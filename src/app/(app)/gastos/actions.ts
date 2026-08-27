"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-guard";
import { Gasto, CuentaNegocio, CategoriaGasto } from "@/types/database";

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
  metodo_pago?: string | null;
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
      cuenta_origen: payload.metodo_pago || ctaOrigen,
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
  revalidatePath("/compras");
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
  if (payload.metodo_pago !== undefined) updateData.cuenta_origen = payload.metodo_pago;
  else if (payload.cuenta_origen !== undefined) updateData.cuenta_origen = payload.cuenta_origen;
  if (payload.cuenta_id !== undefined) updateData.cuenta_id = payload.cuenta_id || null;
  if (payload.numero_factura !== undefined) updateData.numero_factura = payload.numero_factura?.trim() || null;
  if (payload.comprobante_url !== undefined) updateData.comprobante_url = payload.comprobante_url || null;
  if (payload.estado !== undefined) updateData.estado = payload.estado;
  if (payload.notas !== undefined) updateData.notas = payload.notas?.trim() || null;
  if (payload.tasa_bcv !== undefined) updateData.tasa_bcv = payload.tasa_bcv;
  if (payload.monto_bs !== undefined) updateData.monto_bs = payload.monto_bs;

  if (payload.monto_usd !== undefined) {
    if (typeof payload.monto_usd !== "number" || !Number.isFinite(payload.monto_usd) || payload.monto_usd <= 0) {
      return { ok: false, error: "El monto en dólares debe ser mayor a 0." };
    }
    updateData.monto_usd = payload.monto_usd;

    if (payload.monto_bs === undefined) {
      let tasa = payload.tasa_bcv;
      if (!tasa) {
        const { data: tasaData } = await supabase
          .from("tasas_cambio")
          .select("bcv_usd_bs")
          .order("fecha", { ascending: false })
          .limit(1)
          .maybeSingle();
        tasa = Number(tasaData?.bcv_usd_bs) || 1.0;
      }
      updateData.monto_bs = Number((payload.monto_usd * tasa).toFixed(2));
    }
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
  revalidatePath("/compras");
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
  revalidatePath("/compras");
  revalidatePath("/caja");
  revalidatePath("/dashboard");

  return { ok: true };
}

// ==============================================================================
// REGISTRAR INGRESO DE INSUMOS (COMPRA CON AUMENTO DE STOCK + GASTO ASOCIADO)
// ==============================================================================

export type RegistrarCompraInsumoPayload = {
  proveedor_id?: string | null;
  insumo_id: string;
  insumo_nombre: string;
  cantidad_comprada: number;
  unidad_compra: string;
  factor_conversion: number;
  total_usd: number;
  total_bs?: number;
  tasa_bcv: number;
  cuenta_id?: string;
  cuenta_origen?: string;
  numero_factura?: string;
  comprobante_url?: string;
  notas?: string;
};

export async function registrarIngresoInsumo(payload: RegistrarCompraInsumoPayload) {
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
  if (!payload.insumo_id || !UUID_REGEX.test(payload.insumo_id)) {
    return { ok: false, error: "Insumo no válido." };
  }

  const supabase = await createClient();
  const auth = await requireAuth(supabase);
  if (!auth.ok) return { ok: false, error: auth.error };

  const ctaOrigen = payload.cuenta_origen || "efectivo_usd";
  const totalBs = payload.total_bs && payload.total_bs > 0
    ? payload.total_bs
    : Number((payload.total_usd * payload.tasa_bcv).toFixed(2));

  // 1. Insertar Cabecera de Compra
  const { data: compra, error: compraError } = await supabase
    .from("compras")
    .insert({
      proveedor_id: payload.proveedor_id || null,
      tasa_bcv: payload.tasa_bcv,
      total_usd: payload.total_usd,
      total_bs: totalBs,
      metodo_pago: ctaOrigen,
      comprobante: payload.numero_factura || null,
      notas: payload.notas || null,
    })
    .select("id")
    .single();

  if (compraError || !compra) {
    return { ok: false, error: compraError?.message || "Error al crear la compra." };
  }

  // 2. Insertar Item de Compra (Dispara trigger PPMC y suma gramos/und al stock_actual)
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

  // 3. Asentar también en la tabla de Gastos para balance unificado
  let sesion_caja_id: string | null = null;
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

  const { error: gastoError } = await supabase.from("gastos").insert({
    fecha: new Date().toISOString().split("T")[0],
    categoria: "proveedores",
    subcategoria: "Insumos / Despensa",
    descripcion: `Ingreso de stock: ${payload.cantidad_comprada} ${payload.unidad_compra} de ${payload.insumo_nombre}`,
    beneficiario: null,
    proveedor_id: payload.proveedor_id || null,
    monto_usd: payload.total_usd,
    monto_bs: totalBs,
    tasa_bcv: payload.tasa_bcv,
    cuenta_origen: ctaOrigen,
    cuenta_id: payload.cuenta_id || null,
    numero_factura: payload.numero_factura?.trim() || null,
    comprobante_url: payload.comprobante_url || null,
    estado: "pagado",
    sesion_caja_id: sesion_caja_id,
    notas: payload.notas?.trim() || null,
    creado_por: auth.user.email || "admin",
  });

  if (gastoError) {
    console.error("Error registrando gasto de compra:", gastoError);
  }

  revalidatePath("/gastos");
  revalidatePath("/compras");
  revalidatePath("/insumos");
  revalidatePath("/recetas");
  revalidatePath("/caja");
  revalidatePath("/dashboard");
  revalidatePath("/");

  return { ok: true };
}

