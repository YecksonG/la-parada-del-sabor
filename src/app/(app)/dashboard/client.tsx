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
  const [modalGraficasHistoricas, setModalGraficasHistoricas] = useState(false);
  const [agrupacionGrafica, setAgrupacionGrafica] = useState<"semana" | "mes">("semana");
  const [semanaDeliveryKey, setSemanaDeliveryKey] = useState<string>("");
  const [busquedaDelivery, setBusquedaDelivery] = useState<string>("");
  const [copiadoDelivery, setCopiadoDelivery] = useState(false);

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

  // Agrupaciones temporales continuas (Semana a Semana y Mes a Mes)
  const seriesContinuas = useMemo(() => {
    const semanasMap: Record<string, { label: string; ventasUsd: number; costosUsd: number; comandas: number; fechaInicio: number }> = {};
    const mesesMap: Record<string, { label: string; ventasUsd: number; costosUsd: number; comandas: number; fechaInicio: number }> = {};

    const insumosCostosMap = new Map<string, number>();
    insumos.forEach((ins) => {
      insumosCostosMap.set(ins.id, Number(ins.costo_unitario_usd) || 0);
    });

    const recetasCostosMap = new Map<string, number>();
    productos.forEach((prod) => {
      const costoReceta = (prod.ingredientes || []).reduce((acc: number, ing: any) => {
        const costoUnidad = insumosCostosMap.get(ing.insumo_id) || 0;
        return acc + Number(ing.cantidad) * costoUnidad;
      }, 0);
      recetasCostosMap.set(prod.id, costoReceta);
    });

    ventas.forEach((v) => {
      if (v.estado === "cancelada") return;
      const fecha = new Date(v.fecha);
      const montoVenta = Number(v.total_usd) || 0;

      let costoVenta = 0;
      (v.items || []).forEach((item: any) => {
        const costoProd = recetasCostosMap.get(item.producto_id) || 0;
        costoVenta += costoProd * Number(item.cantidad);
      });

      // 1. Agrupar por Semana
      const inicioSemana = new Date(fecha);
      const day = inicioSemana.getDay();
      const diff = inicioSemana.getDate() - day + (day === 0 ? -6 : 1);
      inicioSemana.setDate(diff);
      inicioSemana.setHours(0, 0, 0, 0);
      const semanaKey = inicioSemana.toISOString().split("T")[0];
      const semanaLabel = `Sem ${inicioSemana.getDate()}/${inicioSemana.getMonth() + 1}`;

      if (!semanasMap[semanaKey]) {
        semanasMap[semanaKey] = {
          label: semanaLabel,
          ventasUsd: 0,
          costosUsd: 0,
          comandas: 0,
          fechaInicio: inicioSemana.getTime(),
        };
      }
      semanasMap[semanaKey].ventasUsd += montoVenta;
      semanasMap[semanaKey].costosUsd += costoVenta;
      semanasMap[semanaKey].comandas += 1;

      // 2. Agrupar por Mes
      const mesKey = `${fecha.getFullYear()}-${(fecha.getMonth() + 1).toString().padStart(2, "0")}`;
      const mesesNombres = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
      const mesLabel = `${mesesNombres[fecha.getMonth()]} ${fecha.getFullYear()}`;
      const inicioMes = new Date(fecha.getFullYear(), fecha.getMonth(), 1).getTime();

      if (!mesesMap[mesKey]) {
        mesesMap[mesKey] = {
          label: mesLabel,
          ventasUsd: 0,
          costosUsd: 0,
          comandas: 0,
          fechaInicio: inicioMes,
        };
      }
      mesesMap[mesKey].ventasUsd += montoVenta;
      mesesMap[mesKey].costosUsd += costoVenta;
      mesesMap[mesKey].comandas += 1;
    });

    const listaSemanas = Object.values(semanasMap).sort((a, b) => a.fechaInicio - b.fechaInicio);
    const listaMeses = Object.values(mesesMap).sort((a, b) => a.fechaInicio - b.fechaInicio);

    return {
      semanas: listaSemanas,
      meses: listaMeses,
    };
  }, [ventas, productos, insumos]);

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

    const totalDeliveryUsd = ventasFiltradas.reduce(
      (acc, v) => acc + (v.tipo_entrega === "delivery" ? Number(v.delivery_monto_usd || 0) : 0),
      0
    );
    const totalDeliveryViajes = ventasFiltradas.filter((v) => v.tipo_entrega === "delivery").length;
    const ventasNetasComidaUsd = Math.max(0, totalFacturadoUsd - totalDeliveryUsd);

    const gananciaNetaUsd = ventasNetasComidaUsd - costoInsumosUsd;
    const margenGlobalPct =
      ventasNetasComidaUsd > 0 ? ((gananciaNetaUsd / ventasNetasComidaUsd) * 100).toFixed(1) : "0.0";

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
      totalDeliveryUsd,
      totalDeliveryViajes,
      ventasNetasComidaUsd,
      costoInsumosUsd,
      gananciaNetaUsd,
      margenGlobalPct,
      topPlatos,
      topInsumos,
      totalComandas: ventasFiltradas.length,
      ticketPromedio: ventasFiltradas.length > 0 ? totalFacturadoUsd / ventasFiltradas.length : 0,
    };
  }, [ventasFiltradas, tasaBcv, productos, insumos]);

  // Auditoría y Conciliación Semanal de Delivery con la Empresa Aliada
  const metricasDeliverySemanales = useMemo(() => {
    const semanasMap: Record<string, {
      key: string;
      label: string;
      inicioDate: Date;
      finDate: Date;
      totalViajes: number;
      totalDeliveryUsd: number;
      totalDeliveryBs: number;
      totalComidaUsd: number;
      porNivel: Record<string, { count: number; totalUsd: number }>;
      comandas: Venta[];
    }> = {};

    ventas.forEach((v) => {
      if (v.estado === "cancelada" || v.tipo_entrega !== "delivery") return;

      const fecha = new Date(v.fecha);
      const day = fecha.getDay();
      const diff = fecha.getDate() - day + (day === 0 ? -6 : 1); // Lunes
      const lunes = new Date(fecha);
      lunes.setDate(diff);
      lunes.setHours(0, 0, 0, 0);

      const domingo = new Date(lunes);
      domingo.setDate(lunes.getDate() + 6);
      domingo.setHours(23, 59, 59, 999);

      const key = lunes.toISOString().split("T")[0];
      const mesNombres = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
      const label = `Semana del ${lunes.getDate()} ${mesNombres[lunes.getMonth()]} al ${domingo.getDate()} ${mesNombres[domingo.getMonth()]} ${domingo.getFullYear()}`;

      if (!semanasMap[key]) {
        semanasMap[key] = {
          key,
          label,
          inicioDate: lunes,
          finDate: domingo,
          totalViajes: 0,
          totalDeliveryUsd: 0,
          totalDeliveryBs: 0,
          totalComidaUsd: 0,
          porNivel: {},
          comandas: [],
        };
      }

      const dUsd = Number(v.delivery_monto_usd || 0);
      const tasa = Number(v.tasa_bcv || tasaBcv || 1);
      const dBs = Number(v.delivery_monto_bs || (dUsd * tasa));
      const comidaUsd = Math.max(0, (Number(v.total_usd) || 0) - dUsd);
      const nivel = v.delivery_zona_nombre || "Tarifa Estándar";

      semanasMap[key].totalViajes += 1;
      semanasMap[key].totalDeliveryUsd += dUsd;
      semanasMap[key].totalDeliveryBs += dBs;
      semanasMap[key].totalComidaUsd += comidaUsd;

      if (!semanasMap[key].porNivel[nivel]) {
        semanasMap[key].porNivel[nivel] = { count: 0, totalUsd: 0 };
      }
      semanasMap[key].porNivel[nivel].count += 1;
      semanasMap[key].porNivel[nivel].totalUsd += dUsd;

      semanasMap[key].comandas.push(v);
    });

    const lista = Object.values(semanasMap).sort((a, b) => b.inicioDate.getTime() - a.inicioDate.getTime());
    return lista;
  }, [ventas, tasaBcv]);

  // Semana de delivery activa para auditoría
  const semanaDeliveryActiva = useMemo(() => {
    if (metricasDeliverySemanales.length === 0) return null;
    if (!semanaDeliveryKey) return metricasDeliverySemanales[0];
    return metricasDeliverySemanales.find((s) => s.key === semanaDeliveryKey) || metricasDeliverySemanales[0];
  }, [metricasDeliverySemanales, semanaDeliveryKey]);

  // Comandas filtradas por buscador de delivery
  const comandasDeliveryFiltradas = useMemo(() => {
    if (!semanaDeliveryActiva) return [];
    if (!busquedaDelivery.trim()) return semanaDeliveryActiva.comandas;
    const q = busquedaDelivery.toLowerCase().trim();
    return semanaDeliveryActiva.comandas.filter(
      (v) =>
        v.numero_comanda.toString().includes(q) ||
        (v.cliente?.nombre && v.cliente.nombre.toLowerCase().includes(q)) ||
        (v.cliente?.telefono && v.cliente.telefono.includes(q)) ||
        (v.delivery_zona_nombre && v.delivery_zona_nombre.toLowerCase().includes(q)) ||
        (v.direccion_delivery && v.direccion_delivery.toLowerCase().includes(q))
    );
  }, [semanaDeliveryActiva, busquedaDelivery]);

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

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
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
                onClick={() => {
                  setPeriodo(p.id as any);
                  if (p.id === "todo") {
                    setModalGraficasHistoricas(true);
                  }
                }}
                className={`delivery-btn ${periodo === p.id ? "delivery-btn-active" : ""}`}
                style={{ padding: "8px 14px" }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setModalGraficasHistoricas(true)}
            className="btn-primary-action"
            style={{ fontSize: 12, padding: "8px 14px" }}
            title="Ver evolución de costos semana a semana y mes a mes"
          >
            📈 Gráficas Continuas
          </button>
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
              <div style={{ textAlign: "center", padding: "24px 10px" }}>
                <Image
                  src="/mascota/stickers/05_dormida_cerrado.png"
                  alt="Sin ventas"
                  width={64}
                  height={64}
                  style={{ margin: "0 auto 8px", filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.1))", objectFit: "contain" }}
                />
                <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>No hay ventas registradas en este período.</p>
              </div>
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

      {/* SECCIÓN DEDICADA: AUDITORÍA Y CONCILIACIÓN SEMANAL DE DELIVERY */}
      <div className="receta-card" style={{ marginTop: 20 }}>
        <div className="receta-card-header" style={{ flexWrap: "wrap", gap: 12 }}>
          <div>
            <h3 className="receta-name" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              🛵 Conciliación & Cuentas por Pagar Semanales (Empresa de Delivery)
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
              Cotejo dominical de viajes y cálculo exacto a liquidar a la empresa de transporte los lunes.
            </p>
          </div>

          {/* Selector de Semanas */}
          {metricasDeliverySemanales.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>Semana:</label>
              <select
                value={semanaDeliveryActiva?.key || ""}
                onChange={(e) => setSemanaDeliveryKey(e.target.value)}
                style={{
                  background: "var(--bg-card)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                  padding: "6px 12px",
                  borderRadius: 8,
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {metricasDeliverySemanales.map((sem) => (
                  <option key={sem.key} value={sem.key}>
                    {sem.label} ({sem.totalViajes} viajes • ${sem.totalDeliveryUsd.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {!semanaDeliveryActiva || semanaDeliveryActiva.totalViajes === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--text-muted)" }}>
            <span style={{ fontSize: 36, display: "block", marginBottom: 8 }}>🛵</span>
            <strong style={{ fontSize: 14, color: "var(--text)" }}>Sin envíos de delivery registrados</strong>
            <p style={{ fontSize: 12, margin: "4px 0 0" }}>
              Cuando se registren pedidos con delivery en la web o POS, aparecerán agrupados semana por semana aquí.
            </p>
          </div>
        ) : (
          <div>
            {/* Tarjetas de Resumen de la Semana Seleccionada */}
            <div className="receta-metrics-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", marginTop: 12 }}>
              <div className="metric-box" style={{ borderLeft: "4px solid var(--primary)", background: "rgba(248, 197, 66, 0.05)" }}>
                <span className="metric-label">🛵 Total por Pagar a la Empresa:</span>
                <strong className="metric-val" style={{ fontSize: 22, color: "var(--primary-dark)" }}>
                  ${semanaDeliveryActiva.totalDeliveryUsd.toFixed(2)} USD
                </strong>
                <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 700 }}>
                  ≈ {semanaDeliveryActiva.totalDeliveryBs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs (BCV)
                </span>
              </div>

              <div className="metric-box" style={{ borderLeft: "4px solid #06b6d4" }}>
                <span className="metric-label">📦 Envíos / Viajes Realizados:</span>
                <strong className="metric-val" style={{ fontSize: 22, color: "#06b6d4" }}>
                  {semanaDeliveryActiva.totalViajes} Viajes
                </strong>
                <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                  Tarifa Promedio: ${(semanaDeliveryActiva.totalDeliveryUsd / semanaDeliveryActiva.totalViajes).toFixed(2)} / viaje
                </span>
              </div>

              <div className="metric-box" style={{ borderLeft: "4px solid var(--green)" }}>
                <span className="metric-label">🍽️ Venta de Comida Asociada:</span>
                <strong className="metric-val text-green" style={{ fontSize: 22 }}>
                  ${semanaDeliveryActiva.totalComidaUsd.toFixed(2)} USD
                </strong>
                <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                  Ingreso neto del restaurante por estos pedidos
                </span>
              </div>
            </div>

            {/* Desglose por Nivel de Tarifa */}
            <div style={{ marginTop: 16 }}>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 8 }}>
                📍 Desglose de Tarifas Cobradas por Nivel ({Object.keys(semanaDeliveryActiva.porNivel).length} Niveles Activos):
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {Object.entries(semanaDeliveryActiva.porNivel).map(([nivel, datos]) => (
                  <div
                    key={nivel}
                    style={{
                      background: "var(--bg-subtle)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      padding: "8px 12px",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 12,
                    }}
                  >
                    <span style={{ fontWeight: 800, color: "var(--text)" }}>{nivel}:</span>
                    <span style={{ background: "var(--primary-light)", color: "var(--primary-dark)", padding: "2px 6px", borderRadius: 6, fontWeight: 800 }}>
                      {datos.count} {datos.count === 1 ? "viaje" : "viajes"}
                    </span>
                    <strong style={{ color: "var(--primary-dark)" }}>${datos.totalUsd.toFixed(2)} USD</strong>
                  </div>
                ))}
              </div>
            </div>

            {/* Buscador & Herramientas de Cotejo Dominical */}
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div style={{ position: "relative", minWidth: 260, flex: 1 }}>
                <input
                  type="text"
                  value={busquedaDelivery}
                  onChange={(e) => setBusquedaDelivery(e.target.value)}
                  placeholder="🔍 Buscar por comanda, cliente, sector o dirección..."
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--bg-card)",
                    color: "var(--text)",
                    fontSize: 12.5,
                  }}
                />
              </div>

              {/* Botón Copiar Reporte WhatsApp */}
              <button
                type="button"
                onClick={() => {
                  const texto = `📋 *Liquidación Semanal de Delivery — La Parada del Sabor*\n🗓️ *${semanaDeliveryActiva.label}*\n\n🛵 *Total Viajes:* ${semanaDeliveryActiva.totalViajes}\n💰 *Monto a Transferir:* $${semanaDeliveryActiva.totalDeliveryUsd.toFixed(2)} USD (Bs. ${semanaDeliveryActiva.totalDeliveryBs.toFixed(2)})\n\n📍 *Desglose por Niveles:*\n${Object.entries(semanaDeliveryActiva.porNivel).map(([n, d]) => `• ${n}: ${d.count} viajes ($${d.totalUsd.toFixed(2)})`).join("\n")}\n\n✅ Reporte auditado desde el sistema de comandas.`;
                  navigator.clipboard.writeText(texto);
                  setCopiadoDelivery(true);
                  setTimeout(() => setCopiadoDelivery(false), 2500);
                }}
                className="btn btn-outline"
                style={{ fontSize: 12, padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                {copiadoDelivery ? "✅ ¡Reporte Copiado!" : "📋 Copiar Resumen para WhatsApp de la Empresa"}
              </button>
            </div>

            {/* Tabla de Comandas para Cotejo */}
            <div style={{ marginTop: 12, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "var(--bg-subtle)", borderBottom: "2px solid var(--border)" }}>
                    <th style={{ padding: "8px 10px" }}>Comanda</th>
                    <th style={{ padding: "8px 10px" }}>Fecha / Hora</th>
                    <th style={{ padding: "8px 10px" }}>Cliente</th>
                    <th style={{ padding: "8px 10px" }}>Nivel / Zona</th>
                    <th style={{ padding: "8px 10px" }}>Dirección</th>
                    <th style={{ padding: "8px 10px", textAlign: "right" }}>Costo Delivery</th>
                    <th style={{ padding: "8px 10px", textAlign: "right" }}>Total Pedido</th>
                  </tr>
                </thead>
                <tbody>
                  {comandasDeliveryFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: "16px", textAlign: "center", color: "var(--text-muted)" }}>
                        No se encontraron comandas con el filtro indicado.
                      </td>
                    </tr>
                  ) : (
                    comandasDeliveryFiltradas.map((v) => (
                      <tr key={v.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <td style={{ padding: "8px 10px", fontWeight: 800, color: "var(--primary-dark)" }}>
                          #{v.numero_comanda.toString().padStart(4, "0")}
                        </td>
                        <td style={{ padding: "8px 10px", color: "var(--text-muted)" }}>
                          {new Date(v.fecha).toLocaleDateString([], { day: "2-digit", month: "2-digit" })}{" "}
                          {new Date(v.fecha).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          <strong>{v.cliente?.nombre || "Cliente"}</strong>
                          {v.cliente?.telefono && (
                            <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)" }}>
                              {v.cliente.telefono}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          <span style={{ background: "rgba(248, 197, 66, 0.15)", color: "var(--primary-dark)", padding: "2px 6px", borderRadius: 4, fontWeight: 800, fontSize: 11 }}>
                            {v.delivery_zona_nombre || "Zona Delivery"}
                          </span>
                        </td>
                        <td style={{ padding: "8px 10px", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={v.direccion_delivery || ""}>
                          {v.direccion_delivery || "—"}
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 800, color: "var(--primary-dark)" }}>
                          ${Number(v.delivery_monto_usd || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700 }}>
                          ${Number(v.total_usd || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Gráficas Continuas Históricas (Semana a Semana / Mes a Mes) */}
      {modalGraficasHistoricas && (
        <div className="modal-overlay" onClick={() => setModalGraficasHistoricas(false)}>
          <div
            className="modal-recipe-card"
            style={{ maxWidth: 880, width: "95%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-recipe-header">
              <div>
                <h2>📈 Análisis Continuo de Costos & Facturación</h2>
                <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                  Evolución cronológica de ventas facturadas vs costos de insumos consumidos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalGraficasHistoricas(false)}
                className="btn-modal-close"
              >
                ✕
              </button>
            </div>

            {/* Selector de Agrupación Temporal */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "16px 0", flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", background: "var(--bg-subtle)", borderRadius: 10, padding: 3, border: "1px solid var(--border)" }}>
                <button
                  type="button"
                  onClick={() => setAgrupacionGrafica("semana")}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 8,
                    border: "none",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    background: agrupacionGrafica === "semana" ? "var(--primary)" : "transparent",
                    color: agrupacionGrafica === "semana" ? "#fff" : "var(--text-muted)",
                  }}
                >
                  📅 Semana a Semana
                </button>
                <button
                  type="button"
                  onClick={() => setAgrupacionGrafica("mes")}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 8,
                    border: "none",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    background: agrupacionGrafica === "mes" ? "var(--primary)" : "transparent",
                    color: agrupacionGrafica === "mes" ? "#fff" : "var(--text-muted)",
                  }}
                >
                  📆 Mes a Mes
                </button>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 12 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: "var(--primary)" }}></span>
                  <strong>Ventas ($)</strong>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: "#ef4444" }}></span>
                  <strong>Costos Insumos ($)</strong>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: "#22c55e" }}></span>
                  <strong>Ganancia Neta ($)</strong>
                </span>
              </div>
            </div>

            {/* Renderizado de Gráfica Continua */}
            {(() => {
              const dataPoints = seriesContinuas[agrupacionGrafica === "semana" ? "semanas" : "meses"];
              if (dataPoints.length === 0) {
                return (
                  <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
                    No hay suficientes datos registrados para trazar la gráfica.
                  </div>
                );
              }

              const totalVentasPeriodo = dataPoints.reduce((a, b) => a + b.ventasUsd, 0);
              const totalCostosPeriodo = dataPoints.reduce((a, b) => a + b.costosUsd, 0);
              const totalGananciaPeriodo = totalVentasPeriodo - totalCostosPeriodo;
              const margenPeriodo = totalVentasPeriodo > 0 ? (totalGananciaPeriodo / totalVentasPeriodo) * 100 : 0;
              const maxVenta = Math.max(...dataPoints.map((d) => d.ventasUsd), 10);

              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Resumen Superior Rápido del Período Seleccionado */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                    <div style={{ background: "var(--bg-subtle)", padding: "10px 14px", borderRadius: 12, border: "1px solid var(--border)" }}>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block", textTransform: "uppercase", fontWeight: 700 }}>Total Facturado</span>
                      <strong style={{ fontSize: 16, color: "var(--primary-dark)" }}>${totalVentasPeriodo.toFixed(2)} USD</strong>
                    </div>
                    <div style={{ background: "var(--bg-subtle)", padding: "10px 14px", borderRadius: 12, border: "1px solid var(--border)" }}>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block", textTransform: "uppercase", fontWeight: 700 }}>Costo de Insumos</span>
                      <strong style={{ fontSize: 16, color: "#ef4444" }}>${totalCostosPeriodo.toFixed(2)} USD</strong>
                    </div>
                    <div style={{ background: "var(--bg-subtle)", padding: "10px 14px", borderRadius: 12, border: "1px solid var(--border)" }}>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block", textTransform: "uppercase", fontWeight: 700 }}>Ganancia Neta</span>
                      <strong style={{ fontSize: 16, color: totalGananciaPeriodo >= 0 ? "#16a34a" : "#dc2626" }}>
                        +${totalGananciaPeriodo.toFixed(2)} USD
                      </strong>
                    </div>
                    <div style={{ background: "var(--bg-subtle)", padding: "10px 14px", borderRadius: 12, border: "1px solid var(--border)" }}>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block", textTransform: "uppercase", fontWeight: 700 }}>Margen Promedio</span>
                      <strong style={{ fontSize: 16, color: "#d97706" }}>{margenPeriodo.toFixed(1)}%</strong>
                    </div>
                  </div>

                  {/* Gráfica Visual de Barras Comparativas */}
                  <div
                    style={{
                      background: "var(--bg-subtle)",
                      border: "1px solid var(--border)",
                      borderRadius: 16,
                      padding: "24px 16px 16px",
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "space-around",
                      minHeight: 250,
                      gap: 14,
                      overflowX: "auto",
                    }}
                  >
                    {dataPoints.map((dp, idx) => {
                      const alturaVentasPct = Math.max(10, (dp.ventasUsd / maxVenta) * 100);
                      const alturaCostosPct = Math.max(5, (dp.costosUsd / maxVenta) * 100);
                      const ganancia = dp.ventasUsd - dp.costosUsd;
                      const margen = dp.ventasUsd > 0 ? (ganancia / dp.ventasUsd) * 100 : 0;

                      return (
                        <div
                          key={idx}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 6,
                            minWidth: 72,
                            flex: 1,
                            background: "var(--surface)",
                            padding: "8px 4px",
                            borderRadius: 12,
                            border: "1px solid var(--border)",
                          }}
                        >
                          <span style={{ fontSize: 11, fontWeight: 900, color: ganancia >= 0 ? "#16a34a" : "#dc2626" }}>
                            +${ganancia.toFixed(0)}
                          </span>

                          <div
                            style={{
                              display: "flex",
                              alignItems: "flex-end",
                              gap: 6,
                              height: 130,
                              width: "100%",
                              justifyContent: "center",
                            }}
                          >
                            {/* Barra de Ventas */}
                            <div
                              title={`Ventas: $${dp.ventasUsd.toFixed(2)} USD (${dp.comandas} comandas)`}
                              style={{
                                height: `${alturaVentasPct}%`,
                                width: 22,
                                background: "linear-gradient(180deg, var(--primary) 0%, var(--accent) 100%)",
                                borderRadius: "6px 6px 0 0",
                                display: "flex",
                                alignItems: "flex-start",
                                justifyContent: "center",
                                transition: "height 0.3s ease",
                              }}
                            />
                            {/* Barra de Costos */}
                            <div
                              title={`Costo Insumos: $${dp.costosUsd.toFixed(2)} USD`}
                              style={{
                                height: `${alturaCostosPct}%`,
                                width: 22,
                                background: "linear-gradient(180deg, #f87171 0%, #ef4444 100%)",
                                borderRadius: "6px 6px 0 0",
                                transition: "height 0.3s ease",
                              }}
                            />
                          </div>

                          <div style={{ textAlign: "center", width: "100%" }}>
                            <strong style={{ fontSize: 11, color: "var(--text)", display: "block" }}>{dp.label}</strong>
                            <span style={{ fontSize: 10, color: "var(--primary-dark)", fontWeight: 700 }}>{margen.toFixed(0)}% mg</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Tabla de Detalle Cronológico */}
                  <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 12 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                          <th style={{ padding: "8px 12px" }}>Período</th>
                          <th style={{ padding: "8px 12px" }}>Comandas</th>
                          <th style={{ padding: "8px 12px" }}>Facturado USD</th>
                          <th style={{ padding: "8px 12px" }}>Costo Insumos</th>
                          <th style={{ padding: "8px 12px" }}>Ganancia Neta</th>
                          <th style={{ padding: "8px 12px" }}>Margen %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dataPoints.slice().reverse().map((dp, i) => {
                          const ganancia = dp.ventasUsd - dp.costosUsd;
                          const margen = dp.ventasUsd > 0 ? (ganancia / dp.ventasUsd) * 100 : 0;
                          return (
                            <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                              <td style={{ padding: "8px 12px", fontWeight: 700 }}>{dp.label}</td>
                              <td style={{ padding: "8px 12px" }}>{dp.comandas}</td>
                              <td style={{ padding: "8px 12px", fontWeight: 700, color: "var(--primary-dark)" }}>
                                ${dp.ventasUsd.toFixed(2)}
                              </td>
                              <td style={{ padding: "8px 12px", color: "#ef4444" }}>
                                ${dp.costosUsd.toFixed(2)}
                              </td>
                              <td style={{ padding: "8px 12px", fontWeight: 800, color: ganancia >= 0 ? "#16a34a" : "#dc2626" }}>
                                ${ganancia.toFixed(2)}
                              </td>
                              <td style={{ padding: "8px 12px", fontWeight: 700 }}>
                                {margen.toFixed(1)}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </main>
  );
}
