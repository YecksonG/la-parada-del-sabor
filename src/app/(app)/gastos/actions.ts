"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-guard";
import { Gasto, CuentaNegocio, CategoriaGasto, CuentaOrigenGasto } from "@/types/database";

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
  cuenta_origen?: string;
  cuenta_id?: string;
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

  if (payload.proveedor_id && !UUID_REGEX.test(payload.proveedor_id)) {
    return { ok: false, error: "Identificador de proveedor no válido." };
  }

  if (payload.cuenta_id && !UUID_REGEX.test(payload.cuenta_id)) {
    return { ok: false, error: "Identificador de cuenta no válido." };
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
  const ctaOrigen = payload.cuenta_origen || "efectivo_usd";
  if (["efectivo_usd", "efectivo_bs", "caja_chica"].includes(ctaOrigen)) {
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
      cuenta_origen: ctaOrigen,
      cuenta_id: payload.cuenta_id || null,
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

export async function actualizarGasto(id: string, payload: Partial<PayloadGasto>) {
  if (!id || !UUID_REGEX.test(id)) {
    return { ok: false, error: "Identificador de gasto no válido." };
  }

  const supabase = await createClient();
  const auth = await requireAuth(supabase);
  if (!auth.ok) return { ok: false, error: auth.error };

  if (payload.categoria && !CATEGORIAS_VALIDAS.includes(payload.categoria)) {
    return { ok: false, error: "Categoría de gasto no válida." };
  }

  if (payload.proveedor_id && !UUID_REGEX.test(payload.proveedor_id)) {
    return { ok: false, error: "Identificador de proveedor no válido." };
  }

  if (payload.cuenta_id && !UUID_REGEX.test(payload.cuenta_id)) {
    return { ok: false, error: "Identificador de cuenta no válido." };
  }

  const updateData: Record<string, any> = {
    actualizado_el: new Date().toISOString(),
  };

  if (payload.fecha) updateData.fecha = payload.fecha;
  if (payload.categoria) updateData.categoria = payload.categoria;
  if (payload.subcategoria !== undefined) updateData.subcategoria = payload.subcategoria?.trim() || null;
  if (payload.descripcion !== undefined) {
    if (!payload.descripcion.trim()) return { ok: false, error: "La descripción no puede estar vacía." };
    updateData.descripcion = payload.descripcion.trim();
  }
  if (payload.beneficiario !== undefined) updateData.beneficiario = payload.beneficiario?.trim() || null;
  if (payload.proveedor_id !== undefined) updateData.proveedor_id = payload.proveedor_id || null;
  if (payload.cuenta_origen !== undefined) updateData.cuenta_origen = payload.cuenta_origen;
  if (payload.cuenta_id !== undefined) updateData.cuenta_id = payload.cuenta_id || null;
  if (payload.numero_factura !== undefined) updateData.numero_factura = payload.numero_factura?.trim() || null;
  if (payload.comprobante_url !== undefined) updateData.comprobante_url = payload.comprobante_url || null;
  if (payload.estado !== undefined) updateData.estado = payload.estado;
  if (payload.notas !== undefined) updateData.notas = payload.notas?.trim() || null;

  if (payload.monto_usd !== undefined) {
    if (typeof payload.monto_usd !== "number" || !Number.isFinite(payload.monto_usd) || payload.monto_usd <= 0) {
      return { ok: false, error: "El monto en dólares debe ser mayor a 0." };
    }
    updateData.monto_usd = payload.monto_usd;
    const tasa = payload.tasa_bcv || 60.0;
    updateData.monto_bs = typeof payload.monto_bs === "number" && Number.isFinite(payload.monto_bs) && payload.monto_bs > 0
      ? payload.monto_bs
      : Number((payload.monto_usd * tasa).toFixed(2));
  }

  const { data, error } = await supabase
    .from("gastos")
    .update(updateData)
    .eq("id", id)
    .select("*, proveedor:proveedores(*)")
    .single();

  if (error) {
    return { ok: false, error: error.message || "Error al actualizar gasto." };
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

// ==============================================================================
// GESTIÓN DE CUENTAS FINANCIERAS DEL NEGOCIO
// ==============================================================================

export type PayloadCuentaNegocio = {
  nombre: string;
  codigo?: string;
  tipo: CuentaNegocio["tipo"];
  moneda: CuentaNegocio["moneda"];
  banco_plataforma?: string;
  titular?: string;
  numero_cuenta_telefono?: string;
  saldo_inicial?: number;
  icono?: string;
  color?: string;
  notas?: string;
};

export async function crearCuentaNegocio(payload: PayloadCuentaNegocio) {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);
  if (!auth.ok) return { ok: false, error: auth.error };

  if (!payload.nombre?.trim()) {
    return { ok: false, error: "El nombre de la cuenta es obligatorio." };
  }

  const codigo = payload.codigo?.trim() || payload.nombre.toLowerCase().replace(/[^a-z0-9]/g, "_") + "_" + Date.now().toString(36);

  const { data, error } = await supabase
    .from("cuentas_negocio")
    .insert({
      nombre: payload.nombre.trim(),
      codigo: codigo,
      tipo: payload.tipo || "banco_nacional",
      moneda: payload.moneda || "VES",
      banco_plataforma: payload.banco_plataforma?.trim() || null,
      titular: payload.titular?.trim() || null,
      numero_cuenta_telefono: payload.numero_cuenta_telefono?.trim() || null,
      saldo_inicial: payload.saldo_inicial || 0,
      icono: payload.icono || "🏦",
      color: payload.color || "#3b82f6",
      notas: payload.notas?.trim() || null,
      activo: true,
    })
    .select()
    .single();

  if (error) {
    return { ok: false, error: error.message || "Error al registrar la cuenta." };
  }

  revalidatePath("/gastos");
  return { ok: true, cuenta: data };
}

export async function actualizarCuentaNegocio(id: string, payload: Partial<PayloadCuentaNegocio>) {
  if (!id || !UUID_REGEX.test(id)) {
    return { ok: false, error: "Identificador de cuenta no válido." };
  }

  const supabase = await createClient();
  const auth = await requireAuth(supabase);
  if (!auth.ok) return { ok: false, error: auth.error };

  const updateData: any = {
    actualizado_el: new Date().toISOString(),
  };

  if (payload.nombre) updateData.nombre = payload.nombre.trim();
  if (payload.tipo) updateData.tipo = payload.tipo;
  if (payload.moneda) updateData.moneda = payload.moneda;
  if (payload.banco_plataforma !== undefined) updateData.banco_plataforma = payload.banco_plataforma?.trim() || null;
  if (payload.titular !== undefined) updateData.titular = payload.titular?.trim() || null;
  if (payload.numero_cuenta_telefono !== undefined) updateData.numero_cuenta_telefono = payload.numero_cuenta_telefono?.trim() || null;
  if (payload.icono) updateData.icono = payload.icono;
  if (payload.color) updateData.color = payload.color;
  if (payload.notas !== undefined) updateData.notas = payload.notas?.trim() || null;

  const { data, error } = await supabase
    .from("cuentas_negocio")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return { ok: false, error: error.message || "Error al actualizar la cuenta." };
  }

  revalidatePath("/gastos");
  return { ok: true, cuenta: data };
}
