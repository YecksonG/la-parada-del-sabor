"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { obtenerTasasDelDia } from "@/lib/tasas-api";
import { TasaActivaTipo } from "@/types/database";

export type GuardarTasasPayload = {
  bcv_usd_bs: number;
  usdt_bs: number;
  eur_bs: number;
  promedio_bs: number;
};

export async function guardarTasasCompletas(payload: GuardarTasasPayload) {
  const supabase = await createClient();
  const hoy = new Date().toISOString().split("T")[0];

  // Consultar si ya existe registro de hoy para mantener la preferencia de tasa activa
  const { data: existente } = await supabase
    .from("tasas_cambio")
    .select("tasa_activa_tipo, tasa_personalizada_bs")
    .eq("fecha", hoy)
    .maybeSingle();

  const tipoActivo: TasaActivaTipo = (existente?.tasa_activa_tipo as TasaActivaTipo) || "bcv";
  let tasaEfectiva = payload.bcv_usd_bs;

  if (tipoActivo === "usdt") {
    tasaEfectiva = payload.usdt_bs;
  } else if (tipoActivo === "eur") {
    tasaEfectiva = payload.eur_bs;
  } else if (tipoActivo === "promedio") {
    tasaEfectiva = payload.promedio_bs;
  } else if (tipoActivo === "personalizada" && existente?.tasa_personalizada_bs) {
    tasaEfectiva = Number(existente.tasa_personalizada_bs);
  }

  // Upsert estricto con las columnas reales de la base de datos
  const { error } = await supabase.from("tasas_cambio").upsert(
    {
      fecha: hoy,
      bcv_usd_bs: payload.bcv_usd_bs,
      usdt_bs: payload.usdt_bs,
      promedio_bs: payload.promedio_bs,
      eur_bs: payload.eur_bs,
      tasa_usd_bs: tasaEfectiva, // Tasa activa que rige en todo el sistema
      tasa_activa_tipo: tipoActivo,
      tasa_personalizada_bs: existente?.tasa_personalizada_bs || null,
    },
    { onConflict: "fecha" }
  );

  if (error) return { ok: false, error: error.message };

  revalidatePath("/tasas");
  revalidatePath("/");
  revalidatePath("/pedir");
  revalidatePath("/caja");
  revalidatePath("/dashboard");
  revalidatePath("/ventas");

  return { ok: true };
}

export async function autoSincronizarTasas() {
  const apiData = await obtenerTasasDelDia();
  if (!apiData) {
    return { ok: false, error: "No se pudo conectar con las APIs de tasas externas." };
  }

  const res = await guardarTasasCompletas({
    bcv_usd_bs: apiData.bcv,
    usdt_bs: apiData.usdt,
    eur_bs: apiData.eur,
    promedio_bs: apiData.promedio,
  });

  return res;
}

export async function fijarTasaActivaFacturacion(payload: {
  tasa_activa_tipo: TasaActivaTipo;
  tasa_personalizada_bs?: number;
}) {
  const supabase = await createClient();

  // Obtener tasas del día más reciente
  const { data: tasaActual } = await supabase
    .from("tasas_cambio")
    .select("*")
    .order("fecha", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!tasaActual) {
    return { ok: false, error: "No hay registro de tasas para el día de hoy." };
  }

  let tasaEfectiva = Number(tasaActual.bcv_usd_bs) || 65.50;

  if (payload.tasa_activa_tipo === "usdt") {
    tasaEfectiva = Number(tasaActual.usdt_bs) || tasaEfectiva;
  } else if (payload.tasa_activa_tipo === "eur") {
    tasaEfectiva = Number(tasaActual.eur_bs) || tasaEfectiva;
  } else if (payload.tasa_activa_tipo === "promedio") {
    tasaEfectiva = Number(tasaActual.promedio_bs) || tasaEfectiva;
  } else if (payload.tasa_activa_tipo === "personalizada") {
    if (!payload.tasa_personalizada_bs || payload.tasa_personalizada_bs <= 0) {
      return { ok: false, error: "Ingresa una tasa personalizada válida mayor a 0." };
    }
    tasaEfectiva = payload.tasa_personalizada_bs;
  }

  const { error } = await supabase
    .from("tasas_cambio")
    .update({
      tasa_activa_tipo: payload.tasa_activa_tipo,
      tasa_personalizada_bs: payload.tasa_personalizada_bs || null,
      tasa_usd_bs: tasaEfectiva,
    })
    .eq("id", tasaActual.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/tasas");
  revalidatePath("/");
  revalidatePath("/pedir");
  revalidatePath("/caja");
  revalidatePath("/dashboard");
  revalidatePath("/ventas");

  return { ok: true, tasaEfectiva, tipo: payload.tasa_activa_tipo };
}
