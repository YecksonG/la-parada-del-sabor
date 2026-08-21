"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type RegistrarCompraPayload = {
  proveedor_id?: string | null;
  insumo_id: string;
  cantidad_comprada: number;
  unidad_compra: string;
  factor_conversion: number;
  total_usd: number;
  tasa_bcv: number;
  metodo_pago: string;
  comprobante?: string;
  notas?: string;
};

export async function registrarCompraInsumo(payload: RegistrarCompraPayload) {
  const supabase = await createClient();

  // 1. Insertar Cabecera de Compra
  const { data: compra, error: compraError } = await supabase
    .from("compras")
    .insert({
      proveedor_id: payload.proveedor_id || null,
      tasa_bcv: payload.tasa_bcv,
      total_usd: payload.total_usd,
      total_bs: Number((payload.total_usd * payload.tasa_bcv).toFixed(2)),
      metodo_pago: payload.metodo_pago,
      comprobante: payload.comprobante || null,
      notas: payload.notas || null,
    })
    .select("id")
    .single();

  if (compraError || !compra) {
    return { ok: false, error: compraError?.message || "Error al crear la compra." };
  }

  // 2. Insertar Item de Compra (Dispara automáticamente el trigger PPMC y suma gramos al stock)
  const cantidadBaseTotal = payload.cantidad_comprada * payload.factor_conversion;
  const precioUnitarioBase = payload.total_usd / cantidadBaseTotal;

  const { error: itemError } = await supabase.from("compras_items").insert({
    compra_id: compra.id,
    insumo_id: payload.insumo_id,
    cantidad_comprada: payload.cantidad_comprada,
    unidad_compra: payload.unidad_compra,
    factor_conversion: payload.factor_conversion,
    cantidad_base_total: cantidadBaseTotal,
    precio_unitario_usd: precioUnitarioBase,
    subtotal_usd: payload.total_usd,
  });

  if (itemError) {
    return { ok: false, error: itemError.message };
  }

  revalidatePath("/compras");
  revalidatePath("/insumos");
  revalidatePath("/recetas");
  revalidatePath("/");

  return { ok: true };
}
