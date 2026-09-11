import { createClient } from "@/lib/supabase/server";
import ClientesClient from "./client";
import { Cliente, Venta } from "@/types/database";

export default async function ClientesPage() {
  const supabase = await createClient();

  const [clientesRes, ventasRes] = await Promise.all([
    supabase
      .from("clientes")
      .select("*")
      .order("nombre", { ascending: true }),
    supabase
      .from("ventas")
      .select("*, items:ventas_items(*, producto:productos(*), extras:ventas_items_extras(*, extra:extras_modificadores(*)))")
      .not("cliente_id", "is", null)
      .order("fecha", { ascending: false }),
  ]);

  const clientes = clientesRes.data || [];
  const ventas = ventasRes.data || [];

  return (
    <ClientesClient
      clientes={(clientes as Cliente[]) || []}
      ventas={(ventas as Venta[]) || []}
    />
  );
}
