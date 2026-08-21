"use client";

import { useState } from "react";
import { TasaCambio } from "@/types/database";
import { guardarTasasCompletas } from "./actions";
import { sounds } from "@/lib/sound-effects";

interface TasasClientProps {
  tasas: TasaCambio[];
}

export default function TasasClient({ tasas }: TasasClientProps) {
  const tasaActual = tasas[0] || {
    bcv_usd_bs: 65.50,
    tasa_usd_bs: 65.50,
    paralelo_usd_bs: 72.80,
    efectivo_usd_bs: 68.00,
    cop_usd: 4100,
    fecha: new Date().toISOString().split("T")[0],
  };

  // Form states de las 4 tasas
  const [bcv, setBcv] = useState<number>(Number(tasaActual.bcv_usd_bs) || 65.50);
  const [paralelo, setParalelo] = useState<number>(Number(tasaActual.paralelo_usd_bs) || 72.80);
  const [efectivo, setEfectivo] = useState<number>(Number(tasaActual.efectivo_usd_bs) || 68.00);
  const [cop, setCop] = useState<number>(Number(tasaActual.cop_usd) || 4100);
  const [guardando, setGuardando] = useState(false);

  // Calculadora
  const [montoUsd, setMontoUsd] = useState<number>(10);

  const presets = [1, 3.5, 5, 10, 20, 50, 100];

  const handleSelectPreset = (val: number) => {
    sounds.playPop();
    setMontoUsd(val);
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bcv <= 0 || guardando) return;

    setGuardando(true);
    const res = await guardarTasasCompletas({
      bcv_usd_bs: bcv,
      paralelo_usd_bs: paralelo,
      efectivo_usd_bs: efectivo,
      cop_usd: cop,
    });
    setGuardando(false);

    if (res.ok) {
      sounds.playCashRegister();
      alert("✅ Las 4 tasas fueron actualizadas con éxito en todo el sistema.");
    } else {
      alert(res.error || "Error al actualizar las tasas.");
    }
  };

  return (
    <main className="recetas-container">
      <div className="recetas-header">
        <div>
          <h1 className="recetas-title">💵 Tasas del Bolívar & Calculadora Multimoneda</h1>
          <p className="recetas-subtitle">
            Conversión simultánea en tiempo real para cotizaciones, cobro en punto, pago móvil, efectivo y pesos.
          </p>
        </div>
      </div>

      {/* Grid de las 4 Tasas en Vivo */}
      <div className="tasas-cards-grid">
        <div className="tasa-badge-card bcv-border">
          <div className="tasa-card-top">
            <span className="tasa-pill-label bcv-tag">🟢 BCV Oficial</span>
            <span className="tasa-date">{tasaActual.fecha}</span>
          </div>
          <div className="tasa-value-row">
            <strong className="tasa-number">{Number(bcv).toFixed(2)}</strong>
            <span className="tasa-unit">Bs / $</span>
          </div>
          <span className="tasa-hint">Referencia oficial para facturación</span>
        </div>

        <div className="tasa-badge-card paralelo-border">
          <div className="tasa-card-top">
            <span className="tasa-pill-label paralelo-tag">⚡ Paralelo</span>
            <span className="tasa-date">Mercado</span>
          </div>
          <div className="tasa-value-row">
            <strong className="tasa-number">{Number(paralelo).toFixed(2)}</strong>
            <span className="tasa-unit">Bs / $</span>
          </div>
          <span className="tasa-hint">Referencia reposición / compras</span>
        </div>

        <div className="tasa-badge-card efectivo-border">
          <div className="tasa-card-top">
            <span className="tasa-pill-label efectivo-tag">💵 Efectivo / Promedio</span>
            <span className="tasa-date">Taquilla</span>
          </div>
          <div className="tasa-value-row">
            <strong className="tasa-number">{Number(efectivo).toFixed(2)}</strong>
            <span className="tasa-unit">Bs / $</span>
          </div>
          <span className="tasa-hint">Cambio en billetes físicos</span>
        </div>

        <div className="tasa-badge-card cop-border">
          <div className="tasa-card-top">
            <span className="tasa-pill-label cop-tag">🇨🇴 Pesos COP</span>
            <span className="tasa-date">Frontera</span>
          </div>
          <div className="tasa-value-row">
            <strong className="tasa-number">{Number(cop).toLocaleString()}</strong>
            <span className="tasa-unit">COP / $</span>
          </div>
          <span className="tasa-hint">Cobro directo en pesos</span>
        </div>
      </div>

      <div className="form-grid-2">
        {/* Calculadora Gastronómica Interactiva */}
        <div className="receta-card">
          <div className="receta-card-header">
            <h3 className="receta-name">🧮 Calculadora de Cobro Instantánea</h3>
          </div>

          {/* Presets Rápidos */}
          <div className="calc-presets-row">
            <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)" }}>Rápidos:</span>
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handleSelectPreset(p)}
                className={`preset-btn ${montoUsd === p ? "preset-btn-active" : ""}`}
              >
                ${p}
              </button>
            ))}
          </div>

          <div className="form-field">
            <label>Monto en Dólares ($ USD):</label>
            <input
              type="number"
              step="any"
              value={montoUsd}
              onChange={(e) => setMontoUsd(parseFloat(e.target.value) || 0)}
              className="form-input calc-main-input"
            />
          </div>

          {/* Desglose en las 4 tasas */}
          <div className="calc-breakdown-box">
            <div className="breakdown-row">
              <span className="breakdown-label">🏦 Total Oficial BCV:</span>
              <strong className="breakdown-val bcv-text">{(montoUsd * bcv).toLocaleString("es-VE", { minimumFractionDigits: 2 })} Bs</strong>
            </div>

            <div className="breakdown-row">
              <span className="breakdown-label">⚡ Total Paralelo:</span>
              <strong className="breakdown-val">{(montoUsd * paralelo).toLocaleString("es-VE", { minimumFractionDigits: 2 })} Bs</strong>
            </div>

            <div className="breakdown-row">
              <span className="breakdown-label">💵 Total Efectivo Promedio:</span>
              <strong className="breakdown-val">{(montoUsd * efectivo).toLocaleString("es-VE", { minimumFractionDigits: 2 })} Bs</strong>
            </div>

            <div className="breakdown-row">
              <span className="breakdown-label">🇨🇴 Total Pesos COP:</span>
              <strong className="breakdown-val cop-text">${Math.round(montoUsd * cop).toLocaleString()} COP</strong>
            </div>
          </div>
        </div>

        {/* Formulario de Actualización de las 4 Tasas */}
        <div className="receta-card">
          <div className="receta-card-header">
            <h3 className="receta-name">⚙️ Actualizar Tasas del Día</h3>
          </div>

          <form onSubmit={handleGuardar} className="recipe-form">
            <div className="form-grid-2">
              <div className="form-field">
                <label>1. Tasa Oficial BCV (Bs/$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={bcv}
                  onChange={(e) => setBcv(parseFloat(e.target.value) || 0)}
                  className="form-input"
                />
              </div>

              <div className="form-field">
                <label>2. Tasa Paralelo (Bs/$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={paralelo}
                  onChange={(e) => setParalelo(parseFloat(e.target.value) || 0)}
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-field">
                <label>3. Tasa Efectivo (Bs/$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={efectivo}
                  onChange={(e) => setEfectivo(parseFloat(e.target.value) || 0)}
                  className="form-input"
                />
              </div>

              <div className="form-field">
                <label>4. Pesos Colombianos (COP/$)</label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  required
                  value={cop}
                  onChange={(e) => setCop(parseFloat(e.target.value) || 0)}
                  className="form-input"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={guardando}
              className="btn-submit-recipe"
              style={{ marginTop: 8 }}
            >
              {guardando ? "Actualizando..." : "💾 Guardar Tasas"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