// ==============================================================================
// GESTIÓN DE CUENTAS FINANCIERAS DEL NEGOCIO
// ==============================================================================

export type PayloadCuentaNegocio = {
  nombre: string;
  codigo?: string | null;
  tipo: CuentaNegocio["tipo"];
  moneda: CuentaNegocio["moneda"];
  banco_plataforma?: string | null;
  titular?: string | null;
  numero_cuenta_telefono?: string | null;
  cedula_rif?: string | null;
  telefono_pago_movil?: string | null;
  admite_biopago?: boolean | null;
  numero_cuenta_20digitos?: string | null;
  saldo_inicial?: number | null;
  icono?: string | null;
  color?: string | null;
  notas?: string | null;
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
      cedula_rif: payload.cedula_rif?.trim() || null,
      telefono_pago_movil: payload.telefono_pago_movil?.trim() || null,
      admite_biopago: Boolean(payload.admite_biopago),
      numero_cuenta_20digitos: payload.numero_cuenta_20digitos?.trim() || null,
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
  if (payload.cedula_rif !== undefined) updateData.cedula_rif = payload.cedula_rif?.trim() || null;
  if (payload.telefono_pago_movil !== undefined) updateData.telefono_pago_movil = payload.telefono_pago_movil?.trim() || null;
  if (payload.admite_biopago !== undefined) updateData.admite_biopago = Boolean(payload.admite_biopago);
  if (payload.numero_cuenta_20digitos !== undefined) updateData.numero_cuenta_20digitos = payload.numero_cuenta_20digitos?.trim() || null;
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

export async function eliminarCuentaNegocio(id: string) {
  if (!id || !UUID_REGEX.test(id)) {
    return { ok: false, error: "Identificador de cuenta no válido." };
  }

  const supabase = await createClient();
  const auth = await requireAuth(supabase);
  if (!auth.ok) return { ok: false, error: auth.error };

  // Obtener cuenta para validar por ID y por código
  const { data: ctaObj } = await supabase
    .from("cuentas_negocio")
    .select("id, codigo")
    .eq("id", id)
    .single();

  if (!ctaObj) {
    return { ok: false, error: "Cuenta no encontrada." };
  }

  // Comprobar si tiene gastos, compras o transferencias asociadas
  const { count: countGastos } = await supabase
    .from("gastos")
    .select("id", { count: "exact", head: true })
    .or(`cuenta_id.eq.${id},cuenta_origen.eq.${ctaObj.codigo}`);

  const { count: countCompras } = await supabase
    .from("compras")
    .select("id", { count: "exact", head: true })
    .eq("metodo_pago", ctaObj.codigo);

  const { count: countTransfOrigen } = await supabase
    .from("transferencias_cuentas")
    .select("id", { count: "exact", head: true })
    .eq("cuenta_origen_id", id);

  const { count: countTransfDestino } = await supabase
    .from("transferencias_cuentas")
    .select("id", { count: "exact", head: true })
    .eq("cuenta_destino_id", id);

  const totalMovimientos = (countGastos || 0) + (countCompras || 0) + (countTransfOrigen || 0) + (countTransfDestino || 0);

  if (totalMovimientos > 0) {
    // Si tiene movimientos históricos, marcar como inactiva para no romper integridad
    const { error: updateError } = await supabase
      .from("cuentas_negocio")
      .update({ activo: false, actualizado_el: new Date().toISOString() })
      .eq("id", id);

    if (updateError) {
      return { ok: false, error: "No se pudo desactivar la cuenta: " + updateError.message };
    }

    revalidatePath("/gastos");
    return {
      ok: true,
      desactivada: true,
      mensaje: "La cuenta tenía movimientos históricos asociados y ha sido archivada para proteger los registros contables.",
    };
  }

  // Si no tiene movimientos, se elimina directamente
  const { error: deleteError } = await supabase
    .from("cuentas_negocio")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return { ok: false, error: deleteError.message || "Error al eliminar la cuenta." };
  }

  revalidatePath("/gastos");
  return { ok: true, eliminada: true };
}

