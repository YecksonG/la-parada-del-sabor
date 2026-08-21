"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type GuardarInsumoPayload = {
  id?: string;
  nombre: string;
  unidad_medida: "g" | "ml" | "und";
  stock_actual: number;
  stock_minimo: number;
  costo_unitario_usd: number;
  categoria_insumo: string;
};

export async function guardarInsumo(payload: GuardarInsumoPayload) {
  const supabase = await createClient();

  if (payload.id) {
    const { error } = await supabase
      .from("insumos")
      .update({
        nombre: payload.nombre,
        unidad_medida: payload.unidad_medida,
        stock_actual: payload.stock_actual,
        stock_minimo: payload.stock_minimo,
        costo_unitario_usd: payload.costo_unitario_usd,
        categoria_insumo: payload.categoria_insumo,
        actualizado_el: new Date().toISOString(),
      })
      .eq("id", payload.id);

    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("insumos").insert({
      nombre: payload.nombre,
      unidad_medida: payload.unidad_medida,
      stock_actual: payload.stock_actual,
      stock_minimo: payload.stock_minimo,
      costo_unitario_usd: payload.costo_unitario_usd,
      categoria_insumo: payload.categoria_insumo,
    });

    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/insumos");
  revalidatePath("/recetas");
  revalidatePath("/");

  return { ok: true };
}

export async function ajustarStockInsumo(id: string, nuevoStock: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("insumos")
    .update({
      stock_actual: nuevoStock,
      actualizado_el: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/insumos");
  revalidatePath("/");
  return { ok: true };
}
