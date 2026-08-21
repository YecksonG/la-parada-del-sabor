"use client";

import { useState } from "react";
import { TasaCambio } from "@/types/database";
import { guardarTasa } from "./actions";

interface TasasClientProps {
  tasas: TasaCambio[];
}

export default function TasasClient({ tasas }: TasasClientProps) {
  const tasaActual = tasas[0] || {
    bcv_usd_bs: 65.50,
    tasa_usd_bs: 65.50,
    cop_usd: 4100,
    fecha: new Date().toISOString().split("T")[0],
  };

  const [bcvInput, setBcvInput] = useState(Number(tasaActual.bcv_usd_bs));
  const [copInput, setCopInput] = useState(Number(tasaActual.cop_usd || 4100));
  const [guardando, setGuardando] = useState(false);

  // Calculadora
  const [montoUsd, setMontoUsd] = useState<number>(10);

  const montoBs = Number((montoUsd * Number(tasaActual.bcv_usd_bs)).toFixed(2));
  const montoCop = Number((montoUsd * Number(tasaActual.cop_usd || 4100)).toFixed(0));

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bcvInput <= 0 || guardando) return;

    setGuardando(true);
    const res = await guardarTasa(bcvInput, bcvInput, copInput);
    setGuardando(false);

    if (res.ok) {
      alert("✅ Tasa de cambio actualizada con éxito.");
    } else {
      alert(res.error || "Error al actualizar la tasa.");
    }
  };

  return (
    <main className="recetas-container">
      <div className="recetas-header">
        <div>
          <h1 className="recetas-title">💵 Tasas de Cambio & Calculadora</h1>
          <p className="recetas-subtitle">
            Conversión en tiempo real para cobros en Bolívares (BCV), Dólares en efectivo y Pesos Colombianos (COP).
          </p>
        </div>
      </div>

      <div className="form-grid-2">
        {/* Calculadora Rápida */}
        <div className="receta-card">
          <div className="receta-card-header">
            <h3 className="receta-name">🧮 Calculadora Multimoneda</h3>
          </div>

          <div className="form-field">
            <label>Monto en Dólares ($ USD):</label>
            <input
              type="number"
              step="any"
              value={montoUsd}
              onChange={(e) => setMontoUsd(parseFloat(e.target.value) || 0)}
              className="form-input"
              style={{ fontSize: 18, fontWeight: 800 }}
            />
          </div>

          <div className="receta-metrics-row" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="metric-box">
              <span className="metric-label">En Bolívares (BCV):</span>
              <strong className="metric-val text-primary" style={{ fontSize: 18 }}>
                {montoBs.toLocaleString()} Bs
              </strong>
            </div>
            <div className="metric-box">
              <span className="metric-label">En Pesos (COP):</span>
              <strong className="metric-val text-green" style={{ fontSize: 18 }}>
                ${montoCop.toLocaleString()} COP
              </strong>
            </div>
          </div>
        </div>

        {/* Actualizador de Tasas */}
        <div className="receta-card">
          <div className="receta-card-header">
            <h3 className="receta-name">⚙️ Actualizar Tasa del Día</h3>
          </div>

          <form onSubmit={handleGuardar} className="recipe-form">
            <div className="form-field">
              <label>Tasa Oficial BCV (Bs / USD)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={bcvInput}
                onChange={(e) => setBcvInput(parseFloat(e.target.value) || 0)}
                className="form-input"
              />
            </div>

            <div className="form-field">
              <label>Tasa Pesos Colombianos (COP / USD)</label>
              <input
                type="number"
                step="1"
                min="1"
                required
                value={copInput}
                onChange={(e) => setCopInput(parseFloat(e.target.value) || 0)}
                className="form-input"
              />
            </div>

            <button
              type="submit"
              disabled={guardando}
              className="btn-submit-recipe"
              style={{ marginTop: 8 }}
            >
              {guardando ? "Guardando..." : "💾 Actualizar Tasa Oficial"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
