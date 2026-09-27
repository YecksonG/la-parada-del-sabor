import { createClient } from "@/lib/supabase/server";
import CocinaClient from "./client";
import { Venta } from "@/types/database";
import "./kds.css";

import { KDS_SELECT_VENTAS, obtenerKdsOrFilter } from "./constants";

export const dynamic = "force-dynamic";

function obtenerFechaCorte24Horas(): string {
  const ahora = new Date();
  ahora.setDate(ahora.getDate() - 1);
  return ahora.toISOString();
}

export default async function CocinaPage() {
  const supabase = await createClient();

  // Comandas activas para el KDS:
  // 1) En curso ('pendiente', 'preparando', 'credito'): NUNCA se descartan por antigüedad para no perder pedidos.
  // 2) 'lista' (cajón inferior): limitadas a las últimas 24 horas.
  const hace24Horas = obtenerFechaCorte24Horas();

  const { data: ventas, error } = await supabase
    .from("ventas")
    .select(KDS_SELECT_VENTAS)
    .or(obtenerKdsOrFilter(hace24Horas))
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
