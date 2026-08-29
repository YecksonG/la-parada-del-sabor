import { createClient } from "@/lib/supabase/server";
import CajaClient from "./client";
import { SesionCaja, Venta } from "@/types/database";

export default async function CajaPage() {
  const supabase = await createClient();

  // Ejecutar consultas en paralelo para evitar latencia de cascada (waterfall)
  const [
    sesionRes,
    historialRes,
    ventasRes,
    tasaRes
  ] = await Promise.all([
    supabase
      .from("sesiones_caja")
      .select("*")
      .eq("estado", "abierta")
      .order("fecha_apertura", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("sesiones_caja")
      .select("*")
      .order("fecha_apertura", { ascending: false })
      .limit(20),
    supabase
      .from("ventas")
      .select("*, cliente:clientes(*), items:ventas_items(*, producto:productos(*), extras:ventas_items_extras(*, extra:extras_modificadores(*)))")
      .neq("estado", "cancelada")
      .order("fecha", { ascending: false }),
    supabase
      .from("tasas_cambio")
      .select("*")
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  const sesionActiva = sesionRes.data;
  const historialCajas = historialRes.data || [];
  const ventasTurno: Venta[] = (ventasRes.data as Venta[]) || [];
  const tasaReciente = tasaRes.data;

  return (
    <CajaClient
      sesionActiva={(sesionActiva as SesionCaja) || null}
      historialCajas={(historialCajas as SesionCaja[]) || []}
      ventasTurno={ventasTurno}
      tasaBcv={Number(tasaReciente?.tasa_usd_bs || tasaReciente?.bcv_usd_bs || tasaReciente?.paralelo_usd_bs) || 60}
    />
  );
}
