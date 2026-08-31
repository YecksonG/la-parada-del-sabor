"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { SesionCaja, Venta } from "@/types/database";
import { abrirSesionCaja, cerrarSesionCaja } from "./actions";
import { sounds } from "@/lib/sound-effects";
import { createClient } from "@/lib/supabase/client";

interface CajaClientProps {
  sesionActiva: SesionCaja | null;
  historialCajas: SesionCaja[];
  ventasTurno: Venta[];
  tasaBcv: number;
}

export default function CajaClient({
  sesionActiva,
  historialCajas,
  ventasTurno: initialVentasTurno,
  tasaBcv,
}: CajaClientProps) {
  const router = useRouter();
  const [ventas, setVentas] = useState<Venta[]>(initialVentasTurno);
  const [modalAbrir, setModalAbrir] = useState(false);
  const [modalCerrar, setModalCerrar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [refrescando, setRefrescando] = useState(false);

  const [filtroPeriodo, setFiltroPeriodo] = useState<"turno" | "hoy" | "todo">(
    sesionActiva ? "turno" : "hoy"
  );

  // Sincronizar estado inicial cuando cambian las props
  useEffect(() => {
    setVentas(initialVentasTurno);
  }, [initialVentasTurno]);

  // Función para refrescar datos desde Supabase (Exactamente igual que Dashboard)
  const refrescarVentas = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("ventas")
      .select("*, cliente:clientes(*), items:ventas_items(*, producto:productos(*), extras:ventas_items_extras(*, extra:extras_modificadores(*)))")
      .neq("estado", "cancelada")
      .order("fecha", { ascending: false });

    if (error) {
      console.error("Error cargando ventas en caja:", error);
    } else if (data) {
      setVentas(data as Venta[]);
    }
  }, []);

  // Suscripción Realtime y Polling de Respaldo a ventas y sesiones de caja
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("caja-realtime-listener")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ventas" },
        () => {
          refrescarVentas();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sesiones_caja" },
        () => {
          router.refresh();
        }
      )
      .subscribe();

    // Polling de respaldo cada 3.5 segundos para garantizar actualización en caliente
    const interval = setInterval(() => {
      refrescarVentas();
    }, 3500);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [refrescarVentas, router]);

  // Form de apertura
  const [fondoInicialUsd, setFondoInicialUsd] = useState<number>(20.0);
  const [fondoInicialBs, setFondoInicialBs] = useState<number>(0.0);

  // Form de cierre / arqueo físico en gaveta
  const [arqueoUsd, setArqueoUsd] = useState<number>(0.0);
  const [arqueoBs, setArqueoBs] = useState<number>(0.0);
  const [notasCierre, setNotasCierre] = useState("");

  // Filtrar ventas por período seleccionado (Turno Activo / Hoy / Todo)
  const ventasFiltradas = useMemo(() => {
    const ahora = new Date();
    return ventas.filter((v) => {
      if (v.estado === "cancelada") return false;
      const fechaVenta = new Date(v.fecha);
      if (filtroPeriodo === "turno" && sesionActiva) {
        return fechaVenta >= new Date(sesionActiva.fecha_apertura);
      }
      if (filtroPeriodo === "hoy" || (filtroPeriodo === "turno" && !sesionActiva)) {
        return fechaVenta.toDateString() === ahora.toDateString();
      }
      return true;
    });
  }, [ventas, filtroPeriodo, sesionActiva]);

  // Cálculos en vivo de las ventas del turno estructurados por tipo de fondo
  const resumenTurno = useMemo(() => {
    let efectivoFisicoUsd = 0;
    let efectivoFisicoBs = 0;

    let pagoMovilBs = 0;
    let transferenciaBs = 0;
    let puntoBs = 0;

    let binanceUsd = 0;
    let zelleUsd = 0;

    let totalUsd = 0;
    let totalDeliveryUsd = 0;
    let totalDeliveryViajes = 0;

    ventasFiltradas.forEach((v) => {
      // Fallback si total_usd no fue recalculado por triggers o viene en 0
      const subtotalItems = (v.items || []).reduce((acc, it) => {
        const precio = Number(it.precio_unitario_usd) || 0;
        const cant = Number(it.cantidad) || 0;
        const sub = Number(it.subtotal_usd) > 0 ? Number(it.subtotal_usd) : precio * cant;
        return acc + sub;
      }, 0);

      const vUsd = Number(v.total_usd) > 0 ? Number(v.total_usd) : subtotalItems;
      const tasaVenta = Number(v.tasa_bcv) > 0 ? Number(v.tasa_bcv) : (tasaBcv > 0 ? tasaBcv : 1);
      const vBs = Number(v.total_bs) > 0 ? Number(v.total_bs) : Number((vUsd * tasaVenta).toFixed(2));

      totalUsd += vUsd;

      if (v.tipo_entrega === "delivery" && Number(v.delivery_monto_usd || 0) > 0) {
        totalDeliveryUsd += Number(v.delivery_monto_usd);
        totalDeliveryViajes += 1;
      }

      switch (v.metodo_pago as string) {
        case "efectivo_usd":
        case "efectivo":
          efectivoFisicoUsd += vUsd;
          break;
        case "efectivo_bs":
          efectivoFisicoBs += vBs;
          break;
        case "pago_movil_bs":
        case "pago_movil":
          pagoMovilBs += vBs;
          break;
        case "transferencia_bs":
        case "transferencia":
          transferenciaBs += vBs;
          break;
        case "punto_bs":
        case "punto":
        case "pos":
          puntoBs += vBs;
          break;
        case "binance":
        case "binance_usdt":
          binanceUsd += vUsd;
          break;
        case "zelle":
          zelleUsd += vUsd;
          break;
        default:
          if (vUsd > 0 && vBs === 0) {
            efectivoFisicoUsd += vUsd;
          } else {
            pagoMovilBs += vBs;
          }
      }
    });

    const totalBsDigitales = pagoMovilBs + transferenciaBs + puntoBs;
    const totalBsDigitalesEquivUsd = tasaBcv > 0 ? totalBsDigitales / tasaBcv : 0;

    const totalDolaresDigitalesUsd = binanceUsd + zelleUsd;
    const ventaNetaComidaUsd = totalUsd - totalDeliveryUsd;

    const teoricoEfectivoUsd = (Number(sesionActiva?.monto_inicial_usd) || 0) + efectivoFisicoUsd;
    const teoricoEfectivoBs = (Number(sesionActiva?.monto_inicial_bs) || 0) + efectivoFisicoBs;

    return {
      efectivoFisicoUsd,
      efectivoFisicoBs,
      pagoMovilBs,
      transferenciaBs,
      puntoBs,
      totalBsDigitales,
      totalBsDigitalesEquivUsd,
      binanceUsd,
      zelleUsd,
      totalDolaresDigitalesUsd,
      totalDeliveryUsd,
      totalDeliveryViajes,
      ventaNetaComidaUsd,
      totalUsd,
      teoricoEfectivoUsd,
      teoricoEfectivoBs,
    };
  }, [ventasFiltradas, sesionActiva, tasaBcv]);

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
      router.refresh();
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
      total_ventas_efectivo_usd: resumenTurno.efectivoFisicoUsd,
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
      router.refresh();
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

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* Selector de Período */}
          <div style={{ display: "flex", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: 3, gap: 2 }}>
            <button
              type="button"
              onClick={() => setFiltroPeriodo("turno")}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "none",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                background: filtroPeriodo === "turno" ? "var(--primary)" : "transparent",
                color: filtroPeriodo === "turno" ? "#fff" : "var(--text-muted)",
              }}
            >
              {sesionActiva ? "🟢 Turno Actual" : "🟢 Jornada"}
            </button>
            <button
              type="button"
              onClick={() => setFiltroPeriodo("hoy")}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "none",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                background: filtroPeriodo === "hoy" ? "var(--primary)" : "transparent",
                color: filtroPeriodo === "hoy" ? "#fff" : "var(--text-muted)",
              }}
            >
              📅 Todo Hoy
            </button>
            <button
              type="button"
              onClick={() => setFiltroPeriodo("todo")}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "none",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                background: filtroPeriodo === "todo" ? "var(--primary)" : "transparent",
                color: filtroPeriodo === "todo" ? "#fff" : "var(--text-muted)",
              }}
            >
              📋 Histórico
            </button>
          </div>

          <button
            type="button"
            onClick={async () => {
              setRefrescando(true);
              await refrescarVentas();
              router.refresh();
              setTimeout(() => setRefrescando(false), 500);
            }}
            className="btn-refresh-action"
            title="Actualizar datos de caja en vivo"
            disabled={refrescando}
          >
            <span className={refrescando ? "btn-refresh-icon-spin" : ""}>🔄</span>
            <span>{refrescando ? "Sincronizando..." : "Actualizar"}</span>
          </button>

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
      </div>

      {/* Estado Actual de la Caja */}
      <div className="caja-live-dashboard">
        <div className="caja-banner-activa">
          <div className="caja-banner-status">
            <span className={sesionActiva ? "bcv-dot" : "stock-badge-bajo"} style={{ width: 10, height: 10, borderRadius: "50%" }} />
            <strong>
              {sesionActiva
                ? "Turno de Caja en Operación (Abierto)"
                : "Ventas de la Jornada de Hoy (Sin turno de gaveta abierto)"}
            </strong>
          </div>
          <span className="caja-time-stamp">
            {sesionActiva
              ? `Apertura: ${new Date(sesionActiva.fecha_apertura).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} (${new Date(sesionActiva.fecha_apertura).toLocaleDateString()})`
              : "Mostrando todas las ventas de la jornada"}
          </span>
        </div>

        {/* 1. SECCIÓN: EFECTIVO FÍSICO EN GAVETA */}
        <div style={{ marginTop: 12, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: 14, fontWeight: 900, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            💵 1. Efectivo Físico en Gaveta (Arqueo Físico)
          </h3>
          <span style={{ fontSize: 12, fontWeight: 800, color: "var(--primary-dark)" }}>
            Teórico: ${resumenTurno.teoricoEfectivoUsd.toFixed(2)} USD
          </span>
        </div>

        <div className="caja-summary-grid">
          <div className="caja-stat-card" style={{ borderColor: "var(--primary)" }}>
            <span className="stat-label">💵 Efectivo USD en Gaveta</span>
            <strong className="stat-value text-primary">
              ${resumenTurno.teoricoEfectivoUsd.toFixed(2)} USD
            </strong>
            <span className="stat-hint">
              Fondo inicial (${Number(sesionActiva?.monto_inicial_usd || 0).toFixed(2)}) + Ventas (${resumenTurno.efectivoFisicoUsd.toFixed(2)})
            </span>
          </div>

          <div className="caja-stat-card">
            <span className="stat-label">🇻🇪 Bolívares Físicos en Gaveta (Bs)</span>
            <strong className="stat-value text-green">
              {resumenTurno.teoricoEfectivoBs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs
            </strong>
            <span className="stat-hint">
              Fondo inicial ({Number(sesionActiva?.monto_inicial_bs || 0).toFixed(2)} Bs) + Ventas ({resumenTurno.efectivoFisicoBs.toFixed(2)} Bs)
            </span>
          </div>
        </div>

        {/* 2. SECCIÓN: BOLÍVARES DIGITALES */}
        <div style={{ marginTop: 20, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: 14, fontWeight: 900, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            📱 2. Bolívares Digitales (Conciliación Bancaria BFC)
          </h3>
          <span style={{ fontSize: 12, fontWeight: 800, color: "var(--green)" }}>
            Subtotal: {resumenTurno.totalBsDigitales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs (≈ ${resumenTurno.totalBsDigitalesEquivUsd.toFixed(2)} USD)
          </span>
        </div>

        <div className="caja-summary-grid">
          <div className="caja-stat-card">
            <span className="stat-label">📱 Pago Móvil BFC (Bs)</span>
            <strong className="stat-value text-green">
              {resumenTurno.pagoMovilBs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs
            </strong>
            <span className="stat-hint">
              ≈ ${(tasaBcv > 0 ? resumenTurno.pagoMovilBs / tasaBcv : 0).toFixed(2)} USD (Tasa {tasaBcv.toFixed(2)})
            </span>
          </div>

          <div className="caja-stat-card">
            <span className="stat-label">🏦 Transferencia Bancaria BFC (Bs)</span>
            <strong className="stat-value text-green">
              {resumenTurno.transferenciaBs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs
            </strong>
            <span className="stat-hint">
              ≈ ${(tasaBcv > 0 ? resumenTurno.transferenciaBs / tasaBcv : 0).toFixed(2)} USD
            </span>
          </div>
        </div>

        {/* 3. SECCIÓN: DÓLARES DIGITALES & CRIPTO */}
        <div style={{ marginTop: 20, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: 14, fontWeight: 900, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            🌐 3. Dólares Digitales & Cripto
          </h3>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#d97706" }}>
            Subtotal: ${resumenTurno.totalDolaresDigitalesUsd.toFixed(2)} USD
          </span>
        </div>

        <div className="caja-summary-grid">
          <div className="caja-stat-card">
            <span className="stat-label">🟡 Binance Pay (USDT)</span>
            <strong className="stat-value" style={{ color: "#d97706" }}>
              ${resumenTurno.binanceUsd.toFixed(2)} USDT
            </strong>
            <span className="stat-hint">Cripto directo</span>
          </div>

          <div className="caja-stat-card">
            <span className="stat-label">🟣 Zelle (USD)</span>
            <strong className="stat-value" style={{ color: "#7414CA" }}>
              ${resumenTurno.zelleUsd.toFixed(2)} USD
            </strong>
            <span className="stat-hint">Dólares digitales</span>
          </div>
        </div>

        {/* 4. SECCIÓN: CONCILIACIÓN DE DELIVERY & VENTA NETA DE COCINA */}
        <div style={{ marginTop: 20, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: 14, fontWeight: 900, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            🛵 4. Conciliación de Delivery (Cuentas por Pagar Flota Externa)
          </h3>
          <span style={{ fontSize: 12, fontWeight: 800, color: "var(--primary-dark)" }}>
            {resumenTurno.totalDeliveryViajes} Viajes Realizados
          </span>
        </div>

        <div className="caja-summary-grid">
          <div className="caja-stat-card" style={{ borderColor: "rgba(248, 197, 66, 0.4)", background: "rgba(248, 197, 66, 0.04)" }}>
            <span className="stat-label">🛵 Pasivo Acumulado Delivery (Por Pagar a la Empresa)</span>
            <strong className="stat-value" style={{ color: "var(--primary-dark)" }}>
              ${resumenTurno.totalDeliveryUsd.toFixed(2)} USD
            </strong>
            <span className="stat-hint">
              ≈ {(resumenTurno.totalDeliveryUsd * (tasaBcv > 0 ? tasaBcv : 1)).toFixed(2)} Bs • Dinero recaudado en tránsito
            </span>
          </div>

          <div className="caja-stat-card" style={{ borderColor: "rgba(34, 197, 94, 0.4)", background: "rgba(34, 197, 94, 0.04)" }}>
            <span className="stat-label">🍽️ Venta Neta Real de Cocina (Sin Delivery)</span>
            <strong className="stat-value text-green">
              ${resumenTurno.ventaNetaComidaUsd.toFixed(2)} USD
            </strong>
            <span className="stat-hint">
              Ingreso propio del restaurante para cálculo de margen real
            </span>
          </div>
        </div>

        {/* Gran Total Facturado del Turno */}
        <div className="caja-totals-hero">
          <div>
            <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 700 }}>
              Total Facturado ({ventasFiltradas.length} Comandas)
            </span>
            <h2 style={{ fontSize: 32, fontWeight: 900, color: "var(--text)" }}>
              ${resumenTurno.totalUsd.toFixed(2)} USD
            </h2>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>En Bolívares (BCV):</span>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: "var(--primary-dark)" }}>
              {(resumenTurno.totalUsd * tasaBcv).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs
            </h3>
          </div>
        </div>

        {/* Detalle de Comandas del Turno */}
        <div style={{ marginTop: 16, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>🧾 Comandas del Período ({ventasFiltradas.length})</h3>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Sincronización en vivo</span>
          </div>

          {ventasFiltradas.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "16px 0" }}>
              No hay comandas registradas en este período.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto" }}>
              {ventasFiltradas.map((v) => (
                <div
                  key={v.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "var(--bg-subtle)",
                    border: "1px solid var(--border-subtle)",
                    fontSize: 13,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 900, color: "var(--primary-dark)" }}>
                      #{v.numero_comanda.toString().padStart(4, "0")}
                    </span>
                    <span>{v.cliente?.nombre || "Cliente Mostrador"}</span>
                    {v.tipo_entrega === "delivery" && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: "2px 6px",
                          borderRadius: 6,
                          background: "rgba(248, 197, 66, 0.2)",
                          color: "var(--primary-dark)",
                        }}
                      >
                        🛵 {v.delivery_zona_nombre || "Delivery"} (+${Number(v.delivery_monto_usd || 0).toFixed(2)})
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: "2px 6px",
                        borderRadius: 6,
                        background:
                          v.estado === "pendiente"
                            ? "rgba(245, 158, 11, 0.15)"
                            : v.estado === "preparando"
                            ? "rgba(249, 115, 22, 0.15)"
                            : "rgba(34, 197, 94, 0.15)",
                        color:
                          v.estado === "pendiente"
                            ? "#b45309"
                            : v.estado === "preparando"
                            ? "#ea580c"
                            : "#16a34a",
                        textTransform: "uppercase",
                      }}
                    >
                      {v.estado}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "capitalize" }}>
                      {v.metodo_pago.replace("_", " ")}
                    </span>
                    <div style={{ textAlign: "right" }}>
                      <strong style={{ display: "block", color: "var(--text)" }}>
                        ${Number(v.total_usd).toFixed(2)}
                      </strong>
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                        Bs. {Number(v.total_bs).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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
                  <strong className="text-primary">
                    ${Number(c.estado === "abierta" ? resumenTurno.efectivoFisicoUsd : c.total_ventas_efectivo_usd || 0).toFixed(2)}
                  </strong>
                </div>
                <div className="metric-box">
                  <span className="metric-label">Pago Móvil:</span>
                  <strong className="text-green">
                    {Number(c.estado === "abierta" ? resumenTurno.pagoMovilBs : c.total_ventas_pago_movil_bs || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} Bs
                  </strong>
                </div>
              </div>

              {c.estado === "abierta" ? (
                <div style={{ fontSize: 12, display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border-subtle)", paddingTop: 8, color: "var(--primary)" }}>
                  <span>Estado del Turno:</span>
                  <strong>🔴 En operación (Calculando en vivo)</strong>
                </div>
              ) : c.diferencia_usd !== null ? (
                <div style={{ fontSize: 12, display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border-subtle)", paddingTop: 8 }}>
                  <span>Diferencia Arqueo:</span>
                  <strong style={{ color: c.diferencia_usd >= 0 ? "var(--green)" : "var(--accent)" }}>
                    {c.diferencia_usd >= 0 ? `+${c.diferencia_usd}` : c.diferencia_usd} USD
                  </strong>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      {/* Modal Apertura de Caja */}
      {modalAbrir && (
        <div className="modal-overlay">
          <div className="modal-recipe-card" style={{ maxWidth: 440 }}>
            <div className="modal-recipe-header" style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Image
                src="/mascota/stickers/07_pulgar_arriba_confirmado.png"
                alt="Apertura"
                width={50}
                height={50}
                style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.15))", objectFit: "contain" }}
              />
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: 0, fontSize: 18 }}>🔓 Apertura de Turno</h2>
                <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>¡Vamos con todo el sabor de la jornada!</p>
              </div>
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
                  <span>Fondo Inicial de Apertura:</span>
                  <strong>${Number(sesionActiva?.monto_inicial_usd || 0).toFixed(2)} USD</strong>
                </div>
                <div className="breakdown-row">
                  <span>Ventas en Efectivo USD:</span>
                  <strong>+${resumenTurno.efectivoFisicoUsd.toFixed(2)} USD</strong>
                </div>
                <div className="breakdown-row" style={{ borderTop: "1px dashed var(--border)", paddingTop: 6, fontWeight: 800 }}>
                  <span>Efectivo Teórico en Gaveta:</span>
                  <strong className="text-primary">${resumenTurno.teoricoEfectivoUsd.toFixed(2)} USD</strong>
                </div>
                <div className="breakdown-row">
                  <span>Pago Móvil (Bs):</span>
                  <strong className="text-green">{resumenTurno.pagoMovilBs.toLocaleString(undefined, { minimumFractionDigits: 2 })} Bs</strong>
                </div>
                <div className="breakdown-row">
                  <span>Transferencia Bancaria BFC (Bs):</span>
                  <strong className="text-green">{resumenTurno.transferenciaBs.toLocaleString(undefined, { minimumFractionDigits: 2 })} Bs</strong>
                </div>
                <div className="breakdown-row">
                  <span>Binance Pay (USDT):</span>
                  <strong style={{ color: "#d97706" }}>${resumenTurno.binanceUsd.toFixed(2)} USDT</strong>
                </div>
                <div className="breakdown-row">
                  <span>Zelle (USD):</span>
                  <strong style={{ color: "#7414CA" }}>${resumenTurno.zelleUsd.toFixed(2)} USD</strong>
                </div>
                <div className="breakdown-row" style={{ borderTop: "2px solid var(--border)", paddingTop: 8, fontSize: 15, fontWeight: 900 }}>
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
                  padding: "12px 14px",
                  borderRadius: 14,
                  background: Math.abs(diferenciaUsd) < 0.01 ? "var(--green-light)" : "var(--accent-light)",
                  border: `1px solid ${Math.abs(diferenciaUsd) < 0.01 ? "var(--green)" : "var(--accent)"}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <Image
                  src={
                    Math.abs(diferenciaUsd) < 0.01
                      ? "/mascota/stickers/01_celebracion_exito.png"
                      : "/mascota/stickers/06_pensativa_duda.png"
                  }
                  alt="Diferencia Arqueo"
                  width={52}
                  height={52}
                  style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.12))", flexShrink: 0, objectFit: "contain" }}
                />
                <div style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, fontWeight: 800 }}>
                  <span>Diferencia de Caja:</span>
                  <span>
                    {Math.abs(diferenciaUsd) < 0.01
                      ? "🎯 Cuadre Perfecto ($0.00)"
                      : diferenciaUsd > 0
                      ? `🟢 Sobrante: +$${diferenciaUsd.toFixed(2)} USD`
                      : `🔴 Faltante: -$${Math.abs(diferenciaUsd).toFixed(2)} USD`}
                  </span>
                </div>
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
