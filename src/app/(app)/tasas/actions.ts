"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type GuardarTasasPayload = {
  bcv_usd_bs: number;
  paralelo_usd_bs: number;
  efectivo_usd_bs: number;
  cop_usd: number;
};

export async function guardarTasasCompletas(payload: GuardarTasasPayload) {
  const supabase = await createClient();

  const hoy = new Date().toISOString().split("T")[0];

  const { error } = await supabase.from("tasas_cambio").insert({
    fecha: hoy,
    bcv_usd_bs: payload.bcv_usd_bs,
    tasa_usd_bs: payload.bcv_usd_bs,
    paralelo_usd_bs: payload.paralelo_usd_bs,
    efectivo_usd_bs: payload.efectivo_usd_bs,
    cop_usd: payload.cop_usd,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/tasas");
  revalidatePath("/");
  revalidatePath("/caja");
  revalidatePath("/dashboard");

  return { ok: true };
}
