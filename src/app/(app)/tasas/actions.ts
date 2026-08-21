"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { obtenerTasasDelDia } from "@/lib/tasas-api";

export type GuardarTasasPayload = {
  bcv_usd_bs: number;
  usdt_bs: number;
  eur_bs: number;
  promedio_bs: number;
};

export async function guardarTasasCompletas(payload: GuardarTasasPayload) {
  const supabase = await createClient();
  const hoy = new Date().toISOString().split("T")[0];

  const { error } = await supabase.from("tasas_cambio").upsert(
    {
      fecha: hoy,
      bcv_usd_bs: payload.bcv_usd_bs,
      tasa_usd_bs: payload.bcv_usd_bs,
      usdt_bs: payload.usdt_bs,
      promedio_bs: payload.promedio_bs,
      eur_bs: payload.eur_bs,
      paralelo_usd_bs: payload.usdt_bs,
      efectivo_usd_bs: payload.promedio_bs,
    },
    { onConflict: "fecha" }
  );

  if (error) return { ok: false, error: error.message };

  revalidatePath("/tasas");
  revalidatePath("/");
  revalidatePath("/caja");
  revalidatePath("/dashboard");

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
