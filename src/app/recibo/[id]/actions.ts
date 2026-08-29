"use server";

import { createClient } from "@/lib/supabase/server";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function obtenerEstadoRecibo(id: string) {
  if (!id || !UUID_REGEX.test(id)) {
    return { ok: false, error: "Identificador no válido." };
  }

  const supabase = await createClient();

  // 1. Intento por RPC autoritativo
  const { data: rpcData, error: rpcError } = await supabase.rpc("fn_obtener_recibo_publico", {
    p_venta_id: id,
  });

  if (rpcError || !rpcData?.id) {
    return { ok: false, error: rpcError?.message || "No se encontró el comprobante." };
  }

  return { ok: true, venta: rpcData };
}
