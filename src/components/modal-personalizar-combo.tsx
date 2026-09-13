"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { Producto, ExtraModificador } from "@/types/database";
import { RELLENOS_AREPAS_COMBO, serializarRellenosCombo, getProductImage, RELLENO_A_EXTRA_NOMBRE } from "@/lib/combo-helper";
import { sounds } from "@/lib/sound-effects";

export interface ComboConfirmResult {
  notasItem: string;
  extrasIds: string[];
}

interface ModalPersonalizarComboProps {
  producto: Producto;
  totalArepas: number;
  extras: ExtraModificador[];
  onConfirmar: (result: ComboConfirmResult) => void;
  onCerrar: () => void;
}

export default function ModalPersonalizarCombo({
  producto,
  totalArepas,
  extras,
  onConfirmar,
  onCerrar,
}: ModalPersonalizarComboProps) {
  const [rellenos, setRellenos] = useState<Record<string, number>>({});
  // Recargos gourmet aplicados por relleno (por defecto igual a la cantidad seleccionada)
  const [recargosAplicados, setRecargosAplicados] = useState<Record<string, number>>({});
  const [notaOpcional, setNotaOpcional] = useState("");
  const modalCardRef = useRef<HTMLDivElement>(null);

  // Índice de extras por nombre normalizado para lookup rápido
  const extrasPorNombre = useMemo(() => {
    const map = new Map<string, ExtraModificador>();
    for (const ext of extras) {
      map.set(ext.nombre.toLowerCase().trim(), ext);
    }
    return map;
  }, [extras]);

  const totalSeleccionadas = useMemo(() => {
    return Object.values(rellenos).reduce((acc, curr) => acc + (curr || 0), 0);
  }, [rellenos]);

  // Recargo total acumulado por seleccionar arepas especiales o gourmet (+0.50$ c/u)
  const recargoTotal = useMemo(() => {
    let extraSuma = 0;
    for (const relleno of RELLENOS_AREPAS_COMBO) {
      const cant = rellenos[relleno.id] || 0;
      if (cant > 0) {
        const extraNombre = RELLENO_A_EXTRA_NOMBRE[relleno.id];
        const extraEnBd = extraNombre ? extrasPorNombre.get(extraNombre.toLowerCase().trim()) : null;
        const precioUnitExtra = Number(extraEnBd?.precio_extra_usd ?? relleno.recargo ?? 0);
        if (precioUnitExtra > 0) {
          const aplicados = recargosAplicados[relleno.id] ?? cant;
          const numCobrar = Math.min(cant, Math.max(0, aplicados));
          extraSuma += precioUnitExtra * numCobrar;
        }
      }
    }
    return extraSuma;
  }, [rellenos, extrasPorNombre, recargosAplicados]);

  const precioFinalCombo = useMemo(() => {
    return Number(producto.precio_usd || 0) + recargoTotal;
  }, [producto.precio_usd, recargoTotal]);

  const faltantes = Math.max(0, totalArepas - totalSeleccionadas);
  const esCompleto = totalSeleccionadas === totalArepas;

  // Bloqueo estricto del scroll de fondo para iOS y Android
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalTop = document.body.style.top;
    const scrollY = window.scrollY;

    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.top = originalTop;
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
    };
  }, []);

  // Escape key handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCerrar();
      }
    },
    [onCerrar]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleModificarRelleno = (rellenoId: string, delta: number) => {
    const actual = rellenos[rellenoId] || 0;
    const nuevo = actual + delta;
    if (nuevo < 0) return;

    if (delta > 0 && totalSeleccionadas >= totalArepas) return;

    if (delta > 0) sounds.playPop();
    else sounds.playDelete();

    setRellenos((prev) => {
      const next = { ...prev };
      if (nuevo === 0) {
        delete next[rellenoId];
      } else {
        next[rellenoId] = nuevo;
      }
      return next;
    });

    setRecargosAplicados((prevRecargos) => {
      const nextRecargos = { ...prevRecargos };
      if (nuevo === 0) {
        delete nextRecargos[rellenoId];
      } else if (delta > 0) {
        nextRecargos[rellenoId] = (nextRecargos[rellenoId] ?? actual) + 1;
      } else {
        nextRecargos[rellenoId] = Math.max(0, Math.min(nuevo, nextRecargos[rellenoId] ?? actual));
      }
      return nextRecargos;
    });
  };

  const handleModificarRecargo = (rellenoId: string, delta: number) => {
    const cant = rellenos[rellenoId] || 0;
    if (cant <= 0) return;
    const actual = recargosAplicados[rellenoId] ?? cant;
    const nuevo = Math.max(0, Math.min(cant, actual + delta));
    if (nuevo === actual) return;

    if (delta > 0) sounds.playPop();
    else sounds.playDelete();

    setRecargosAplicados((prev) => ({ ...prev, [rellenoId]: nuevo }));
  };

  const handleConfirmar = () => {
    if (!esCompleto) return;
    sounds.playKitchenBell();
    const textoNotas = serializarRellenosCombo(rellenos, notaOpcional);

    // Construir extrasIds: por cada arepa elegida, buscar el extra de la BD N veces (según recargos cobrados)
    const extrasIds: string[] = [];
    for (const [rellenoId, cantidad] of Object.entries(rellenos)) {
      const extraNombre = RELLENO_A_EXTRA_NOMBRE[rellenoId];
      if (!extraNombre) continue;
      const extraEnBd = extrasPorNombre.get(extraNombre.toLowerCase().trim());
      if (extraEnBd) {
        const aplicados = recargosAplicados[rellenoId] ?? cantidad;
        const numCobrar = Math.min(cantidad, Math.max(0, aplicados));
        for (let i = 0; i < numCobrar; i++) {
          extrasIds.push(extraEnBd.id);
        }
      }
    }

    onConfirmar({ notasItem: textoNotas, extrasIds });
  };

  return (
    <div
      className="combo-modal-overlay"
      onClick={onCerrar}
      role="dialog"
      aria-modal="true"
      aria-labelledby="combo-modal-title"
    >
      <div
        ref={modalCardRef}
        className="combo-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header del Modal */}
        <div className="combo-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {getProductImage(producto) ? (
              <Image
                src={getProductImage(producto)!}
                alt={producto.nombre}
                width={48}
                height={48}
                style={{ borderRadius: 10, objectFit: "cover", border: "1px solid var(--border)" }}
              />
            ) : (
              <span className="combo-flavor-icon" aria-hidden="true">{producto.icono || "🍱"}</span>
            )}
            <div>
              <h2 id="combo-modal-title" style={{ fontSize: 17, fontWeight: 900, color: "var(--text)", margin: 0 }}>
                Elige los Rellenos del Combo
              </h2>
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, fontWeight: 700 }}>
                {producto.nombre} {recargoTotal > 0 && <span style={{ color: "#d97706" }}>(+${recargoTotal.toFixed(2)} por gourmet)</span>}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="combo-modal-close-btn"
            aria-label="Cerrar modal de rellenos"
          >
            ✕
          </button>
        </div>

        {/* Barra de Progreso de Arepas Seleccionadas */}
        <div className="combo-progress-box">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 900, color: esCompleto ? "#15803d" : "var(--text)" }}>
              {esCompleto
                ? `✅ ¡Listo! (${totalSeleccionadas} de ${totalArepas} seleccionadas)`
                : `Selecciona tus arepas: (${totalSeleccionadas} de ${totalArepas})`}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 900,
                color: esCompleto ? "#15803d" : "var(--primary-dark)",
                background: esCompleto ? "rgba(21, 128, 61, 0.15)" : "var(--primary-light)",
                padding: "3px 10px",
                borderRadius: 12,
                border: "1px solid var(--border)",
              }}
            >
              {esCompleto ? "Completo" : `Faltan ${faltantes}`}
            </span>
          </div>

          <div style={{ height: 8, background: "var(--bg-card)", borderRadius: 6, overflow: "hidden", border: "1px solid var(--border)" }}>
            <div
              style={{
                height: "100%",
                width: `${Math.min(100, (totalSeleccionadas / totalArepas) * 100)}%`,
                background: esCompleto
                  ? "linear-gradient(90deg, #10b981, #059669)"
                  : "linear-gradient(90deg, #f59e0b, #d97706)",
                transition: "width 0.25s ease",
              }}
            />
          </div>
        </div>

        {/* Lista de Rellenos con Stepper */}
        <div className="combo-flavors-list">
          {RELLENOS_AREPAS_COMBO.map((relleno) => {
            const cant = rellenos[relleno.id] || 0;
            const puedeSumar = totalSeleccionadas < totalArepas;

            const extraNombre = RELLENO_A_EXTRA_NOMBRE[relleno.id];
            const extraEnBd = extraNombre ? extrasPorNombre.get(extraNombre.toLowerCase().trim()) : null;
            const precioUnitExtra = Number(extraEnBd?.precio_extra_usd ?? relleno.recargo ?? 0);
            const numRecargos = Math.min(cant, Math.max(0, recargosAplicados[relleno.id] ?? cant));

            return (
              <div
                key={relleno.id}
                className={`combo-flavor-row ${cant > 0 ? "flavor-selected" : ""}`}
                style={
                  precioUnitExtra > 0 && cant > 0
                    ? { flexDirection: "column", alignItems: "stretch", gap: 10 }
                    : undefined
                }
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                  <div className="combo-flavor-info">
                    {relleno.imagen ? (
                      <Image
                        src={relleno.imagen}
                        alt={relleno.nombre}
                        width={48}
                        height={48}
                        className="combo-flavor-img"
                      />
                    ) : (
                      <span className="combo-flavor-icon" aria-hidden="true">
                        {relleno.icono}
                      </span>
                    )}
                    <div>
                      <div className="combo-flavor-name" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span>{relleno.nombre}</span>
                        {precioUnitExtra > 0 && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              color: "#b45309",
                              background: "#fef3c7",
                              border: "1px solid #fde68a",
                              padding: "1px 6px",
                              borderRadius: 6,
                            }}
                          >
                            +${precioUnitExtra.toFixed(2)}
                          </span>
                        )}
                      </div>
                      <div className="combo-flavor-desc">
                        {relleno.desc}
                      </div>
                    </div>
                  </div>

                  {/* Controles de Cantidad */}
                  <div className="combo-stepper-wrap">
                    <button
                      type="button"
                      disabled={cant <= 0}
                      onClick={() => handleModificarRelleno(relleno.id, -1)}
                      className="combo-stepper-btn"
                      aria-label={`Restar una ${relleno.nombre}`}
                    >
                      −
                    </button>

                    <span className={`combo-stepper-num ${cant > 0 ? "has-count" : ""}`}>
                      {cant}
                    </span>

                    <button
                      type="button"
                      disabled={!puedeSumar}
                      onClick={() => handleModificarRelleno(relleno.id, 1)}
                      className={`combo-stepper-btn ${puedeSumar ? "plus-active" : ""}`}
                      aria-label={`Sumar una ${relleno.nombre}`}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Control de Recargo Gourmet para este Relleno */}
                {precioUnitExtra > 0 && cant > 0 && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 10px",
                      background: numRecargos === 0 ? "rgba(34, 197, 94, 0.12)" : "rgba(245, 158, 11, 0.12)",
                      border: `1px solid ${numRecargos === 0 ? "rgba(34, 197, 94, 0.3)" : "rgba(245, 158, 11, 0.3)"}`,
                      borderRadius: 8,
                      fontSize: 11.5,
                    }}
                  >
                    <span style={{ fontWeight: 800, color: numRecargos === 0 ? "#16a34a" : "#b45309" }}>
                      {numRecargos === 0 ? (
                        `✨ Recargo $${precioUnitExtra.toFixed(2)} exonerado (0 cobrados)`
                      ) : (
                        `⚡ Recargo (+$${(numRecargos * precioUnitExtra).toFixed(2)}): ${numRecargos} de ${cant} arepa${cant > 1 ? "s" : ""}`
                      )}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <button
                        type="button"
                        disabled={numRecargos <= 0}
                        onClick={() => handleModificarRecargo(relleno.id, -1)}
                        aria-label={`Restar un recargo de $${precioUnitExtra.toFixed(2)}`}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 6,
                          border: "1px solid var(--border)",
                          background: "var(--bg-card)",
                          color: "var(--text)",
                          fontWeight: 900,
                          fontSize: 13,
                          cursor: numRecargos <= 0 ? "not-allowed" : "pointer",
                          opacity: numRecargos <= 0 ? 0.35 : 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        −
                      </button>
                      <span style={{ minWidth: 20, textAlign: "center", fontWeight: 900, fontSize: 12 }}>
                        {numRecargos}
                      </span>
                      <button
                        type="button"
                        disabled={numRecargos >= cant}
                        onClick={() => handleModificarRecargo(relleno.id, 1)}
                        aria-label={`Sumar un recargo de $${precioUnitExtra.toFixed(2)}`}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 6,
                          border: "1px solid var(--border)",
                          background: "var(--bg-card)",
                          color: "var(--text)",
                          fontWeight: 900,
                          fontSize: 13,
                          cursor: numRecargos >= cant ? "not-allowed" : "pointer",
                          opacity: numRecargos >= cant ? 0.35 : 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        +
                      </button>
                      {numRecargos > 0 ? (
                        <button
                          type="button"
                          onClick={() => setRecargosAplicados((prev) => ({ ...prev, [relleno.id]: 0 }))}
                          style={{
                            marginLeft: 4,
                            padding: "3px 7px",
                            fontSize: 10,
                            fontWeight: 800,
                            borderRadius: 5,
                            border: "none",
                            background: "rgba(239, 68, 68, 0.15)",
                            color: "#dc2626",
                            cursor: "pointer",
                          }}
                        >
                          Exonerar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setRecargosAplicados((prev) => ({ ...prev, [relleno.id]: cant }))}
                          style={{
                            marginLeft: 4,
                            padding: "3px 7px",
                            fontSize: 10,
                            fontWeight: 800,
                            borderRadius: 5,
                            border: "none",
                            background: "rgba(34, 197, 94, 0.15)",
                            color: "#16a34a",
                            cursor: "pointer",
                          }}
                        >
                          Cobrar todo
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Observación Opcional con maxLength */}
        <div className="combo-obs-wrap">
          <input
            type="text"
            maxLength={60}
            aria-label="Observación opcional para el combo"
            placeholder="Observación opcional (ej: 1 Pelúa sin queso, salsas aparte...)"
            value={notaOpcional}
            onChange={(e) => setNotaOpcional(e.target.value)}
            className="combo-obs-input"
          />
        </div>

        {/* Botones de Acción */}
        <div className="combo-actions-wrap">
          <button
            type="button"
            onClick={onCerrar}
            className="combo-btn-cancel"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!esCompleto}
            onClick={handleConfirmar}
            className="combo-btn-confirm"
          >
            {esCompleto
              ? `Listo • Agregar Combo ($${precioFinalCombo.toFixed(2)})`
              : `Elige ${faltantes} más`}
          </button>
        </div>
      </div>
    </div>
  );
}
