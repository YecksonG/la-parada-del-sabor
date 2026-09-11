"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-guard";
import type { MetodoPago } from "@/types/database";

export type GuardarClientePayload = {
  id?: string;
  nombre: string;
  telefono?: string;
  direccion_delivery?: string;
  notas_preferencias?: string;
};

export async function guardarCliente(payload: GuardarClientePayload) {
  const supabase = await createClient();
  const auth = await requireAuth();
  if (!auth.ok) return { ok: false, error: auth.error };

  if (payload.id) {
    const { error } = await supabase
      .from("clientes")
      .update({
        nombre: payload.nombre,
        telefono: payload.telefono || null,
        direccion_delivery: payload.direccion_delivery || null,
        notas_preferencias: payload.notas_preferencias || null,
      })
      .eq("id", payload.id);

    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("clientes").insert({
      nombre: payload.nombre,
      telefono: payload.telefono || null,
      direccion_delivery: payload.direccion_delivery || null,
      notas_preferencias: payload.notas_preferencias || null,
    });

    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/clientes");
  return { ok: true };
}

export async function eliminarCliente(id: string) {
  if (!id || typeof id !== "string") {
    return { ok: false, error: "ID de cliente no proporcionado o inválido." };
  }

  // Validación de formato UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return { ok: false, error: "Identificador de cliente no válido." };
  }

  const supabase = await createClient();
  const auth = await requireAuth();
  if (!auth.ok) return { ok: false, error: auth.error };

  // 1. Desvincular ventas históricas de forma segura con verificación de error
  const { error: errorDesvincular } = await supabase
    .from("ventas")
    .update({ cliente_id: null })
    .eq("cliente_id", id);

  if (errorDesvincular) {
    return { ok: false, error: `Error al desvincular comandas del cliente: ${errorDesvincular.message}` };
  }

  // 2. Eliminar registro del cliente
  const { error: errorDelete } = await supabase
    .from("clientes")
    .delete()
    .eq("id", id);

  if (errorDelete) {
    return { ok: false, error: `Error al eliminar el cliente: ${errorDelete.message}` };
  }

  revalidatePath("/clientes");
  revalidatePath("/");
  revalidatePath("/dashboard");
  return { ok: true };
}

export type RegistrarPagoCreditoPayload = {
  venta_id: string;
  monto_abonado_usd: number;
  metodo_pago_abono: MetodoPago;
  es_pago_total: boolean;
  monto_restante_usd: number;
  tag_abono: string;
};

export async function registrarPagoComandaCredito(payload: RegistrarPagoCreditoPayload) {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!payload.venta_id || !UUID_REGEX.test(payload.venta_id)) {
    return { ok: false, error: "Identificador de comanda inválido." };
  }

  const supabase = await createClient();
  const auth = await requireAuth();
  if (!auth.ok) return { ok: false, error: auth.error };

  // 1. Obtener la comanda actual
  const { data: venta, error: errorFetch } = await supabase
    .from("ventas")
    .select("id, total_usd, total_bs, tasa_bcv, notas_comanda, metodo_pago, estado")
    .eq("id", payload.venta_id)
    .single();

  if (errorFetch || !venta) {
    return { ok: false, error: "No se encontró la comanda a procesar." };
  }

  const notasActuales = venta.notas_comanda ? venta.notas_comanda.trim() : "";
  const nuevasNotas = notasActuales ? `${notasActuales} • ${payload.tag_abono}` : payload.tag_abono;

  const updateFields: Record<string, any> = {
    notas_comanda: nuevasNotas,
  };

  if (payload.es_pago_total) {
    // Si saldó la deuda completamente
    updateFields.estado = "completada";
    updateFields.metodo_pago = payload.metodo_pago_abono;
  } else {
    // Abono parcial: permanece en credito pero registramos el abono en notas
    updateFields.estado = "credito";
  }

  const { error: updateError } = await supabase
    .from("ventas")
    .update(updateFields)
    .eq("id", payload.venta_id);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  revalidatePath("/clientes");
  revalidatePath("/ventas");
  revalidatePath("/dashboard");
  revalidatePath("/caja");
  revalidatePath("/");

  return { ok: true };
}
