"use client";

import { useState, useMemo, useEffect } from "react";
import { ZonaDelivery } from "@/types/database";

interface ModalSeleccionarZonaDeliveryProps {
  abierto: boolean;
  onClose: () => void;
  zonas: ZonaDelivery[];
  zonaSeleccionadaId: string;
  onSeleccionarZona: (zonaId: string) => void;
  tasaBcv: number;
}

export default function ModalSeleccionarZonaDelivery({
  abierto,
  onClose,
  zonas,
  zonaSeleccionadaId,
  onSeleccionarZona,
  tasaBcv,
}: ModalSeleccionarZonaDeliveryProps) {
  const [busqueda, setBusqueda] = useState("");

  // Cerrar con Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && abierto) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [abierto, onClose]);

  // Filtrado reactivo por nombre de nivel o sectores
  const zonasFiltradas = useMemo(() => {
    if (!busqueda.trim()) return zonas;
    const query = busqueda.toLowerCase().trim();
    return zonas.filter(
      (z) =>
        z.nombre.toLowerCase().includes(query) ||
        (z.descripcion && z.descripcion.toLowerCase().includes(query))
    );
  }, [zonas, busqueda]);

  if (!abierto) return null;

  return (
    <div className="combo-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="combo-modal-card modal-zona-delivery-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header del Modal */}
        <div className="combo-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 24 }}>📍</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: "var(--text)" }}>
                Selecciona tu Zona de Delivery
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
                Calcula la tarifa exacta según tu sector
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="combo-modal-close-btn"
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>

        {/* Buscador de Sectores */}
        <div style={{ marginTop: 14, marginBottom: 10 }}>
          <div className="pedir-search-container" style={{ position: "relative" }}>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="🔍 Escribe tu sector (ej. Zarabón, Centro, Maraven...)"
              className="pedir-search-input"
              style={{ fontSize: 13, padding: "10px 14px", width: "100%" }}
              autoFocus
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda("")}
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  fontWeight: 800,
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Lista de Zonas / Niveles */}
        <div className="combo-flavors-list" style={{ maxHeight: "55vh" }}>
          {zonasFiltradas.length === 0 ? (
            <div style={{ textAlign: "center", padding: "28px 16px", color: "var(--text-muted)" }}>
              <span style={{ fontSize: 32, display: "block", marginBottom: 6 }}>🔍</span>
              <strong style={{ fontSize: 14, color: "var(--text)" }}>Sector no encontrado</strong>
              <p style={{ fontSize: 12, marginTop: 4 }}>
                Revisa la ortografía o consulta la tarifa con nuestro operador por WhatsApp.
              </p>
            </div>
          ) : (
            zonasFiltradas.map((z) => {
              const isSelected = z.id === zonaSeleccionadaId;
              const precioUsd = Number(z.precio_usd || 0);
              const precioBs = tasaBcv > 0 ? (precioUsd * tasaBcv).toFixed(2) : null;

              return (
                <div
                  key={z.id}
                  onClick={() => {
                    onSeleccionarZona(z.id);
                    onClose();
                  }}
                  className={`combo-flavor-row ${isSelected ? "flavor-selected" : ""}`}
                  style={{
                    cursor: "pointer",
                    padding: "12px 14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 900,
                          background: isSelected ? "var(--primary)" : "var(--bg-subtle)",
                          color: isSelected ? "var(--text)" : "var(--text-muted)",
                          padding: "2px 8px",
                          borderRadius: 6,
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        {z.nombre}
                      </span>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12.5,
                        color: isSelected ? "var(--text)" : "var(--text-muted)",
                        fontWeight: isSelected ? 700 : 500,
                        lineHeight: 1.35,
                      }}
                    >
                      {z.descripcion}
                    </p>
                  </div>

                  {/* Precio Tarifa */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 900,
                        color: "var(--primary-dark)",
                      }}
                    >
                      ${precioUsd.toFixed(2)}
                    </div>
                    {precioBs && (
                      <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>
                        Bs. {precioBs}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer con Ayuda */}
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600 }}>
            🛵 Entrega directa con empresa aliada
          </span>
          <button
            type="button"
            onClick={onClose}
            className="combo-btn-cancel"
            style={{ padding: "8px 16px", fontSize: 12, flex: "none", width: "auto" }}
          >
            Listo / Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
