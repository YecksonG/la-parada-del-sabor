import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-guard";
import { redirect } from "next/navigation";
import TetasClient from "./client";
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

  const [inventarioRes, ventasRes, ventasMesRes, tasaRes] = await Promise.all([
    supabase.from("tetas_inventario").select("*").eq("activo", true).order("sabor", { ascending: true }),
    supabase.from("tetas_ventas").select("*").order("fecha", { ascending: false }).limit(80),
    supabase.from("tetas_ventas").select("total_usd, costo_unitario_usd, cantidad").gte("fecha", primerDiaMes),
    supabase.from("tasas_cambio").select("bcv_usd_bs, tasa_usd_bs").order("fecha", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const inventario: TetasInventario[] = (inventarioRes.data as TetasInventario[]) || [];
  const ventas: TetasVenta[] = (ventasRes.data as TetasVenta[]) || [];

  const tasaBcv = Number(tasaRes.data?.tasa_usd_bs || tasaRes.data?.bcv_usd_bs) || 60.0;

  // Métricas del mes
  const ventasMesUsd = (ventasMesRes.data || []).reduce((acc, v) => acc + (Number(v.total_usd) || 0), 0);
  const costoMesUsd = (ventasMesRes.data || []).reduce((acc, v) => acc + (Number(v.costo_unitario_usd || 0) * Number(v.cantidad || 0)), 0);
  const unidadesMes = (ventasMesRes.data || []).reduce((acc, v) => acc + (Number(v.cantidad) || 0), 0);
  const utilidadMesUsd = Number((ventasMesUsd - costoMesUsd).toFixed(2));

  return (
    <TetasClient
      inventario={inventario}
      ventas={ventas}
      tasaBcv={tasaBcv}
      metricas={{
        ventasMesUsd,
        costoMesUsd,
        utilidadMesUsd,
        unidadesMes,
      }}
      operador={auth.user.email?.split("@")[0] || "admin"}
    />
  );
}
