"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ItemPedidoWeb = {
  producto_id: string;
  cantidad: number;
  notas_item?: string;
  extras_ids?: string[];
};

export type PayloadPedidoWeb = {
  nombre_cliente: string;
  telefono: string;
  tipo_entrega: "pickup" | "delivery" | "puerta_cerrada";
  direccion_delivery?: string;
  metodo_pago: string;
  notas_pedido?: string;
  items: ItemPedidoWeb[];
};

export async function crearPedidoWebPublico(payload: PayloadPedidoWeb) {
  if (!payload.nombre_cliente?.trim()) {
    return { ok: false, error: "Por favor indica tu nombre." };
  }
  if (!payload.telefono?.trim()) {
    return { ok: false, error: "Por favor indica tu número de teléfono / WhatsApp." };
  }
  if (!payload.items || payload.items.length === 0) {
    return { ok: false, error: "Tu pedido no tiene productos seleccionados." };
  }
  if (payload.tipo_entrega === "delivery" && !payload.direccion_delivery?.trim()) {
    return { ok: false, error: "Por favor ingresa la dirección exacta para el delivery." };
  }

  // G2 Fix: Validación estricta de cantidades en el servidor (rango 1..50, enteros)
  for (const item of payload.items) {
    if (
      typeof item.cantidad !== "number" ||
      !Number.isInteger(item.cantidad) ||
      item.cantidad < 1 ||
      item.cantidad > 50
    ) {
      return { ok: false, error: "Cantidad no válida para uno de los productos seleccionados." };
    }
  }

  const supabase = await createClient();

  // Inserción atómica autoritativa mediante RPC con SECURITY DEFINER
  const { data: rpcRes, error: rpcError } = await supabase.rpc("fn_crear_pedido_web", {
    p_payload: payload,
  });

  if (rpcError) {
    console.error("Error RPC creando pedido web:", rpcError);
    return { ok: false, error: "No se pudo registrar el pedido. Por favor verifica los datos e intenta nuevamente." };
  }

  if (!rpcRes?.ok) {
    return { ok: false, error: rpcRes?.error || "Error al procesar el pedido." };
  }

  revalidatePath("/ventas");
  revalidatePath("/");

  return {
    ok: true,
    venta_id: rpcRes.venta_id,
    numero_comanda: rpcRes.numero_comanda,
  };
}
