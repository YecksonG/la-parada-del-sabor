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

  // 3. Obtener ventas del turno o de la jornada de hoy
  let ventasTurno: Venta[] = [];
  if (sesionActiva) {
    const { data: ventas } = await supabase
      .from("ventas")
      .select("*")
      .gte("creado_el", sesionActiva.fecha_apertura)
      .neq("estado", "cancelada")
      .order("creado_el", { ascending: false });

    ventasTurno = (ventas as Venta[]) || [];
  } else {
    // Si no hay turno abierto, obtener todas las ventas de la jornada de hoy
    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);
    const { data: ventas } = await supabase
      .from("ventas")
      .select("*")
      .gte("creado_el", inicioHoy.toISOString())
      .neq("estado", "cancelada")
      .order("creado_el", { ascending: false });

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
      tasaBcv={Number(tasaReciente?.tasa_usd_bs || tasaReciente?.bcv_usd_bs) || 0}
    />
  );
}
