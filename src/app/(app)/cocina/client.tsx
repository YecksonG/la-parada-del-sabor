"use client";

import { useState, useEffect, useMemo, useCallback, useRef, useSyncExternalStore, memo } from "react";
import { Venta, VentaItem, VentaItemExtra } from "@/types/database";
import { createClient } from "@/lib/supabase/client";
import { cambiarEstadoVenta } from "@/app/(app)/ventas/actions";
import { sounds } from "@/lib/sound-effects";
import { getComboArepasCount, esArepaIndividual } from "@/lib/combo-helper";
import { KDS_SELECT_VENTAS, KDS_ESTADOS_ACTIVOS } from "./constants";

let soundListeners: Array<() => void> = [];
function notifySoundChange() {
  soundListeners.forEach((l) => l());
}
function subscribeSound(listener: () => void) {
  soundListeners.push(listener);
  return () => {
    soundListeners = soundListeners.filter((l) => l !== listener);
  };
}
function getSoundSnapshot(): boolean {
  return sounds.isEnabled();
}
function getServerSoundSnapshot(): boolean {
  return true;
}
const NOOP_SUBSCRIBE = () => () => {};

interface CocinaClientProps {
  initialVentas: Venta[];
  initialError?: string | null;
}

// Helper para clasificar tipo de cocción predominante en la comanda
function detectarCoccionComanda(venta: Venta): { tipo: "fritas" | "asadas" | "mixtas" | "normal"; label: string } {
  const notasComanda = (venta.notas_comanda || "").toLowerCase();
  const notasItems = (venta.items || []).map((it) => (it.notas || it.notas_item || "").toLowerCase()).join(" ");
  const textoTotal = `${notasComanda} ${notasItems}`;

  const tieneMixto =
    textoTotal.includes("mixt") ||
    /\(\s*\d+\s*a\s*\/\s*\d+\s*f\s*\)/i.test(textoTotal) ||
    /\(\s*\d+\s*f\s*\/\s*\d+\s*a\s*\)/i.test(textoTotal);
  const tieneFrita = textoTotal.includes("frit");
  const tieneAsada = textoTotal.includes("asad");

  if (tieneMixto || (tieneFrita && tieneAsada)) return { tipo: "mixtas", label: "Cocción Mixta (Fritas & Asadas)" };
  if (tieneFrita) return { tipo: "fritas", label: "Todas Fritas" };
  if (tieneAsada) return { tipo: "asadas", label: "Todas Asadas" };
  return { tipo: "normal", label: "Cocción Estándar" };
}

// Formatear minutos y segundos transcurridos (con guard de montado SSR para evitar mismatch)
function calcularTiempoTranscurrido(fechaIso: string, mounted: boolean): { texto: string; segundos: number; colorClass: string } {
  if (!mounted || !fechaIso) {
    return { texto: "--:--", segundos: 0, colorClass: "kds-timer-green" };
  }
  const timestamp = new Date(fechaIso).getTime();
  if (Number.isNaN(timestamp)) {
    return { texto: "--:--", segundos: 0, colorClass: "kds-timer-green" };
  }
  const diffMs = Math.max(0, Date.now() - timestamp);
  const diffSeg = Math.floor(diffMs / 1000);
  const min = Math.floor(diffSeg / 60);
  const seg = diffSeg % 60;
  const texto = `${String(min).padStart(2, "0")}:${String(seg).padStart(2, "0")}`;

  // Semáforo de tiempo
  let colorClass = "kds-timer-green";
  if (min >= 15) {
    colorClass = "kds-timer-red";
  } else if (min >= 8) {
    colorClass = "kds-timer-amber";
  }

  return { texto, segundos: diffSeg, colorClass };
}

