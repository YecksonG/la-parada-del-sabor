"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-guard";

export type GuardarRecetaPayload = {
  producto_id?: string;
  nombre: string;
  categoria_id: string | null;
  descripcion: string;
  precio_usd: number;
  icono: string;
  popular: boolean;
  ingredientes: {
    insumo_id: string;
    cantidad: number; // en gramos, ml o unidades
    notas?: string;
  }[];
};

export async function guardarPlatoYReceta(payload: GuardarRecetaPayload) {
  if (!payload.nombre?.trim()) {
    return { ok: false, error: "El nombre del plato es obligatorio." };
  }
  if (
    typeof payload.precio_usd !== "number" ||
    payload.precio_usd <= 0 ||
    !Number.isFinite(payload.precio_usd)
  ) {
    return { ok: false, error: "El precio debe ser un número mayor a 0." };
  }

  const supabase = await createClient();
  const auth = await requireAuth();
  if (!auth.ok) return { ok: false, error: auth.error };

  let prodId = payload.producto_id;

  // 1. Crear o Actualizar Producto
  if (prodId) {
    const { error: updError } = await supabase
      .from("productos")
      .update({
        nombre: payload.nombre,
        categoria_id: payload.categoria_id,
        descripcion: payload.descripcion || null,
        precio_usd: payload.precio_usd,
        icono: payload.icono,
        popular: payload.popular,
      })
      .eq("id", prodId);

    if (updError) return { ok: false, error: updError.message };
  } else {
    const { data: newProd, error: insError } = await supabase
      .from("productos")
      .insert({
        nombre: payload.nombre,
        categoria_id: payload.categoria_id,
        descripcion: payload.descripcion || null,
        precio_usd: payload.precio_usd,
        icono: payload.icono,
        popular: payload.popular,
      })
      .select("id")
      .single();

    if (insError || !newProd) return { ok: false, error: insError?.message || "Error al crear el producto." };
    prodId = newProd.id;
  }

  // 2. Reemplazar Ingredientes de la Receta
  await supabase.from("recetas_ingredientes").delete().eq("producto_id", prodId);

  if (payload.ingredientes && payload.ingredientes.length > 0) {
    for (const ing of payload.ingredientes) {
      const cant = Number(ing.cantidad);
      if (!Number.isFinite(cant) || cant <= 0) {
        return { ok: false, error: `La cantidad del insumo '${ing.insumo_id}' debe ser un número positivo.` };
      }
    }
    const ingInsert = payload.ingredientes.map((ing) => ({
      producto_id: prodId,
      insumo_id: ing.insumo_id,
      cantidad: Number(ing.cantidad),
      notas: ing.notas || null,
    }));

    const { error: recError } = await supabase.from("recetas_ingredientes").insert(ingInsert);
    if (recError) return { ok: false, error: recError.message };
  }

  revalidatePath("/recetas");
  revalidatePath("/");

  return { ok: true, producto_id: prodId };
}

export async function eliminarPlato(producto_id: string) {
  const supabase = await createClient();
  const auth = await requireAuth();
  if (!auth.ok) return { ok: false, error: auth.error };

  const { error } = await supabase.from("productos").delete().eq("id", producto_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/recetas");
  revalidatePath("/");
  return { ok: true };
}
