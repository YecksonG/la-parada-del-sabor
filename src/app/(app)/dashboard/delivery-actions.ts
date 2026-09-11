"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-guard";
import { toFechaCaracasString } from "@/lib/date-vzla";

export interface RegistrarDeliveryEmpresaPayload {
  zona_id?: string | null;
  zona_nombre: string;
  monto_usd: number;
  motivo: string;
  trayecto?: string | null;
  fecha?: string;
}

export async function registrarDeliveryEmpresa(payload: RegistrarDeliveryEmpresaPayload) {
  const auth = await requireAuth();
  if (!auth.ok) return { ok: false, error: auth.error };

  if (!payload.zona_nombre?.trim()) {
    return { ok: false, error: "La zona o nivel de delivery es obligatoria." };
  }

  const montoUsd = Number(payload.monto_usd);
  if (isNaN(montoUsd) || montoUsd <= 0) {
    return { ok: false, error: "La tarifa de delivery debe ser mayor a 0." };
  }

  if (!payload.motivo?.trim()) {
    return { ok: false, error: "El motivo o insumo de la diligencia es obligatorio." };
  }

  const supabase = await createClient();

  // 1. Obtener tasa BCV activa
  const { data: tasaData } = await supabase
    .from("tasas_cambio")
    .select("bcv_usd_bs, tasa_usd_bs")
    .order("fecha", { ascending: false })
    .limit(1)
    .maybeSingle();

  const tasaBcv = Number(tasaData?.tasa_usd_bs || tasaData?.bcv_usd_bs) || 1.0;
  const montoBs = Number((montoUsd * tasaBcv).toFixed(2));
  const usuario = auth.user?.email?.split("@")[0] || "admin";
  const fechaStr = payload.fecha ? `${payload.fecha}T12:00:00` : new Date().toISOString();
  const motivoLimpio = payload.motivo.trim();
  const trayectoLimpio = payload.trayecto?.trim() || "";

  // 2. Buscar o crear cliente institucional para auditoría interna
  let clienteId: string | null = null;
  const { data: clienteExistente } = await supabase
    .from("clientes")
    .select("id")
    .ilike("nombre", "La Parada del Sabor (Uso Interno)")
    .maybeSingle();

  if (clienteExistente?.id) {
    clienteId = clienteExistente.id;
  } else {
    const { data: nuevoCliente } = await supabase
      .from("clientes")
      .insert({
        nombre: "La Parada del Sabor (Uso Interno)",
        telefono: "EMPRESA",
        direccion_delivery: "Sede La Parada del Sabor",
        total_pedidos: 0,
      })
      .select("id")
      .maybeSingle();
    clienteId = nuevoCliente?.id || null;
  }

  // 3. Registrar como venta de tipo "delivery" con origen institucional
  const notaComanda = `[DELIVERY INTERNO EMPRESA / INSUMOS]\nMotivo: ${motivoLimpio}${
    trayectoLimpio ? `\nTrayecto: ${trayectoLimpio}` : ""
  }`;

  const { data: venta, error: ventaError } = await supabase
    .from("ventas")
    .insert({
      cliente_id: clienteId,
      fecha: fechaStr,
      tasa_bcv: tasaBcv,
      metodo_pago: "efectivo_usd",
      tipo_entrega: "delivery",
      delivery_zona_id: payload.zona_id || null,
      delivery_zona_nombre: payload.zona_nombre.trim(),
      delivery_monto_usd: montoUsd,
      delivery_monto_bs: montoBs,
      direccion_delivery: trayectoLimpio || "Traslado Operativo / Insumos",
      estado: "completada",
      notas_comanda: notaComanda,
      creado_por: `empresa_delivery (${usuario})`,
      origen_pedido: "delivery_empresa",
      total_usd: montoUsd,
      total_bs: montoBs,
    })
    .select("id, numero_comanda")
    .single();

  if (ventaError) {
    console.error("Error al registrar delivery de empresa en ventas:", ventaError);
    return { ok: false, error: ventaError.message || "Error al registrar el viaje en ventas." };
  }

  // 4. Asentar también como Gasto Operativo en categoría "servicios"
  const descripcionGasto = `🛵 Delivery Operativo (${payload.zona_nombre}): ${motivoLimpio}`;
  await supabase.from("gastos").insert({
    fecha: toFechaCaracasString(new Date(fechaStr)),
    categoria: "servicios",
    subcategoria: "Transporte / Delivery Empresa",
    descripcion: descripcionGasto,
    beneficiario: "Empresa Aliada de Delivery",
    monto_usd: montoUsd,
    monto_bs: montoBs,
    tasa_bcv: tasaBcv,
    cuenta_origen: "efectivo_usd",
    estado: "pagado",
    notas: `Generado automáticamente desde Conciliación Semanal. Comanda #${venta?.numero_comanda || venta?.id}`,
    creado_por: usuario,
  });

  revalidatePath("/dashboard");
  revalidatePath("/gastos");
  revalidatePath("/caja");
  revalidatePath("/ventas");

  return { ok: true, venta };
}
