import { createClient } from "@/lib/supabase/server";
import ClientesClient from "./client";
import { Cliente, Venta } from "@/types/database";

export default async function ClientesPage() {
  const supabase = await createClient();

  const [clientesRes, ventasRes, tasaRes] = await Promise.all([
    supabase
      .from("clientes")
      .select("*")
      .order("nombre", { ascending: true }),
    supabase
      .from("ventas")
      .select("*, items:ventas_items(*, producto:productos(*), extras:ventas_items_extras(*, extra:extras_modificadores(*)))")
      .not("cliente_id", "is", null)
      .order("fecha", { ascending: false }),
    supabase
      .from("tasas_cambio")
      .select("bcv_usd_bs, tasa_usd_bs")
      .order("fecha", { ascending: false })
      .limit(1)
      .single(),
  ]);

  const clientes = clientesRes.data || [];
  const ventas = ventasRes.data || [];
  const tasaBcv = Number(tasaRes.data?.tasa_usd_bs || tasaRes.data?.bcv_usd_bs || 832);

  return (
    <ClientesClient
      clientes={(clientes as Cliente[]) || []}
      ventas={(ventas as Venta[]) || []}
      tasaBcv={tasaBcv}
    />
  );
}
