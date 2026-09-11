"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-guard";
import type { MetodoPago } from "@/types/database";

export type EstadoVenta = "pendiente" | "preparando" | "lista" | "completada" | "cancelada" | "credito";

const METODOS_PAGO_VALIDOS: MetodoPago[] = [
  "pago_movil",
  "pago_movil_bs",
  "efectivo_usd",
  "efectivo_bs",
  "transferencia",
  "binance",
  "zelle",
  "pago_mixto",
  "credito",
];

const TRANSICIONES_VALIDAS: Record<EstadoVenta, EstadoVenta[]> = {
  pendiente: ["preparando", "cancelada", "credito"],
  preparando: ["lista", "completada", "cancelada", "credito"],
  lista: ["completada", "cancelada", "credito"],
  credito: ["completada", "cancelada", "preparando", "lista"],
  completada: ["cancelada", "credito"],
  cancelada: ["preparando", "credito"],
};

export async function cambiarEstadoVenta(venta_id: string, nuevoEstado: EstadoVenta) {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!venta_id || !UUID_REGEX.test(venta_id)) {
    return { ok: false, error: "Identificador de venta no válido." };
  }

  const supabase = await createClient();
  const auth = await requireAuth();
  if (!auth.ok) return { ok: false, error: auth.error };

  // 1. Obtener estado actual y verificar existencia
  const { data: ventaActual, error: errorFetch } = await supabase
    .from("ventas")
    .select("id, estado")
    .eq("id", venta_id)
    .single();

  if (errorFetch || !ventaActual) {
    return { ok: false, error: "La comanda no existe o no se pudo encontrar." };
  }

  // 2. Validar transición de estado
  const permitidos = TRANSICIONES_VALIDAS[ventaActual.estado as EstadoVenta] || [];
  if (!permitidos.includes(nuevoEstado)) {
    return {
      ok: false,
      error: `Transición no permitida: no se puede cambiar de '${ventaActual.estado}' a '${nuevoEstado}'.`,
    };
  }

  // 3. Actualizar estado
  const { error: errorUpdate } = await supabase
    .from("ventas")
    .update({ estado: nuevoEstado })
    .eq("id", venta_id);

  if (errorUpdate) return { ok: false, error: errorUpdate.message };

  revalidatePath("/ventas");
  revalidatePath("/caja");
  revalidatePath("/dashboard");
  revalidatePath("/insumos");
  revalidatePath("/");

  return { ok: true };
}

export async function actualizarMetodoPagoVenta(
  venta_id: string,
  nuevoMetodoPago: MetodoPago,
  cliente_id?: string | null
) {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!venta_id || !UUID_REGEX.test(venta_id)) {
    return { ok: false, error: "Identificador de venta no válido." };
  }

  if (!METODOS_PAGO_VALIDOS.includes(nuevoMetodoPago)) {
    return { ok: false, error: "Método de pago no válido." };
  }

  if (nuevoMetodoPago === "pago_mixto") {
    return { ok: false, error: "El pago mixto solo puede ser configurado con su desglose desde el POS o editar comanda." };
  }

  const supabase = await createClient();
  const auth = await requireAuth();
  if (!auth.ok) return { ok: false, error: auth.error };

  // 1. Obtener la venta actual
  const { data: ventaActual, error: errorFetch } = await supabase
    .from("ventas")
    .select("id, estado, cliente_id")
    .eq("id", venta_id)
    .single();

  if (errorFetch || !ventaActual) {
    return { ok: false, error: "La comanda no existe o no se pudo encontrar." };
  }

  const updateData: Record<string, any> = { metodo_pago: nuevoMetodoPago };

  if (nuevoMetodoPago === "credito") {
    updateData.estado = "credito";
    if (cliente_id) {
      updateData.cliente_id = cliente_id;
    }
  } else if (ventaActual.estado === "credito") {
    // Si estaba a crédito y ahora se cambia a otro método (ej: efectivo, pago móvil),
    // se da por completada/pagada
    updateData.estado = "completada";
    if (cliente_id !== undefined) {
      updateData.cliente_id = cliente_id;
    }
  } else if (cliente_id !== undefined) {
    updateData.cliente_id = cliente_id;
  }

  const { error } = await supabase
    .from("ventas")
    .update(updateData)
    .eq("id", venta_id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/ventas");
  revalidatePath("/caja");
  revalidatePath("/clientes");
  revalidatePath("/dashboard");
  revalidatePath("/");

  return { ok: true };
}

