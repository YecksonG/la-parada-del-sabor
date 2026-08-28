"use client";

import { useState, useMemo } from "react";
import { Producto } from "@/types/database";
import { SABORES_AREPAS_COMBO, serializarSaboresCombo } from "@/lib/combo-helper";
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
  const [sabores, setSabores] = useState<Record<string, number>>({});
  const [notaOpcional, setNotaOpcional] = useState("");

  const totalSeleccionadas = useMemo(() => {
    return Object.values(sabores).reduce((acc, curr) => acc + (curr || 0), 0);
  }, [sabores]);

  const faltantes = totalArepas - totalSeleccionadas;
  const esCompleto = totalSeleccionadas === totalArepas;

  const handleModificarSabor = (saborId: string, delta: number) => {
    const actual = sabores[saborId] || 0;
    const nuevo = actual + delta;

    if (nuevo < 0) return;
    if (delta > 0 && totalSeleccionadas >= totalArepas) return;

    if (delta > 0) sounds.playPop();
    else sounds.playDelete();

    setSabores((prev) => {
      const next = { ...prev };
      if (nuevo === 0) {
        delete next[saborId];
      } else {
        next[saborId] = nuevo;
      }
      return next;
    });
  };

  const handleConfirmar = () => {
    if (!esCompleto) return;
    sounds.playKitchenBell();
    const textoNotas = serializarSaboresCombo(sabores, notaOpcional);
    onConfirmar(textoNotas);
  };

  return (
    <div className="modal-overlay" onClick={onCerrar} style={{ zIndex: 9999 }}>
      <div
        className="modal-card combo-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 520, width: "94%", maxHeight: "90vh", display: "flex", flexDirection: "column" }}
      >
        {/* Header del Modal */}
        <div className="combo-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 28 }}>{producto.icono || "🍱"}</span>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 900, color: "var(--text)", margin: 0 }}>
                Elige los Sabores del Combo
              </h2>
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, fontWeight: 600 }}>
                {producto.nombre}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="combo-modal-close-btn"
            title="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Barra de Progreso de Arepas Seleccionadas */}
        <div className="combo-progress-box">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: esCompleto ? "#16a34a" : "var(--text)" }}>
              {esCompleto
                ? `✅ ¡Listo! (${totalSeleccionadas}/${totalArepas} seleccionadas)`
                : `Selecciona tus arepas: (${totalSeleccionadas} de ${totalArepas})`}
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: esCompleto ? "#16a34a" : "var(--primary)",
                background: esCompleto ? "rgba(22, 163, 74, 0.12)" : "rgba(230, 92, 0, 0.12)",
                padding: "2px 8px",
                borderRadius: 12,
              }}
            >
              {esCompleto ? "Completo" : `Faltan ${faltantes}`}
            </span>
          </div>

          <div style={{ height: 8, background: "var(--bg-subtle)", borderRadius: 6, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${Math.min(100, (totalSeleccionadas / totalArepas) * 100)}%`,
                background: esCompleto
                  ? "linear-gradient(90deg, #22c55e, #16a34a)"
                  : "linear-gradient(90deg, #f97316, #e65c00)",
                transition: "width 0.25s ease",
              }}
            />
          </div>
        </div>

        {/* Lista de Sabores con Stepper */}
        <div className="combo-flavors-list" style={{ overflowY: "auto", flex: 1, padding: "10px 0", display: "flex", flexDirection: "column", gap: 8 }}>
          {SABORES_AREPAS_COMBO.map((sabor) => {
            const cant = sabores[sabor.id] || 0;
            const puedeSumar = totalSeleccionadas < totalArepas;

            return (
              <div
                key={sabor.id}
                className={`combo-flavor-row ${cant > 0 ? "flavor-selected" : ""}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: cant > 0 ? "1.5px solid var(--primary)" : "1px solid var(--border)",
                  background: cant > 0 ? "rgba(230, 92, 0, 0.05)" : "var(--card-bg)",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                  <span style={{ fontSize: 22 }}>{sabor.icono}</span>
                  <div>
                    <strong style={{ fontSize: 14, color: "var(--text)", display: "block" }}>
                      {sabor.nombre}
                    </strong>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
                      {sabor.desc}
                    </span>
                  </div>
                </div>

                {/* Controles de Cantidad */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    disabled={cant <= 0}
                    onClick={() => handleModificarSabor(sabor.id, -1)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: cant > 0 ? "var(--surface)" : "var(--bg-subtle)",
                      color: cant > 0 ? "var(--text)" : "var(--text-muted)",
                      fontWeight: 900,
                      fontSize: 16,
                      cursor: cant > 0 ? "pointer" : "not-allowed",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    -
                  </button>

                  <span
                    style={{
                      minWidth: 20,
                      textAlign: "center",
                      fontSize: 15,
                      fontWeight: 800,
                      color: cant > 0 ? "var(--primary)" : "var(--text-muted)",
                    }}
                  >
                    {cant}
                  </span>

                  <button
                    type="button"
                    disabled={!puedeSumar}
                    onClick={() => handleModificarSabor(sabor.id, 1)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      border: "none",
                      background: puedeSumar ? "var(--primary)" : "var(--bg-subtle)",
                      color: puedeSumar ? "#ffffff" : "var(--text-muted)",
                      fontWeight: 900,
                      fontSize: 16,
                      cursor: puedeSumar ? "pointer" : "not-allowed",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Observación Opcional */}
        <div style={{ marginTop: 8, marginBottom: 12 }}>
          <input
            type="text"
            placeholder="Observación opcional (ej: 1 Pelúa sin queso, salsas aparte...)"
            value={notaOpcional}
            onChange={(e) => setNotaOpcional(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--bg-subtle)",
              color: "var(--text)",
              fontSize: 12,
              outline: "none",
            }}
          />
        </div>

        {/* Botón de Confirmación */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={onCerrar}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-muted)",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!esCompleto}
            onClick={handleConfirmar}
            style={{
              flex: 2,
              padding: "12px",
              borderRadius: 12,
              border: "none",
              background: esCompleto ? "linear-gradient(135deg, #e65c00, #ff8c00)" : "var(--border)",
              color: esCompleto ? "#ffffff" : "var(--text-muted)",
              fontWeight: 900,
              fontSize: 14,
              cursor: esCompleto ? "pointer" : "not-allowed",
              boxShadow: esCompleto ? "0 4px 14px rgba(230, 92, 0, 0.4)" : "none",
              transition: "all 0.2s ease",
            }}
          >
            {esCompleto ? `Listo • Agregar Combo ($${Number(producto.precio_usd).toFixed(2)})` : `Elige ${faltantes} más`}
          </button>
        </div>
      </div>
    </div>
  );
}
