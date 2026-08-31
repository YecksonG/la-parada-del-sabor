"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { Producto } from "@/types/database";
import { RELLENOS_AREPAS_COMBO, serializarRellenosCombo, getProductImage } from "@/lib/combo-helper";
import { sounds } from "@/lib/sound-effects";

interface ModalPersonalizarComboProps {
  producto: Producto;
  totalArepas: number;
  onConfirmar: (notasItem: string) => void;
  onCerrar: () => void;
}

export default function ModalPersonalizarCombo({
  producto,
  totalArepas,
  onConfirmar,
  onCerrar,
}: ModalPersonalizarComboProps) {
  const [rellenos, setRellenos] = useState<Record<string, number>>({});
  const [notaOpcional, setNotaOpcional] = useState("");
  const modalCardRef = useRef<HTMLDivElement>(null);

  const totalSeleccionadas = useMemo(() => {
    return Object.values(rellenos).reduce((acc, curr) => acc + (curr || 0), 0);
  }, [rellenos]);

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
    setRellenos((prev) => {
      const actual = prev[rellenoId] || 0;
      const nuevo = actual + delta;
      if (nuevo < 0) return prev;

      const totalActual = Object.values(prev).reduce((acc, c) => acc + (c || 0), 0);
      if (delta > 0 && totalActual >= totalArepas) return prev;

      if (delta > 0) sounds.playPop();
      else sounds.playDelete();

      const next = { ...prev };
      if (nuevo === 0) {
        delete next[rellenoId];
      } else {
        next[rellenoId] = nuevo;
      }
      return next;
    });
  };

  const handleConfirmar = () => {
    if (!esCompleto) return;
    sounds.playKitchenBell();
    const textoNotas = serializarRellenosCombo(rellenos, notaOpcional);
    onConfirmar(textoNotas);
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
                {producto.nombre}
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

            return (
              <div
                key={relleno.id}
                className={`combo-flavor-row ${cant > 0 ? "flavor-selected" : ""}`}
              >
                <div className="combo-flavor-info">
                  <span className="combo-flavor-icon" aria-hidden="true">{relleno.icono}</span>
                  <div>
                    <div className="combo-flavor-name">
                      {relleno.nombre}
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
            {esCompleto ? `Listo • Agregar Combo ($${Number(producto.precio_usd).toFixed(2)})` : `Elige ${faltantes} más`}
          </button>
        </div>
      </div>
    </div>
  );
}
