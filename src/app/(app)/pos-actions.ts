"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-guard";

export type CartItemExtra = {
  extra_id: string;
  nombre: string;
  precio_unitario_usd: number;
  cantidad: number;
};

export type CartItem = {
  producto_id: string;
  nombre: string;
  precio_unitario_usd: number;
  cantidad: number;
  notas_item?: string;
  extras?: CartItemExtra[];
};

export type RegistrarVentaPayload = {
  cliente_id?: string | null;
  metodo_pago: string;
  tipo_entrega: string;
  delivery_zona_id?: string | null;
  delivery_zona_nombre?: string | null;
  delivery_tarifa_usd?: number;
  direccion_delivery?: string | null;
  tasa_bcv: number;
  notas_comanda?: string;
  items: CartItem[];
};

export async function crearClienteRapido(payload: {
  nombre: string;
  telefono?: string;
  direccion_delivery?: string;
}) {
  if (!payload.nombre?.trim()) {
    return { ok: false, error: "El nombre del cliente es obligatorio." };
  }

  const supabase = await createClient();
  const auth = await requireAuth();
  if (!auth.ok) return { ok: false, error: auth.error };

  const { data, error } = await supabase
    .from("clientes")
    .insert({
      nombre: payload.nombre.trim(),
      telefono: payload.telefono?.trim() || null,
      direccion_delivery: payload.direccion_delivery?.trim() || null,
      total_pedidos: 0,
    })
    .select("*")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/clientes");
  revalidatePath("/");
  return { ok: true, cliente: data };
}

