import { createClient } from "@/lib/supabase/server";
import VentasClient from "./client";
import { Venta } from "@/types/database";

export default async function VentasPage() {
  const supabase = await createClient();

  const { data: ventas } = await supabase
    .from("ventas")
    .select("*, cliente:clientes(*), items:ventas_items(*, producto:productos(*), extras:ventas_items_extras(*, extra:extras_modificadores(*)))")
    .order("fecha", { ascending: false })
    .limit(100);

  return <VentasClient ventas={(ventas as Venta[]) || []} />;
}
