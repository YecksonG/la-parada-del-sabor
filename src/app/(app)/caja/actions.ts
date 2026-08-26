"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-guard";

export type AbrirCajaPayload = {
  monto_inicial_usd: number;
  monto_inicial_bs: number;
  usuario?: string;
};

export async function abrirSesionCaja(payload: AbrirCajaPayload) {
  if (
    typeof payload.monto_inicial_usd !== "number" ||
    payload.monto_inicial_usd < 0 ||
    !Number.isFinite(payload.monto_inicial_usd)
  ) {
    return { ok: false, error: "El monto inicial USD debe ser un número no negativo." };
  }
  if (
    typeof payload.monto_inicial_bs !== "number" ||
    payload.monto_inicial_bs < 0 ||
    !Number.isFinite(payload.monto_inicial_bs)
  ) {
    return { ok: false, error: "El monto inicial BS debe ser un número no negativo." };
  }

  const supabase = await createClient();
  const auth = await requireAuth(supabase);
  if (!auth.ok) return { ok: false, error: auth.error };

  // Verificar que no haya otra caja abierta
  const { data: abierta } = await supabase
    .from("sesiones_caja")
    .select("id")
    .eq("estado", "abierta")
    .maybeSingle();

  if (abierta) {
    return { ok: false, error: "Ya existe un turno de caja abierto." };
  }

  const { error } = await supabase.from("sesiones_caja").insert({
    monto_inicial_usd: payload.monto_inicial_usd,
    monto_inicial_bs: payload.monto_inicial_bs,
    usuario_apertura: payload.usuario || auth.user?.email?.split("@")[0] || "Operador",
    estado: "abierta",
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/caja");
  revalidatePath("/");
  return { ok: true };
}

export type CerrarCajaPayload = {
  sesion_id: string;
  total_ventas_efectivo_usd: number;
  total_ventas_pago_movil_bs: number;
  total_ventas_transferencia_bs: number;
  total_ventas_binance_usd: number;
  total_ventas_punto_bs: number;
  arqueo_fisico_efectivo_usd: number;
  arqueo_fisico_efectivo_bs: number;
  diferencia_usd: number;
  diferencia_bs: number;
  notas_cierre?: string;
  usuario_cierre?: string;
};

export async function cerrarSesionCaja(payload: CerrarCajaPayload) {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);
  if (!auth.ok) return { ok: false, error: auth.error };

  const { error } = await supabase
    .from("sesiones_caja")
    .update({
      estado: "cerrada",
      fecha_cierre: new Date().toISOString(),
      total_ventas_efectivo_usd: payload.total_ventas_efectivo_usd,
      total_ventas_pago_movil_bs: payload.total_ventas_pago_movil_bs,
      total_ventas_transferencia_bs: payload.total_ventas_transferencia_bs,
      total_ventas_binance_usd: payload.total_ventas_binance_usd,
      total_ventas_punto_bs: payload.total_ventas_punto_bs,
      arqueo_fisico_efectivo_usd: payload.arqueo_fisico_efectivo_usd,
      arqueo_fisico_efectivo_bs: payload.arqueo_fisico_efectivo_bs,
      diferencia_usd: payload.diferencia_usd,
      diferencia_bs: payload.diferencia_bs,
      notas_cierre: payload.notas_cierre || null,
      usuario_cierre: payload.usuario_cierre || auth.user?.email?.split("@")[0] || "Operador",
    })
    .eq("id", payload.sesion_id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/caja");
  revalidatePath("/dashboard");
  revalidatePath("/");
  return { ok: true };
}