export async function registrarVentaPos(payload: RegistrarVentaPayload) {
  if (!payload.items || payload.items.length === 0) {
    return { ok: false, error: "La comanda no tiene ningún producto agregado." };
  }

  // Validación de cantidad en servidor (1..50 unidades enteras por item en POS)
  for (const item of payload.items) {
    if (
      typeof item.cantidad !== "number" ||
      !Number.isInteger(item.cantidad) ||
      item.cantidad < 1 ||
      item.cantidad > 50
    ) {
      return { ok: false, error: "La cantidad por producto en POS debe ser un número entero entre 1 y 50 unidades." };
    }
  }

  const supabase = await createClient();
  const auth = await requireAuth();
  if (!auth.ok) return { ok: false, error: auth.error };

  const nombreOperador = auth.user?.email?.split("@")[0] ?? "cajero";

  // 0. Revalidar precios reales de la base de datos (seguridad financiera)
  const productIds = Array.from(new Set(payload.items.map((it) => it.producto_id)));
  const { data: dbProducts } = await supabase
    .from("productos")
    .select("id, precio_usd")
    .in("id", productIds);

  const productPriceMap = new Map<string, number>();
  (dbProducts || []).forEach((p) => {
    productPriceMap.set(p.id, Number(p.precio_usd) || 0);
  });

  const extraIds = Array.from(
    new Set(
      payload.items.flatMap((it) => (it.extras || []).map((e) => e.extra_id))
    )
  );

  const extraPriceMap = new Map<string, number>();
  if (extraIds.length > 0) {
    const { data: dbExtras } = await supabase
      .from("extras_modificadores")
      .select("id, precio_extra_usd")
      .in("id", extraIds);
    (dbExtras || []).forEach((e) => {
      extraPriceMap.set(e.id, Number(e.precio_extra_usd) || 0);
    });
  }

  // Calcular totales directamente en el servidor con precios de DB
  let totalUsdCalculado = 0;
  for (const item of payload.items) {
    const precioProd = productPriceMap.has(item.producto_id)
      ? productPriceMap.get(item.producto_id)!
      : Number(item.precio_unitario_usd) || 0;
    const subtotalItem = Number((precioProd * item.cantidad).toFixed(2));
    let subtotalExtras = 0;
    if (item.extras && item.extras.length > 0) {
      for (const ext of item.extras) {
        const precioExt = extraPriceMap.has(ext.extra_id)
          ? extraPriceMap.get(ext.extra_id)!
          : Number(ext.precio_unitario_usd) || 0;
        subtotalExtras += Number((precioExt * ext.cantidad).toFixed(2));
      }
    }
    totalUsdCalculado += subtotalItem + subtotalExtras;
  }

  const tarifaDeliveryUsd =
    payload.tipo_entrega === "delivery" && Number(payload.delivery_tarifa_usd) > 0
      ? Number(payload.delivery_tarifa_usd)
      : 0;

  totalUsdCalculado += tarifaDeliveryUsd;
  totalUsdCalculado = Number(totalUsdCalculado.toFixed(2));
  const tasaBCV = Number(payload.tasa_bcv) > 0 ? Number(payload.tasa_bcv) : 1;
  const totalBsCalculado = Number((totalUsdCalculado * tasaBCV).toFixed(2));
  const deliveryBs = tarifaDeliveryUsd > 0 ? Number((tarifaDeliveryUsd * tasaBCV).toFixed(2)) : null;

  // 1. Insertar Cabecera de Venta
  const { data: venta, error: ventaError } = await supabase
    .from("ventas")
    .insert({
      cliente_id: payload.cliente_id || null,
      tasa_bcv: tasaBCV,
      metodo_pago: payload.metodo_pago,
      tipo_entrega: payload.tipo_entrega,
      delivery_zona_id: payload.delivery_zona_id || null,
      delivery_zona_nombre: payload.delivery_zona_nombre || null,
      delivery_monto_usd: tarifaDeliveryUsd > 0 ? tarifaDeliveryUsd : null,
      delivery_monto_bs: deliveryBs,
      direccion_delivery: payload.direccion_delivery || null,
      estado: "preparando",
      notas_comanda: payload.notas_comanda || null,
      creado_por: nombreOperador,
      origen_pedido: "pos",
      total_usd: totalUsdCalculado,
      total_bs: totalBsCalculado,
    })
    .select("id, numero_comanda")
    .single();

  if (ventaError || !venta) {
    return { ok: false, error: ventaError?.message || "Error al crear la comanda en base de datos." };
  }

  // 2. Insertar Items de Venta (Disparará la deducción atómica de gramos de insumos de recetas)
  for (const item of payload.items) {
    const precioProd = productPriceMap.has(item.producto_id)
      ? productPriceMap.get(item.producto_id)!
      : Number(item.precio_unitario_usd) || 0;
    const subtotalItem = Number((precioProd * item.cantidad).toFixed(2));
    const precioUnitarioBs = Number((precioProd * tasaBCV).toFixed(2));
    const subtotalBs = Number((subtotalItem * tasaBCV).toFixed(2));

    const { data: ventaItem, error: itemError } = await supabase
      .from("ventas_items")
      .insert({
        venta_id: venta.id,
        producto_id: item.producto_id,
        cantidad: item.cantidad,
        precio_unitario_usd: precioProd,
        precio_unitario_bs: precioUnitarioBs,
        subtotal_usd: subtotalItem,
        subtotal_bs: subtotalBs,
        notas_item: item.notas_item ? item.notas_item.trim().slice(0, 150) : null,
      })
      .select("id")
      .single();

    if (itemError || !ventaItem) {
      console.error("Error insertando item de venta:", itemError);
      continue;
    }

    // 3. Insertar Extras si tiene (Disparará la deducción de gramos de extras)
    if (item.extras && item.extras.length > 0) {
      const extrasInsert = item.extras.map((ext) => {
        const precioExt = extraPriceMap.has(ext.extra_id)
          ? extraPriceMap.get(ext.extra_id)!
          : Number(ext.precio_unitario_usd) || 0;
        const subtotalExtraUsd = Number((precioExt * ext.cantidad).toFixed(2));
        return {
          venta_item_id: ventaItem.id,
          extra_id: ext.extra_id,
          cantidad: ext.cantidad,
          precio_extra_usd: precioExt,
          precio_extra_bs: Number((precioExt * tasaBCV).toFixed(2)),
          precio_unitario_usd: precioExt,
          precio_unitario_bs: Number((precioExt * tasaBCV).toFixed(2)),
          subtotal_usd: subtotalExtraUsd,
          subtotal_bs: Number((subtotalExtraUsd * tasaBCV).toFixed(2)),
        };
      });

      await supabase.from("ventas_items_extras").insert(extrasInsert);
    }
  }

  revalidatePath("/");
  revalidatePath("/ventas");
  revalidatePath("/caja");
  revalidatePath("/dashboard");
  revalidatePath("/insumos");

  // Notificación a Telegram para POS en segundo plano
  try {
    const { notificarComandaTelegram } = await import("@/lib/telegram");
    let clienteNombre = "Cliente Salón";
    let clienteTelf: string | null = null;
    if (payload.cliente_id) {
      const { data: cData } = await supabase
        .from("clientes")
        .select("nombre, telefono")
        .eq("id", payload.cliente_id)
        .maybeSingle();
      if (cData) {
        clienteNombre = cData.nombre;
        clienteTelf = cData.telefono;
      }
    }

    const itemNames = payload.items.map((it) => ({
      cantidad: it.cantidad,
      nombre: it.nombre || "Producto",
      notas: it.notas_item,
    }));

    notificarComandaTelegram({
      numero_comanda: venta.numero_comanda,
      origen: "pos",
      nombre_cliente: clienteNombre,
      telefono: clienteTelf,
      tipo_entrega: payload.tipo_entrega,
      delivery_zona: payload.delivery_zona_nombre,
      direccion: payload.direccion_delivery,
      total_usd: totalUsdCalculado,
      total_bs: totalBsCalculado,
      metodo_pago: payload.metodo_pago,
      items: itemNames,
    }).catch((err) => console.error("Error Telegram POS:", err));
  } catch (tErr) {
    console.error("Error preparando notificación Telegram POS:", tErr);
  }

  return {
    ok: true,
    numero_comanda: venta.numero_comanda,
    venta_id: venta.id,
  };
}

export async function aceptarPedidoWeb(ventaId: string) {
  const supabase = await createClient();
  const auth = await requireAuth();
  if (!auth.ok) return { ok: false, error: auth.error };

  // Al pasar a 'preparando', el trigger PostgreSQL `trg_confirmar_pedido_web`
  // descontará automáticamente los insumos en gramos de la despensa
  const { error } = await supabase
    .from("ventas")
    .update({ estado: "preparando" })
    .eq("id", ventaId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  revalidatePath("/ventas");
  revalidatePath("/caja");
  revalidatePath("/dashboard");
  revalidatePath("/insumos");

  return { ok: true };
}

export async function rechazarPedidoWeb(ventaId: string) {
  const supabase = await createClient();
  const auth = await requireAuth();
  if (!auth.ok) return { ok: false, error: auth.error };

  const { error } = await supabase
    .from("ventas")
    .update({ estado: "cancelada" })
    .eq("id", ventaId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  revalidatePath("/ventas");
  revalidatePath("/caja");
  revalidatePath("/dashboard");
  revalidatePath("/insumos");

  return { ok: true };
}
