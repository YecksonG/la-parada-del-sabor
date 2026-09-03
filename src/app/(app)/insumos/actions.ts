"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-guard";
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
  if (!payload.nombre?.trim()) {
    return { ok: false, error: "El nombre del insumo es obligatorio." };
  }
  if (!["g", "ml", "und"].includes(payload.unidad_medida)) {
    return { ok: false, error: "Unidad de medida no válida. Debe ser 'g', 'ml' o 'und'." };
  }
  if (
    typeof payload.stock_actual !== "number" ||
    payload.stock_actual < 0 ||
    !Number.isFinite(payload.stock_actual)
  ) {
    return { ok: false, error: "El stock actual debe ser un número no negativo." };
  }
  if (
    typeof payload.costo_unitario_usd !== "number" ||
    payload.costo_unitario_usd < 0 ||
    !Number.isFinite(payload.costo_unitario_usd)
  ) {
    return { ok: false, error: "El costo unitario debe ser un número no negativo." };
  }

  const supabase = await createClient();
  const auth = await requireAuth();
  if (!auth.ok) return { ok: false, error: auth.error };

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
    // 1. Intentar vía RPC transaccional atómica
    const { error: rpcError } = await supabase.rpc("sincronizar_insumo_proveedores", {
      p_insumo_id: insumoId,
      p_proveedores_ids: payload.proveedores_ids,
    });

    // 2. Fallback directo a la tabla puente preservando precios existentes
    if (rpcError) {
      // Eliminar solo las filas que ya NO están en el nuevo arreglo de proveedores
      if (payload.proveedores_ids.length > 0) {
        const { error: delErr } = await supabase
          .from("proveedor_insumos")
          .delete()
          .eq("insumo_id", insumoId)
          .not("proveedor_id", "in", payload.proveedores_ids);

        if (delErr) {
          console.error("Error al eliminar proveedor_insumos obsoletos desde insumo:", delErr.message);
        }
      } else {
        // Si se deseleccionaron todos, eliminar todo
        const { error: delErr } = await supabase
          .from("proveedor_insumos")
          .delete()
          .eq("insumo_id", insumoId);

        if (delErr) {
          console.error("Error al eliminar proveedor_insumos desde insumo:", delErr.message);
        }
      }

      // Upsert los proveedores seleccionados (NO sobrescribe precio_referencial_usd si ya existe)
      if (payload.proveedores_ids.length > 0) {
        const rows = payload.proveedores_ids.map((provId) => ({
          proveedor_id: provId,
          insumo_id: insumoId,
        }));
        const { error: insErr } = await supabase
          .from("proveedor_insumos")
          .upsert(rows, { onConflict: "proveedor_id,insumo_id", ignoreDuplicates: true });
        if (insErr && insErr.code !== "PGRST204" && insErr.code !== "42P01") {
          console.error("Error al sincronizar proveedor_insumos desde insumo:", insErr.message);
        }
      }
    }

    // 3. Sincronización de respaldo en proveedores.notas
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
  if (!id || typeof id !== "string") {
    return { ok: false, error: "ID de insumo no proporcionado." };
  }
  if (typeof nuevoStock !== "number" || nuevoStock < 0 || !Number.isFinite(nuevoStock)) {
    return { ok: false, error: "El stock debe ser un número no negativo." };
  }

  const supabase = await createClient();
  const auth = await requireAuth();
  if (!auth.ok) return { ok: false, error: auth.error };

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

export async function eliminarInsumo(id: string) {
  if (!id || typeof id !== "string") {
    return { ok: false, error: "ID de insumo no proporcionado." };
  }

  const supabase = await createClient();
  const auth = await requireAuth();
  if (!auth.ok) return { ok: false, error: auth.error };

  const { data, error } = await supabase.rpc("fn_eliminar_insumo_seguro", {
    p_insumo_id: id,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  if (data && data.ok === false) {
    return { ok: false, error: data.error };
  }

  revalidatePath("/insumos");
  revalidatePath("/recetas");
  revalidatePath("/proveedores");
  revalidatePath("/");
  return { ok: true };
}
