import { createClient } from "@/lib/supabase/server";
import ClientesClient from "./client";
import { Cliente } from "@/types/database";

export default async function ClientesPage() {
  const supabase = await createClient();

  const { data: clientes } = await supabase
    .from("clientes")
    .select("*")
    .order("nombre", { ascending: true });

  return <ClientesClient clientes={(clientes as Cliente[]) || []} />;
}