export type ActualizarComandaPayload = {
  venta_id: string;
  tipo_entrega: "puerta_cerrada" | "mesa" | "pickup" | "delivery";
  delivery_monto_usd?: number;
  delivery_zona_nombre?: string | null;
  direccion_delivery?: string | null;
  metodo_pago: MetodoPago;
  notas_comanda?: string | null;
  cliente_id?: string | null;
};

export async function actualizarDetallesComanda(payload: ActualizarComandaPayload) {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!payload.venta_id || !UUID_REGEX.test(payload.venta_id)) {
    return { ok: false, error: "Identificador de venta no válido." };
  }

  if (!METODOS_PAGO_VALIDOS.includes(payload.metodo_pago)) {
    return { ok: false, error: "Método de pago no válido." };
  }

  if (payload.metodo_pago === "pago_mixto") {
    const tieneTag = /\[Pago Mixto:\s*[^\]]+\]/i.test(payload.notas_comanda || "");
    if (!tieneTag) {
      return { ok: false, error: "No se puede establecer pago mixto sin su desglose detallado." };
    }
  }

  const supabase = await createClient();
  const auth = await requireAuth();
  if (!auth.ok) return { ok: false, error: auth.error };

  // 1. Obtener la venta actual y sus items para recalcular totales con precisión
  const { data: venta, error: errorFetch } = await supabase
    .from("ventas")
    .select("id, total_usd, total_bs, tasa_bcv, tipo_entrega, delivery_monto_usd, estado, cliente_id, items:ventas_items(subtotal_usd)")
    .eq("id", payload.venta_id)
    .single();

  if (errorFetch || !venta) {
    return { ok: false, error: "No se pudo encontrar la comanda a editar." };
  }

  const tasaBcv = Number(venta.tasa_bcv) || 1;
  const esDelivery = payload.tipo_entrega === "delivery";
  const nuevoDeliveryUsd = esDelivery ? Math.max(0, Number(payload.delivery_monto_usd) || 0) : 0;
  const nuevoDeliveryBs = Number((nuevoDeliveryUsd * tasaBcv).toFixed(2));

  // Subtotal base de los items (comida)
  const subtotalItemsUsd = (venta.items || []).reduce(
    (acc: number, item: any) => acc + (Number(item.subtotal_usd) || 0),
    0
  );

  // Si no hay items registrados (o items dan 0), tomar el total anterior restándole el delivery anterior
  const deliveryAnteriorUsd = Number(venta.delivery_monto_usd) || 0;
  const comidaBaseUsd = subtotalItemsUsd > 0 ? subtotalItemsUsd : Math.max(0, Number(venta.total_usd) - deliveryAnteriorUsd);

  const nuevoTotalUsd = Number((comidaBaseUsd + nuevoDeliveryUsd).toFixed(2));
  const nuevoTotalBs = Number((nuevoTotalUsd * tasaBcv).toFixed(2));

  let nuevoEstado = venta.estado;
  if (payload.metodo_pago === "credito") {
    nuevoEstado = "credito";
  } else if (venta.estado === "credito") {
    // Si estaba a crédito y se cambia a otro método, pasa a completada
    nuevoEstado = "completada";
  }

  const updateFields: Record<string, any> = {
    tipo_entrega: payload.tipo_entrega,
    delivery_monto_usd: nuevoDeliveryUsd,
    delivery_monto_bs: nuevoDeliveryBs,
    total_usd: nuevoTotalUsd,
    total_bs: nuevoTotalBs,
    metodo_pago: payload.metodo_pago,
    estado: nuevoEstado,
    notas_comanda: payload.notas_comanda ? payload.notas_comanda.trim() : null,
    direccion_delivery: payload.direccion_delivery ? payload.direccion_delivery.trim() : null,
  };

  if (payload.cliente_id !== undefined) {
    updateFields.cliente_id = payload.cliente_id;
  }

  if (payload.delivery_zona_nombre !== undefined) {
    updateFields.delivery_zona_nombre = payload.delivery_zona_nombre ? payload.delivery_zona_nombre.trim() : null;
  }

  const { error: errorUpdate } = await supabase
    .from("ventas")
    .update(updateFields)
    .eq("id", payload.venta_id);

  if (errorUpdate) return { ok: false, error: errorUpdate.message };

  revalidatePath("/ventas");
  revalidatePath("/caja");
  revalidatePath("/clientes");
  revalidatePath("/dashboard");
  revalidatePath("/");

  return { ok: true, total_usd: nuevoTotalUsd, total_bs: nuevoTotalBs, estado: nuevoEstado };
}
