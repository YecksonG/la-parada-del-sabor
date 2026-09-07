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

export type RegistrarProduccionPayload = {
  insumoProducidoId: string;
  cantidadProducida: number;
  insumoMateriaPrimaId?: string | null;
  cantidadMateriaPrima?: number;
  nuevoCostoUnitarioUsd?: number | null;
};

export async function registrarProduccionGuiso(payload: RegistrarProduccionPayload) {
  if (!payload.insumoProducidoId || typeof payload.insumoProducidoId !== "string") {
    return { ok: false, error: "ID de insumo producido no proporcionado." };
  }
  if (
    typeof payload.cantidadProducida !== "number" ||
    payload.cantidadProducida <= 0 ||
    !Number.isFinite(payload.cantidadProducida)
  ) {
    return { ok: false, error: "La cantidad producida debe ser un número mayor a 0." };
  }
  if (
    payload.insumoMateriaPrimaId &&
    payload.insumoMateriaPrimaId === payload.insumoProducidoId
  ) {
    return { ok: false, error: "La materia prima no puede ser el mismo insumo producido." };
  }
  if (
    payload.insumoMateriaPrimaId &&
    (typeof payload.cantidadMateriaPrima !== "number" ||
      payload.cantidadMateriaPrima <= 0 ||
      !Number.isFinite(payload.cantidadMateriaPrima))
  ) {
    return { ok: false, error: "La cantidad de materia prima utilizada debe ser un número válido mayor a 0." };
  }

  const supabase = await createClient();
  const auth = await requireAuth();
  if (!auth.ok) return { ok: false, error: auth.error };

  // 1. Intentar RPC transaccional atómica en PostgreSQL
  const { data: rpcData, error: rpcError } = await supabase.rpc("fn_registrar_produccion_guiso", {
    p_insumo_producido_id: payload.insumoProducidoId,
    p_cantidad_producida: payload.cantidadProducida,
    p_insumo_materia_prima_id: payload.insumoMateriaPrimaId || null,
    p_cantidad_materia_prima: payload.cantidadMateriaPrima || null,
    p_costo_lote_usd: payload.nuevoCostoUnitarioUsd || null,
  });

  if (!rpcError && rpcData) {
    if (rpcData.ok === false) {
      return { ok: false, error: rpcData.error || "Error al procesar la producción en base de datos." };
    }
    revalidatePath("/insumos");
    revalidatePath("/recetas");
    revalidatePath("/");
    return { ok: true };
  }

  // Si hubo un error en RPC que NO sea "función no encontrada" (PGRST202), abortar directamente
  if (rpcError && rpcError.code !== "PGRST202") {
    return { ok: false, error: rpcError.message || "Error al ejecutar producción en base de datos." };
  }

  // 2. Fallback transaccional estricto y tipado (si la función RPC aún no ha sido creada en Supabase)
  // Paso A: Validar existencia del insumo producido antes de cualquier DML
  const { data: prodData, error: prodErr } = await supabase
    .from("insumos")
    .select("id, nombre, stock_actual, costo_unitario_usd")
    .eq("id", payload.insumoProducidoId)
    .single();

  if (prodErr || !prodData) {
    return { ok: false, error: prodErr?.message || "Insumo producido no encontrado." };
  }

  let mpOriginalStock: number | null = null;
  let nuevoStockMp: number | null = null;

  // Paso B: Validar existencia y disponibilidad de la materia prima antes de cualquier DML
  if (payload.insumoMateriaPrimaId && payload.cantidadMateriaPrima) {
    const { data: mpData, error: mpErr } = await supabase
      .from("insumos")
      .select("id, nombre, stock_actual")
      .eq("id", payload.insumoMateriaPrimaId)
      .single();

    if (mpErr || !mpData) {
      return { ok: false, error: mpErr?.message || "Insumo de materia prima no encontrado." };
    }

    mpOriginalStock = Number(mpData.stock_actual || 0);
    nuevoStockMp = mpOriginalStock - Number(payload.cantidadMateriaPrima);

    if (nuevoStockMp < 0) {
      return {
        ok: false,
        error: `Stock insuficiente de materia prima (${mpData.nombre}): disponible ${mpOriginalStock}, requerido ${payload.cantidadMateriaPrima}.`,
      };
    }
  }

  // Paso C: Ejecutar descuento de materia prima con bloqueo optimista
  if (payload.insumoMateriaPrimaId && nuevoStockMp !== null && mpOriginalStock !== null) {
    const { data: updatedMpRows, error: errUpdateMp } = await supabase
      .from("insumos")
      .update({
        stock_actual: nuevoStockMp,
        actualizado_el: new Date().toISOString(),
      })
      .eq("id", payload.insumoMateriaPrimaId)
      .eq("stock_actual", mpOriginalStock)
      .select("id");

    if (errUpdateMp || !updatedMpRows || updatedMpRows.length === 0) {
      return {
        ok: false,
        error: errUpdateMp
          ? `Error al descontar materia prima: ${errUpdateMp.message}`
          : "Conflicto de concurrencia: el stock de la materia prima fue modificado simultáneamente por otra operación.",
      };
    }
  }

  // Paso D: Calcular nuevo stock y costo PPMC del insumo producido
  const nuevoStockProducido = Number(prodData.stock_actual || 0) + Number(payload.cantidadProducida);

  let nuevoCostoFinal: number | undefined;
  if (
    typeof payload.nuevoCostoUnitarioUsd === "number" &&
    payload.nuevoCostoUnitarioUsd > 0 &&
    Number.isFinite(payload.nuevoCostoUnitarioUsd)
  ) {
    const stockPrevio = Number(prodData.stock_actual || 0);
    const costoPrevio = Number(prodData.costo_unitario_usd || 0);
    if (stockPrevio > 0 && costoPrevio > 0) {
      nuevoCostoFinal = Number(
        (((stockPrevio * costoPrevio) + (payload.cantidadProducida * payload.nuevoCostoUnitarioUsd)) / nuevoStockProducido).toFixed(6)
      );
    } else {
      nuevoCostoFinal = Number(payload.nuevoCostoUnitarioUsd.toFixed(6));
    }
  }

  type InsumoUpdateFields = {
    stock_actual: number;
    actualizado_el: string;
    costo_unitario_usd?: number;
  };

  const updateProd: InsumoUpdateFields = {
    stock_actual: nuevoStockProducido,
    actualizado_el: new Date().toISOString(),
  };

  if (nuevoCostoFinal !== undefined && nuevoCostoFinal > 0) {
    updateProd.costo_unitario_usd = nuevoCostoFinal;
  }

  const { error: errUpdateProd } = await supabase
    .from("insumos")
    .update(updateProd)
    .eq("id", payload.insumoProducidoId);

  if (errUpdateProd) {
    // Reversión compensatoria en caso de fallo con captura estricta de error
    if (payload.insumoMateriaPrimaId && mpOriginalStock !== null && nuevoStockMp !== null) {
      const { error: errRollback } = await supabase
        .from("insumos")
        .update({ stock_actual: mpOriginalStock, actualizado_el: new Date().toISOString() })
        .eq("id", payload.insumoMateriaPrimaId)
        .eq("stock_actual", nuevoStockMp);

      if (errRollback) {
        return {
          ok: false,
          error: `Error crítico: falló registrar producción (${errUpdateProd.message}) y falló reversión de materia prima (${errRollback.message}).`,
        };
      }
    }
    return { ok: false, error: `Error al registrar producción: ${errUpdateProd.message}` };
  }

  revalidatePath("/insumos");
  revalidatePath("/recetas");
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
