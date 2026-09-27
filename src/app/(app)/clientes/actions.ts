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

const METODOS_PAGO_VALIDOS: MetodoPago[] = [
  "pago_movil",
  "pago_movil_bs",
  "efectivo_usd",
  "efectivo_bs",
  "transferencia",
  "binance",
  "zelle",
  "pago_mixto",
  "credito",
];

export async function registrarPagoComandaCredito(payload: RegistrarPagoCreditoPayload) {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!payload.venta_id || !UUID_REGEX.test(payload.venta_id)) {
    return { ok: false, error: "Identificador de comanda inválido." };
  }

  if (!METODOS_PAGO_VALIDOS.includes(payload.metodo_pago_abono)) {
    return { ok: false, error: "Método de pago de abono inválido." };
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

  const updateFields: Record<string, unknown> = {
    notas_comanda: nuevasNotas,
  };

  if (payload.es_pago_total) {
    // Si saldó la deuda completamente:
    // Si la venta está aún en cocina (pendiente, preparando, lista), NO cambiar el estado para que permanezca en el KDS
    if (venta.estado !== "preparando" && venta.estado !== "lista" && venta.estado !== "pendiente") {
      updateFields.estado = "completada";
    }
    updateFields.metodo_pago = payload.metodo_pago_abono;
  } else {
    // Abono parcial: si estaba en credito permanece en credito; si ya estaba en cocina o completada, no alterar estado operativo
    if (venta.estado === "credito") {
      updateFields.estado = "credito";
    }
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
  revalidatePath("/cocina");
  revalidatePath("/dashboard");
  revalidatePath("/caja");
  revalidatePath("/");

  return { ok: true };
}

export async function eliminarAbonoComandaCredito(payload: {
  venta_id: string;
  raw_tag: string;
}) {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!payload.venta_id || !UUID_REGEX.test(payload.venta_id)) {
    return { ok: false, error: "Identificador de comanda inválido." };
  }

  const supabase = await createClient();
  const auth = await requireAuth();
  if (!auth.ok) return { ok: false, error: auth.error };

  const { data: venta, error: errorFetch } = await supabase
    .from("ventas")
    .select("id, total_usd, notas_comanda, metodo_pago, estado")
    .eq("id", payload.venta_id)
    .single();

  if (errorFetch || !venta) {
    return { ok: false, error: "No se encontró la comanda a modificar." };
  }

  // Eliminar el tag de abono
  const notasPrevias = venta.notas_comanda || "";
  let limpias = notasPrevias.replace(payload.raw_tag, "").trim();
  limpias = limpias
    .replace(/•\s*•+/g, "•")
    .replace(/^\s*•\s*/, "")
    .replace(/\s*•\s*$/, "")
    .trim();

  const updateFields: Record<string, unknown> = {
    notas_comanda: limpias.length > 0 ? limpias : null,
  };

  // Si no está completada ni lista, al eliminar abono el estado y método vuelven a credito
  if (venta.estado !== "completada" && venta.estado !== "lista") {
    updateFields.estado = "credito";
    updateFields.metodo_pago = "credito";
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
  revalidatePath("/cocina");
  revalidatePath("/dashboard");
  revalidatePath("/caja");
  revalidatePath("/");

  return { ok: true, notas_comanda: updateFields.notas_comanda, estado: updateFields.estado || venta.estado };
}

export async function limpiarTodosAbonosComandaCredito(payload: {
  venta_id: string;
}) {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!payload.venta_id || !UUID_REGEX.test(payload.venta_id)) {
    return { ok: false, error: "Identificador de comanda inválido." };
  }

  const supabase = await createClient();
  const auth = await requireAuth();
  if (!auth.ok) return { ok: false, error: auth.error };

  const { data: venta, error: errorFetch } = await supabase
    .from("ventas")
    .select("id, total_usd, notas_comanda, metodo_pago, estado")
    .eq("id", payload.venta_id)
    .single();

  if (errorFetch || !venta) {
    return { ok: false, error: "No se encontró la comanda a modificar." };
  }

  let limpias = (venta.notas_comanda || "").replace(/•?\s*\[ABONO CRÉDITO:[^\]]+\]/gi, "").trim();
  limpias = limpias
    .replace(/•\s*•+/g, "•")
    .replace(/^\s*•\s*/, "")
    .replace(/\s*•\s*$/, "")
    .trim();

  const updateFields: Record<string, unknown> = {
    notas_comanda: limpias.length > 0 ? limpias : null,
  };
  if (venta.estado !== "completada" && venta.estado !== "lista") {
    updateFields.estado = "credito";
    updateFields.metodo_pago = "credito";
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
  revalidatePath("/cocina");
  revalidatePath("/dashboard");
  revalidatePath("/caja");
  revalidatePath("/");

  return { ok: true, notas_comanda: updateFields.notas_comanda, estado: updateFields.estado || venta.estado };
}
