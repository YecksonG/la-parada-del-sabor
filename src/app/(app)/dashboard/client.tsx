"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Venta, Cliente, Insumo, Producto, SesionCaja } from "@/types/database";
import { esMismaFechaEnCaracas, toFechaCaracasString } from "@/lib/date-vzla";

export interface JornadaCierreItem {
  id: string;
  titulo: string;
  fechaTexto: string;
  fechaIso: string;
  fechaApertura: string;
  fechaCierre?: string | null;
  estado: "abierta" | "cerrada";
  fondoInicialUsd: number;
  totalUsd: number;
  totalBs: number;
  efectivoUsd: number;
  efectivoBs: number;
  pagoMovilBs: number;
  transferenciaBs: number;
  puntoBs: number;
  dolaresDigitalesUsd: number;
  diferenciaUsd?: number | null;
  notasCierre?: string | null;
  comandas: Venta[];
  esSesionFormal: boolean;
}

export function getMetodoPagoBadge(metodo?: string | null) {
  switch (metodo) {
    case "efectivo_usd":
      return { label: "💵 Efectivo USD", color: "#16a34a", bg: "rgba(22, 163, 74, 0.12)" };
    case "efectivo_bs":
      return { label: "🇻🇪 Efectivo Bs", color: "#16a34a", bg: "rgba(22, 163, 74, 0.12)" };
    case "pago_movil":
    case "pago_movil_bs":
      return { label: "📱 Pago Móvil Bs", color: "#0284c7", bg: "rgba(2, 132, 199, 0.12)" };
    case "punto":
    case "punto_bs":
      return { label: "💳 Punto / POS", color: "#6366f1", bg: "rgba(99, 102, 241, 0.12)" };
    case "transferencia":
    case "transferencia_bs":
      return { label: "🏦 Transferencia", color: "#0d9488", bg: "rgba(13, 148, 136, 0.12)" };
    case "binance":
      return { label: "🟡 Binance Pay", color: "#ca8a04", bg: "rgba(202, 138, 4, 0.12)" };
    case "zelle":
      return { label: "🟣 Zelle", color: "#9333ea", bg: "rgba(147, 51, 234, 0.12)" };
    case "pesos_cop":
      return { label: "🇨🇴 Pesos COP", color: "#ea580c", bg: "rgba(234, 88, 12, 0.12)" };
    default:
      return { label: metodo ? `💳 ${metodo}` : "💵 Efectivo USD", color: "var(--text)", bg: "var(--bg-subtle)" };
  }
}

interface DashboardClientProps {
  ventas: Venta[];
  clientes: Cliente[];
  insumos: Insumo[];
  productos: Producto[];
  historialCajas?: SesionCaja[];
  tasaBcv: number;
}

