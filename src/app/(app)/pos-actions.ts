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
  // 0. Calcular totales directamente en el servidor
  let totalUsdCalculado = 0;
  for (const item of payload.items) {
    const subtotalItem = Number((item.precio_unitario_usd * item.cantidad).toFixed(2));
    let subtotalExtras = 0;
    if (item.extras && item.extras.length > 0) {
      for (const ext of item.extras) {
        subtotalExtras += Number((ext.precio_unitario_usd * ext.cantidad).toFixed(2));
      }
    }
    totalUsdCalculado += subtotalItem + subtotalExtras;
  }
  totalUsdCalculado = Number(totalUsdCalculado.toFixed(2));
  const tasaBCV = Number(payload.tasa_bcv) > 0 ? Number(payload.tasa_bcv) : 1;
  const totalBsCalculado = Number((totalUsdCalculado * tasaBCV).toFixed(2));

  // 1. Insertar Cabecera de Venta
  const { data: venta, error: ventaError } = await supabase
    .from("ventas")
    .insert({
      cliente_id: payload.cliente_id || null,
      tasa_bcv: tasaBCV,
      metodo_pago: payload.metodo_pago,
      tipo_entrega: payload.tipo_entrega,
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
    const subtotalItem = Number((item.precio_unitario_usd * item.cantidad).toFixed(2));
    const precioUnitarioBs = Number((item.precio_unitario_usd * tasaBCV).toFixed(2));
    const subtotalBs = Number((subtotalItem * tasaBCV).toFixed(2));

    const { data: ventaItem, error: itemError } = await supabase
      .from("ventas_items")
      .insert({
        venta_id: venta.id,
        producto_id: item.producto_id,
        cantidad: item.cantidad,
        precio_unitario_usd: item.precio_unitario_usd,
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
        const subtotalExtraUsd = Number((ext.precio_unitario_usd * ext.cantidad).toFixed(2));
        return {
          venta_item_id: ventaItem.id,
          extra_id: ext.extra_id,
          cantidad: ext.cantidad,
          precio_extra_usd: ext.precio_unitario_usd,
          precio_extra_bs: Number((ext.precio_unitario_usd * tasaBCV).toFixed(2)),
          precio_unitario_usd: ext.precio_unitario_usd,
          precio_unitario_bs: Number((ext.precio_unitario_usd * tasaBCV).toFixed(2)),
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
