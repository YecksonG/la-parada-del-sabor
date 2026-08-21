import { createClient } from "@/lib/supabase/server";
import TasasClient from "./client";
import { TasaCambio } from "@/types/database";

export default async function TasasPage() {
  const supabase = await createClient();

  const { data: tasas } = await supabase
    .from("tasas_cambio")
    .select("*")
    .order("fecha", { ascending: false })
    .limit(30);

  return <TasasClient tasas={(tasas as TasaCambio[]) || []} />;
}
