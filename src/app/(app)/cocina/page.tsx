import { createClient } from "@/lib/supabase/server";
import CocinaClient from "./client";
import { Venta } from "@/types/database";
import "./kds.css";

import { KDS_SELECT_VENTAS, KDS_ESTADOS_ACTIVOS } from "./constants";

export const dynamic = "force-dynamic";

function obtenerFechaCortePorDefecto(): string {
  // Ventana de 14 horas para cubrir el turno nocturno/diurno activo
  const ahora = new Date();
  ahora.setHours(ahora.getHours() - 14);
  return ahora.toISOString();
}

export default async function CocinaPage() {
  const supabase = await createClient();

  // 1. Si existe un turno de caja abierto, se sincroniza con su fecha de apertura. Si no, toma las últimas 14 horas.
  const { data: sesionAbierta } = await supabase
    .from("sesiones_caja")
    .select("fecha_apertura")
    .eq("estado", "abierta")
    .order("fecha_apertura", { ascending: false })
    .limit(1)
    .maybeSingle();

  const fechaCorte = sesionAbierta?.fecha_apertura || obtenerFechaCortePorDefecto();

  const { data: ventas, error } = await supabase
    .from("ventas")
    .select(KDS_SELECT_VENTAS)
    .in("estado", KDS_ESTADOS_ACTIVOS)
    .gte("fecha", fechaCorte)
    .order("fecha", { ascending: true });

  if (error) {
    console.error("Error cargando comandas para KDS:", error.message);
  }

  return (
    <CocinaClient
      initialVentas={(ventas as Venta[]) || []}
      initialError={error ? error.message : null}
    />
  );
}
