import { createClient } from "@/lib/supabase/server";
import DashboardClient from "./client";
import { Venta, Cliente, Insumo, Producto, SesionCaja } from "@/types/database";

export default async function DashboardPage() {
  const supabase = await createClient();

  // 1. Ejecutar consultas en paralelo para máxima velocidad
  const [ventasRes, clientesRes, insumosRes, productosRes, tasaRes, sesionesRes] = await Promise.all([
    supabase
      .from("ventas")
      .select("*, cliente:clientes(*), items:ventas_items(*, producto:productos(*), extras:ventas_items_extras(*, extra:extras_modificadores(*)))")
      .neq("estado", "cancelada")
      .order("fecha", { ascending: false }),
    supabase
      .from("clientes")
      .select("*")
      .order("total_pedidos", { ascending: false }),
    supabase
      .from("insumos")
      .select("*")
      .order("stock_actual", { ascending: true }),
    supabase
      .from("productos")
      .select("*, categoria:categorias(*), ingredientes:recetas_ingredientes(*, insumo:insumos(*))"),
    supabase
      .from("tasas_cambio")
      .select("*")
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("sesiones_caja")
      .select("*")
      .order("fecha_apertura", { ascending: false })
      .limit(30),
  ]);

  const ventas = ventasRes.data || [];
  const clientes = clientesRes.data || [];
  const insumos = insumosRes.data || [];
  const productos = productosRes.data || [];
  const tasaReciente = tasaRes.data;
  const historialCajas = sesionesRes.data || [];

  return (
    <DashboardClient
      ventas={(ventas as Venta[]) || []}
      clientes={(clientes as Cliente[]) || []}
      insumos={(insumos as Insumo[]) || []}
      productos={(productos as Producto[]) || []}
      historialCajas={(historialCajas as SesionCaja[]) || []}
      tasaBcv={Number(tasaReciente?.tasa_usd_bs || tasaReciente?.bcv_usd_bs) || 0}
    />
  );
}
