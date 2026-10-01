import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-guard";
import { redirect } from "next/navigation";
import TetasClient from "./client";
import { esMismaSemanaEnCaracas, esMismoMesEnCaracas } from "@/lib/date-vzla";
import { TetasInventario, TetasVenta } from "@/types/database";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Tetas Cream • Inventario y Despacho | La Parada del Sabor",
  description: "Gestión de catálogo de sabores artesanales, stock en freezer y despacho POS multi-sabor.",
};

export default async function TetasPage() {
  const auth = await requireAuth();
  if (!auth.ok) {
    redirect("/login");
  }

  const supabase = await createClient();

  // Fecha inicio del mes actual (Caracas -04:00)
  const ahora = new Date();
  const anio = ahora.getFullYear();
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  const primerDiaMes = `${anio}-${mes}-01T00:00:00.000-04:00`;

  // 1. Carga de datos base (sin traer todo el historial al cliente)
  const [inventarioRes, ventasRes, tasaRes, clientesRes] = await Promise.all([
    supabase.from("tetas_inventario").select("*").eq("activo", true).order("sabor", { ascending: true }),
    supabase.from("tetas_ventas").select("*, cliente:clientes(*)").order("fecha", { ascending: false }).limit(80),
    supabase.from("tasas_cambio").select("bcv_usd_bs, tasa_usd_bs").order("fecha", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("clientes").select("*").order("nombre", { ascending: true })
  ]);

  const inventario: TetasInventario[] = (inventarioRes.data as TetasInventario[]) || [];
  const ventas: TetasVenta[] = (ventasRes.data as TetasVenta[]) || [];
  const tasaBcv = Number(tasaRes.data?.tasa_usd_bs || tasaRes.data?.bcv_usd_bs) || 60.0;

  // 2. Carga optimizada de métricas (agrupada en el servidor)
  // Obtenemos un subconjunto ligero y limitamos en caso de que crezca masivamente
  const ventasMetricasRes = await supabase.from("tetas_ventas").select("fecha, total_usd, costo_unitario_usd, cantidad").limit(5000);
  const rawVentas = ventasMetricasRes.data || [];

  const calc = (filtradas: any[]) => {
    const ventasUsd = filtradas.reduce((acc, v) => acc + (Number(v.total_usd) || 0), 0);
    const costoUsd = filtradas.reduce((acc, v) => acc + (Number(v.costo_unitario_usd || 0) * Number(v.cantidad || 0)), 0);
    const unidades = filtradas.reduce((acc, v) => acc + (Number(v.cantidad) || 0), 0);
    return { ventasUsd, costoUsd, utilidadUsd: Number((ventasUsd - costoUsd).toFixed(2)), unidades };
  };

  const metricasAgrupadas = {
    semana: calc(rawVentas.filter(v => esMismaSemanaEnCaracas(v.fecha))),
    mes: calc(rawVentas.filter(v => esMismoMesEnCaracas(v.fecha))),
    historico: calc(rawVentas)
  };

  return (
    <TetasClient
      inventario={inventario}
      ventas={ventas}
      clientesIniciales={clientesRes.data || []}
      tasaBcv={tasaBcv}
      metricasAgrupadas={metricasAgrupadas}
      operador={auth.user.email?.split("@")[0] || "admin"}
    />
  );
}
