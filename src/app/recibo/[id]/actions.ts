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

  if (!rpcError && rpcData?.id) {
    return { ok: true, venta: rpcData };
  }

  // 2. Fallback por consulta estructurada
  const { data: directData, error: directError } = await supabase
    .from("ventas")
    .select(`
      id,
      numero_comanda,
      fecha,
      total_usd,
      total_bs,
      tasa_bcv,
      metodo_pago,
      tipo_entrega,
      estado,
      notas_comanda,
      creado_por,
      cliente:clientes (
        id,
        nombre,
        telefono,
        direccion_delivery
      ),
      items:ventas_items (
        id,
        producto_id,
        cantidad,
        precio_unitario_usd,
        subtotal_usd,
        notas_item,
        producto:productos (
          id,
          nombre,
          icono
        ),
        extras:ventas_items_extras (
          id,
          cantidad,
          precio_unitario_usd,
          subtotal_usd,
          extra:extras_modificadores (
            id,
            nombre
          )
        )
      )
    `)
    .eq("id", id)
    .single();

  if (directError || !directData) {
    return { ok: false, error: directError?.message || "No se encontró el comprobante." };
  }

  return { ok: true, venta: directData };
}