// ==============================================================================
// GESTIÓN DE TRANSFERENCIAS Y MOVIMIENTOS ENTRE CUENTAS
// ==============================================================================

export type PayloadTransferencia = {
  fecha: string;
  cuenta_origen_id: string;
  cuenta_destino_id: string;
  monto_origen: number;
  moneda_origen: string;
  monto_destino: number;
  moneda_destino: string;
  tasa_cambio?: number;
  metodo_transferencia: string;
  referencia?: string;
  concepto?: string;
  comprobante_url?: string;
  notas?: string;
};

export async function crearTransferenciaCuenta(payload: PayloadTransferencia) {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);
  if (!auth.ok) return { ok: false, error: auth.error };

  if (!payload.cuenta_origen_id || !UUID_REGEX.test(payload.cuenta_origen_id)) {
    return { ok: false, error: "Selecciona una cuenta de origen válida." };
  }
  if (!payload.cuenta_destino_id || !UUID_REGEX.test(payload.cuenta_destino_id)) {
    return { ok: false, error: "Selecciona una cuenta de destino válida." };
  }
  if (payload.cuenta_origen_id === payload.cuenta_destino_id) {
    return { ok: false, error: "La cuenta de origen y destino no pueden ser la misma." };
  }
  if (typeof payload.monto_origen !== "number" || payload.monto_origen <= 0 || !Number.isFinite(payload.monto_origen)) {
    return { ok: false, error: "El monto a transferir debe ser mayor a 0." };
  }
  if (typeof payload.monto_destino !== "number" || payload.monto_destino <= 0 || !Number.isFinite(payload.monto_destino)) {
    return { ok: false, error: "El monto recibido debe ser mayor a 0." };
  }

  const METODOS_PERMITIDOS = ["pago_movil", "transferencia", "biopago", "efectivo", "zelle", "binance", "otro"];
  const metodoValido = METODOS_PERMITIDOS.includes(payload.metodo_transferencia)
    ? payload.metodo_transferencia
    : "pago_movil";

  const { data, error } = await supabase
    .from("transferencias_cuentas")
    .insert({
      fecha: payload.fecha || new Date().toISOString().split("T")[0],
      cuenta_origen_id: payload.cuenta_origen_id,
      cuenta_destino_id: payload.cuenta_destino_id,
      monto_origen: payload.monto_origen,
      moneda_origen: payload.moneda_origen || "VES",
      monto_destino: payload.monto_destino,
      moneda_destino: payload.moneda_destino || "VES",
      tasa_cambio: payload.tasa_cambio || 1.0,
      metodo_transferencia: metodoValido,
      referencia: payload.referencia?.trim().slice(0, 100) || null,
      concepto: payload.concepto?.trim().slice(0, 255) || null,
      comprobante_url: payload.comprobante_url || null,
      notas: payload.notas?.trim().slice(0, 500) || null,
      creado_por: auth.user.email || "admin",
    })
    .select("*, cuenta_origen:cuentas_negocio!transferencias_cuentas_cuenta_origen_id_fkey(*), cuenta_destino:cuentas_negocio!transferencias_cuentas_cuenta_destino_id_fkey(*)")
    .single();

  if (error) {
    console.error("Error creando transferencia:", error);
    return { ok: false, error: error.message || "Error al registrar la transferencia." };
  }

  revalidatePath("/gastos");
  return { ok: true, transferencia: data };
}

export async function eliminarTransferenciaCuenta(id: string) {
  if (!id || !UUID_REGEX.test(id)) {
    return { ok: false, error: "Identificador de transferencia no válido." };
  }

  const supabase = await createClient();
  const auth = await requireAuth(supabase);
  if (!auth.ok) return { ok: false, error: auth.error };

  const { error } = await supabase.from("transferencias_cuentas").delete().eq("id", id);
  if (error) {
    return { ok: false, error: error.message || "Error al eliminar transferencia." };
  }

  revalidatePath("/gastos");
  return { ok: true };
}

