import { createClient } from "@/lib/supabase/server";
import DashboardClient from "./client";
import { Venta, Cliente, Insumo, Producto } from "@/types/database";

export default async function DashboardPage() {
  const supabase = await createClient();

  // 1. Ventas históricas y de este mes/semana
  const { data: ventas } = await supabase
    .from("ventas")
    .select("*, cliente:clientes(*), items:ventas_items(*, producto:productos(*), extras:ventas_items_extras(*, extra:extras_modificadores(*)))")
    .neq("estado", "cancelada")
    .order("fecha", { ascending: false });

  // 2. Clientes
  const { data: clientes } = await supabase
    .from("clientes")
    .select("*")
    .order("total_pedidos", { ascending: false });

  // 3. Insumos
  const { data: insumos } = await supabase
    .from("insumos")
    .select("*")
    .order("stock_actual", { ascending: true });

  // 4. Productos
  const { data: productos } = await supabase
    .from("productos")
    .select("*, categoria:categorias(*), ingredientes:recetas_ingredientes(*, insumo:insumos(*))");

  // 5. Tasa BCV
  const { data: tasaReciente } = await supabase
    .from("tasas_cambio")
    .select("*")
    .order("fecha", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <DashboardClient
      ventas={(ventas as Venta[]) || []}
      clientes={(clientes as Cliente[]) || []}
      insumos={(insumos as Insumo[]) || []}
      productos={(productos as Producto[]) || []}
      tasaBcv={Number(tasaReciente?.tasa_usd_bs || tasaReciente?.bcv_usd_bs) || 65.50}
    />
  );
}
