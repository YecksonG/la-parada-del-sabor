"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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

export async function registrarVentaPos(payload: RegistrarVentaPayload) {
  if (!payload.items || payload.items.length === 0) {
    return { ok: false, error: "La comanda no tiene ningún producto agregado." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const nombreOperador = user?.email?.split("@")[0] ?? "cajero";

  // 1. Insertar Cabecera de Venta
  const { data: venta, error: ventaError } = await supabase
    .from("ventas")
    .insert({
      cliente_id: payload.cliente_id || null,
      tasa_bcv: payload.tasa_bcv,
      metodo_pago: payload.metodo_pago,
      tipo_entrega: payload.tipo_entrega,
      estado: "preparando",
      notas_comanda: payload.notas_comanda || null,
      creado_por: nombreOperador,
      total_usd: 0, // Los triggers server-side calcularán el total exacto
      total_bs: 0,
    })
    .select("id, numero_comanda")
    .single();

  if (ventaError || !venta) {
    return { ok: false, error: ventaError?.message || "Error al crear la comanda en base de datos." };
  }

  // 2. Insertar Items de Venta (Disparará la deducción atómica de gramos de insumos de recetas)
  for (const item of payload.items) {
    const subtotalItem = Number((item.precio_unitario_usd * item.cantidad).toFixed(2));

    const { data: ventaItem, error: itemError } = await supabase
      .from("ventas_items")
      .insert({
        venta_id: venta.id,
        producto_id: item.producto_id,
        cantidad: item.cantidad,
        precio_unitario_usd: item.precio_unitario_usd,
        subtotal_usd: subtotalItem,
        notas_item: item.notas_item || null,
      })
      .select("id")
      .single();

    if (itemError || !ventaItem) {
      console.error("Error insertando item de venta:", itemError);
      continue;
    }

    // 3. Insertar Extras si tiene (Disparará la deducción de gramos de extras)
    if (item.extras && item.extras.length > 0) {
      const extrasInsert = item.extras.map((ext) => ({
        venta_item_id: ventaItem.id,
        extra_id: ext.extra_id,
        cantidad: ext.cantidad,
        precio_unitario_usd: ext.precio_unitario_usd,
        subtotal_usd: Number((ext.precio_unitario_usd * ext.cantidad).toFixed(2)),
      }));

      await supabase.from("ventas_items_extras").insert(extrasInsert);
    }
  }

  revalidatePath("/");
  revalidatePath("/ventas");
  revalidatePath("/insumos");

  return {
    ok: true,
    numero_comanda: venta.numero_comanda,
    venta_id: venta.id,
  };
}

export async function aceptarPedidoWeb(ventaId: string) {
  const supabase = await createClient();

  // Al pasar a 'preparando', el trigger PostgreSQL `trg_confirmar_pedido_web`
  // descontará automáticamente los insumos en gramos de la despensa
  const { error } = await supabase
    .from("ventas")
    .update({ estado: "preparando" })
    .eq("id", ventaId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  revalidatePath("/ventas");
  revalidatePath("/insumos");

  return { ok: true };
}

export async function rechazarPedidoWeb(ventaId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("ventas")
    .update({ estado: "cancelada" })
    .eq("id", ventaId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  revalidatePath("/ventas");

  return { ok: true };
}