export default function DashboardClient({
  ventas,
  clientes,
  insumos,
  productos,
  historialCajas = [],
  tasaBcv,
}: DashboardClientProps) {
  const [periodo, setPeriodo] = useState<"hoy" | "semana" | "mes" | "todo">("mes");
  const [modalGraficasHistoricas, setModalGraficasHistoricas] = useState(false);
  const [agrupacionGrafica, setAgrupacionGrafica] = useState<"semana" | "mes">("semana");
  const [semanaDeliveryKey, setSemanaDeliveryKey] = useState<string>("");
  const [busquedaDelivery, setBusquedaDelivery] = useState<string>("");
  const [copiadoDelivery, setCopiadoDelivery] = useState(false);

  // Modal para ver comandas del cierre seleccionado
  const [cierreSeleccionado, setCierreSeleccionado] = useState<JornadaCierreItem | null>(null);
  const [filtroEstadoModalCierre, setFiltroEstadoModalCierre] = useState<string>("todos");

  // Filtrar ventas por periodo
  const ventasFiltradas = useMemo(() => {
    const ahora = new Date();
    return ventas.filter((v) => {
      const fechaVenta = new Date(v.fecha);
      if (periodo === "hoy") {
        return esMismaFechaEnCaracas(v.fecha);
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
    // Cálculo individual por comanda según su tasa y bolívares históricos
    const totalFacturadoBs = ventasFiltradas.reduce((acc, v) => {
      const bsHistorico = Number(v.total_bs);
      if (!isNaN(bsHistorico) && bsHistorico > 0) return acc + bsHistorico;
      const tasaHistorica = Number(v.tasa_bcv) || tasaBcv;
      return acc + ((Number(v.total_usd) || 0) * tasaHistorica);
    }, 0);

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

  // Historial unificado de Cierres de Caja & Jornadas Diarias
  const jornadasCierres = useMemo(() => {
    const list: JornadaCierreItem[] = [];
    const fechasCubiertas = new Set<string>();

    // 1. Si hay sesiones formales en `historialCajas`, mapearlas
    historialCajas.forEach((c) => {
      const fechaIso = toFechaCaracasString(c.fecha_apertura);
      fechasCubiertas.add(fechaIso);

      const apertura = new Date(c.fecha_apertura);
      const cierre = c.fecha_cierre ? new Date(c.fecha_cierre) : null;

      // Filtrar comandas de este turno
      // Sesiones abiertas: incluir todas las ventas desde apertura (sin límite superior)
      // Sesiones cerradas: incluir solo ventas dentro del rango apertura ↔ cierre
      const comandasTurno = ventas.filter((v) => {
        if (v.estado === "cancelada") return false;
        const f = new Date(v.fecha);
        if (cierre) {
          return f >= apertura && f <= cierre;
        }
        return f >= apertura;
      });

      // Cubrir TODAS las fechas a las que pertenecen las comandas de este turno formal.
      // Esto evita que ventas de sesiones abiertas multi-día (o que cruzan medianoche)
      // se filtren a jornadas sintéticas y se cuenten dos veces.
      comandasTurno.forEach((v) => {
        fechasCubiertas.add(toFechaCaracasString(v.fecha));
      });

      const totalVentasUsdCalc = comandasTurno.reduce((acc, v) => acc + (Number(v.total_usd) || 0), 0);
      const totalVentasBsCalc = comandasTurno.reduce((acc, v) => acc + (Number(v.total_bs) || 0), 0);

      const efectivoCalc = comandasTurno
        .filter((v) => v.metodo_pago === "efectivo_usd" || v.metodo_pago === "efectivo")
        .reduce((acc, v) => acc + (Number(v.total_usd) || 0), 0);

      const efectivoBsCalc = comandasTurno
        .filter((v) => v.metodo_pago === "efectivo_bs")
        .reduce((acc, v) => acc + (Number(v.total_bs) || 0), 0);

      const pagoMovilCalc = comandasTurno
        .filter((v) => v.metodo_pago === "pago_movil" || v.metodo_pago === "pago_movil_bs")
        .reduce((acc, v) => acc + (Number(v.total_bs) || 0), 0);

      const puntoCalc = comandasTurno
        .filter((v) => v.metodo_pago === "punto" || v.metodo_pago === "punto_bs" || v.metodo_pago === "pos")
        .reduce((acc, v) => acc + (Number(v.total_bs) || 0), 0);

      const transferenciaCalc = comandasTurno
        .filter((v) => v.metodo_pago === "transferencia" || v.metodo_pago === "transferencia_bs")
        .reduce((acc, v) => acc + (Number(v.total_bs) || 0), 0);

      const digitalesCalc = comandasTurno
        .filter((v) => v.metodo_pago === "binance" || v.metodo_pago === "binance_usdt" || v.metodo_pago === "zelle")
        .reduce((acc, v) => acc + (Number(v.total_usd) || 0), 0);

      const d = new Date(c.fecha_apertura);
      const fechaTexto = d.toLocaleDateString("es-VE", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "America/Caracas",
      });
      const horaTexto = d.toLocaleTimeString("es-VE", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Caracas",
      });

      list.push({
        id: c.id,
        titulo: c.estado === "abierta" ? "🟢 Turno Actual (En Operación)" : "🔒 Turno Cerrado (Arqueado)",
        fechaTexto: `${fechaTexto.charAt(0).toUpperCase() + fechaTexto.slice(1)} • ${horaTexto}`,
        fechaIso,
        fechaApertura: c.fecha_apertura,
        fechaCierre: c.fecha_cierre,
        estado: c.estado,
        fondoInicialUsd: Number(c.monto_inicial_usd || 0),
        totalUsd: totalVentasUsdCalc,
        totalBs: totalVentasBsCalc,
        efectivoUsd: c.estado === "cerrada" && c.total_ventas_efectivo_usd ? Number(c.total_ventas_efectivo_usd) : efectivoCalc,
        efectivoBs: efectivoBsCalc,
        pagoMovilBs: c.estado === "cerrada" && c.total_ventas_pago_movil_bs ? Number(c.total_ventas_pago_movil_bs) : pagoMovilCalc,
        transferenciaBs: c.estado === "cerrada" && c.total_ventas_transferencia_bs ? Number(c.total_ventas_transferencia_bs) : transferenciaCalc,
        puntoBs: c.estado === "cerrada" && c.total_ventas_punto_bs ? Number(c.total_ventas_punto_bs) : puntoCalc,
        dolaresDigitalesUsd: c.estado === "cerrada" && c.total_ventas_binance_usd ? Number(c.total_ventas_binance_usd) : digitalesCalc,
        diferenciaUsd: c.diferencia_usd,
        notasCierre: c.notas_cierre,
        comandas: comandasTurno,
        esSesionFormal: true,
      });
    });

    // 2. Agrupar ventas por día para las jornadas que no tengan sesión formal
    const ventasPorDia = new Map<string, Venta[]>();
    ventas.forEach((v) => {
      if (v.estado === "cancelada") return;
      const fIso = toFechaCaracasString(v.fecha);
      if (!fechasCubiertas.has(fIso)) {
        const arr = ventasPorDia.get(fIso) || [];
        arr.push(v);
        ventasPorDia.set(fIso, arr);
      }
    });

    ventasPorDia.forEach((comandasDelDia, fIso) => {
      const primeraVenta = comandasDelDia[0];
      const d = new Date(primeraVenta.fecha);
      const fechaTexto = d.toLocaleDateString("es-VE", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "America/Caracas",
      });

      const esHoy = esMismaFechaEnCaracas(primeraVenta.fecha);
      const totalUsd = comandasDelDia.reduce((acc, v) => acc + (Number(v.total_usd) || 0), 0);
      const totalBs = comandasDelDia.reduce((acc, v) => acc + (Number(v.total_bs) || 0), 0);

      const efectivoUsd = comandasDelDia
        .filter((v) => v.metodo_pago === "efectivo_usd" || v.metodo_pago === "efectivo")
        .reduce((acc, v) => acc + (Number(v.total_usd) || 0), 0);

      const efectivoBs = comandasDelDia
        .filter((v) => v.metodo_pago === "efectivo_bs")
        .reduce((acc, v) => acc + (Number(v.total_bs) || 0), 0);

      const pagoMovilBs = comandasDelDia
        .filter((v) => v.metodo_pago === "pago_movil" || v.metodo_pago === "pago_movil_bs")
        .reduce((acc, v) => acc + (Number(v.total_bs) || 0), 0);

      const transferenciaBs = comandasDelDia
        .filter((v) => v.metodo_pago === "transferencia" || v.metodo_pago === "transferencia_bs")
        .reduce((acc, v) => acc + (Number(v.total_bs) || 0), 0);

      const puntoBs = comandasDelDia
        .filter((v) => v.metodo_pago === "punto" || v.metodo_pago === "punto_bs" || v.metodo_pago === "pos")
        .reduce((acc, v) => acc + (Number(v.total_bs) || 0), 0);

      const dolaresDigitalesUsd = comandasDelDia
        .filter((v) => v.metodo_pago === "binance" || v.metodo_pago === "binance_usdt" || v.metodo_pago === "zelle")
        .reduce((acc, v) => acc + (Number(v.total_usd) || 0), 0);

      list.push({
        id: `jornada-${fIso}`,
        titulo: esHoy ? "🟢 Jornada de Hoy" : `🔒 Jornada ${fIso}`,
        fechaTexto: fechaTexto.charAt(0).toUpperCase() + fechaTexto.slice(1),
        fechaIso: fIso,
        fechaApertura: primeraVenta.fecha,
        fechaCierre: null,
        estado: esHoy ? "abierta" : "cerrada",
        fondoInicialUsd: 0,
        totalUsd,
        totalBs,
        efectivoUsd,
        efectivoBs,
        pagoMovilBs,
        transferenciaBs,
        puntoBs,
        dolaresDigitalesUsd,
        diferenciaUsd: null,
        notasCierre: null,
        comandas: comandasDelDia,
        esSesionFormal: false,
      });
    });

    // Ordenar de más reciente a más antigua
    return list.sort((a, b) => new Date(b.fechaApertura).getTime() - new Date(a.fechaApertura).getTime());
  }, [ventas, historialCajas]);

  // Comandas filtradas dentro del modal de cierre
  const comandasModalFiltradas = useMemo(() => {
    if (!cierreSeleccionado) return [];
    if (filtroEstadoModalCierre === "todos") return cierreSeleccionado.comandas;
    return cierreSeleccionado.comandas.filter((v) => v.estado === filtroEstadoModalCierre);
  }, [cierreSeleccionado, filtroEstadoModalCierre]);

  // Conteos por estado para las pestañas del modal
  const conteosModal = useMemo(() => {
    if (!cierreSeleccionado) return { todos: 0, pendiente: 0, preparando: 0, lista: 0, completada: 0, cancelada: 0 };
    const all = cierreSeleccionado.comandas;
    return {
      todos: all.length,
      pendiente: all.filter((v) => v.estado === "pendiente").length,
      preparando: all.filter((v) => v.estado === "preparando").length,
      lista: all.filter((v) => v.estado === "lista").length,
      completada: all.filter((v) => v.estado === "completada").length,
      cancelada: all.filter((v) => v.estado === "cancelada").length,
    };
  }, [cierreSeleccionado]);

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
          <div style={{ position: "relative", width: 48, height: 48, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Image
              src="/images/isotipo_arepa.png"
              alt="Logo La Parada del Sabor"
              width={48}
              height={48}
              className="logo-light-only"
              style={{ objectFit: "contain" }}
            />
            <Image
              src="/images/isotipo_arepa_dark.png"
              alt="Logo La Parada del Sabor"
              width={48}
              height={48}
              className="logo-dark-only"
              style={{ objectFit: "contain" }}
            />
          </div>
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
          <span className="stat-hint">{finanzas.totalFacturadoBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs (Tasas de Cada Día)</span>
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

      {/* SECCIÓN DEDICADA: HISTORIAL DE CIERRES ANTERIORES & JORNADAS DIARIAS */}
      <div className="receta-card" style={{ marginTop: 20 }}>
        <div className="receta-card-header" style={{ flexWrap: "wrap", gap: 12 }}>
          <div>
            <h3 className="receta-name" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              📋 Historial de Cierres Anteriores & Jornadas Diarias
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
              Auditoría cronológica de turnos de caja y jornadas. Haz clic en cualquier tarjeta para abrir el modal con todas las comandas, facturas y detalle de platos.
            </p>
          </div>
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: "var(--text-muted)",
              background: "var(--bg-subtle)",
              padding: "4px 12px",
              borderRadius: 8,
              border: "1px solid var(--border)",
            }}
          >
            {jornadasCierres.length} {jornadasCierres.length === 1 ? "Registro" : "Cierres / Jornadas"}
          </span>
        </div>

        {jornadasCierres.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--text-muted)" }}>
            <span style={{ fontSize: 36, display: "block", marginBottom: 8 }}>🔒</span>
            <strong style={{ fontSize: 14, color: "var(--text)" }}>Sin jornadas ni cierres registrados</strong>
            <p style={{ fontSize: 12, margin: "4px 0 0" }}>
              Cuando se registren ventas o aperturas de caja, se listarán automáticamente aquí.
            </p>
          </div>
        ) : (
          <div className="comandas-grid" style={{ marginTop: 14 }}>
            {jornadasCierres.map((c) => (
              <div
                key={c.id}
                className="comanda-card"
                onClick={() => {
                  setCierreSeleccionado(c);
                  setFiltroEstadoModalCierre("todos");
                }}
                style={{
                  cursor: "pointer",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease",
                  borderColor: c.estado === "abierta" ? "var(--primary)" : undefined,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-3px)";
                  e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)";
                  e.currentTarget.style.borderColor = "var(--primary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.boxShadow = "";
                  e.currentTarget.style.borderColor = c.estado === "abierta" ? "var(--primary)" : "";
                }}
              >
                <div className="comanda-card-header">
                  <div>
                    <h3 className="receta-name" style={{ fontSize: 15 }}>
                      {c.titulo}
                    </h3>
                    <span className="comanda-time" style={{ fontSize: 11.5 }}>
                      📅 {c.fechaTexto}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    <span className={`stock-badge ${c.estado === "abierta" ? "stock-badge-optimo" : "stock-badge-bajo"}`}>
                      {c.estado.toUpperCase()}
                    </span>
                    {c.esSesionFormal ? (
                      <span style={{ fontSize: 10, fontWeight: 800, color: "#10b981" }}>🛡️ Turno Caja</span>
                    ) : (
                      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)" }}>📅 Jornada</span>
                    )}
                  </div>
                </div>

                <div className="receta-metrics-row" style={{ marginTop: 10, marginBottom: 10 }}>
                  <div className="metric-box">
                    <span className="metric-label">Comandas:</span>
                    <strong style={{ fontSize: 15 }}>{c.comandas.length} pedidos</strong>
                  </div>
                  <div className="metric-box">
                    <span className="metric-label">Facturado USD:</span>
                    <strong className="text-primary" style={{ fontSize: 15 }}>
                      ${c.totalUsd.toFixed(2)}
                    </strong>
                  </div>
                  <div className="metric-box">
                    <span className="metric-label">Facturado Bs:</span>
                    <strong className="text-green" style={{ fontSize: 14 }}>
                      {c.totalBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs
                    </strong>
                  </div>
                </div>

                {/* Desglose por método */}
                <div
                  style={{
                    background: "var(--bg-subtle)",
                    borderRadius: 8,
                    padding: "8px 10px",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr 1fr",
                    gap: 6,
                    fontSize: 11.5,
                  }}
                >
                  <div>
                    <span style={{ color: "var(--text-muted)", display: "block" }}>💵 Efectivo Gaveta:</span>
                    <strong style={{ color: "#16a34a" }}>${c.efectivoUsd.toFixed(2)} USD</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted)", display: "block" }}>🇻🇪 Efectivo Bs:</span>
                    <strong style={{ color: "#16a34a" }}>
                      {c.efectivoBs.toLocaleString("es-VE", { minimumFractionDigits: 2 })} Bs
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted)", display: "block" }}>📱 Pago Móvil:</span>
                    <strong style={{ color: "#0284c7" }}>
                      {c.pagoMovilBs.toLocaleString("es-VE", { minimumFractionDigits: 2 })} Bs
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted)", display: "block" }}>🏦 Transferencia:</span>
                    <strong style={{ color: "#0d9488" }}>
                      {c.transferenciaBs.toLocaleString("es-VE", { minimumFractionDigits: 2 })} Bs
                    </strong>
                  </div>
                </div>

                {/* Arqueo y Botón de Auditoría */}
                <div
                  style={{
                    marginTop: 10,
                    paddingTop: 8,
                    borderTop: "1px solid var(--border-subtle)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: 12,
                  }}
                >
                  {c.diferenciaUsd !== null && c.diferenciaUsd !== undefined ? (
                    <span style={{ fontSize: 11, fontWeight: 700, color: c.diferenciaUsd >= 0 ? "var(--green)" : "var(--accent)" }}>
                      ⚖️ Arqueo: {c.diferenciaUsd >= 0 ? `+${c.diferenciaUsd}` : c.diferenciaUsd} USD
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      🔍 Auditoría detallada
                    </span>
                  )}

                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 800,
                      color: "var(--primary-dark)",
                      background: "var(--primary-light)",
                      padding: "4px 10px",
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    Ver Comandas ({c.comandas.length}) →
                  </span>
                </div>
              </div>
            ))}
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

      {/* Modal Detallado de Comandas y Facturas del Cierre Seleccionado */}
      {cierreSeleccionado && (
        <div
          className="modal-overlay"
          onClick={() => setCierreSeleccionado(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "16px",
          }}
        >
          <div
            className="modal-recipe-card"
            style={{
              maxWidth: 1060,
              width: "100%",
              maxHeight: "92vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              padding: 0,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              className="modal-recipe-header"
              style={{
                padding: "18px 24px",
                borderBottom: "1px solid var(--border)",
                background: "var(--bg-card)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 16,
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                  <h2 style={{ fontSize: 19, fontWeight: 900, margin: 0, color: "var(--text)" }}>
                    📋 {cierreSeleccionado.titulo}
                  </h2>
                  <span className={`stock-badge ${cierreSeleccionado.estado === "abierta" ? "stock-badge-optimo" : "stock-badge-bajo"}`}>
                    {cierreSeleccionado.estado.toUpperCase()}
                  </span>
                  {cierreSeleccionado.esSesionFormal ? (
                    <span style={{ fontSize: 11, fontWeight: 800, background: "rgba(16, 185, 129, 0.15)", color: "#10b981", padding: "2px 8px", borderRadius: 6 }}>
                      🛡️ Turno Oficial en Caja
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 800, background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6", padding: "2px 8px", borderRadius: 6 }}>
                      📅 Jornada Diaria Registrada
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
                  📅 {cierreSeleccionado.fechaTexto} • Facturación total:{" "}
                  <strong className="text-primary">${cierreSeleccionado.totalUsd.toFixed(2)} USD</strong> (
                  {cierreSeleccionado.totalBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs)
                </p>
              </div>

              <button
                type="button"
                onClick={() => setCierreSeleccionado(null)}
                className="btn-modal-close"
                style={{ fontSize: 18, width: 34, height: 34, borderRadius: "50%", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {/* Resumen Métricas Rápidas del Cierre */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
                gap: 10,
                padding: "12px 24px",
                background: "var(--bg-subtle)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div style={{ textAlign: "center" }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>🧾 Comandas</span>
                <strong style={{ fontSize: 15 }}>{cierreSeleccionado.comandas.length} pedidos</strong>
              </div>
              <div style={{ textAlign: "center" }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>💵 Efectivo Gaveta</span>
                <strong style={{ fontSize: 15, color: "#16a34a" }}>${cierreSeleccionado.efectivoUsd.toFixed(2)} USD</strong>
              </div>
              <div style={{ textAlign: "center" }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>🇻🇪 Efectivo Bs</span>
                <strong style={{ fontSize: 15, color: "#16a34a" }}>
                  {cierreSeleccionado.efectivoBs.toLocaleString("es-VE", { minimumFractionDigits: 2 })} Bs
                </strong>
              </div>
              <div style={{ textAlign: "center" }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>📱 Pago Móvil</span>
                <strong style={{ fontSize: 15, color: "#0284c7" }}>
                  {cierreSeleccionado.pagoMovilBs.toLocaleString("es-VE", { minimumFractionDigits: 2 })} Bs
                </strong>
              </div>
              <div style={{ textAlign: "center" }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>🏦 Transferencia</span>
                <strong style={{ fontSize: 15, color: "#0d9488" }}>
                  {cierreSeleccionado.transferenciaBs.toLocaleString("es-VE", { minimumFractionDigits: 2 })} Bs
                </strong>
              </div>
              {cierreSeleccionado.fondoInicialUsd > 0 && (
                <div style={{ textAlign: "center" }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>💼 Fondo Inicial</span>
                  <strong style={{ fontSize: 15 }}>${cierreSeleccionado.fondoInicialUsd.toFixed(2)} USD</strong>
                </div>
              )}
              {cierreSeleccionado.diferenciaUsd !== null && cierreSeleccionado.diferenciaUsd !== undefined && (
                <div style={{ textAlign: "center" }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>⚖️ Dif. Arqueo</span>
                  <strong style={{ fontSize: 15, color: cierreSeleccionado.diferenciaUsd >= 0 ? "#16a34a" : "#ef4444" }}>
                    {cierreSeleccionado.diferenciaUsd >= 0 ? `+${cierreSeleccionado.diferenciaUsd}` : cierreSeleccionado.diferenciaUsd} USD
                  </strong>
                </div>
              )}
            </div>

            {/* Barra de Filtros de Estado en Modal */}
            <div
              style={{
                padding: "10px 24px",
                background: "var(--bg)",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                gap: 8,
                overflowX: "auto",
              }}
            >
              {[
                { id: "todos", label: "Todas", count: conteosModal.todos, icon: "📋" },
                { id: "pendiente", label: "Por Confirmar", count: conteosModal.pendiente, icon: "🟡" },
                { id: "preparando", label: "En Cocina", count: conteosModal.preparando, icon: "🍳" },
                { id: "lista", label: "Listas / En Camino", count: conteosModal.lista, icon: "🛵" },
                { id: "completada", label: "Entregadas", count: conteosModal.completada, icon: "✅" },
                { id: "cancelada", label: "Canceladas", count: conteosModal.cancelada, icon: "❌" },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFiltroEstadoModalCierre(f.id)}
                  className={`cat-pill ${filtroEstadoModalCierre === f.id ? "cat-pill-active" : ""}`}
                  style={{ fontSize: 12, padding: "5px 12px", whiteSpace: "nowrap" }}
                >
                  <span>{f.icon}</span> {f.label} ({f.count})
                </button>
              ))}
            </div>

            {/* Contenido scrolleable con Grid de Comandas */}
            <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1, maxHeight: "calc(92vh - 200px)" }}>
              {comandasModalFiltradas.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 16px" }}>
                  <Image
                    src="/mascota/stickers/07_pulgar_arriba_confirmado.png"
                    alt="Sin comandas"
                    width={80}
                    height={80}
                    style={{ margin: "0 auto 12px", objectFit: "contain" }}
                  />
                  <h4 style={{ margin: "0 0 6px" }}>No hay comandas registradas en este estado</h4>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
                    Selecciona otra pestaña o cambia el filtro superior.
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                    gap: 16,
                  }}
                >
                  {comandasModalFiltradas.map((v) => {
                    const metodoInfo = getMetodoPagoBadge(v.metodo_pago);
                    const hora = new Date(v.fecha).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

                    return (
                      <div key={v.id} className={`comanda-card comanda-${v.estado}`} style={{ margin: 0 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                          {/* Header de la comanda */}
                          <div className="comanda-card-header">
                            <div>
                              <span className="comanda-number">#{v.numero_comanda}</span>
                              <span className="comanda-time">🕒 {hora}</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <a
                                href={`/recibo/${v.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-ticket-receipt-link"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  fontSize: 11,
                                  fontWeight: 800,
                                  color: "var(--primary-dark)",
                                  textDecoration: "none",
                                  padding: "3px 8px",
                                  borderRadius: 8,
                                  background: "var(--primary-light)",
                                  border: "1px solid var(--border)",
                                }}
                                title="Ver o compartir factura digital gourmet"
                              >
                                🧾 Recibo
                              </a>
                              <span className={`comanda-status-pill status-${v.estado}`}>
                                {v.estado === "pendiente"
                                  ? "🟡 Por Confirmar"
                                  : v.estado === "preparando"
                                  ? "🍳 En Cocina"
                                  : v.estado === "lista"
                                  ? v.tipo_entrega === "delivery"
                                    ? "🛵 En Camino"
                                    : "🛍️ Lista"
                                  : v.estado === "completada"
                                  ? "✅ Entregada"
                                  : "❌ Cancelada"}
                              </span>
                            </div>
                          </div>

                          {/* Cliente */}
                          <div className="comanda-client-row">
                            <span style={{ fontSize: 16 }}>👤</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <strong style={{ fontSize: 13, color: "var(--text)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {v.cliente?.nombre || (v.creado_por === "web_cliente" ? "Cliente Web" : "Cliente Mostrador")}
                              </strong>
                              {v.cliente?.telefono && (
                                <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>
                                  📞 {v.cliente.telefono}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Badges de Tipo, Método de Pago y Origen */}
                          <div className="comanda-type-row" style={{ flexWrap: "wrap", gap: 6 }}>
                            <span className="comanda-badge-type">{v.tipo_entrega.toUpperCase()}</span>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 800,
                                background: metodoInfo.bg,
                                color: metodoInfo.color,
                                padding: "2px 8px",
                                borderRadius: 6,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              {metodoInfo.label}
                            </span>

                            {v.origen_pedido === "instagram" ? (
                              <span style={{ fontSize: 10.5, fontWeight: 800, background: "linear-gradient(135deg, #f09433 0%, #dc2743 50%, #bc1888 100%)", color: "#ffffff", padding: "2px 7px", borderRadius: 6 }}>
                                📸 IG
                              </span>
                            ) : v.origen_pedido === "whatsapp" ? (
                              <span style={{ fontSize: 10.5, fontWeight: 800, background: "#25D366", color: "#ffffff", padding: "2px 7px", borderRadius: 6 }}>
                                💬 WA
                              </span>
                            ) : v.origen_pedido === "qr" ? (
                              <span style={{ fontSize: 10.5, fontWeight: 800, background: "#06b6d4", color: "#ffffff", padding: "2px 7px", borderRadius: 6 }}>
                                📲 QR
                              </span>
                            ) : v.creado_por === "web_cliente" ? (
                              <span style={{ fontSize: 10.5, fontWeight: 700, background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6", padding: "2px 6px", borderRadius: 4 }}>
                                🌐 Web
                              </span>
                            ) : (
                              <span style={{ fontSize: 10.5, fontWeight: 700, background: "var(--bg-subtle)", color: "var(--text-muted)", padding: "2px 6px", borderRadius: 4 }}>
                                🖥️ POS
                              </span>
                            )}
                          </div>

                          {/* Items de la Comanda */}
                          <div className="comanda-items-list">
                            {(v.items || []).map((item, iIdx) => (
                              <div key={iIdx} className="comanda-item-entry">
                                <div className="comanda-item-top">
                                  <span>
                                    <strong>{item.cantidad}x</strong> {item.producto?.nombre || "Producto"}
                                  </span>
                                  <span>${Number(item.subtotal_usd).toFixed(2)}</span>
                                </div>
                                {item.extras && item.extras.length > 0 && (
                                  <div className="comanda-extras-line">
                                    {item.extras.map((ext, eIdx) => (
                                      <span key={eIdx} className="comanda-extra-tag">
                                        +{ext.extra?.nombre || "Extra"} (${Number(ext.precio_unitario_usd).toFixed(2)})
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {(item.notas_item || item.notas) && (
                                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--primary-dark)", background: "var(--primary-light)", padding: "3px 7px", borderRadius: 6, marginTop: 4 }}>
                                    🍱 {item.notas_item || item.notas}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Detalle Delivery */}
                          {v.tipo_entrega === "delivery" && (
                            <div style={{ background: "rgba(248, 197, 66, 0.12)", border: "1px solid rgba(248, 197, 66, 0.35)", borderRadius: 8, padding: "8px 10px", marginTop: 6 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                                <strong style={{ fontSize: 11.5, color: "var(--text)" }}>
                                  🛵 {v.delivery_zona_nombre || "Delivery"}
                                </strong>
                                <span style={{ fontSize: 11.5, fontWeight: 800, color: "var(--primary-dark)" }}>
                                  +${Number(v.delivery_monto_usd || 0).toFixed(2)} USD
                                </span>
                              </div>
                              {v.direccion_delivery && (
                                <p style={{ margin: "0 0 6px", fontSize: 11.5, color: "var(--text)", lineHeight: 1.3 }}>
                                  📍 {v.direccion_delivery}
                                </p>
                              )}
                              {v.direccion_delivery?.match(/https:\/\/maps\.google\.com\/\?q=[^\s]+/) && (
                                <a
                                  href={v.direccion_delivery.match(/https:\/\/maps\.google\.com\/\?q=[^\s]+/)?.[0]}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    padding: "4px 8px",
                                    borderRadius: 6,
                                    background: "var(--bg-card)",
                                    color: "var(--text)",
                                    border: "1px solid var(--border)",
                                    fontSize: 11,
                                    fontWeight: 800,
                                    textDecoration: "none",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                  }}
                                >
                                  🗺️ Ver Mapa
                                </a>
                              )}
                            </div>
                          )}

                          {v.notas_comanda && (
                            <div className="comanda-notes-box" style={{ marginTop: 6 }}>
                              <span>📝 {v.notas_comanda}</span>
                            </div>
                          )}
                        </div>

                        {/* Totales */}
                        <div style={{ marginTop: "auto", paddingTop: 10 }}>
                          <div className="comanda-totals">
                            <div className="comanda-total-row">
                              <span>Total:</span>
                              <strong>${Number(v.total_usd).toFixed(2)} USD</strong>
                            </div>
                            <span className="comanda-bs-label">{Number(v.total_bs).toFixed(2)} Bs</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
