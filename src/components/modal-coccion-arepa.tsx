"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { Producto } from "@/types/database";
import { getProductImage } from "@/lib/combo-helper";
import { sounds } from "@/lib/sound-effects";

interface ModalCoccionArepaProps {
  producto: Producto;
  tasaBcv: number;
  onConfirmar: (coccion: "Frita" | "Asada", cantidad: number) => void;
  onCerrar: () => void;
}

export default function ModalCoccionArepa({
  producto,
  tasaBcv,
  onConfirmar,
  onCerrar,
}: ModalCoccionArepaProps) {
  const [cantidad, setCantidad] = useState(1);
  const modalCardRef = useRef<HTMLDivElement>(null);
  const imgUrl = getProductImage(producto);
  const precioUsd = Number(producto.precio_usd || 0);
  const precioBs = precioUsd * tasaBcv;

  // Bloqueo estricto de scroll de fondo para móviles
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

  const handleElegirCoccion = (coccion: "Frita" | "Asada") => {
    sounds.playKitchenBell();
    onConfirmar(coccion, cantidad);
  };

  const handleCambiarCantidad = (delta: number) => {
    const nueva = Math.max(1, Math.min(25, cantidad + delta));
    if (nueva === cantidad) return;
    if (delta > 0) sounds.playPop();
    else sounds.playDelete();
    setCantidad(nueva);
  };

  return (
    <div
      className="combo-modal-overlay"
      onClick={onCerrar}
      role="dialog"
      aria-modal="true"
      aria-labelledby="coccion-modal-title"
    >
      <div
        ref={modalCardRef}
        className="combo-modal-card modal-coccion-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="combo-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {imgUrl ? (
              <Image
                src={imgUrl}
                alt={producto.nombre}
                width={48}
                height={48}
                style={{ borderRadius: 10, objectFit: "cover", border: "1px solid var(--border)" }}
              />
            ) : (
              <span className="combo-flavor-icon" aria-hidden="true">
                {producto.icono || "🫓"}
              </span>
            )}
            <div>
              <h2 id="coccion-modal-title" style={{ fontSize: 17, fontWeight: 900, color: "var(--text)", margin: 0 }}>
                {producto.nombre}
              </h2>
              <p style={{ fontSize: 12, color: "var(--primary)", margin: 0, fontWeight: 700 }}>
                ${precioUsd.toFixed(2)} USD • Bs. {precioBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="combo-modal-close-btn"
            aria-label="Cerrar modal de cocción"
          >
            ✕
          </button>
        </div>

        {/* Cuerpo */}
        <div className="coccion-modal-body">
          <div className="coccion-question-box">
            <h3 className="coccion-question-title">¿Cómo deseas tu arepa?</h3>
            <p className="coccion-question-sub">
              Elige el tipo de cocción preferido. Ambas opciones tienen el mismo costo.
            </p>
          </div>

          {/* Selector de Cantidad */}
          <div className="coccion-qty-selector">
            <span className="coccion-qty-label">Cantidad a pedir:</span>
            <div className="coccion-qty-controls">
              <button
                type="button"
                disabled={cantidad <= 1}
                onClick={() => handleCambiarCantidad(-1)}
                className="coccion-qty-btn"
                aria-label="Restar una unidad"
              >
                −
              </button>
              <span className="coccion-qty-value">{cantidad}</span>
              <button
                type="button"
                disabled={cantidad >= 25}
                onClick={() => handleCambiarCantidad(1)}
                className="coccion-qty-btn"
                aria-label="Sumar una unidad"
              >
                +
              </button>
            </div>
          </div>

          {/* Tarjetas de Selección de Cocción */}
          <div className="coccion-options-grid">
            <button
              type="button"
              onClick={() => handleElegirCoccion("Frita")}
              className="coccion-option-card coccion-card-frita"
            >
              <div className="coccion-card-icon-wrap">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
              </div>
              <div className="coccion-card-content">
                <span className="coccion-card-title">Frita en Caldero</span>
                <span className="coccion-card-desc">Doradita, crujiente y caliente</span>
              </div>
              <span className="coccion-card-badge">Seleccionar</span>
            </button>

            <button
              type="button"
              onClick={() => handleElegirCoccion("Asada")}
              className="coccion-option-card coccion-card-asada"
            >
              <div className="coccion-card-icon-wrap">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e65c00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                </svg>
              </div>
              <div className="coccion-card-content">
                <span className="coccion-card-title">Asada al Budare</span>
                <span className="coccion-card-desc">Tostadita por fuera, suave por dentro</span>
              </div>
              <span className="coccion-card-badge">Seleccionar</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="combo-actions-wrap" style={{ marginTop: 14 }}>
          <button
            type="button"
            onClick={onCerrar}
            className="combo-btn-cancel"
            style={{ width: "100%" }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
