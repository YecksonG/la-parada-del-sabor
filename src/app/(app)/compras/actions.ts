"use server";

import { createClient } from "@/lib/supabase/server";
import { registrarCompraMultiInsumo } from "@/app/(app)/gastos/actions";

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
  const { data: insumoData } = await supabase
    .from("insumos")
    .select("nombre")
    .eq("id", payload.insumo_id)
    .maybeSingle();

  return registrarCompraMultiInsumo({
    proveedor_id: payload.proveedor_id || undefined,
    tasa_bcv: payload.tasa_bcv,
    total_usd: payload.total_usd,
    total_bs: Number((payload.total_usd * payload.tasa_bcv).toFixed(2)),
    cuenta_origen: payload.metodo_pago,
    numero_factura: payload.comprobante,
    notas: payload.notas,
    items: [
      {
        insumo_id: payload.insumo_id,
        insumo_nombre: insumoData?.nombre || "Insumo",
        cantidad_comprada: payload.cantidad_comprada,
        unidad_compra: payload.unidad_compra,
        factor_conversion: payload.factor_conversion,
        total_usd: payload.total_usd,
      },
    ],
  });
}
