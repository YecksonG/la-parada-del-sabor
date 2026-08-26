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

  // 3. Obtener ventas del turno y jornada
  let ventasTurno: Venta[] = [];
  const { data: ventas } = await supabase
    .from("ventas")
    .select("*, cliente:clientes(*), items:ventas_items(*, producto:productos(*))")
    .neq("estado", "cancelada")
    .order("creado_el", { ascending: false })
    .limit(100);

  ventasTurno = (ventas as Venta[]) || [];

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
      tasaBcv={Number(tasaReciente?.tasa_usd_bs || tasaReciente?.bcv_usd_bs || tasaReciente?.paralelo_usd_bs) || 60}
    />
  );
}
