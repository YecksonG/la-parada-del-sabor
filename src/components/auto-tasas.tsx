"use client";

import { useEffect } from "react";
import { autoSincronizarTasas } from "@/app/(app)/tasas/actions";

export default function AutoTasas() {
  useEffect(() => {
    let activo = true;

    async function sincronizar() {
      if (!activo) return;
      try {
        await autoSincronizarTasas();
      } catch (e) {
        // Silencioso en segundo plano
      }
    }

    sincronizar();
    // Sincronizar automáticamente cada 30 minutos
    const intervalo = setInterval(sincronizar, 30 * 60 * 1000);

    return () => {
      activo = false;
      clearInterval(intervalo);
    };
  }, []);

  return null;
}
