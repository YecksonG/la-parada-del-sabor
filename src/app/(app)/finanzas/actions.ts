"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { FinanzasEntidadId } from "@/types/database";

// =============================================================================
// 1. TETAS RELLENAS (VENTAS & STOCK)
// =============================================================================

import { generarTagPagoMixto, PagoFraccionItem } from "@/lib/pago-mixto";

export type RegistrarVentaTetaPayload = {
  sabor_id: string;
  cantidad: number;
  metodo_pago: string;
  tasa_bcv: number;
  notas?: string;
  registrado_por?: string;
  desglose_mixto?: PagoFraccionItem[];
  cliente_credito?: string;
};

export async function registrarVentaTetaAction(payload: RegistrarVentaTetaPayload) {
  const auth = await requireAuth();
  if (!auth.ok) return { ok: false, error: auth.error };

  if (!payload.sabor_id) {
    return { ok: false, error: "Debes seleccionar un sabor de teta." };
  }
  if (!payload.cantidad || payload.cantidad <= 0 || !Number.isInteger(payload.cantidad)) {
    return { ok: false, error: "La cantidad vendida debe ser un número entero mayor a 0." };
  }

  const supabase = await createClient();

  // Obtener sabor, stock, costo y precio
  const { data: sabor, error: saborErr } = await supabase
    .from("tetas_inventario")
    .select("*")
    .eq("id", payload.sabor_id)
    .single();

  if (saborErr || !sabor) {
    return { ok: false, error: "Sabor de teta no encontrado en inventario." };
  }

  // Validación estricta de stock disponible en freezer
  const stockDisponible = Number(sabor.stock_unidades) || 0;
  if (stockDisponible < payload.cantidad) {
    return {
      ok: false,
      error: `Stock insuficiente en freezer. Solo quedan ${stockDisponible} unidades de "${sabor.sabor}".`,
    };
  }

  // Obtener tasa de cambio canónica si no viene una válida
  let tasaBcv = Number(payload.tasa_bcv);
  if (!tasaBcv || tasaBcv <= 0) {
    const { data: tasaData } = await supabase
      .from("tasas_cambio")
      .select("tasa_usd_bs, bcv_usd_bs")
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle();
    tasaBcv = Number(tasaData?.tasa_usd_bs || tasaData?.bcv_usd_bs) || 60.0;
  }

  const precioUnitario = Number(sabor.precio_venta_unitario_usd) || 1.0;
  const costoUnitario = Number(sabor.costo_compra_unitario_usd) || 0.5;
  const totalUsd = Number((precioUnitario * payload.cantidad).toFixed(2));
  const totalBs = Number((totalUsd * tasaBcv).toFixed(2));

  // Procesamiento de notas para Pago Mixto / Fraccionado o Crédito
  const partesNotas: string[] = [];
  if (payload.metodo_pago === "pago_mixto" && payload.desglose_mixto && payload.desglose_mixto.length > 0) {
    partesNotas.push(generarTagPagoMixto(payload.desglose_mixto, tasaBcv));
  } else if (payload.metodo_pago === "credito") {
    partesNotas.push(`[CRÉDITO PENDIENTE: ${payload.cliente_credito?.trim() || "Cliente directo"}]`);
  }
  if (payload.notas?.trim()) {
    partesNotas.push(payload.notas.trim());
  }
  const notasFinales = partesNotas.length > 0 ? partesNotas.join(" • ") : null;

  const { error: insertErr } = await supabase.from("tetas_ventas").insert({
    sabor_id: sabor.id,
    sabor_nombre: sabor.sabor,
    cantidad: payload.cantidad,
    precio_unitario_usd: precioUnitario,
    costo_unitario_usd: costoUnitario,
    total_usd: totalUsd,
    total_bs: totalBs,
    tasa_bcv: tasaBcv,
    metodo_pago: payload.metodo_pago || "efectivo_usd",
    registrado_por: payload.registrado_por || auth.user?.email?.split("@")[0] || "Operador",
    notas: notasFinales,
  });

  if (insertErr) {
    return { ok: false, error: insertErr.message };
  }

  revalidatePath("/finanzas");
  return { ok: true, totalUsd, totalBs };
}

export type AbastecerStockTetasPayload = {
  sabor_id: string;
  cantidad_ingresada: number;
  costo_compra_unitario_usd?: number;
  precio_venta_unitario_usd?: number;
};

