"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { TAG_KDS_COLA, limpiarTagKdsCola } from "./constants";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function devolverComandaAColaAction(ventaId: string) {
  if (!ventaId || !UUID_REGEX.test(ventaId)) {
    return { ok: false, error: "Identificador de comanda inválido." };
  }

  const supabase = await createClient();
  const auth = await requireAuth();
  if (!auth.ok) return { ok: false, error: auth.error };

  // 1. Intentar ejecución atómica mediante RPC en Supabase
  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc("rpc_mover_comanda_kds", {
      p_venta_id: ventaId,
      p_destino: "cola",
    });

    if (!rpcErr) {
      if (rpcData && typeof rpcData === "object" && "ok" in rpcData && !rpcData.ok) {
        return { ok: false, error: rpcData.error || "No se pudo devolver la comanda a cola." };
      }
      revalidatePath("/cocina");
      return { ok: true };
    }
  } catch {
    // Si la RPC aún no ha sido aplicada en Supabase, aplicar fallback defensivo
  }

  // 2. Fallback defensivo: Obtener estado actual y validar que esté en preparación
  const { data: venta, error: fetchErr } = await supabase
    .from("ventas")
    .select("id, estado, notas_comanda")
    .eq("id", ventaId)
    .single();

  if (fetchErr || !venta) {
    return { ok: false, error: "No se encontró la comanda." };
  }

  if (venta.estado !== "preparando") {
    return { ok: false, error: "Sólo se pueden devolver a cola comandas que estén en preparación." };
  }

  // Intentar actualizar columna en_cola_kds
  const { error: colErr } = await supabase
    .from("ventas")
    .update({ en_cola_kds: true })
    .eq("id", ventaId);

  if (!colErr) {
    revalidatePath("/cocina");
    return { ok: true };
  }

  // Fallback con bloqueo optimista en notas_comanda
  const notasActuales = venta.notas_comanda || "";
  if (notasActuales.includes(TAG_KDS_COLA)) {
    return { ok: true };
  }

  const notasFinales = notasActuales ? `${notasActuales} ${TAG_KDS_COLA}`.trim() : TAG_KDS_COLA;
  const updateQuery = supabase
    .from("ventas")
    .update({ notas_comanda: notasFinales })
    .eq("id", ventaId);

  if (venta.notas_comanda === null) {
    updateQuery.is("notas_comanda", null);
  } else {
    updateQuery.eq("notas_comanda", venta.notas_comanda);
  }

  const { error: updateErr } = await updateQuery;
  if (updateErr) {
    return { ok: false, error: "Conflicto de concurrencia al actualizar notas. Reintente." };
  }

  revalidatePath("/cocina");
  return { ok: true };
}

export async function moverComandaAPlanchaAction(ventaId: string) {
  if (!ventaId || !UUID_REGEX.test(ventaId)) {
    return { ok: false, error: "Identificador de comanda inválido." };
  }

  const supabase = await createClient();
  const auth = await requireAuth();
  if (!auth.ok) return { ok: false, error: auth.error };

  // 1. Intentar ejecución atómica mediante RPC en Supabase
  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc("rpc_mover_comanda_kds", {
      p_venta_id: ventaId,
      p_destino: "plancha",
    });

    if (!rpcErr) {
      if (rpcData && typeof rpcData === "object" && "ok" in rpcData && !rpcData.ok) {
        return { ok: false, error: rpcData.error || "No se pudo mover la comanda a plancha." };
      }
      revalidatePath("/cocina");
      return { ok: true };
    }
  } catch {
    // Si la RPC aún no ha sido aplicada en Supabase, aplicar fallback defensivo
  }

  // 2. Fallback defensivo
  const { data: venta, error: fetchErr } = await supabase
    .from("ventas")
    .select("id, estado, notas_comanda")
    .eq("id", ventaId)
    .single();

  if (fetchErr || !venta) {
    return { ok: false, error: "No se encontró la comanda." };
  }

  const notasActuales = venta.notas_comanda || "";
  const tieneTagCola = notasActuales.includes(TAG_KDS_COLA);
  const notasLimpias = limpiarTagKdsCola(notasActuales);

  const updatePayload: { estado?: "preparando"; en_cola_kds?: boolean; notas_comanda?: string | null } = {
    en_cola_kds: false,
  };

  if (tieneTagCola) {
    updatePayload.notas_comanda = notasLimpias || null;
  }

  if (venta.estado === "pendiente" || venta.estado === "credito") {
    updatePayload.estado = "preparando";
  }

  const buildQuery = (payload: typeof updatePayload) => {
    const q = supabase.from("ventas").update(payload).eq("id", ventaId);
    if (tieneTagCola) {
      if (venta.notas_comanda === null) {
        q.is("notas_comanda", null);
      } else {
        q.eq("notas_comanda", venta.notas_comanda);
      }
    }
    return q;
  };

  const { error: updateErr } = await buildQuery(updatePayload);

  if (updateErr) {
    // Si falla por columna en_cola_kds inexistente, reintentar sin en_cola_kds
    delete updatePayload.en_cola_kds;
    if (Object.keys(updatePayload).length > 0) {
      const { error: retryErr } = await buildQuery(updatePayload);
      if (retryErr) return { ok: false, error: retryErr.message };
    }
  }

  revalidatePath("/cocina");
  return { ok: true };
}
