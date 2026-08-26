"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Venta, Cliente, Insumo, Producto } from "@/types/database";

interface DashboardClientProps {
  ventas: Venta[];
  clientes: Cliente[];
  insumos: Insumo[];
  productos: Producto[];
  tasaBcv: number;
}

export default function DashboardClient({
  ventas,
  clientes,
  insumos,
  productos,
  tasaBcv,
}: DashboardClientProps) {
  const [periodo, setPeriodo] = useState<"hoy" | "semana" | "mes" | "todo">("mes");

  // Filtrar ventas por periodo
  const ventasFiltradas = useMemo(() => {
    const ahora = new Date();
    return ventas.filter((v) => {
      const fechaVenta = new Date(v.fecha);
      if (periodo === "hoy") {
        return fechaVenta.toDateString() === ahora.toDateString();
      }
      if (periodo === "semana") {
        const hace7Dias = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
        return fechaVenta >= hace7Dias;
      }
      if (periodo === "mes") {
        const hace30Dias = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
        return fechaVenta >= hace30Dias;
      }
      return true;
    });
  }, [ventas, periodo]);

  // Cálculos Financieros
  const finanzas = useMemo(() => {
    const totalFacturadoUsd = ventasFiltradas.reduce((acc, v) => acc + (Number(v.total_usd) || 0), 0);
    const totalFacturadoBs = totalFacturadoUsd * tasaBcv;

    // Calcular costo real de insumos vendidos en el periodo
    let costoInsumosUsd = 0;
    const rankingPlatos: { [nombre: string]: { cantidad: number; totalUsd: number; icono: string } } = {};
    const consumoInsumosGramos: { [nombre: string]: { gramos: number; unidad: string } } = {};

    ventasFiltradas.forEach((v) => {
      (v.items || []).forEach((item) => {
        const prod = productos.find((p) => p.id === item.producto_id);
        const nombreProd = prod?.nombre || "Arepa";
        const iconoProd = prod?.icono || "🫓";

        // Ranking de platos
        if (!rankingPlatos[nombreProd]) {
          rankingPlatos[nombreProd] = { cantidad: 0, totalUsd: 0, icono: iconoProd };
        }
        rankingPlatos[nombreProd].cantidad += Number(item.cantidad);
        rankingPlatos[nombreProd].totalUsd += Number(item.subtotal_usd);

        // Costo de receta
        (prod?.ingredientes || []).forEach((ing) => {
          const insumo = insumos.find((i) => i.id === ing.insumo_id);
          const cantidadGastada = Number(ing.cantidad) * Number(item.cantidad);
          const costoUnit = Number(insumo?.costo_unitario_usd) || 0;
          costoInsumosUsd += cantidadGastada * costoUnit;

          // Consumo de insumos
          const nombreIns = insumo?.nombre || "Insumo";
          if (!consumoInsumosGramos[nombreIns]) {
            consumoInsumosGramos[nombreIns] = { gramos: 0, unidad: insumo?.unidad_medida || "g" };
          }
          consumoInsumosGramos[nombreIns].gramos += cantidadGastada;
        });
      });
    });

    const gananciaNetaUsd = totalFacturadoUsd - costoInsumosUsd;
    const margenGlobalPct =
      totalFacturadoUsd > 0 ? ((gananciaNetaUsd / totalFacturadoUsd) * 100).toFixed(1) : "0.0";

    const topPlatos = Object.entries(rankingPlatos)
      .map(([nombre, data]) => ({ nombre, ...data }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5);

    const topInsumos = Object.entries(consumoInsumosGramos)
      .map(([nombre, data]) => ({ nombre, ...data }))
      .sort((a, b) => b.gramos - a.gramos)
      .slice(0, 6);

    return {
      totalFacturadoUsd,
      totalFacturadoBs,
      costoInsumosUsd,
      gananciaNetaUsd,
      margenGlobalPct,
      topPlatos,
      topInsumos,
      totalComandas: ventasFiltradas.length,
      ticketPromedio: ventasFiltradas.length > 0 ? totalFacturadoUsd / ventasFiltradas.length : 0,
    };
  }, [ventasFiltradas, tasaBcv, productos, insumos]);

  // Métricas de Clientes
  const metricasClientes = useMemo(() => {
    const totalClientes = clientes.length;
    const clientesRecurrentes = clientes.filter((c) => c.total_pedidos > 1).length;
    const topClientes = [...clientes].sort((a, b) => b.total_pedidos - a.total_pedidos).slice(0, 5);

    return {
      totalClientes,
      clientesRecurrentes,
      topClientes,
    };
  }, [clientes]);

  // Métricas de Canales de Origen (Instagram / WhatsApp / QR / Web / POS)
  const metricasCanales = useMemo(() => {
    let instagram = { count: 0, totalUsd: 0 };
    let whatsapp = { count: 0, totalUsd: 0 };
    let qr = { count: 0, totalUsd: 0 };
    let webDirecto = { count: 0, totalUsd: 0 };
    let posMostrador = { count: 0, totalUsd: 0 };

    ventasFiltradas.forEach((v) => {
      const monto = Number(v.total_usd) || 0;
      const origen = (v.origen_pedido || "").toLowerCase();

      if (origen === "instagram" || origen === "ig") {
        instagram.count += 1;
        instagram.totalUsd += monto;
      } else if (origen === "whatsapp" || origen === "ws" || origen === "wa") {
        whatsapp.count += 1;
        whatsapp.totalUsd += monto;
      } else if (origen === "qr") {
        qr.count += 1;
        qr.totalUsd += monto;
      } else if (v.creado_por === "web_cliente" || origen === "directo" || origen === "web") {
        webDirecto.count += 1;
        webDirecto.totalUsd += monto;
      } else {
        posMostrador.count += 1;
        posMostrador.totalUsd += monto;
      }
    });

    return {
      instagram,
      whatsapp,
      qr,
      webDirecto,
      posMostrador,
    };
  }, [ventasFiltradas]);

  return (
    <main className="recetas-container">
      {/* Header con Filtro de Periodo */}
      <div className="recetas-header">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Image
            src="/images/logo-badge.png"
            alt="Logo La Parada del Sabor"
            width={48}
            height={48}
            style={{ borderRadius: "50%", flexShrink: 0 }}
          />
          <div>
            <h1 className="recetas-title">📊 Panel Administrativo & Métricas</h1>
            <p className="recetas-subtitle">
              Monitoreo en tiempo real de facturación, márgenes netos, clientes ganados y consumo de despensa.
            </p>
          </div>
        </div>

        <div className="delivery-type-selector" style={{ width: "auto" }}>
          {[
            { id: "hoy", label: "Hoy" },
            { id: "semana", label: "Últimos 7 días" },
            { id: "mes", label: "Este Mes" },
            { id: "todo", label: "Histórico Total" },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriodo(p.id as any)}
              className={`delivery-btn ${periodo === p.id ? "delivery-btn-active" : ""}`}
              style={{ padding: "8px 14px" }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tarjetas Principales KPI */}
      <div className="caja-summary-grid">
        <div className="caja-stat-card">
          <span className="stat-label">💵 Total Facturado ({periodo.toUpperCase()})</span>
          <strong className="stat-value text-primary">
            ${finanzas.totalFacturadoUsd.toFixed(2)} USD
          </strong>
          <span className="stat-hint">{finanzas.totalFacturadoBs.toLocaleString()} Bs (BCV {tasaBcv})</span>
        </div>

        <div className="caja-stat-card">
          <span className="stat-label">🥩 Costo Materia Prima</span>
          <strong className="stat-value">
            ${finanzas.costoInsumosUsd.toFixed(2)} USD
          </strong>
          <span className="stat-hint">Consumo real en recetas</span>
        </div>

        <div className="caja-stat-card">
          <span className="stat-label">✨ Ganancia Neta Estimada</span>
          <strong className="stat-value text-green">
            ${finanzas.gananciaNetaUsd.toFixed(2)} USD
          </strong>
          <span className="stat-hint">Margen Global: {finanzas.margenGlobalPct}% 🔥</span>
        </div>

        <div className="caja-stat-card">
          <span className="stat-label">🧾 Comandas & Ticket Promedio</span>
          <strong className="stat-value">
            {finanzas.totalComandas} Ventas
          </strong>
          <span className="stat-hint">Promedio: ${finanzas.ticketPromedio.toFixed(2)} / comanda</span>
        </div>
      </div>

      {/* Grid de 2 Columnas: Ranking de Platos y Consumo de Insumos */}
      <div className="form-grid-2">
        {/* Top Arepas & Platos Estrella */}
        <div className="receta-card">
          <div className="receta-card-header">
            <h3 className="receta-name">🔥 Arepas & Platos Más Vendidos</h3>
          </div>

          <div className="dashboard-rank-list">
            {finanzas.topPlatos.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No hay ventas en este periodo.</p>
            ) : (
              finanzas.topPlatos.map((plato, idx) => {
                const maxVentas = finanzas.topPlatos[0]?.cantidad || 1;
                const pct = Math.round((plato.cantidad / maxVentas) * 100);

                return (
                  <div key={plato.nombre} className="rank-item-row">
                    <div className="rank-item-info">
                      <span className="rank-badge">#{idx + 1}</span>
                      <span style={{ fontSize: 20 }}>{plato.icono}</span>
                      <strong className="rank-item-name">{plato.nombre}</strong>
                    </div>
                    <div className="rank-item-metrics">
                      <span><strong>{plato.cantidad}</strong> unds</span>
                      <span className="text-primary">${plato.totalUsd.toFixed(2)}</span>
                    </div>
                    {/* Barra visual de popularidad */}
                    <div className="rank-progress-track">
                      <div className="rank-progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Consumo de Materia Prima en Gramos */}
        <div className="receta-card">
          <div className="receta-card-header">
            <h3 className="receta-name">🌾 Despensa Consumida en Gramos (BOM)</h3>
          </div>

          <div className="dashboard-rank-list">
            {finanzas.topInsumos.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No hay consumo registrado.</p>
            ) : (
              finanzas.topInsumos.map((ins) => {
                const esGramos = ins.unidad === "g";
                const esMililitros = ins.unidad === "ml";
                const display =
                  esGramos && ins.gramos >= 1000
                    ? `${(ins.gramos / 1000).toFixed(2)} kg (${ins.gramos.toLocaleString()} g)`
                    : esMililitros && ins.gramos >= 1000
                    ? `${(ins.gramos / 1000).toFixed(2)} L (${ins.gramos.toLocaleString()} ml)`
                    : `${ins.gramos.toLocaleString()} ${ins.unidad}`;

                return (
                  <div key={ins.nombre} className="rank-item-row">
                    <div className="rank-item-info">
                      <span style={{ fontSize: 16 }}>📦</span>
                      <strong className="rank-item-name">{ins.nombre}</strong>
                    </div>
                    <div className="rank-item-metrics">
                      <strong className="text-primary">{display}</strong>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Sección de Métricas de Clientes Ganados */}
      <div className="receta-card">
        <div className="receta-card-header">
          <h3 className="receta-name">👥 Crecimiento de Clientes & Fidelización</h3>
        </div>

        <div className="receta-metrics-row" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div className="metric-box">
            <span className="metric-label">Total Clientes en Agenda:</span>
            <strong className="metric-val text-primary" style={{ fontSize: 20 }}>
              {metricasClientes.totalClientes} Clientes
            </strong>
          </div>
          <div className="metric-box">
            <span className="metric-label">Clientes Recurrentes (+1 pedido):</span>
            <strong className="metric-val text-green" style={{ fontSize: 20 }}>
              {metricasClientes.clientesRecurrentes} Clientes
            </strong>
          </div>
          <div className="metric-box">
            <span className="metric-label">Tasa de Recompra:</span>
            <strong className="metric-val" style={{ fontSize: 20 }}>
              {metricasClientes.totalClientes > 0
                ? ((metricasClientes.clientesRecurrentes / metricasClientes.totalClientes) * 100).toFixed(1)
                : 0}%
            </strong>
          </div>
        </div>

        {/* Top Clientes con más pedidos */}
        <div className="dashboard-rank-list" style={{ marginTop: 14 }}>
          <span className="ingredients-title">Top Clientes Más Frecuentes:</span>
          {metricasClientes.topClientes.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: 12 }}>No hay clientes registrados.</p>
          ) : (
            metricasClientes.topClientes.map((c, i) => (
              <div key={c.id} className="rank-item-row">
                <div className="rank-item-info">
                  <span className="rank-badge">#{i + 1}</span>
                  <strong>{c.nombre}</strong>
                  {c.telefono && <span style={{ color: "var(--text-muted)", fontSize: 11 }}>({c.telefono})</span>}
                </div>
                <span className="badge-ticket">{c.total_pedidos} Pedidos Realizados</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Sección de Canales de Adquisición (Instagram / WhatsApp / Directo / POS) */}
      <div className="receta-card" style={{ marginTop: 16 }}>
        <div className="receta-card-header">
          <h3 className="receta-name">🌐 Canales de Venta & Rendimiento de Redes Sociales</h3>
        </div>

        <div className="receta-metrics-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          {/* Instagram */}
          <div className="metric-box" style={{ borderLeft: "4px solid #dc2743" }}>
            <span className="metric-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              📸 <strong>Instagram</strong>
            </span>
            <strong className="metric-val" style={{ fontSize: 18, color: "#dc2743" }}>
              ${metricasCanales.instagram.totalUsd.toFixed(2)} USD
            </strong>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {metricasCanales.instagram.count} pedidos (?ref=instagram)
            </span>
          </div>

          {/* WhatsApp */}
          <div className="metric-box" style={{ borderLeft: "4px solid #25D366" }}>
            <span className="metric-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              💬 <strong>WhatsApp</strong>
            </span>
            <strong className="metric-val" style={{ fontSize: 18, color: "#25D366" }}>
              ${metricasCanales.whatsapp.totalUsd.toFixed(2)} USD
            </strong>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {metricasCanales.whatsapp.count} pedidos (?ref=whatsapp)
            </span>
          </div>

          {/* Web Directo */}
          <div className="metric-box" style={{ borderLeft: "4px solid #3b82f6" }}>
            <span className="metric-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              🌐 <strong>Web Directa</strong>
            </span>
            <strong className="metric-val" style={{ fontSize: 18, color: "#3b82f6" }}>
              ${metricasCanales.webDirecto.totalUsd.toFixed(2)} USD
            </strong>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {metricasCanales.webDirecto.count} pedidos online
            </span>
          </div>

          {/* QR Mesa / Local */}
          <div className="metric-box" style={{ borderLeft: "4px solid #06b6d4" }}>
            <span className="metric-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              📲 <strong>QR Mesa</strong>
            </span>
            <strong className="metric-val" style={{ fontSize: 18, color: "#06b6d4" }}>
              ${metricasCanales.qr.totalUsd.toFixed(2)} USD
            </strong>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {metricasCanales.qr.count} pedidos en local
            </span>
          </div>

          {/* POS Mostrador */}
          <div className="metric-box" style={{ borderLeft: "4px solid var(--primary)" }}>
            <span className="metric-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              🖥️ <strong>POS Mostrador</strong>
            </span>
            <strong className="metric-val" style={{ fontSize: 18, color: "var(--primary-dark)" }}>
              ${metricasCanales.posMostrador.totalUsd.toFixed(2)} USD
            </strong>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {metricasCanales.posMostrador.count} comandas físicas
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
