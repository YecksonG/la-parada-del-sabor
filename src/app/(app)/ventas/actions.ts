"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-guard";
import type { MetodoPago } from "@/types/database";

export type EstadoVenta = "pendiente" | "preparando" | "lista" | "completada" | "cancelada";

const METODOS_PAGO_VALIDOS: MetodoPago[] = [
  "efectivo_usd",
  "efectivo_bs",
  "pago_movil",
  "pago_movil_bs",
  "transferencia",
  "punto",
  "punto_bs",
  "binance",
  "zelle",
  "pesos_cop",
];

const TRANSICIONES_VALIDAS: Record<EstadoVenta, EstadoVenta[]> = {
  pendiente: ["preparando", "cancelada"],
  preparando: ["lista", "completada", "cancelada"],
  lista: ["completada", "cancelada"],
  completada: ["cancelada"],
  cancelada: ["preparando"],
};

export async function cambiarEstadoVenta(venta_id: string, nuevoEstado: EstadoVenta) {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!venta_id || !UUID_REGEX.test(venta_id)) {
    return { ok: false, error: "Identificador de venta no válido." };
  }

  const supabase = await createClient();
  const auth = await requireAuth();
  if (!auth.ok) return { ok: false, error: auth.error };

  // 1. Obtener estado actual y verificar existencia
  const { data: ventaActual, error: errorFetch } = await supabase
    .from("ventas")
    .select("id, estado")
    .eq("id", venta_id)
    .single();

  if (errorFetch || !ventaActual) {
    return { ok: false, error: "La comanda no existe o no se pudo encontrar." };
  }

  // 2. Validar transición de estado
  const permitidos = TRANSICIONES_VALIDAS[ventaActual.estado as EstadoVenta] || [];
  if (!permitidos.includes(nuevoEstado)) {
    return {
      ok: false,
      error: `Transición no permitida: no se puede cambiar de '${ventaActual.estado}' a '${nuevoEstado}'.`,
    };
  }

  // 3. Actualizar estado
  const { error: errorUpdate } = await supabase
    .from("ventas")
    .update({ estado: nuevoEstado })
    .eq("id", venta_id);

  if (errorUpdate) return { ok: false, error: errorUpdate.message };

  revalidatePath("/ventas");
  revalidatePath("/caja");
  revalidatePath("/dashboard");
  revalidatePath("/insumos");
  revalidatePath("/");

  return { ok: true };
}

export async function actualizarMetodoPagoVenta(venta_id: string, nuevoMetodoPago: MetodoPago) {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!venta_id || !UUID_REGEX.test(venta_id)) {
    return { ok: false, error: "Identificador de venta no válido." };
  }

  if (!METODOS_PAGO_VALIDOS.includes(nuevoMetodoPago)) {
    return { ok: false, error: "Método de pago no válido." };
  }

  const supabase = await createClient();
  const auth = await requireAuth();
  if (!auth.ok) return { ok: false, error: auth.error };

  const { error } = await supabase
    .from("ventas")
    .update({ metodo_pago: nuevoMetodoPago })
    .eq("id", venta_id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/ventas");
  revalidatePath("/caja");
  revalidatePath("/dashboard");
  revalidatePath("/");

  return { ok: true };
}
