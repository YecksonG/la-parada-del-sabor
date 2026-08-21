import { createClient } from "@/lib/supabase/server";
import InsumosClient from "./client";
import { Insumo } from "@/types/database";

export default async function InsumosPage() {
  const supabase = await createClient();

  const { data: insumos } = await supabase
    .from("insumos")
    .select("*")
    .order("categoria_insumo", { ascending: true })
    .order("nombre", { ascending: true });

  return <InsumosClient insumos={(insumos as Insumo[]) || []} />;
}
