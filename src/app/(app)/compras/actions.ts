"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-guard";

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
  if (
    typeof payload.cantidad_comprada !== "number" ||
    payload.cantidad_comprada <= 0 ||
    !Number.isFinite(payload.cantidad_comprada)
  ) {
    return { ok: false, error: "La cantidad comprada debe ser un número positivo." };
  }
  if (
    typeof payload.factor_conversion !== "number" ||
    payload.factor_conversion <= 0 ||
    !Number.isFinite(payload.factor_conversion)
  ) {
    return { ok: false, error: "El factor de conversión debe ser un número positivo." };
  }
  if (
    typeof payload.total_usd !== "number" ||
    payload.total_usd <= 0 ||
    !Number.isFinite(payload.total_usd)
  ) {
    return { ok: false, error: "El total en USD debe ser un número positivo." };
  }

  const supabase = await createClient();
  const auth = await requireAuth(supabase);
  if (!auth.ok) return { ok: false, error: auth.error };

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
