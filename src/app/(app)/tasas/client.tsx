"use client";

import { useState } from "react";
import { TasaCambio } from "@/types/database";
import { guardarTasasCompletas, autoSincronizarTasas } from "./actions";
import { sounds } from "@/lib/sound-effects";

interface TasasClientProps {
  tasas: TasaCambio[];
}

export default function TasasClient({ tasas }: TasasClientProps) {
  const tasaActual = tasas[0] || {
    bcv_usd_bs: 65.50,
    usdt_bs: 72.80,
    eur_bs: 70.80,
    promedio_bs: 69.15,
    tasa_usd_bs: 65.50,
    fecha: new Date().toISOString().split("T")[0],
  };

  // Form states de las 4 tasas exactas de Dabajuro
  const [bcv, setBcv] = useState<number>(Number(tasaActual.bcv_usd_bs) || 65.50);
  const [usdt, setUsdt] = useState<number>(Number(tasaActual.usdt_bs) || 72.80);
  const [eur, setEur] = useState<number>(Number(tasaActual.eur_bs) || 70.80);
  const [promedio, setPromedio] = useState<number>(Number(tasaActual.promedio_bs) || 69.15);
  const [guardando, setGuardando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);

  // Estados de la Calculadora Física
  const [calcDisplay, setCalcDisplay] = useState<string>("10");
  const [calcMemory, setCalcMemory] = useState<number | null>(null);
  const [calcOp, setCalcOp] = useState<string | null>(null);
  const [calcResetOnNext, setCalcResetOnNext] = useState<boolean>(false);
  const [calcMoneda, setCalcMoneda] = useState<"USD" | "Bs">("USD");

  // Orden exacto de Radiadores Dabajuro
  const listaTasas = [
    { id: "bcv", label: "BCV oficial", tag: "🟢 BCV", tasa: bcv, color: "#10b981" },
    { id: "usdt", label: "USDT", tag: "🟡 USDT", tasa: usdt, color: "#f59e0b" },
    { id: "eur", label: "EUR", tag: "🇪🇺 EUR", tasa: eur, color: "#6366f1" },
    { id: "promedio", label: "Promedio", tag: "⚡ Promedio", tasa: promedio, color: "#ec4899" },
  ];

  // Presets
  const presets = [1, 3.5, 5, 10, 20, 50, 100];

  const handleSelectPreset = (val: number) => {
    sounds.playPop();
    setCalcDisplay(String(val));
    setCalcMemory(null);
    setCalcOp(null);
    setCalcResetOnNext(false);
  };

  // Botones de la Calculadora Física
  const handleKeyClick = (key: string) => {
    sounds.playPop();

    if (key === "C") {
      setCalcDisplay("0");
      setCalcMemory(null);
      setCalcOp(null);
      setCalcResetOnNext(false);
      return;
    }

    if (key === "←") {
      if (calcDisplay.length > 1) {
        setCalcDisplay(calcDisplay.slice(0, -1));
      } else {
        setCalcDisplay("0");
      }
      return;
    }

    if (["+", "-", "*", "/"].includes(key)) {
      setCalcMemory(parseFloat(calcDisplay) || 0);
      setCalcOp(key);
      setCalcResetOnNext(true);
      return;
    }

    if (key === "=") {
      if (calcMemory !== null && calcOp) {
        const current = parseFloat(calcDisplay) || 0;
        let result = current;
        if (calcOp === "+") result = calcMemory + current;
        if (calcOp === "-") result = calcMemory - current;
        if (calcOp === "*") result = calcMemory * current;
        if (calcOp === "/") result = current !== 0 ? calcMemory / current : 0;

        sounds.playKitchenBell();
        setCalcDisplay(String(Number(result.toFixed(2))));
        setCalcMemory(null);
        setCalcOp(null);
        setCalcResetOnNext(true);
      }
      return;
    }

    if (key === ".") {
      if (!calcDisplay.includes(".")) {
        setCalcDisplay(calcDisplay + ".");
      }
      return;
    }

    // Dígitos
    if (calcDisplay === "0" || calcResetOnNext) {
      setCalcDisplay(key);
      setCalcResetOnNext(false);
    } else {
      setCalcDisplay(calcDisplay + key);
    }
  };

  const valorCalculado = parseFloat(calcDisplay) || 0;

  const copiarAlPortapapeles = (texto: string, key: string) => {
    sounds.playCashRegister();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(texto);
      setCopiado(key);
      setTimeout(() => setCopiado(null), 1800);
    }
  };

  const handleAutoSincronizar = async () => {
    setSincronizando(true);
    const res = await autoSincronizarTasas();
    setSincronizando(false);

    if (res.ok) {
      sounds.playCashRegister();
      alert("✅ Tasas sincronizadas automáticamente con bcv.today y dolarflow.");
    } else {
      alert(res.error || "No se pudo sincronizar automáticamente.");
    }
  };

  const handleGuardarManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bcv <= 0 || guardando) return;

    setGuardando(true);
    const res = await guardarTasasCompletas({
      bcv_usd_bs: bcv,
      usdt_bs: usdt,
      eur_bs: eur,
      promedio_bs: promedio,
    });
    setGuardando(false);

    if (res.ok) {
      sounds.playCashRegister();
      alert("✅ Las 4 tasas (BCV, USDT, EUR, Promedio) fueron actualizadas con éxito.");
    } else {
      alert(res.error || "Error al actualizar las tasas.");
    }
  };

  return (
    <main className="recetas-container">
      {/* Header */}
      <div className="recetas-header">
        <div>
          <h1 className="recetas-title">💵 Tasas de Cambio & Calculadora Multimoneda</h1>
          <p className="recetas-subtitle">
            Orden oficial de Radiadores Dabajuro: <strong>BCV, USDT, EUR, Promedio</strong> con calculadora física de cobro.
          </p>
        </div>
        <button
          type="button"
          disabled={sincronizando}
          onClick={handleAutoSincronizar}
          className="btn-primary-action"
        >
          <span>🔄</span> {sincronizando ? "Sincronizando..." : "Sincronizar APIs Oficiales"}
        </button>
      </div>

      {/* Grid de las 4 Tasas en Vivo (Orden Dabajuro) */}
      <div className="tasas-cards-grid">
        <div className="tasa-badge-card bcv-border">
          <div className="tasa-card-top">
            <span className="tasa-pill-label bcv-tag">🟢 BCV oficial</span>
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
            <span className="tasa-pill-label paralelo-tag">🟡 USDT</span>
            <span className="tasa-date">DolarFlow / P2P</span>
          </div>
          <div className="tasa-value-row">
            <strong className="tasa-number">{Number(usdt).toFixed(2)}</strong>
            <span className="tasa-unit">Bs / $</span>
          </div>
          <span className="tasa-hint">Referencia reposición inventario</span>
        </div>

        <div className="tasa-badge-card cop-border" style={{ borderTopColor: "#6366f1" }}>
          <div className="tasa-card-top">
            <span className="tasa-pill-label cop-tag" style={{ background: "rgba(99, 102, 241, 0.15)", color: "#6366f1" }}>
              🇪🇺 EUR
            </span>
            <span className="tasa-date">Oficial BCV</span>
          </div>
          <div className="tasa-value-row">
            <strong className="tasa-number">{Number(eur).toFixed(2)}</strong>
            <span className="tasa-unit">Bs / €</span>
          </div>
          <span className="tasa-hint">Divisa europea oficial</span>
        </div>

        <div className="tasa-badge-card efectivo-border" style={{ borderTopColor: "#ec4899" }}>
          <div className="tasa-card-top">
            <span className="tasa-pill-label efectivo-tag" style={{ background: "rgba(236, 72, 153, 0.15)", color: "#ec4899" }}>
              ⚡ Promedio
            </span>
            <span className="tasa-date">(BCV + USDT) / 2</span>
          </div>
          <div className="tasa-value-row">
            <strong className="tasa-number">{Number(promedio).toFixed(2)}</strong>
            <span className="tasa-unit">Bs / $</span>
          </div>
          <span className="tasa-hint">Media ponderada del día</span>
        </div>
      </div>

      <div className="form-grid-2">
        {/* CALCULADORA FÍSICA REAL CON TECLADO NUMÉRICO TÁCTIL */}
        <div className="physical-calc-card">
          <div className="physical-calc-header">
            <div className="physical-calc-title">
              <span style={{ fontSize: 24 }}>🧮</span>
              <div>
                <h3>Calculadora de Mostrador</h3>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Conversión táctil multimoneda</span>
              </div>
            </div>

            {/* Switch USD / Bs */}
            <div className="delivery-type-selector" style={{ padding: 3 }}>
              <button
                type="button"
                onClick={() => {
                  sounds.playPop();
                  setCalcMoneda("USD");
                }}
                className={`delivery-btn ${calcMoneda === "USD" ? "delivery-btn-active" : ""}`}
              >
                USD ($)
              </button>
              <button
                type="button"
                onClick={() => {
                  sounds.playPop();
                  setCalcMoneda("Bs");
                }}
                className={`delivery-btn ${calcMoneda === "Bs" ? "delivery-btn-active" : ""}`}
              >
                Bs
              </button>
            </div>
          </div>

          {/* Pantalla LCD / LED */}
          <div className="calc-lcd-screen">
            <div className="lcd-header-line">
              <span className="lcd-mode-tag">{calcMoneda === "USD" ? "MODO DÓLARES ($)" : "MODO BOLÍVARES (Bs)"}</span>
              {calcOp && <span className="lcd-op-indicator">{calcMemory} {calcOp}</span>}
            </div>
            <div className="lcd-main-digits">
              <span>{calcMoneda === "USD" ? "$" : "Bs."}</span>
              <strong>{calcDisplay}</strong>
            </div>
          </div>

          {/* Chips de montos rápidos */}
          <div className="calc-presets-row">
            <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)" }}>Rápidos:</span>
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handleSelectPreset(p)}
                className={`preset-btn ${parseFloat(calcDisplay) === p ? "preset-btn-active" : ""}`}
              >
                ${p}
              </button>
            ))}
          </div>

          {/* Desglose de Conversión en las 4 Tasas con Botón Copiar */}
          <div className="calc-rates-conversion-list">
            {listaTasas.map((t) => {
              const resultado =
                calcMoneda === "USD"
                  ? valorCalculado * t.tasa
                  : t.tasa > 0
                  ? valorCalculado / t.tasa
                  : 0;
              const unidad = calcMoneda === "USD" ? "Bs." : "$";
              const copiadoActivo = copiado === t.id;

              return (
                <div key={t.id} className="calc-rate-row-item">
                  <div className="calc-rate-item-left">
                    <span className="tasa-pill-label" style={{ background: `${t.color}20`, color: t.color }}>
                      {t.tag}
                    </span>
                    <span className="rate-ref-small">@{t.tasa.toFixed(2)}</span>
                  </div>

                  <div className="calc-rate-item-right">
                    <strong className="rate-val-strong">
                      {unidad} {resultado.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                    <button
                      type="button"
                      onClick={() => copiarAlPortapapeles(resultado.toFixed(2), t.id)}
                      className={`btn-copy-rate ${copiadoActivo ? "btn-copy-active" : ""}`}
                    >
                      {copiadoActivo ? "✓ Copiado" : "📋 Copiar"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Teclado Numérico Físico */}
          <div className="calc-keypad-grid">
            {["7", "8", "9", "/"].map((k) => (
              <button key={k} type="button" onClick={() => handleKeyClick(k)} className={`calc-key ${isNaN(Number(k)) ? "calc-key-op" : ""}`}>
                {k}
              </button>
            ))}
            {["4", "5", "6", "*"].map((k) => (
              <button key={k} type="button" onClick={() => handleKeyClick(k)} className={`calc-key ${isNaN(Number(k)) ? "calc-key-op" : ""}`}>
                {k}
              </button>
            ))}
            {["1", "2", "3", "-"].map((k) => (
              <button key={k} type="button" onClick={() => handleKeyClick(k)} className={`calc-key ${isNaN(Number(k)) ? "calc-key-op" : ""}`}>
                {k}
              </button>
            ))}
            {["C", "0", ".", "+"].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => handleKeyClick(k)}
                className={`calc-key ${k === "C" ? "calc-key-clear" : isNaN(Number(k)) && k !== "." ? "calc-key-op" : ""}`}
              >
                {k}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleKeyClick("=")}
              className="calc-key calc-key-equals"
              style={{ gridColumn: "span 4" }}
            >
              =
            </button>
          </div>
        </div>

        {/* Formulario de Actualización Manual de las 4 Tasas */}
        <div className="receta-card">
          <div className="receta-card-header">
            <h3 className="receta-name">⚙️ Ajuste Manual de Tasas</h3>
          </div>

          <form onSubmit={handleGuardarManual} className="recipe-form">
            <div className="form-grid-2">
              <div className="form-field">
                <label>1. 🟢 BCV oficial (Bs/$)</label>
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
                <label>2. 🟡 USDT / DolarFlow (Bs/$)</label>
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
                <label>3. 🇪🇺 EUR / Euro BCV (Bs/€)</label>
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

              <div className="form-field">
                <label>4. ⚡ Promedio (Bs/$)</label>
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
