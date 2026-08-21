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
    usdt_bs: 72.80,
    promedio_bs: 69.15,
    eur_bs: 70.80,
    tasa_usd_bs: 65.50,
    fecha: new Date().toISOString().split("T")[0],
  };

  // Form states de las 4 tasas exactas (BCV, USDT, Promedio, EUR)
  const [bcv, setBcv] = useState<number>(Number(tasaActual.bcv_usd_bs) || 65.50);
  const [usdt, setUsdt] = useState<number>(Number(tasaActual.usdt_bs || tasaActual.paralelo_usd_bs) || 72.80);
  const [promedio, setPromedio] = useState<number>(Number(tasaActual.promedio_bs || tasaActual.efectivo_usd_bs) || 69.15);
  const [eur, setEur] = useState<number>(Number(tasaActual.eur_bs) || 70.80);
  const [guardando, setGuardando] = useState(false);

  // Calculadora Multimoneda
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
      usdt_bs: usdt,
      promedio_bs: promedio,
      eur_bs: eur,
    });
    setGuardando(false);

    if (res.ok) {
      sounds.playCashRegister();
      alert("✅ Las 4 tasas (BCV, USDT, Promedio, EUR) fueron actualizadas con éxito.");
    } else {
      alert(res.error || "Error al actualizar las tasas.");
    }
  };

  return (
    <main className="recetas-container">
      <div className="recetas-header">
        <div>
          <h1 className="recetas-title">💵 Tasas de Cambio & Calculadora Multimoneda</h1>
          <p className="recetas-subtitle">
            Gestión de las 4 tasas de referencia (BCV, Binance USDT, Promedio y Euro EUR) y calculadora de cobro.
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
          <span className="tasa-hint">Tasa oficial de facturación</span>
        </div>

        <div className="tasa-badge-card paralelo-border">
          <div className="tasa-card-top">
            <span className="tasa-pill-label paralelo-tag">🟡 USDT (Binance)</span>
            <span className="tasa-date">P2P Crypto</span>
          </div>
          <div className="tasa-value-row">
            <strong className="tasa-number">{Number(usdt).toFixed(2)}</strong>
            <span className="tasa-unit">Bs / $</span>
          </div>
          <span className="tasa-hint">Referencia reposición</span>
        </div>

        <div className="tasa-badge-card efectivo-border">
          <div className="tasa-card-top">
            <span className="tasa-pill-label efectivo-tag">⚡ Tasa Promedio</span>
            <span className="tasa-date">Mercado</span>
          </div>
          <div className="tasa-value-row">
            <strong className="tasa-number">{Number(promedio).toFixed(2)}</strong>
            <span className="tasa-unit">Bs / $</span>
          </div>
          <span className="tasa-hint">Media ponderada del mercado</span>
        </div>

        <div className="tasa-badge-card cop-border">
          <div className="tasa-card-top">
            <span className="tasa-pill-label cop-tag">🇪🇺 Euro (EUR)</span>
            <span className="tasa-date">Oficial BCV</span>
          </div>
          <div className="tasa-value-row">
            <strong className="tasa-number">{Number(eur).toFixed(2)}</strong>
            <span className="tasa-unit">Bs / €</span>
          </div>
          <span className="tasa-hint">Cobro en divisa europea</span>
        </div>
      </div>

      <div className="form-grid-2">
        {/* Calculadora Multimoneda Interactiva */}
        <div className="receta-card">
          <div className="receta-card-header">
            <h3 className="receta-name">🧮 Calculadora de Cobro Multimoneda</h3>
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
              <span className="breakdown-label">🟡 Total Binance USDT:</span>
              <strong className="breakdown-val">{(montoUsd * usdt).toLocaleString("es-VE", { minimumFractionDigits: 2 })} Bs</strong>
            </div>

            <div className="breakdown-row">
              <span className="breakdown-label">⚡ Total Tasa Promedio:</span>
              <strong className="breakdown-val">{(montoUsd * promedio).toLocaleString("es-VE", { minimumFractionDigits: 2 })} Bs</strong>
            </div>

            <div className="breakdown-row">
              <span className="breakdown-label">🇪🇺 Equivalente en Euros (EUR):</span>
              <strong className="breakdown-val cop-text">€{(montoUsd * (bcv / (eur || 70.8))).toFixed(2)} EUR ({(montoUsd * bcv).toLocaleString("es-VE", { minimumFractionDigits: 2 })} Bs)</strong>
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
                <label>2. Tasa Binance USDT (Bs/$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={usdt}
                  onChange={(e) => setUsdt(parseFloat(e.target.value) || 0)}
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-field">
                <label>3. Tasa Promedio (Bs/$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={promedio}
                  onChange={(e) => setPromedio(parseFloat(e.target.value) || 0)}
                  className="form-input"
                />
              </div>

              <div className="form-field">
                <label>4. Tasa Euro EUR (Bs/€)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={eur}
                  onChange={(e) => setEur(parseFloat(e.target.value) || 0)}
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
