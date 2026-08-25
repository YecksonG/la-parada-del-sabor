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

  const supabase = await createClient();

  // 1. Obtener tasa BCV oficial más reciente
  const { data: tasaData } = await supabase
    .from("tasas_cambio")
    .select("bcv_usd_bs")
    .order("fecha", { ascending: false })
    .limit(1)
    .maybeSingle();

  const tasaBcv = Number(tasaData?.bcv_usd_bs) || 1;

  // 2. Obtener precios autoritativos de la BD (evitando manipulación en el cliente)
  const productosIds = payload.items.map((i) => i.producto_id);
  const { data: productosDb } = await supabase
    .from("productos")
    .select("id, nombre, precio_usd, activo")
    .in("id", productosIds)
    .eq("activo", true);

  if (!productosDb || productosDb.length === 0) {
    return { ok: false, error: "Algunos productos seleccionados ya no están disponibles." };
  }

  const productosMap = new Map(productosDb.map((p) => [p.id, p]));

  // Obtener extras de la BD
  const allExtrasIds = payload.items.flatMap((i) => i.extras_ids || []);
  const { data: extrasDb } = allExtrasIds.length > 0
    ? await supabase
        .from("extras_modificadores")
        .select("id, nombre, precio_extra_usd, activo")
        .in("id", allExtrasIds)
        .eq("activo", true)
    : { data: [] };

  const extrasMap = new Map((extrasDb || []).map((e) => [e.id, e]));

  // 3. Crear o actualizar cliente
  let clienteId: string | null = null;
  const telefonoLimpio = payload.telefono.trim();

  const { data: clienteExistente } = await supabase
    .from("clientes")
    .select("id")
    .eq("telefono", telefonoLimpio)
    .maybeSingle();

  if (clienteExistente) {
    clienteId = clienteExistente.id;
    if (payload.tipo_entrega === "delivery" && payload.direccion_delivery) {
      await supabase
        .from("clientes")
        .update({
          nombre: payload.nombre_cliente.trim(),
          direccion_delivery: payload.direccion_delivery.trim(),
        })
        .eq("id", clienteId);
    }
  } else {
    const { data: nuevoCliente } = await supabase
      .from("clientes")
      .insert({
        nombre: payload.nombre_cliente.trim(),
        telefono: telefonoLimpio,
        direccion_delivery: payload.direccion_delivery?.trim() || null,
        total_pedidos: 1,
      })
      .select("id")
      .single();

    if (nuevoCliente) {
      clienteId = nuevoCliente.id;
    }
  }

  // 4. Calcular totales autoritativos
  let totalCalculadoUsd = 0;

  for (const item of payload.items) {
    const prod = productosMap.get(item.producto_id);
    if (!prod) continue;

    const precioBase = Number((prod as any).precio_usd || (prod as any).pvp_usd || 0);
    const subtotalProd = precioBase * item.cantidad;
    totalCalculadoUsd += subtotalProd;

    if (item.extras_ids && item.extras_ids.length > 0) {
      for (const extraId of item.extras_ids) {
        const ext = extrasMap.get(extraId);
        if (ext) {
          totalCalculadoUsd += Number(ext.precio_extra_usd || 0) * item.cantidad;
        }
      }
    }
  }

  const totalCalculadoBs = Number((totalCalculadoUsd * tasaBcv).toFixed(2));

  // 5. Insertar venta en estado 'pendiente'
  const { data: venta, error: ventaError } = await supabase
    .from("ventas")
    .insert({
      cliente_id: clienteId,
      tasa_bcv: tasaBcv,
      metodo_pago: payload.metodo_pago,
      tipo_entrega: payload.tipo_entrega,
      estado: "pendiente", // Pedido Web pendiente por verificar en caja
      notas_comanda: payload.notas_pedido || null,
      creado_por: "web_cliente",
      total_usd: Number(totalCalculadoUsd.toFixed(2)),
      total_bs: totalCalculadoBs,
    })
    .select("id, numero_comanda")
    .single();

  if (ventaError || !venta) {
    console.error("Error creando pedido web:", ventaError);
    return { ok: false, error: "No se pudo registrar el pedido. Intenta nuevamente." };
  }

  // 6. Insertar items y extras
  for (const item of payload.items) {
    const prod = productosMap.get(item.producto_id);
    if (!prod) continue;

    const precioUnitario = Number((prod as any).precio_usd || (prod as any).pvp_usd || 0);
    const subtotalItem = Number((precioUnitario * item.cantidad).toFixed(2));

    const { data: ventaItem } = await supabase
      .from("ventas_items")
      .insert({
        venta_id: venta.id,
        producto_id: item.producto_id,
        cantidad: item.cantidad,
        precio_unitario_usd: precioUnitario,
        subtotal_usd: subtotalItem,
        notas_item: item.notas_item || null,
      })
      .select("id")
      .single();

    if (ventaItem && item.extras_ids && item.extras_ids.length > 0) {
      const extrasInsert: {
        venta_item_id: string;
        extra_id: string;
        cantidad: number;
        precio_unitario_usd: number;
        subtotal_usd: number;
      }[] = [];

      for (const extraId of item.extras_ids) {
        const ext = extrasMap.get(extraId);
        if (ext) {
          extrasInsert.push({
            venta_item_id: ventaItem.id,
            extra_id: extraId,
            cantidad: item.cantidad,
            precio_unitario_usd: Number(ext.precio_extra_usd || 0),
            subtotal_usd: Number((Number(ext.precio_extra_usd || 0) * item.cantidad).toFixed(2)),
          });
        }
      }

      if (extrasInsert.length > 0) {
        await supabase.from("ventas_items_extras").insert(extrasInsert);
      }
    }
  }

  revalidatePath("/ventas");
  revalidatePath("/");

  return {
    ok: true,
    venta_id: venta.id,
    numero_comanda: venta.numero_comanda,
  };
}
