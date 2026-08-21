"use client";

import { useEffect } from "react";
import { autoSincronizarTasas } from "@/app/(app)/tasas/actions";

const THROTTLE_MS = 15 * 60 * 1000; // 15 minutos entre sincronizaciones automáticas

export default function AutoTasas() {
  useEffect(() => {
    let activo = true;

    async function ejecutarSincronizacion(forzar = false) {
      if (!activo) return;

      const ultimoStr = sessionStorage.getItem("last_tasas_sync");
      const ultimo = ultimoStr ? parseInt(ultimoStr, 10) : 0;
      const ahora = Date.now();

      // Si no es forzado y pasaron menos de 15 minutos, omitir para ahorrar tráfico
      if (!forzar && ahora - ultimo < THROTTLE_MS) {
        return;
      }

      try {
        await autoSincronizarTasas();
        sessionStorage.setItem("last_tasas_sync", String(ahora));
      } catch {
        // Silencioso en background
      }
    }

    // Sincronización inicial al montar
    ejecutarSincronizacion();

    // Sincronización periódica cada 30 minutos
    const intervalo = setInterval(() => ejecutarSincronizacion(), 30 * 60 * 1000);

    // Listener para tabletas/pestañas que vuelven al primer plano
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        ejecutarSincronizacion();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      activo = false;
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
