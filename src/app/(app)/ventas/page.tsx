import { createClient } from "@/lib/supabase/server";
import VentasClient from "./client";
import { Cliente, Venta } from "@/types/database";

export default async function VentasPage() {
  const supabase = await createClient();

  const [ventasRes, clientesRes, tasaRes] = await Promise.all([
    supabase
      .from("ventas")
      .select("*, cliente:clientes(*), items:ventas_items(*, producto:productos(*), extras:ventas_items_extras(*, extra:extras_modificadores(*)))")
      .order("fecha", { ascending: false })
      .limit(100),
    supabase
      .from("clientes")
      .select("*")
      .order("nombre", { ascending: true }),
    supabase
      .from("tasas_cambio")
      .select("bcv_usd_bs, tasa_usd_bs")
      .order("fecha", { ascending: false })
      .limit(1)
      .single(),
  ]);

  const ventas = (ventasRes.data as Venta[]) || [];
  const clientes = (clientesRes.data as Cliente[]) || [];
  const tasaBcv = Number(tasaRes.data?.tasa_usd_bs || tasaRes.data?.bcv_usd_bs || 832);

  return (
    <VentasClient
      ventas={ventas}
      clientes={clientes}
      tasaBcv={tasaBcv}
    />
  );
}
