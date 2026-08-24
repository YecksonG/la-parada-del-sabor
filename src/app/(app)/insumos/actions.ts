"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  parseProveedorInsumos,
  serializeProveedorInsumos,
} from "@/lib/proveedor-insumos-helper";

export type GuardarInsumoPayload = {
  id?: string;
  nombre: string;
  unidad_medida: "g" | "ml" | "und";
  stock_actual: number;
  stock_minimo: number;
  costo_unitario_usd: number;
  categoria_insumo: string;
  proveedores_ids?: string[];
};

export async function guardarInsumo(payload: GuardarInsumoPayload) {
  const supabase = await createClient();
  let insumoId = payload.id;

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
    const { data, error } = await supabase
      .from("insumos")
      .insert({
        nombre: payload.nombre,
        unidad_medida: payload.unidad_medida,
        stock_actual: payload.stock_actual,
        stock_minimo: payload.stock_minimo,
        costo_unitario_usd: payload.costo_unitario_usd,
        categoria_insumo: payload.categoria_insumo,
      })
      .select("id")
      .single();

    if (error) return { ok: false, error: error.message };
    if (data) insumoId = data.id;
  }

  // Sincronizar proveedores seleccionados si se enviaron
  if (insumoId && payload.proveedores_ids !== undefined) {
    // 1. Sincronización atómica en la tabla puente proveedor_insumos (si existe en DB)
    try {
      await supabase
        .from("proveedor_insumos")
        .delete()
        .eq("insumo_id", insumoId);

      if (payload.proveedores_ids.length > 0) {
        const rows = payload.proveedores_ids.map((provId) => ({
          proveedor_id: provId,
          insumo_id: insumoId,
        }));
        await supabase.from("proveedor_insumos").insert(rows);
      }
    } catch {
      // Ignorar si la tabla puente aún no está migrada en la base de datos
    }

    // 2. Sincronización de respaldo en proveedores.notas
    const { data: proveedores } = await supabase.from("proveedores").select("id, notas");
    if (proveedores) {
      const targetSet = new Set(payload.proveedores_ids);
      for (const prov of proveedores) {
        const { insumos_ids, notas_texto } = parseProveedorInsumos(prov.notas);
        const yaTiene = insumos_ids.includes(insumoId);
        const deberiaTener = targetSet.has(prov.id);

        if (deberiaTener && !yaTiene) {
          const nuevosIds = [...insumos_ids, insumoId];
          await supabase
            .from("proveedores")
            .update({ notas: serializeProveedorInsumos(nuevosIds, notas_texto) })
            .eq("id", prov.id);
        } else if (!deberiaTener && yaTiene) {
          const nuevosIds = insumos_ids.filter((id) => id !== insumoId);
          await supabase
            .from("proveedores")
            .update({ notas: serializeProveedorInsumos(nuevosIds, notas_texto) })
            .eq("id", prov.id);
        }
      }
    }
  }

  revalidatePath("/insumos");
  revalidatePath("/proveedores");
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
