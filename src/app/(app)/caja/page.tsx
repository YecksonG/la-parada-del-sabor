import { createClient } from "@/lib/supabase/server";
import CajaClient from "./client";
import { SesionCaja, Venta } from "@/types/database";

export default async function CajaPage() {
  const supabase = await createClient();

  // 1. Obtener sesión de caja activa (si hay)
  const { data: sesionActiva } = await supabase
    .from("sesiones_caja")
    .select("*")
    .eq("estado", "abierta")
    .order("fecha_apertura", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 2. Obtener historial de sesiones de caja
  const { data: historialCajas } = await supabase
    .from("sesiones_caja")
    .select("*")
    .order("fecha_apertura", { ascending: false })
    .limit(20);

  // 3. Si hay sesión activa, sumar ventas desde su fecha_apertura
  let ventasTurno: Venta[] = [];
  if (sesionActiva) {
    const { data: ventas } = await supabase
      .from("ventas")
      .select("*")
      .gte("creado_el", sesionActiva.fecha_apertura)
      .neq("estado", "cancelada");

    ventasTurno = (ventas as Venta[]) || [];
  }

  const { data: tasaReciente } = await supabase
    .from("tasas_cambio")
    .select("*")
    .order("fecha", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <CajaClient
      sesionActiva={(sesionActiva as SesionCaja) || null}
      historialCajas={(historialCajas as SesionCaja[]) || []}
      ventasTurno={ventasTurno}
      tasaBcv={Number(tasaReciente?.bcv_usd_bs || tasaReciente?.tasa_usd_bs) || 65.50}
    />
  );
}
