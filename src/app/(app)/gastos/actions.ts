"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-guard";
import { Gasto, CategoriaGasto, CuentaOrigenGasto } from "@/types/database";

const CATEGORIAS_VALIDAS: CategoriaGasto[] = [
  "servicios",
  "nomina",
  "proveedores",
  "alquiler",
  "mantenimiento",
  "marketing",
  "impuestos",
  "otros",
];

const CUENTAS_VALIDAS: CuentaOrigenGasto[] = [
  "efectivo_usd",
  "efectivo_bs",
  "pago_movil_bfc",
  "transferencia_bfc",
  "binance",
  "zelle",
  "punto_venta",
  "caja_chica",
  "otra",
];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PayloadGasto = {
  fecha: string;
  categoria: CategoriaGasto;
  subcategoria?: string;
  descripcion: string;
  beneficiario?: string;
  proveedor_id?: string;
  monto_usd: number;
  monto_bs?: number;
  tasa_bcv?: number;
  cuenta_origen: CuentaOrigenGasto;
  numero_factura?: string;
  comprobante_url?: string;
  estado?: "pagado" | "pendiente" | "anulado";
  notas?: string;
};

export async function crearGasto(payload: PayloadGasto) {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);
  if (!auth.ok) return { ok: false, error: auth.error };

  if (!payload.descripcion?.trim()) {
    return { ok: false, error: "Por favor indica la descripción del gasto." };
  }
  if (
    typeof payload.monto_usd !== "number" ||
    !Number.isFinite(payload.monto_usd) ||
    payload.monto_usd <= 0
  ) {
    return { ok: false, error: "El monto en dólares debe ser un número válido mayor a 0." };
  }

  if (!CATEGORIAS_VALIDAS.includes(payload.categoria)) {
    return { ok: false, error: "Categoría de gasto no válida." };
  }

  if (!CUENTAS_VALIDAS.includes(payload.cuenta_origen)) {
    return { ok: false, error: "Cuenta de origen no válida." };
  }

  if (payload.proveedor_id && !UUID_REGEX.test(payload.proveedor_id)) {
    return { ok: false, error: "Identificador de proveedor no válido." };
  }

  // Obtener tasa activa si no se proporciona
  let tasa = payload.tasa_bcv;
  if (!tasa || typeof tasa !== "number" || !Number.isFinite(tasa) || tasa <= 0) {
    const { data: tasaData } = await supabase
      .from("tasas_cambio")
      .select("bcv_usd_bs, tasa_usd_bs")
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle();
    tasa = Number(tasaData?.tasa_usd_bs || tasaData?.bcv_usd_bs) || 60.0;
  }

  const monto_bs =
    typeof payload.monto_bs === "number" && Number.isFinite(payload.monto_bs) && payload.monto_bs > 0
      ? payload.monto_bs
      : Number((payload.monto_usd * tasa).toFixed(2));

  // Verificar si hay una sesión de caja abierta si el gasto sale de efectivo físico o caja chica
  let sesion_caja_id: string | null = null;
  if (["efectivo_usd", "efectivo_bs", "caja_chica"].includes(payload.cuenta_origen)) {
    const { data: sesionActiva } = await supabase
      .from("sesiones_caja")
      .select("id")
      .eq("estado", "abierta")
      .order("fecha_apertura", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sesionActiva) {
      sesion_caja_id = sesionActiva.id;
    }
  }

  const { data, error } = await supabase
    .from("gastos")
    .insert({
      fecha: payload.fecha || new Date().toISOString().split("T")[0],
      categoria: payload.categoria,
      subcategoria: payload.subcategoria?.trim() || null,
      descripcion: payload.descripcion.trim(),
      beneficiario: payload.beneficiario?.trim() || null,
      proveedor_id: payload.proveedor_id || null,
      monto_usd: payload.monto_usd,
      monto_bs: monto_bs,
      tasa_bcv: tasa,
      cuenta_origen: payload.cuenta_origen,
      numero_factura: payload.numero_factura?.trim() || null,
      comprobante_url: payload.comprobante_url || null,
      estado: payload.estado || "pagado",
      sesion_caja_id: sesion_caja_id,
      notas: payload.notas?.trim() || null,
      creado_por: auth.user.email || "admin",
    })
    .select("*, proveedor:proveedores(*)")
    .single();

  if (error) {
    console.error("Error creando gasto:", error);
    return { ok: false, error: error.message || "Error al registrar el gasto." };
  }

  revalidatePath("/gastos");
  revalidatePath("/caja");
  revalidatePath("/dashboard");

  return { ok: true, gasto: data };
}

export async function eliminarGasto(id: string) {
  if (!id || !UUID_REGEX.test(id)) {
    return { ok: false, error: "Identificador de gasto no válido." };
  }

  const supabase = await createClient();
  const auth = await requireAuth(supabase);
  if (!auth.ok) return { ok: false, error: auth.error };

  const { error } = await supabase.from("gastos").delete().eq("id", id);

  if (error) {
    return { ok: false, error: error.message || "Error al eliminar gasto." };
  }

  revalidatePath("/gastos");
  revalidatePath("/caja");
  revalidatePath("/dashboard");

  return { ok: true };
}
