"use client";

import { useEffect } from "react";
import { autoSincronizarTasas } from "@/app/(app)/tasas/actions";

const THROTTLE_SUCCESS_MS = 15 * 60 * 1000; // 15 minutos si fue exitoso
const THROTTLE_FAIL_MS = 2 * 60 * 1000;     // 2 minutos de backoff si falló la API

export default function AutoTasas() {
  useEffect(() => {
    let activo = true;

    async function ejecutarSincronizacion() {
      if (!activo) return;

      try {
        const ultimoStr = localStorage.getItem("last_tasas_sync");
        const ultimo = ultimoStr ? parseInt(ultimoStr, 10) : 0;
        const ahora = Date.now();

        // Evitar llamadas duplicadas entre pestañas concurrentes
        if (ahora - ultimo < THROTTLE_SUCCESS_MS) {
          return;
        }

        const res = await autoSincronizarTasas();
        if (res?.ok) {
          localStorage.setItem("last_tasas_sync", String(ahora));
        } else {
          // Backoff corto de 2 min ante fallo para no martillar la API
          localStorage.setItem("last_tasas_sync", String(ahora - THROTTLE_SUCCESS_MS + THROTTLE_FAIL_MS));
        }
      } catch {
        // En caso de error de red, establecer backoff de 2 minutos
        const ahora = Date.now();
        localStorage.setItem("last_tasas_sync", String(ahora - THROTTLE_SUCCESS_MS + THROTTLE_FAIL_MS));
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