export default function CocinaClient({ initialVentas, initialError }: CocinaClientProps) {
  const [ventas, setVentas] = useState<Venta[]>(initialVentas);
  const [errorConexion, setErrorConexion] = useState<string | null>(initialError || null);
  const [audioBloqueado, setAudioBloqueado] = useState<boolean>(false);
  const [horaActual, setHoraActual] = useState<string>("");
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "delivery" | "mostrador">("todos");
  const sonidoHabilitado = useSyncExternalStore(subscribeSound, getSoundSnapshot, getServerSoundSnapshot);
  const [procesandoIds, setProcesandoIds] = useState<Record<string, number>>({});
  const [pantallaCompleta, setPantallaCompleta] = useState<boolean>(false);
  const [ultimaCompletadaId, setUltimaCompletadaId] = useState<string | null>(null);
  const [tiempoTick, setTiempoTick] = useState<number>(0);
  const isClient = useSyncExternalStore(NOOP_SUBSCRIBE, () => true, () => false);
  const [feedback, setFeedback] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);

  const enfocarProximaRef = useRef<string | null>(null);
  const ventasRef = useRef(ventas);
  const comandasFiltradasRef = useRef<Venta[]>([]);
  const comandasRecienListasRef = useRef<Venta[]>([]);
  const ultimaCompletadaIdRef = useRef(ultimaCompletadaId);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const procesandoIdsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    ventasRef.current = ventas;
  }, [ventas]);

  useEffect(() => {
    ultimaCompletadaIdRef.current = ultimaCompletadaId;
  }, [ultimaCompletadaId]);

  // Retención accesible de foco tras el avance de una comanda
  useEffect(() => {
    if (enfocarProximaRef.current) {
      const targetId = enfocarProximaRef.current;
      const elementId = targetId.startsWith("kds-") ? targetId : `kds-btn-${targetId}`;
      requestAnimationFrame(() => {
        const btn = document.getElementById(elementId);
        if (btn) {
          if (!btn.hasAttribute("disabled")) {
            enfocarProximaRef.current = null;
            btn.focus();
          }
        } else {
          enfocarProximaRef.current = null;
          const fallback = document.getElementById("kds-filtro-todos");
          if (fallback) fallback.focus();
        }
      });
    }
  }, [ventas, procesandoIds]);

  // Desbloqueo proactivo de AudioContext para navegadores con política estricta de reproducción
  useEffect(() => {
    sounds.resumeContext().then((running) => {
      if (!running && sounds.isEnabled()) {
        setAudioBloqueado(true);
      }
    });

    const desbloquear = () => {
      sounds.resumeContext().then((running) => {
        if (running) setAudioBloqueado(false);
      });
    };

    window.addEventListener("pointerdown", desbloquear, { once: true, passive: true });
    window.addEventListener("keydown", desbloquear, { once: true, passive: true });
    return () => {
      window.removeEventListener("pointerdown", desbloquear);
      window.removeEventListener("keydown", desbloquear);
    };
  }, []);

  // Escuchar eventos de cambio de pantalla completa (por ejemplo al presionar Esc)
  useEffect(() => {
    const handleFsChange = () => {
      setPantallaCompleta(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Mostrar mensaje de feedback temporal sin solapamientos
  const mostrarFeedback = useCallback((tipo: "exito" | "error", texto: string) => {
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }
    setFeedback({ tipo, texto });
    feedbackTimeoutRef.current = setTimeout(() => {
      setFeedback(null);
    }, 3500);
  }, []);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    };
  }, []);

  // Ref de sonido para evitar desconexiones constantes del canal Realtime
  const soundEnabledRef = useRef(sonidoHabilitado);
  useEffect(() => {
    soundEnabledRef.current = sonidoHabilitado;
  }, [sonidoHabilitado]);

  // 1. Reloj en Vivo y Ticker de Cronómetros (cada 1s)
  useEffect(() => {
    const actualizarReloj = () => {
      const now = new Date();
      setHoraActual(
        now.toLocaleTimeString("es-VE", {
          timeZone: "America/Caracas",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
      setTiempoTick((prev) => prev + 1);
    };

    actualizarReloj();
    const interval = setInterval(actualizarReloj, 1000);
    return () => clearInterval(interval);
  }, []);

  // 2. Función de refresco y sincronización de respaldo (Fallback de polling y visibilidad)
  const refrescarComandas = useCallback(async () => {
    if (Object.keys(procesandoIdsRef.current).length > 0) return;

    try {
      const supabase = createClient();

      // 1. Si existe turno de caja abierto se sincroniza con su fecha_apertura; si no, toma las últimas 14 horas
      const { data: sesionAbierta } = await supabase
        .from("sesiones_caja")
        .select("fecha_apertura")
        .eq("estado", "abierta")
        .order("fecha_apertura", { ascending: false })
        .limit(1)
        .maybeSingle();

      const ahora = new Date();
      ahora.setHours(ahora.getHours() - 14);
      const fechaCorte = sesionAbierta?.fecha_apertura || ahora.toISOString();

      const { data, error } = await supabase
        .from("ventas")
        .select(KDS_SELECT_VENTAS)
        .in("estado", KDS_ESTADOS_ACTIVOS)
        .gte("fecha", fechaCorte)
        .order("fecha", { ascending: true });

      if (Object.keys(procesandoIdsRef.current).length > 0) return;

      if (!error && data) {
        setVentas(data as Venta[]);
        setErrorConexion(null);
      } else if (error) {
        setErrorConexion(error.message);
      }
    } catch {
      setErrorConexion("Error de conexión al sincronizar comandas");
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(refrescarComandas, 45000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refrescarComandas();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", refrescarComandas);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", refrescarComandas);
    };
  }, [refrescarComandas]);

  // 3. Suscripción en Tiempo Real con Supabase Realtime (ventas y ventas_items)
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("cocina-kds-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ventas",
        },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const id = payload.new.id;
            let { data: nuevaVenta } = await supabase
              .from("ventas")
              .select(KDS_SELECT_VENTAS)
              .eq("id", id)
              .single();

            // Si los ítems no están listos por carrera de inserción en POS, esperar 600ms y reintentar
            if (nuevaVenta && (!nuevaVenta.items || nuevaVenta.items.length === 0)) {
              await new Promise((r) => setTimeout(r, 600));
              const { data: reintento } = await supabase
                .from("ventas")
                .select(KDS_SELECT_VENTAS)
                .eq("id", id)
                .single();
              if (reintento) nuevaVenta = reintento;
            }

            if (nuevaVenta) {
              const v = nuevaVenta as Venta;
              if (!["pendiente", "preparando", "lista", "credito"].includes(v.estado)) {
                return;
              }
              if (v.estado === "lista") {
                const fechaMs = new Date(v.fecha).getTime();
                if (Date.now() - fechaMs > 24 * 60 * 60 * 1000) {
                  return;
                }
              }

              setVentas((prev) => {
                if (prev.some((existente) => existente.id === v.id)) return prev;
                return [...prev, v];
              });

              if (soundEnabledRef.current && (v.estado === "pendiente" || v.estado === "preparando" || v.estado === "credito")) {
                sounds.playKitchenBell();
              }
            }
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as Partial<Venta>;
            if (updated.id) {
              if (updated.estado) {
                if (updated.estado === "cancelada" || updated.estado === "completada") {
                  setVentas((prev) => prev.filter((v) => v.id !== updated.id));
                } else {
                  setVentas((prev) =>
                    prev.map((v) => (v.id === updated.id ? ({ ...v, ...updated } as Venta) : v))
                  );
                }
              } else {
                // Fallback defensivo si REPLICA IDENTITY de Postgres no envía la fila completa
                supabase
                  .from("ventas")
                  .select("id, estado")
                  .eq("id", updated.id)
                  .single()
                  .then(({ data }) => {
                    if (data) {
                      if (data.estado === "cancelada" || data.estado === "completada") {
                        setVentas((prev) => prev.filter((v) => v.id !== data.id));
                      } else {
                        setVentas((prev) =>
                          prev.map((v) => (v.id === data.id ? { ...v, estado: data.estado } : v))
                        );
                      }
                    }
                  });
              }
            }
          } else if (payload.eventType === "DELETE") {
            setVentas((prev) => prev.filter((v) => v.id !== payload.old.id));
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ventas_items",
        },
        async (payload) => {
          const ventaId = (payload.new as { venta_id?: string })?.venta_id;
          if (ventaId) {
            const { data: ventaActualizada } = await supabase
              .from("ventas")
              .select(KDS_SELECT_VENTAS)
              .eq("id", ventaId)
              .single();
            if (ventaActualizada) {
              setVentas((prev) => {
                const existe = prev.some((v) => v.id === ventaId);
                if (existe) {
                  return prev.map((v) => (v.id === ventaId ? (ventaActualizada as Venta) : v));
                }
                if (["pendiente", "preparando", "lista", "credito"].includes(ventaActualizada.estado)) {
                  return [...prev, ventaActualizada as Venta];
                }
                return prev;
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 4. Acciones de avance de estado (Con retroalimentación inmediata por ítem y TTL defensivo)
  const avanzarComanda = useCallback(
    async (id: string, nuevoEstado: "preparando" | "lista") => {
      const now = Date.now();
      const nextProcesando = { ...procesandoIdsRef.current };
      for (const [k, ts] of Object.entries(nextProcesando)) {
        if (now - ts > 20000) delete nextProcesando[k];
      }
      if (nextProcesando[id]) {
        return;
      }
      nextProcesando[id] = now;
      procesandoIdsRef.current = nextProcesando;
      setProcesandoIds(nextProcesando);

      // Accesibilidad: capturar foco si el elemento activo era el botón de esta comanda
      const hadFocus =
        typeof document !== "undefined" &&
        document.activeElement?.id === `kds-btn-${id}`;

      if (hadFocus) {
        if (nuevoEstado === "preparando") {
          const col1 = comandasFiltradasRef.current.filter((v) => v.estado === "pendiente" || v.estado === "credito");
          const idx = col1.findIndex((v) => v.id === id);
          const sig = col1[idx + 1] || col1[idx - 1];
          enfocarProximaRef.current = sig ? sig.id : id;
        } else {
          const col2 = comandasFiltradasRef.current.filter((v) => v.estado === "preparando");
          const idx = col2.findIndex((v) => v.id === id);
          const sig = col2[idx + 1] || col2[idx - 1];
          if (sig) {
            enfocarProximaRef.current = sig.id;
          } else {
            const col1 = comandasFiltradasRef.current.filter((v) => v.estado === "pendiente" || v.estado === "credito");
            enfocarProximaRef.current = col1[0] ? col1[0].id : "kds-filtro-todos";
          }
        }
      }

      const ventaPrevia = ventasRef.current.find((v) => v.id === id);
      const estadoPrevio = ventaPrevia?.estado || "pendiente";

      // Optimistic update
      setVentas((prev) =>
        prev.map((v) => (v.id === id ? { ...v, estado: nuevoEstado } : v))
      );

      if (nuevoEstado === "lista") {
        setUltimaCompletadaId(id);
        if (soundEnabledRef.current) sounds.playCashRegister();
      } else {
        if (soundEnabledRef.current) sounds.playPop();
      }

      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const timeoutPromise = new Promise<{ ok: boolean; error?: string }>((resolve) => {
          timer = setTimeout(() => resolve({ ok: false, error: "TIMEOUT" }), 15000);
        });
        const res = await Promise.race([cambiarEstadoVenta(id, nuevoEstado), timeoutPromise]);
        if (timer) clearTimeout(timer);

        if (!res.ok) {
          if (res.error === "TIMEOUT") {
            mostrarFeedback("error", "Demora en conexión con el servidor. Se reconciliará automáticamente.");
          } else {
            console.error("Error al actualizar estado en cocina:", res.error);
            setVentas((prev) =>
              prev.map((v) => (v.id === id ? { ...v, estado: estadoPrevio } : v))
            );
            if (nuevoEstado === "lista") {
              setUltimaCompletadaId((prev) => (prev === id ? null : prev));
            }
            mostrarFeedback("error", res.error || "No se pudo actualizar la comanda");
          }
        }
      } catch {
        if (timer) clearTimeout(timer);
        setVentas((prev) =>
          prev.map((v) => (v.id === id ? { ...v, estado: estadoPrevio } : v))
        );
        if (nuevoEstado === "lista") {
          setUltimaCompletadaId((prev) => (prev === id ? null : prev));
        }
        mostrarFeedback("error", "Error de red al actualizar comanda");
      } finally {
        const next = { ...procesandoIdsRef.current };
        delete next[id];
        procesandoIdsRef.current = next;
        setProcesandoIds(next);
      }
    },
    [mostrarFeedback]
  );

  // 5. Reversión / Deshacer (G4) - Solo revierte de 'lista' a 'preparando'
  const deshacerComanda = useCallback(
    async (id: string) => {
      const now = Date.now();
      const nextProcesando = { ...procesandoIdsRef.current };
      for (const [k, ts] of Object.entries(nextProcesando)) {
        if (now - ts > 20000) delete nextProcesando[k];
      }
      if (nextProcesando[id]) {
        return;
      }
      nextProcesando[id] = now;
      procesandoIdsRef.current = nextProcesando;
      setProcesandoIds(nextProcesando);

      const comandaActual = ventasRef.current.find((v) => v.id === id);
      if (!comandaActual || comandaActual.estado !== "lista") {
        const next = { ...procesandoIdsRef.current };
        delete next[id];
        procesandoIdsRef.current = next;
        setProcesandoIds(next);
        return;
      }

      setVentas((prev) =>
        prev.map((v) => (v.id === id ? { ...v, estado: "preparando" } : v))
      );
      if (ultimaCompletadaIdRef.current === id) setUltimaCompletadaId(null);
      if (soundEnabledRef.current) sounds.playPop();

      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const timeoutPromise = new Promise<{ ok: boolean; error?: string }>((resolve) => {
          timer = setTimeout(() => resolve({ ok: false, error: "TIMEOUT" }), 15000);
        });
        const res = await Promise.race([cambiarEstadoVenta(id, "preparando"), timeoutPromise]);
        if (timer) clearTimeout(timer);

        if (!res.ok) {
          if (res.error === "TIMEOUT") {
            mostrarFeedback("error", "Demora en conexión al revertir. Se reconciliará en breve.");
          } else {
            setVentas((prev) =>
              prev.map((v) => (v.id === id ? { ...v, estado: "lista" } : v))
            );
            mostrarFeedback("error", res.error || "No se pudo deshacer el estado de la comanda");
          }
        } else {
          mostrarFeedback("exito", `Comanda #${comandaActual.numero_comanda} devuelta a Plancha`);
        }
      } catch {
        if (timer) clearTimeout(timer);
        setVentas((prev) =>
          prev.map((v) => (v.id === id ? { ...v, estado: "lista" } : v))
        );
        mostrarFeedback("error", "Error de red al deshacer comanda");
      } finally {
        const next = { ...procesandoIdsRef.current };
        delete next[id];
        procesandoIdsRef.current = next;
        setProcesandoIds(next);
      }
    },
    [mostrarFeedback]
  );

  // 6. Filtrado y Agrupación de Comandas
  const comandasFiltradas = useMemo(() => {
    return ventas.filter((v) => {
      if (v.estado === "cancelada" || v.estado === "completada") return false;
      if (filtroTipo === "delivery" && v.tipo_entrega !== "delivery") return false;
      if (filtroTipo === "mostrador" && v.tipo_entrega === "delivery") return false;
      return true;
    });
  }, [ventas, filtroTipo]);

  useEffect(() => {
    comandasFiltradasRef.current = comandasFiltradas;
  }, [comandasFiltradas]);

  // Alternar Pantalla Completa
  const toggleFullScreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setPantallaCompleta(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setPantallaCompleta(false);
    }
  }, []);

  const comandasRecienListas = useMemo(
    () => comandasFiltradas.filter((v) => v.estado === "lista").slice(-6).reverse(),
    [comandasFiltradas]
  );

  useEffect(() => {
    comandasRecienListasRef.current = comandasRecienListas;
  }, [comandasRecienListas]);

  // Callbacks memoizados estables para evitar re-renderizado innecesario de TarjetaComanda (N7)
  const handleTirarAPlancha = useCallback(
    (id: string) => {
      avanzarComanda(id, "preparando");
    },
    [avanzarComanda]
  );

  const handleMarcarLista = useCallback(
    (id: string) => {
      avanzarComanda(id, "lista");
    },
    [avanzarComanda]
  );

  // Auto-desenfocar botones del KDS tras interacción de ratón/toque sin romper navegación por Tab (R1/MEDIO-01)
  useEffect(() => {
    const handleAutoBlurButton = (e: MouseEvent | TouchEvent) => {
      // Un click activado por teclado tiene detail === 0: desenfocarlo rompe la navegación accesible (WCAG 2.4.7)
      if (typeof (e as MouseEvent).detail === "number" && (e as MouseEvent).detail === 0) return;
      const btn = (e.target as HTMLElement)?.closest(".kds-wrapper button");
      if (btn) {
        requestAnimationFrame(() => {
          (btn as HTMLElement).blur();
        });
      }
    };
    window.addEventListener("click", handleAutoBlurButton);
    return () => window.removeEventListener("click", handleAutoBlurButton);
  }, []);

  // 7. Atajos de Teclado Físicos (Excluye inputs, delega en botones KDS y descarta modificadores H3)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar combinaciones con teclas modificadoras y repeticiones continuas de tecla sostenida (H3)
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.repeat) {
        return;
      }

      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      // G-01 & MEDIO-1: Si el foco está en CUALQUIER elemento interactivo (botones de cocina, topbar, enlaces),
      // DELEGAR en el comportamiento nativo (Enter/Espacio -> click) y no interferir con la navegación (WCAG 2.1.1)
      if ((e.target as HTMLElement)?.closest("button, a, input, textarea, select")) {
        return;
      }

      // Espacio: Pasa la comanda más vieja visible en 'pendiente' o 'credito' a 'preparando'
      if (e.code === "Space") {
        const pendientes = comandasFiltradasRef.current.filter((v) => v.estado === "pendiente" || v.estado === "credito");
        if (pendientes.length > 0) {
          e.preventDefault();
          avanzarComanda(pendientes[0].id, "preparando");
        }
      }

      // Enter: Pasa la comanda más vieja visible en 'preparando' a 'lista'
      if (e.code === "Enter") {
        const enPlancha = comandasFiltradasRef.current.filter((v) => v.estado === "preparando");
        if (enPlancha.length > 0) {
          e.preventDefault();
          avanzarComanda(enPlancha[0].id, "lista");
        }
      }

      // Tecla Z: Deshacer última lista (con fallback a la primera visible del drawer si F5)
      if (e.code === "KeyZ") {
        e.preventDefault();
        if (ultimaCompletadaIdRef.current) {
          deshacerComanda(ultimaCompletadaIdRef.current);
        } else if (comandasRecienListasRef.current.length > 0) {
          deshacerComanda(comandasRecienListasRef.current[0].id);
        } else {
          mostrarFeedback("error", "No hay comandas recientes en lista para deshacer");
        }
      }

      // Tecla F: Pantalla Completa
      if (e.code === "KeyF") {
        e.preventDefault();
        toggleFullScreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [avanzarComanda, deshacerComanda, toggleFullScreen, mostrarFeedback]);

  const comandasNuevas = useMemo(
    () => comandasFiltradas.filter((v) => v.estado === "pendiente" || v.estado === "credito"),
    [comandasFiltradas]
  );

  const comandasEnPlancha = useMemo(
    () => comandasFiltradas.filter((v) => v.estado === "preparando"),
    [comandasFiltradas]
  );

  // 8. Resumen de Budare en Vivo (Cálculo exacto: arepas individuales y combos de arepas según filtroTipo activo)
  const metricasBudare = useMemo(() => {
    let totalArepas = 0;
    let fritas = 0;
    let asadas = 0;
    const saboresCount: { [nombre: string]: number } = {};

    const activasCocina = comandasFiltradas.filter(
      (v) => v.estado === "pendiente" || v.estado === "credito" || v.estado === "preparando"
    );

    activasCocina.forEach((v) => {
      const coccion = detectarCoccionComanda(v);
      (v.items || []).forEach((it) => {
        const cant = Number(it.cantidad || 1);
        const comboCant = getComboArepasCount(it.producto);
        const esArepa = esArepaIndividual(it.producto);

        // Si NO es combo de arepas ni arepa individual (ej: bebidas, empanadas, etc.), no suma a la plancha
        if (comboCant === null && !esArepa) {
          return;
        }

        const factorArepas = comboCant !== null ? comboCant : 1;
        const arepasDelItem = cant * factorArepas;
        totalArepas += arepasDelItem;

        // M-03: el desglose (xA/yF) es POR RELLENO dentro de notas_item del propio ítem.
        // notas_comanda es texto libre del cajero: NUNCA entra en el desglose numérico.
        const notaItem = `${it.notas || ""} ${it.notas_item || ""}`.toLowerCase();
        let aItem = 0;
        let fItem = 0;
        // M-01: puede haber VARIOS tokens; los regex se crean aquí (lastIndex fresco)
        const reAF = /\((\d+)\s*a\s*\/\s*(\d+)\s*f\)/gi;
        const reFA = /\((\d+)\s*f\s*\/\s*(\d+)\s*a\)/gi;
        let mm: RegExpExecArray | null;
        while ((mm = reAF.exec(notaItem)) !== null) {
          aItem += Number(mm[1]);
          fItem += Number(mm[2]);
        }
        while ((mm = reFA.exec(notaItem)) !== null) {
          fItem += Number(mm[1]);
          aItem += Number(mm[2]);
        }
        aItem *= cant;
        fItem *= cant;

        // Rellenos o arepas sin desglose explícito (xA/yF)
        const restante = Math.max(0, arepasDelItem - (aItem + fItem));
        if (restante > 0) {
          const esItemAsada = /asad/i.test(notaItem);
          const esItemFrita = /frit/i.test(notaItem);
          if (esItemAsada && !esItemFrita) {
            aItem += restante;
          } else if (esItemFrita && !esItemAsada) {
            fItem += restante;
          } else if (coccion.tipo === "asadas") {
            aItem += restante;
          } else {
            fItem += restante; // Default gastronómico del negocio: fritas (combo-helper.ts:178)
          }
        }

        // Invariante dura: nunca clasificar más arepas de las que existen (M-02)
        const suma = aItem + fItem;
        if (suma > arepasDelItem) {
          const factor = arepasDelItem / suma;
          aItem = Math.floor(aItem * factor);
          fItem = arepasDelItem - aItem;
        }
        asadas += aItem;
        fritas += fItem;

        // Conteo por sabores de arepas (excluye nombres genéricos de combos)
        if (esArepa) {
          const nombreLimpio = (it.producto?.nombre || "Arepa")
            .replace(/^Arepa\s+/i, "")
            .trim();
          saboresCount[nombreLimpio] = (saboresCount[nombreLimpio] || 0) + arepasDelItem;
        } else if (comboCant !== null && it.extras && it.extras.length > 0) {
          it.extras.forEach((ext) => {
            const nomSabor = (ext.extra?.nombre || "")
              .replace(/^Arepa\s+/i, "")
              .replace(/\s*\([^)]*\)/g, "")
              .trim();
            if (nomSabor) {
              saboresCount[nomSabor] = (saboresCount[nomSabor] || 0) + (Number(ext.cantidad || 1) * cant);
            }
          });
        }
      });
    });

    const topSabores = Object.entries(saboresCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([sabor, cant]) => `${cant} ${sabor}`);

    return { totalArepas, fritas, asadas, topSabores };
  }, [comandasFiltradas]);

  return (
    <div className="kds-wrapper">
      {/* 1. CABECERA PRINCIPAL */}
      <header className="kds-header">
        <div className="kds-brand-wrap">
          <div>
            <div className="kds-title-row">
              <h1 className="kds-title">KDS Plancha</h1>
              <span className="kds-badge-live">
                <span className="kds-dot-live"></span>
                En Vivo
              </span>
            </div>
            <p className="kds-clock">{horaActual || "--:--:--"}</p>
          </div>
        </div>

        {/* Centro: Resumen en Budare */}
        <div className="kds-budare-bar">
          <div className="kds-budare-stat">
            <span className="kds-budare-stat-label">Por Cocinar</span>
            <span className="kds-budare-stat-val">
              {metricasBudare.totalArepas} <small>arepas</small>
            </span>
          </div>

          <div className="kds-budare-divider"></div>

          <div className="kds-budare-pills">
            <span className="kds-pill-fritas">{metricasBudare.fritas} Fritas</span>
            <span className="kds-pill-asadas">{metricasBudare.asadas} Asadas</span>
          </div>

          {metricasBudare.topSabores.length > 0 && (
            <>
              <div className="kds-budare-divider"></div>
              <div className="kds-budare-sabores" title={metricasBudare.topSabores.join(" • ")}>
                {metricasBudare.topSabores.join(" • ")}
              </div>
            </>
          )}
        </div>

        {/* Derecha: Filtros, Sonido y Pantalla Completa */}
        <div className="kds-controls">
          <div className="kds-filter-tabs">
            <button
              id="kds-filtro-todos"
              onClick={() => setFiltroTipo("todos")}
              aria-pressed={filtroTipo === "todos"}
              className={`kds-filter-tab ${filtroTipo === "todos" ? "active" : ""}`}
            >
              Todos ({comandasNuevas.length + comandasEnPlancha.length})
            </button>
            <button
              onClick={() => setFiltroTipo("delivery")}
              aria-pressed={filtroTipo === "delivery"}
              className={`kds-filter-tab ${filtroTipo === "delivery" ? "active" : ""}`}
            >
              Delivery
            </button>
            <button
              onClick={() => setFiltroTipo("mostrador")}
              aria-pressed={filtroTipo === "mostrador"}
              className={`kds-filter-tab ${filtroTipo === "mostrador" ? "active" : ""}`}
            >
              Local/Pickup
            </button>
          </div>

          {/* Toggle Sonido */}
          <button
            onClick={() => {
              const nuevo = sounds.toggleSound();
              notifySoundChange();
              if (nuevo) sounds.playKitchenBell();
            }}
            title={sonidoHabilitado ? "Silenciar campana" : "Activar campana"}
            aria-label={sonidoHabilitado ? "Silenciar campana de cocina" : "Activar campana de cocina"}
            aria-pressed={sonidoHabilitado}
            className={`kds-btn-icon ${sonidoHabilitado ? "active" : "muted"}`}
          >
            {sonidoHabilitado ? (
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            ) : (
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            )}
          </button>

          {/* Botón Pantalla Completa */}
          <button
            onClick={toggleFullScreen}
            title={pantallaCompleta ? "Salir de pantalla completa (F)" : "Pantalla completa (F)"}
            aria-label={pantallaCompleta ? "Salir de pantalla completa" : "Pantalla completa"}
            className={`kds-btn-icon ${pantallaCompleta ? "active" : ""}`}
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
            </svg>
          </button>
        </div>
      </header>

      {/* Banner de alerta de conexión si falla Supabase */}
      {errorConexion && (
        <div role="alert" className="kds-banner-alerta error">
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="kds-banner-texto">Aviso de conexión: {errorConexion}. La pantalla puede no estar actualizada.</span>
          <button onClick={() => refrescarComandas()} className="kds-banner-btn">Reintentar</button>
        </div>
      )}

      {/* Banner de campana en espera por política de autoplay */}
      {audioBloqueado && sonidoHabilitado && (
        <div
          role="status"
          className="kds-banner-alerta audio"
          onClick={() => {
            sounds.resumeContext().then((running) => {
              if (running) setAudioBloqueado(false);
            });
          }}
        >
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
          <span className="kds-banner-texto">Campana en espera de interacción: Haz clic aquí o toca cualquier tecla para activar el sonido de comandas.</span>
          <button
            className="kds-banner-btn"
            onClick={(e) => {
              e.stopPropagation();
              sounds.resumeContext().then((running) => {
                if (running) {
                  setAudioBloqueado(false);
                  sounds.playPop();
                }
              });
            }}
          >
            Habilitar Sonido
          </button>
        </div>
      )}

      {/* 2. TABLERO DE 2 COLUMNAS */}
      <main className="kds-board">
        {/* COLUMNA 1: POR ENTRAR A PLANCHA (Pendientes) */}
        <section className="kds-column">
          <div className="kds-col-header">
            <div className="kds-col-title-wrap">
              <span className="kds-col-dot-amber"></span>
              <h2 className="kds-col-title">Por Entrar a Plancha</h2>
            </div>
            <span className="kds-col-badge-amber">{comandasNuevas.length}</span>
          </div>

          <div className="kds-col-body">
            {comandasNuevas.length === 0 ? (
              <div className="kds-empty-box">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                </svg>
                <p className="kds-empty-title">No hay comandas nuevas en cola</p>
                <p className="kds-empty-desc">Aparecerán automáticamente aquí</p>
              </div>
            ) : (
              comandasNuevas.map((comanda, idx) => (
                <TarjetaComanda
                  key={comanda.id}
                  comanda={comanda}
                  esPrimera={idx === 0}
                  mounted={isClient}
                  tick={tiempoTick}
                  onAvanzar={handleTirarAPlancha}
                  labelBoton="Tirar a Plancha"
                  atajo="Espacio"
                  botonModificador="kds-btn-plancha"
                  deshabilitado={!!procesandoIds[comanda.id]}
                />
              ))
            )}
          </div>
        </section>

        {/* COLUMNA 2: EN PLANCHA (Preparando) */}
        <section className="kds-column">
          <div className="kds-col-header">
            <div className="kds-col-title-wrap">
              <span className="kds-col-dot-cyan"></span>
              <h2 className="kds-col-title">En Plancha / Cocinando</h2>
            </div>
            <span className="kds-col-badge-cyan">{comandasEnPlancha.length}</span>
          </div>

          <div className="kds-col-body">
            {comandasEnPlancha.length === 0 ? (
              <div className="kds-empty-box">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                </svg>
                <p className="kds-empty-title">Plancha disponible</p>
                <p className="kds-empty-desc">Presiona &quot;Tirar a Plancha&quot; para comenzar</p>
              </div>
            ) : (
              comandasEnPlancha.map((comanda, idx) => (
                <TarjetaComanda
                  key={comanda.id}
                  comanda={comanda}
                  esPrimera={idx === 0}
                  mounted={isClient}
                  tick={tiempoTick}
                  onAvanzar={handleMarcarLista}
                  labelBoton="Marcar Lista"
                  atajo="Enter"
                  botonModificador="kds-btn-lista"
                  deshabilitado={!!procesandoIds[comanda.id]}
                />
              ))
            )}
          </div>
        </section>
      </main>

      {/* 3. BARRA INFERIOR / RECIÉN LISTAS & HISTORIAL */}
      <footer className="kds-footer">
        <div className="kds-drawer-left">
          <span className="kds-drawer-title">Recién Listas ({comandasRecienListas.length}):</span>

          {comandasRecienListas.length === 0 ? (
            <span className="kds-drawer-empty">No hay comandas despachadas recientemente</span>
          ) : (
            <div className="kds-recent-list">
              {comandasRecienListas.map((c) => (
                <div key={c.id} className="kds-recent-card">
                  <span className="kds-recent-id">#{c.numero_comanda}</span>
                  <span className="kds-recent-client">
                    {c.cliente?.nombre || c.tipo_entrega}
                  </span>
                  <button
                    onClick={() => deshacerComanda(c.id)}
                    title="Devolver a En Plancha"
                    className="kds-btn-undo"
                  >
                    Deshacer
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Leyenda de Atajos de Teclado */}
        <div className="kds-shortcuts-legend">
          <span><kbd>Espacio</kbd> A Plancha</span>
          <span><kbd>Enter</kbd> Marcar Lista</span>
          <span><kbd>Z</kbd> Deshacer</span>
          <span><kbd>F</kbd> Pantalla Completa</span>
        </div>
      </footer>

      {/* Región ARIA permanente para tecnologías de asistencia */}
      <div role="status" aria-live="polite" className="sr-only">
        {feedback ? feedback.texto : ""}
      </div>

      {/* Notificación Flotante Visual de Feedback */}
      {feedback && (
        <div aria-hidden="true" className={`kds-feedback-toast ${feedback.tipo}`}>
          {feedback.tipo === "exito" ? (
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <span>{feedback.texto}</span>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTE: Tarjeta de Comanda Individual (Alto Contraste)
// =============================================================================
interface TarjetaComandaProps {
  comanda: Venta;
  esPrimera: boolean;
  mounted: boolean;
  tick: number;
  onAvanzar: (id: string) => void;
  labelBoton: string;
  atajo?: string;
  botonModificador: string;
  deshabilitado: boolean;
}

const TarjetaComanda = memo(function TarjetaComanda({
  comanda,
  esPrimera,
  mounted,
  tick,
  onAvanzar,
  labelBoton,
  atajo,
  botonModificador,
  deshabilitado,
}: TarjetaComandaProps) {
  void tick; // El cambio de valor numérico de la prop tick cada segundo invalida la comparación de memo y actualiza el cronómetro (H1)
  const coccion = detectarCoccionComanda(comanda);
  const tiempo = calcularTiempoTranscurrido(comanda.fecha, mounted);

  const esDelivery = comanda.tipo_entrega === "delivery";
  const esPickup = comanda.tipo_entrega === "pickup";
  const esCredito =
    comanda.estado === "credito" ||
    comanda.metodo_pago === "credito" ||
    /\[ABONO CRÉDITO/i.test(comanda.notas_comanda || "");

  return (
    <div data-card-id={comanda.id} className={`kds-card ${esPrimera ? "kds-card-primera" : ""}`}>
      {/* Cabecera: # Comanda, Badges de Entrega, Crédito y Cronómetro */}
      <div className="kds-card-topbar">
        <div className="kds-card-topbar-left">
          <span className="kds-comanda-id">#{comanda.numero_comanda}</span>

          {esDelivery ? (
            <span className="kds-badge-delivery">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1m-6 0a2 2 0 100-4 2 2 0 000 4zm10 0a2 2 0 100-4 2 2 0 000 4z" />
              </svg>
              Delivery {comanda.delivery_zona_nombre ? `• ${comanda.delivery_zona_nombre}` : ""}
            </span>
          ) : esPickup ? (
            <span className="kds-badge-pickup">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              Pickup / Retiro
            </span>
          ) : (
            <span className="kds-badge-local">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Local
            </span>
          )}

          {esCredito && (
            <span className="kds-badge-credito">
              Crédito
            </span>
          )}
        </div>

        {/* Cronómetro Dinámico */}
        <div className={`kds-timer-pill ${tiempo.colorClass}`}>
          {tiempo.texto}
        </div>
      </div>

      {/* Badge de Cocción (Planchero) */}
      <div className="kds-coccion-row">
        <span className={`kds-badge-coccion ${coccion.tipo}`}>
          {coccion.label}
        </span>

        {comanda.cliente?.nombre && (
          <span className="kds-client-name">
            Cliente: <strong>{comanda.cliente.nombre}</strong>
          </span>
        )}
      </div>

      {/* Lista de Ítems / Arepas */}
      <div className="kds-items-list">
        {(comanda.items || []).map((item: VentaItem, i: number) => {
          const extrasList = item.extras || [];
          const itemKey = item.id ? `${comanda.id}-${item.id}` : `${comanda.id}-it-${i}`;
          return (
            <div key={itemKey} className="kds-item-card">
              <div className="kds-item-main">
                <span className="kds-item-qty">{item.cantidad}x</span>
                <span className="kds-item-name">{item.producto?.nombre || "Arepa"}</span>
              </div>

              {/* Rellenos / Modificadores (en combos o adicionales) */}
              {extrasList.length > 0 && (
                <div className="kds-extras-list">
                  {extrasList.map((ext: VentaItemExtra, extIdx: number) => {
                    const extraKey = ext.id ? `${itemKey}-${ext.id}` : `${itemKey}-ext-${extIdx}`;
                    return (
                      <div key={extraKey} className="kds-extra-row">
                        <span className="kds-extra-arrow">↳</span>
                        <span className="kds-extra-name">
                          {Number(ext.cantidad || 1) > 1 ? `${ext.cantidad}x ` : ""}
                          {ext.extra?.nombre || "Extra"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Nota específica de este ítem si tiene */}
              {(item.notas || item.notas_item) && (
                <div className="kds-item-nota">
                  Nota: {item.notas || item.notas_item}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Nota General de Cocina / Alergias */}
      {comanda.notas_comanda && (
        <div className="kds-alerta-comanda">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{comanda.notas_comanda}</span>
        </div>
      )}

      {/* Botón de Acción Principal */}
      <div className="kds-action-btn-wrap">
        <button
          id={`kds-btn-${comanda.id}`}
          onClick={() => onAvanzar(comanda.id)}
          disabled={deshabilitado}
          className={`kds-btn-action ${botonModificador}`}
        >
          <span>{deshabilitado ? "Guardando..." : labelBoton}</span>
          {esPrimera && atajo && (
            <kbd className="kds-kbd-badge">{atajo}</kbd>
          )}
        </button>
      </div>
    </div>
  );
});
