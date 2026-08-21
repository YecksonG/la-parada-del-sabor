"use client";

import { useState, useMemo } from "react";
import { SesionCaja, Venta } from "@/types/database";
import { abrirSesionCaja, cerrarSesionCaja } from "./actions";
import { sounds } from "@/lib/sound-effects";

interface CajaClientProps {
  sesionActiva: SesionCaja | null;
  historialCajas: SesionCaja[];
  ventasTurno: Venta[];
  tasaBcv: number;
}

export default function CajaClient({
  sesionActiva,
  historialCajas,
  ventasTurno,
  tasaBcv,
}: CajaClientProps) {
  const [modalAbrir, setModalAbrir] = useState(false);
  const [modalCerrar, setModalCerrar] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Form de apertura
  const [fondoInicialUsd, setFondoInicialUsd] = useState<number>(20.0);
  const [fondoInicialBs, setFondoInicialBs] = useState<number>(0.0);

  // Form de cierre / arqueo físico en gaveta
  const [arqueoUsd, setArqueoUsd] = useState<number>(0.0);
  const [arqueoBs, setArqueoBs] = useState<number>(0.0);
  const [notasCierre, setNotasCierre] = useState("");

  // Cálculos en vivo de las ventas del turno
  const resumenTurno = useMemo(() => {
    let efectivoUsd = 0;
    let pagoMovilBs = 0;
    let transferenciaBs = 0;
    let binanceUsd = 0;
    let puntoBs = 0;
    let totalUsd = 0;

    ventasTurno.forEach((v) => {
      const vUsd = Number(v.total_usd) || 0;
      const vBs = Number(v.total_bs) || 0;
      totalUsd += vUsd;

      switch (v.metodo_pago) {
        case "efectivo_usd":
          efectivoUsd += vUsd;
          break;
        case "pago_movil_bs":
          pagoMovilBs += vBs;
          break;
        case "punto_bs":
          puntoBs += vBs;
          break;
        case "binance":
          binanceUsd += vUsd;
          break;
        default:
          pagoMovilBs += vBs;
      }
    });

    const teoricoEfectivoUsd = (Number(sesionActiva?.monto_inicial_usd) || 0) + efectivoUsd;
    const teoricoEfectivoBs = (Number(sesionActiva?.monto_inicial_bs) || 0);

    return {
      efectivoUsd,
      pagoMovilBs,
      transferenciaBs,
      binanceUsd,
      puntoBs,
      totalUsd,
      teoricoEfectivoUsd,
      teoricoEfectivoBs,
    };
  }, [ventasTurno, sesionActiva]);

  // Diferencia de Arqueo
  const diferenciaUsd = arqueoUsd - resumenTurno.teoricoEfectivoUsd;
  const diferenciaBs = arqueoBs - resumenTurno.teoricoEfectivoBs;

  const handleAbrirCaja = async (e: React.FormEvent) => {
    e.preventDefault();
    if (guardando) return;

    setGuardando(true);
    const res = await abrirSesionCaja({
      monto_inicial_usd: Number(fondoInicialUsd),
      monto_inicial_bs: Number(fondoInicialBs),
    });
    setGuardando(false);

    if (res.ok) {
      sounds.playKitchenBell();
      setModalAbrir(false);
    } else {
      alert(res.error || "Error al abrir la caja.");
    }
  };

  const handleCerrarCaja = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sesionActiva || guardando) return;

    setGuardando(true);
    const res = await cerrarSesionCaja({
      sesion_id: sesionActiva.id,
      total_ventas_efectivo_usd: resumenTurno.efectivoUsd,
      total_ventas_pago_movil_bs: resumenTurno.pagoMovilBs,
      total_ventas_transferencia_bs: resumenTurno.transferenciaBs,
      total_ventas_binance_usd: resumenTurno.binanceUsd,
      total_ventas_punto_bs: resumenTurno.puntoBs,
      arqueo_fisico_efectivo_usd: Number(arqueoUsd),
      arqueo_fisico_efectivo_bs: Number(arqueoBs),
      diferencia_usd: Number(diferenciaUsd.toFixed(2)),
      diferencia_bs: Number(diferenciaBs.toFixed(2)),
      notas_cierre: notasCierre,
    });
    setGuardando(false);

    if (res.ok) {
      sounds.playCashRegister();
      setModalCerrar(false);
      alert("✅ Turno de caja cerrado exitosamente (Corte Z).");
    } else {
      alert(res.error || "Error al cerrar la caja.");
    }
  };

  return (
    <main className="recetas-container">
      {/* Header */}
      <div className="recetas-header">
        <div>
          <h1 className="recetas-title">💰 Cierre de Caja & Arqueo Diario (Cortes X / Z)</h1>
          <p className="recetas-subtitle">
            Control de fondo inicial, ventas por método de pago y conciliación física en gaveta.
          </p>
        </div>

        {sesionActiva ? (
          <button
            type="button"
            onClick={() => {
              setArqueoUsd(resumenTurno.teoricoEfectivoUsd);
              setArqueoBs(resumenTurno.teoricoEfectivoBs);
              setModalCerrar(true);
            }}
            className="btn-primary-action"
            style={{ background: "linear-gradient(135deg, #e11d48 0%, #be123c 100%)" }}
          >
            🔒 Realizar Cierre de Turno (Corte Z)
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setModalAbrir(true)}
            className="btn-primary-action"
          >
            🔓 Abrir Nuevo Turno de Caja
          </button>
        )}
      </div>

      {/* Estado Actual de la Caja */}
      {sesionActiva ? (
        <div className="caja-live-dashboard">
          <div className="caja-banner-activa">
            <div className="caja-banner-status">
              <span className="bcv-dot" />
              <strong>Turno de Caja en Operación (Abierto)</strong>
            </div>
            <span className="caja-time-stamp">
              Apertura: {new Date(sesionActiva.fecha_apertura).toLocaleTimeString()} (
              {new Date(sesionActiva.fecha_apertura).toLocaleDateString()})
            </span>
          </div>

          {/* Tarjetas de Métodos de Pago del Turno (Corte X) */}
          <div className="caja-summary-grid">
            <div className="caja-stat-card">
              <span className="stat-label">💵 Efectivo USD en Gaveta</span>
              <strong className="stat-value text-primary">
                ${resumenTurno.teoricoEfectivoUsd.toFixed(2)}
              </strong>
              <span className="stat-hint">
                Fondo: ${Number(sesionActiva.monto_inicial_usd).toFixed(2)} + Ventas: ${resumenTurno.efectivoUsd.toFixed(2)}
              </span>
            </div>

            <div className="caja-stat-card">
              <span className="stat-label">📱 Pago Móvil (Bs)</span>
              <strong className="stat-value text-green">
                {resumenTurno.pagoMovilBs.toLocaleString()} Bs
              </strong>
              <span className="stat-hint">
                ≈ ${(resumenTurno.pagoMovilBs / tasaBcv).toFixed(2)} USD (Tasa {tasaBcv})
              </span>
            </div>

            <div className="caja-stat-card">
              <span className="stat-label">🟡 Binance (USDT)</span>
              <strong className="stat-value">
                ${resumenTurno.binanceUsd.toFixed(2)} USDT
              </strong>
              <span className="stat-hint">Cripto directo</span>
            </div>

            <div className="caja-stat-card">
              <span className="stat-label">💳 Punto de Venta (Bs)</span>
              <strong className="stat-value">
                {resumenTurno.puntoBs.toLocaleString()} Bs
              </strong>
              <span className="stat-hint">Tarjetas débito</span>
            </div>
          </div>

          {/* Gran Total Facturado del Turno */}
          <div className="caja-totals-hero">
            <div>
              <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 700 }}>
                Total Ventas del Turno ({ventasTurno.length} Comandas)
              </span>
              <h2 style={{ fontSize: 32, fontWeight: 900, color: "var(--text)" }}>
                ${resumenTurno.totalUsd.toFixed(2)} USD
              </h2>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>En Bolívares (BCV):</span>
              <h3 style={{ fontSize: 22, fontWeight: 800, color: "var(--primary-dark)" }}>
                {(resumenTurno.totalUsd * tasaBcv).toLocaleString()} Bs
              </h3>
            </div>
          </div>
        </div>
      ) : (
        <div className="recetas-empty-box">
          <span style={{ fontSize: 52 }}>🔒</span>
          <h2>No hay turno de caja abierto</h2>
          <p>Abre la caja con el fondo inicial en sencillo para comenzar la jornada de ventas.</p>
          <button
            type="button"
            onClick={() => setModalAbrir(true)}
            className="btn-primary-action"
          >
            🔓 Abrir Caja Ahora
          </button>
        </div>
      )}

      {/* Historial de Cierres de Caja Anteriores */}
      <div className="recetas-header" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800 }}>📋 Historial de Cierres Anteriores</h2>
      </div>

      <div className="comandas-grid">
        {historialCajas.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No hay cierres registrados todavía.</p>
        ) : (
          historialCajas.map((c) => (
            <div key={c.id} className="comanda-card">
              <div className="comanda-card-header">
                <div>
                  <h3 className="receta-name">
                    {c.estado === "abierta" ? "🟢 Turno Actual" : "🔒 Turno Cerrado"}
                  </h3>
                  <span className="comanda-time">
                    📅 {new Date(c.fecha_apertura).toLocaleDateString()} (
                    {new Date(c.fecha_apertura).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})
                  </span>
                </div>
                <span className={`stock-badge ${c.estado === "abierta" ? "stock-badge-optimo" : "stock-badge-bajo"}`}>
                  {c.estado.toUpperCase()}
                </span>
              </div>

              <div className="receta-metrics-row">
                <div className="metric-box">
                  <span className="metric-label">Fondo Inicial:</span>
                  <strong>${Number(c.monto_inicial_usd).toFixed(2)}</strong>
                </div>
                <div className="metric-box">
                  <span className="metric-label">Efectivo USD:</span>
                  <strong className="text-primary">${Number(c.total_ventas_efectivo_usd || 0).toFixed(2)}</strong>
                </div>
                <div className="metric-box">
                  <span className="metric-label">Pago Móvil:</span>
                  <strong className="text-green">{Number(c.total_ventas_pago_movil_bs || 0).toLocaleString()} Bs</strong>
                </div>
              </div>

              {c.estado === "cerrada" && c.diferencia_usd !== null && (
                <div style={{ fontSize: 12, display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border-subtle)", paddingTop: 8 }}>
                  <span>Diferencia Arqueo:</span>
                  <strong style={{ color: c.diferencia_usd >= 0 ? "var(--green)" : "var(--accent)" }}>
                    {c.diferencia_usd >= 0 ? `+${c.diferencia_usd}` : c.diferencia_usd} USD
                  </strong>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal Apertura de Caja */}
      {modalAbrir && (
        <div className="modal-overlay">
          <div className="modal-recipe-card" style={{ maxWidth: 440 }}>
            <div className="modal-recipe-header">
              <h2>🔓 Apertura de Turno de Caja</h2>
              <button type="button" onClick={() => setModalAbrir(false)} className="btn-modal-close">✕</button>
            </div>

            <form onSubmit={handleAbrirCaja} className="recipe-form">
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Ingresa el monto de fondo inicial en sencillo con el que inicia la gaveta:
              </p>

              <div className="form-grid-2">
                <div className="form-field">
                  <label>Fondo Inicial ($ USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={fondoInicialUsd}
                    onChange={(e) => setFondoInicialUsd(parseFloat(e.target.value) || 0)}
                    className="form-input"
                  />
                </div>

                <div className="form-field">
                  <label>Fondo Inicial (Bs)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={fondoInicialBs}
                    onChange={(e) => setFondoInicialBs(parseFloat(e.target.value) || 0)}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="modal-recipe-actions">
                <button type="button" onClick={() => setModalAbrir(false)} className="btn-cancel">Cancelar</button>
                <button type="submit" disabled={guardando} className="btn-submit-recipe">
                  {guardando ? "Abriendo..." : "🔓 Confirmar Apertura"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cierre de Turno & Arqueo (Corte Z) */}
      {modalCerrar && (
        <div className="modal-overlay">
          <div className="modal-recipe-card" style={{ maxWidth: 500 }}>
            <div className="modal-recipe-header">
              <h2>🔒 Cierre de Turno & Arqueo (Corte Z)</h2>
              <button type="button" onClick={() => setModalCerrar(false)} className="btn-modal-close">✕</button>
            </div>

            <form onSubmit={handleCerrarCaja} className="recipe-form">
              <div className="calc-breakdown-box">
                <div className="breakdown-row">
                  <span>Efectivo Teórico en Gaveta (USD):</span>
                  <strong>${resumenTurno.teoricoEfectivoUsd.toFixed(2)} USD</strong>
                </div>
                <div className="breakdown-row">
                  <span>Pago Móvil Recaudado:</span>
                  <strong>{resumenTurno.pagoMovilBs.toLocaleString()} Bs</strong>
                </div>
                <div className="breakdown-row">
                  <span>Gran Total del Turno:</span>
                  <strong className="text-primary">${resumenTurno.totalUsd.toFixed(2)} USD</strong>
                </div>
              </div>

              <div className="form-field">
                <label>💵 Arqueo Físico: Billetes USD Contados en Gaveta ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={arqueoUsd}
                  onChange={(e) => setArqueoUsd(parseFloat(e.target.value) || 0)}
                  className="form-input"
                  style={{ fontSize: 16, fontWeight: 800 }}
                />
              </div>

              {/* Indicador de Diferencia */}
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  background: Math.abs(diferenciaUsd) < 0.01 ? "var(--green-light)" : "var(--accent-light)",
                  border: `1px solid ${Math.abs(diferenciaUsd) < 0.01 ? "var(--green)" : "var(--accent)"}`,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                <span>Diferencia de Caja:</span>
                <span>
                  {Math.abs(diferenciaUsd) < 0.01
                    ? "🎯 Cuadre Perfecto ($0.00)"
                    : diferenciaUsd > 0
                    ? `🟢 Sobrante: +$${diferenciaUsd.toFixed(2)} USD`
                    : `🔴 Faltante: -$${Math.abs(diferenciaUsd).toFixed(2)} USD`}
                </span>
              </div>

              <div className="form-field">
                <label>Notas u Observaciones del Cierre</label>
                <input
                  type="text"
                  placeholder="Ej. Turno de noche sin incidencias"
                  value={notasCierre}
                  onChange={(e) => setNotasCierre(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="modal-recipe-actions">
                <button type="button" onClick={() => setModalCerrar(false)} className="btn-cancel">Cancelar</button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="btn-submit-recipe"
                  style={{ background: "linear-gradient(135deg, #e11d48 0%, #be123c 100%)" }}
                >
                  {guardando ? "Cerrando..." : "🔒 Finalizar y Cerrar Turno"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
