"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function guardarTasa(bcv_usd_bs: number, tasa_usd_bs?: number, cop_usd?: number) {
  const supabase = await createClient();

  const hoy = new Date().toISOString().split("T")[0];

  const { error } = await supabase.from("tasas_cambio").insert({
    fecha: hoy,
    bcv_usd_bs,
    tasa_usd_bs: tasa_usd_bs || bcv_usd_bs,
    cop_usd: cop_usd || 4100,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/tasas");
  revalidatePath("/");
  return { ok: true };
}