export async function abastecerStockTetasAction(payload: AbastecerStockTetasPayload) {
  const auth = await requireAuth();
  if (!auth.ok) return { ok: false, error: auth.error };

  if (!payload.sabor_id || !payload.cantidad_ingresada || payload.cantidad_ingresada <= 0) {
    return { ok: false, error: "La cantidad ingresada debe ser mayor a 0." };
  }

  const supabase = await createClient();

  const { data: actual, error: fetchErr } = await supabase
    .from("tetas_inventario")
    .select("stock_unidades, costo_compra_unitario_usd, precio_venta_unitario_usd")
    .eq("id", payload.sabor_id)
    .single();

  if (fetchErr || !actual) {
    return { ok: false, error: "Sabor no encontrado." };
  }

  const nuevoStock = (Number(actual.stock_unidades) || 0) + payload.cantidad_ingresada;
  const updateData: Record<string, any> = {
    stock_unidades: nuevoStock,
    actualizado_el: new Date().toISOString(),
  };

  if (typeof payload.costo_compra_unitario_usd === "number" && payload.costo_compra_unitario_usd > 0) {
    updateData.costo_compra_unitario_usd = payload.costo_compra_unitario_usd;
  }
  if (typeof payload.precio_venta_unitario_usd === "number" && payload.precio_venta_unitario_usd > 0) {
    updateData.precio_venta_unitario_usd = payload.precio_venta_unitario_usd;
  }

  const { error } = await supabase
    .from("tetas_inventario")
    .update(updateData)
    .eq("id", payload.sabor_id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/finanzas");
  return { ok: true, nuevoStock };
}

export async function crearSaborTetaAction(sabor: string, costoUnitarioUsd: number, precioVentaUsd: number, stockInicial: number) {
  const auth = await requireAuth();
  if (!auth.ok) return { ok: false, error: auth.error };

  if (!sabor || sabor.trim().length === 0) {
    return { ok: false, error: "El nombre del sabor no puede estar vacío." };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("tetas_inventario").insert({
    sabor: sabor.trim(),
    costo_compra_unitario_usd: Number(costoUnitarioUsd) >= 0 ? Number(costoUnitarioUsd) : 0.50,
    precio_venta_unitario_usd: Number(precioVentaUsd) >= 0 ? Number(precioVentaUsd) : 1.00,
    stock_unidades: Number(stockInicial) >= 0 ? Math.floor(Number(stockInicial)) : 0,
    activo: true,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/finanzas");
  return { ok: true };
}

// =============================================================================
// 2. FINANZAS PERSONALES, SUELDOS Y SIDE HUSTLES
// =============================================================================

export type RegistrarMovimientoFinanzasPayload = {
  entidad_id: FinanzasEntidadId;
  tipo: "ingreso" | "gasto";
  categoria: string;
  descripcion: string;
  monto_usd: number;
  tasa_bcv: number;
  metodo_pago: string;
  recurrente?: boolean;
  frecuencia?: "quincenal" | "mensual" | "semanal";
  notas?: string;
};

export async function registrarMovimientoFinanzasAction(payload: RegistrarMovimientoFinanzasPayload) {
  const auth = await requireAuth();
  if (!auth.ok) return { ok: false, error: auth.error };

  if (!payload.entidad_id) {
    return { ok: false, error: "Debes seleccionar a qué motor o persona pertenece el movimiento." };
  }
  if (!payload.monto_usd || payload.monto_usd <= 0) {
    return { ok: false, error: "El monto debe ser mayor a 0." };
  }
  if (!payload.descripcion || payload.descripcion.trim().length === 0) {
    return { ok: false, error: "Debes ingresar una descripción o concepto." };
  }

  const tasaBcv = Number(payload.tasa_bcv) > 0 ? Number(payload.tasa_bcv) : 60.0;
  const montoBs = Number((payload.monto_usd * tasaBcv).toFixed(2));

  const supabase = await createClient();

  const { error } = await supabase.from("finanzas_movimientos").insert({
    entidad_id: payload.entidad_id,
    tipo: payload.tipo,
    categoria: payload.categoria || "otro",
    descripcion: payload.descripcion.trim(),
    monto_usd: payload.monto_usd,
    monto_bs: montoBs,
    tasa_bcv: tasaBcv,
    metodo_pago: payload.metodo_pago || "efectivo_usd",
    recurrente: !!payload.recurrente,
    frecuencia: payload.recurrente ? payload.frecuencia || "mensual" : null,
    notas: payload.notas?.trim() || null,
    creado_por: auth.user?.email?.split("@")[0] || "Operador",
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/finanzas");
  return { ok: true };
}

// =============================================================================
// 3. PRÉSTAMOS CRUZADOS Y FAMILIARES
// =============================================================================

export type RegistrarPrestamoPayload = {
  origen_tipo: "entidad_interna" | "tercero_familiar";
  origen_entidad_id?: string;
  origen_nombre: string;
  destino_tipo: "entidad_interna" | "tercero_familiar";
  destino_entidad_id?: string;
  destino_nombre: string;
  monto_usd: number;
  tasa_bcv: number;
  concepto: string;
  notas?: string;
};

export async function registrarPrestamoAction(payload: RegistrarPrestamoPayload) {
  const auth = await requireAuth();
  if (!auth.ok) return { ok: false, error: auth.error };

  if (!payload.monto_usd || payload.monto_usd <= 0) {
    return { ok: false, error: "El monto del préstamo debe ser mayor a 0." };
  }
  if (!payload.concepto || payload.concepto.trim().length === 0) {
    return { ok: false, error: "Debes especificar el concepto del préstamo." };
  }
  if (!payload.origen_nombre || !payload.destino_nombre) {
    return { ok: false, error: "Debes especificar quién presta y quién recibe el dinero." };
  }

  const tasaBcv = Number(payload.tasa_bcv) > 0 ? Number(payload.tasa_bcv) : 60.0;
  const montoBs = Number((payload.monto_usd * tasaBcv).toFixed(2));

  const supabase = await createClient();

  const { error } = await supabase.from("finanzas_prestamos").insert({
    origen_tipo: payload.origen_tipo,
    origen_entidad_id: payload.origen_tipo === "entidad_interna" ? payload.origen_entidad_id : null,
    origen_nombre: payload.origen_nombre.trim(),
    destino_tipo: payload.destino_tipo,
    destino_entidad_id: payload.destino_tipo === "entidad_interna" ? payload.destino_entidad_id : null,
    destino_nombre: payload.destino_nombre.trim(),
    monto_original_usd: payload.monto_usd,
    monto_original_bs: montoBs,
    saldo_pendiente_usd: payload.monto_usd,
    tasa_bcv: tasaBcv,
    concepto: payload.concepto.trim(),
    estado: "activo",
    notas: payload.notas?.trim() || null,
    creado_por: auth.user?.email?.split("@")[0] || "Operador",
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/finanzas");
  return { ok: true };
}

export type AbonarPrestamoPayload = {
  prestamo_id: string;
  monto_usd: number;
  tasa_bcv: number;
  metodo_pago: string;
  notas?: string;
};

export async function abonarPrestamoAction(payload: AbonarPrestamoPayload) {
  const auth = await requireAuth();
  if (!auth.ok) return { ok: false, error: auth.error };

  if (!payload.prestamo_id) {
    return { ok: false, error: "Identificador de préstamo inválido." };
  }
  if (!payload.monto_usd || payload.monto_usd <= 0) {
    return { ok: false, error: "El monto del abono debe ser mayor a 0." };
  }

  const supabase = await createClient();

  // Validar existencia y saldo pendiente del préstamo en servidor
  const { data: prestamo, error: prestamoErr } = await supabase
    .from("finanzas_prestamos")
    .select("saldo_pendiente_usd, estado")
    .eq("id", payload.prestamo_id)
    .single();

  if (prestamoErr || !prestamo) {
    return { ok: false, error: "Préstamo no encontrado en la base de datos." };
  }
  if (prestamo.estado !== "activo") {
    return { ok: false, error: "Este préstamo ya se encuentra completamente pagado o anulado." };
  }
  const saldoPendiente = Number(prestamo.saldo_pendiente_usd) || 0;
  if (payload.monto_usd > saldoPendiente) {
    return {
      ok: false,
      error: `El abono ($${payload.monto_usd.toFixed(2)}) no puede exceder el saldo pendiente ($${saldoPendiente.toFixed(2)}).`,
    };
  }

  // Obtener tasa de cambio canónica si no viene una válida
  let tasaBcv = Number(payload.tasa_bcv);
  if (!tasaBcv || tasaBcv <= 0) {
    const { data: tasaData } = await supabase
      .from("tasas_cambio")
      .select("tasa_usd_bs, bcv_usd_bs")
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle();
    tasaBcv = Number(tasaData?.tasa_usd_bs || tasaData?.bcv_usd_bs) || 60.0;
  }
  const montoBs = Number((payload.monto_usd * tasaBcv).toFixed(2));

  const { error } = await supabase.from("finanzas_prestamos_abonos").insert({
    prestamo_id: payload.prestamo_id,
    monto_usd: payload.monto_usd,
    monto_bs: montoBs,
    tasa_bcv: tasaBcv,
    metodo_pago: payload.metodo_pago || "efectivo_usd",
    notas: payload.notas?.trim() || null,
    registrado_por: auth.user?.email?.split("@")[0] || "Operador",
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/finanzas");
  return { ok: true };
}
