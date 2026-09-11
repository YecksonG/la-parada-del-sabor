"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { Cliente, Venta } from "@/types/database";
import type { MetodoPago } from "@/types/database";
import { cambiarEstadoVenta, actualizarMetodoPagoVenta, actualizarDetallesComanda } from "./actions";
import {
  registrarPagoComandaCredito,
  eliminarAbonoComandaCredito,
  limpiarTodosAbonosComandaCredito,
} from "../clientes/actions";
import { sounds } from "@/lib/sound-effects";
import { toFechaCaracasString, fechaHoyEnCaracas } from "@/lib/date-vzla";
import {
  parsearPagoMixtoDeNotas,
  generarTagPagoMixto,
  METODOS_FRACCION_INFO,
  type MetodoPagoFraccion,
  type PagoFraccionItem,
  calcularSaldoPendienteComanda,
  parsearAbonosCreditoDeNotas,
  eliminarTagAbonoDeNotas,
  limpiarTodosLosAbonosDeNotas,
} from "@/lib/pago-mixto";

interface VentasClientProps {
  ventas: Venta[];
  clientes?: Cliente[];
  tasaBcv?: number;
}

export default function VentasClient({ ventas: initialVentas, clientes = [], tasaBcv = 832 }: VentasClientProps) {
  const [ventas, setVentas] = useState<Venta[]>(initialVentas);
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [filtroFecha, setFiltroFecha] = useState<"hoy" | "ayer" | "todas" | "fecha">("hoy");
  const [fechaEspecifica, setFechaEspecifica] = useState<string>("");
  const [procesandoId, setProcesandoId] = useState<string | null>(null);
  const [comandaParaEditar, setComandaParaEditar] = useState<Venta | null>(null);

  // Fechas de referencia en Caracas
  const hoyStr = useMemo(() => {
    const h = fechaHoyEnCaracas();
    return `${h.anio}-${h.mes}-${h.dia}`;
  }, []);

  const ayerStr = useMemo(() => {
    const h = fechaHoyEnCaracas();
    const d = new Date(Date.UTC(Number(h.anio), Number(h.mes) - 1, Number(h.dia) - 1));
    return toFechaCaracasString(d);
  }, []);

  const ventasFiltradas = useMemo(() => {
    return ventas.filter((v) => {
      // 1. Filtro por fecha / jornada
      if (filtroFecha === "hoy") {
        const vFechaStr = toFechaCaracasString(v.fecha);
        if (vFechaStr !== hoyStr) return false;
      } else if (filtroFecha === "ayer") {
        const vFechaStr = toFechaCaracasString(v.fecha);
        if (vFechaStr !== ayerStr) return false;
      } else if (filtroFecha === "fecha" && fechaEspecifica) {
        const vFechaStr = toFechaCaracasString(v.fecha);
        if (vFechaStr !== fechaEspecifica) return false;
      }

      // 2. Filtro por estado
      if (filtroEstado !== "todos") {
        if (filtroEstado === "credito") {
          if (v.estado !== "credito" && v.metodo_pago !== "credito") return false;
        } else if (v.estado !== filtroEstado) {
          return false;
        }
      }

      return true;
    });
  }, [ventas, filtroEstado, filtroFecha, fechaEspecifica, hoyStr, ayerStr]);

  const totalVentasUsd = useMemo(() => {
    return ventasFiltradas
      .filter((v) => v.estado === "preparando" || v.estado === "lista" || v.estado === "completada")
      .reduce((acc, v) => acc + Number(v.total_usd), 0);
  }, [ventasFiltradas]);

  const [comandaAsignarCliente, setComandaAsignarCliente] = useState<Venta | null>(null);
  const [clienteSeleccionadoId, setClienteSeleccionadoId] = useState<string>("");

  // Modal de Abono rápido / Saldar Deuda directo en ventas
  const [comandaAbono, setComandaAbono] = useState<Venta | null>(null);
  const [montoAbonoUsd, setMontoAbonoUsd] = useState<number | "">("");
  const [metodoPagoAbono, setMetodoPagoAbono] = useState<MetodoPago>("pago_movil");
  const [notasAbono, setNotasAbono] = useState<string>("");
  const [procesandoAbono, setProcesandoAbono] = useState<boolean>(false);

  // Sub-montos si el método de abono es mixto
  const [abonoMixtoEfUsd, setAbonoMixtoEfUsd] = useState<number | "">("");
  const [abonoMixtoPmBs, setAbonoMixtoPmBs] = useState<number | "">("");
  const [abonoMixtoEfBs, setAbonoMixtoEfBs] = useState<number | "">("");
  const [abonoMixtoTransfBs, setAbonoMixtoTransfBs] = useState<number | "">("");
  const [abonoMixtoBinance, setAbonoMixtoBinance] = useState<number | "">("");
  const [abonoMixtoZelle, setAbonoMixtoZelle] = useState<number | "">("");

  const abrirModalAbono = (comanda: Venta) => {
    sounds.playPop();
    setComandaAbono(comanda);
    const { saldoPendienteUsd } = calcularSaldoPendienteComanda(comanda, tasaBcv);
    setMontoAbonoUsd(saldoPendienteUsd);
    setMetodoPagoAbono("pago_movil");
    setNotasAbono("");
    setAbonoMixtoEfUsd("");
    setAbonoMixtoPmBs("");
    setAbonoMixtoEfBs("");
    setAbonoMixtoTransfBs("");
    setAbonoMixtoBinance("");
    setAbonoMixtoZelle("");
  };

  const cerrarModalAbono = () => {
    setComandaAbono(null);
    setMontoAbonoUsd("");
    setNotasAbono("");
    setProcesandoAbono(false);
  };

  // Cálculo de total desglose para pago mixto en abono
  const abonoMixtoTotalUsd = useMemo(() => {
    if (metodoPagoAbono !== "pago_mixto") return 0;
    const efUsd = Number(abonoMixtoEfUsd) || 0;
    const pmBs = Number(abonoMixtoPmBs) || 0;
    const efBs = Number(abonoMixtoEfBs) || 0;
    const transfBs = Number(abonoMixtoTransfBs) || 0;
    const binance = Number(abonoMixtoBinance) || 0;
    const zelle = Number(abonoMixtoZelle) || 0;

    const bsTotal = pmBs + efBs + transfBs;
    const bsEnUsd = tasaBcv > 0 ? bsTotal / tasaBcv : 0;
    return efUsd + binance + zelle + bsEnUsd;
  }, [metodoPagoAbono, abonoMixtoEfUsd, abonoMixtoPmBs, abonoMixtoEfBs, abonoMixtoTransfBs, abonoMixtoBinance, abonoMixtoZelle, tasaBcv]);

  const abonoMixtoPendienteUsd = useMemo(() => {
    const target = Number(montoAbonoUsd) || 0;
    return Number((target - abonoMixtoTotalUsd).toFixed(2));
  }, [montoAbonoUsd, abonoMixtoTotalUsd]);

  const handleConfirmarAbono = async () => {
    if (!comandaAbono || procesandoAbono) return;
    const abonoNum = Number(montoAbonoUsd);
    const { saldoPendienteUsd } = calcularSaldoPendienteComanda(comandaAbono, tasaBcv);

    if (!abonoNum || abonoNum <= 0) {
      alert("Por favor ingrese un monto válido a abonar o saldar.");
      return;
    }

    if (abonoNum > saldoPendienteUsd + 0.01) {
      alert(`El monto a abonar ($${abonoNum.toFixed(2)}) no puede exceder el saldo pendiente de la comanda ($${saldoPendienteUsd.toFixed(2)}).`);
      return;
    }

    if (metodoPagoAbono === "pago_mixto") {
      if (Math.abs(abonoMixtoPendienteUsd) > 0.05) {
        alert(`El desglose de pago mixto debe coincidir exactamente con el monto a abonar ($${abonoNum.toFixed(2)}). Diferencia: $${abonoMixtoPendienteUsd.toFixed(2)}.`);
        return;
      }
    }

    setProcesandoAbono(true);

    const esPagoTotal = abonoNum >= saldoPendienteUsd - 0.01;
    const restante = Math.max(0, Number((saldoPendienteUsd - abonoNum).toFixed(2)));

    let tag = `[ABONO CRÉDITO: $${abonoNum.toFixed(2)} USD vía ${metodoPagoAbono.toUpperCase()}${
      esPagoTotal ? " - SALDADA TOTALMENTE" : ` - RESTA: $${restante.toFixed(2)} USD`
    }`;
    if (metodoPagoAbono === "pago_mixto") {
      const parts: string[] = [];
      if (Number(abonoMixtoEfUsd) > 0) parts.push(`EfUSD: $${Number(abonoMixtoEfUsd).toFixed(2)}`);
      if (Number(abonoMixtoPmBs) > 0) parts.push(`PMBs: Bs.${Number(abonoMixtoPmBs).toFixed(2)}`);
      if (Number(abonoMixtoEfBs) > 0) parts.push(`EfBs: Bs.${Number(abonoMixtoEfBs).toFixed(2)}`);
      if (Number(abonoMixtoTransfBs) > 0) parts.push(`TransfBs: Bs.${Number(abonoMixtoTransfBs).toFixed(2)}`);
      if (Number(abonoMixtoBinance) > 0) parts.push(`Binance: $${Number(abonoMixtoBinance).toFixed(2)}`);
      if (Number(abonoMixtoZelle) > 0) parts.push(`Zelle: $${Number(abonoMixtoZelle).toFixed(2)}`);
      tag += ` (${parts.join(", ")})`;
    }
    if (notasAbono.trim()) {
      tag += ` | Ref/Notas: ${notasAbono.trim()}`;
    }
    tag += ` - ${new Date().toLocaleDateString("es-VE")} ${new Date().toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })}]`;

    const res = await registrarPagoComandaCredito({
      venta_id: comandaAbono.id,
      monto_abonado_usd: abonoNum,
      metodo_pago_abono: metodoPagoAbono,
      es_pago_total: esPagoTotal,
      monto_restante_usd: restante,
      tag_abono: tag,
    });

    setProcesandoAbono(false);

    if (res.ok) {
      sounds.playKitchenBell();
      setVentas((prev) =>
        prev.map((v) => {
          if (v.id === comandaAbono.id) {
            const nuevasNotas = v.notas_comanda ? `${v.notas_comanda} • ${tag}` : tag;
            return {
              ...v,
              estado: esPagoTotal ? "completada" : "credito",
              metodo_pago: esPagoTotal ? metodoPagoAbono : v.metodo_pago,
              notas_comanda: nuevasNotas,
            };
          }
          return v;
        })
      );
      cerrarModalAbono();
    } else {
      alert(res.error || "No se pudo registrar el abono.");
    }
  };

  const [eliminandoAbono, setEliminandoAbono] = useState(false);

  const handleEliminarAbono = async (rawTag: string) => {
    if (!comandaAbono || eliminandoAbono) return;
    if (!confirm("¿Estás seguro de eliminar este abono de la comanda? El monto adeudado se restaurará automáticamente.")) return;

    setEliminandoAbono(true);
    const res = await eliminarAbonoComandaCredito({
      venta_id: comandaAbono.id,
      raw_tag: rawTag,
    });
    setEliminandoAbono(false);

    if (res.ok) {
      sounds.playDelete();
      const notasActualizadas = eliminarTagAbonoDeNotas(comandaAbono.notas_comanda, rawTag);
      const comandaActualizada: Venta = {
        ...comandaAbono,
        notas_comanda: notasActualizadas,
        estado: (res.estado as any) || "credito",
        metodo_pago: (res.estado === "credito" ? "credito" : comandaAbono.metodo_pago),
      };

      setVentas((prev) =>
        prev.map((v) => (v.id === comandaAbono.id ? comandaActualizada : v))
      );
      setComandaAbono(comandaActualizada);
    } else {
      alert(res.error || "No se pudo eliminar el abono.");
    }
  };

  const handleLimpiarTodosAbonos = async () => {
    if (!comandaAbono || eliminandoAbono) return;
    if (!confirm("¿Deseas eliminar TODOS los abonos registrados en esta comanda y restaurar su deuda al total original?")) return;

    setEliminandoAbono(true);
    const res = await limpiarTodosAbonosComandaCredito({
      venta_id: comandaAbono.id,
    });
    setEliminandoAbono(false);

    if (res.ok) {
      sounds.playDelete();
      const notasActualizadas = limpiarTodosLosAbonosDeNotas(comandaAbono.notas_comanda);
      const comandaActualizada: Venta = {
        ...comandaAbono,
        notas_comanda: notasActualizadas,
        estado: "credito",
        metodo_pago: "credito",
      };

      setVentas((prev) =>
        prev.map((v) => (v.id === comandaAbono.id ? comandaActualizada : v))
      );
      setComandaAbono(comandaActualizada);
    } else {
      alert(res.error || "No se pudieron limpiar los abonos.");
    }
  };

  const handleCambiarMetodoPago = async (venta: Venta, nuevoMetodo: MetodoPago) => {
    if (nuevoMetodo === "credito" && !venta.cliente_id) {
      // Necesita seleccionar cliente para asignarle la deuda
      setComandaAsignarCliente(venta);
      setClienteSeleccionadoId("");
      return;
    }

    setProcesandoId(venta.id);
    const res = await actualizarMetodoPagoVenta(venta.id, nuevoMetodo);
    setProcesandoId(null);
    if (!res.ok) {
      alert(res.error || "No se pudo actualizar el método de pago.");
    } else {
      setVentas((prev) =>
        prev.map((v) =>
          v.id === venta.id
            ? {
                ...v,
                metodo_pago: nuevoMetodo,
                estado: nuevoMetodo === "credito" ? "credito" : v.estado === "credito" ? "completada" : v.estado,
              }
            : v
        )
      );
    }
  };

  const handleConfirmarCreditoConCliente = async () => {
    if (!comandaAsignarCliente) return;
    if (!clienteSeleccionadoId) {
      alert("Por favor seleccione a qué cliente se le cargará el crédito.");
      return;
    }

    setProcesandoId(comandaAsignarCliente.id);
    const res = await actualizarMetodoPagoVenta(comandaAsignarCliente.id, "credito", clienteSeleccionadoId);
    setProcesandoId(null);

    if (!res.ok) {
      alert(res.error || "No se pudo asignar el crédito al cliente.");
    } else {
      sounds.playKitchenBell();
      const cliObj = clientes.find((c) => c.id === clienteSeleccionadoId);
      setVentas((prev) =>
        prev.map((v) =>
          v.id === comandaAsignarCliente.id
            ? {
                ...v,
                metodo_pago: "credito",
                estado: "credito",
                cliente_id: clienteSeleccionadoId,
                cliente: cliObj || v.cliente,
              }
            : v
        )
      );
      setComandaAsignarCliente(null);
      setClienteSeleccionadoId("");
    }
  };

  const handleCambiarEstado = async (
    ventaId: string,
    nuevoEstado: "pendiente" | "preparando" | "lista" | "completada" | "cancelada" | "credito"
  ) => {
    setProcesandoId(ventaId);
    const res = await cambiarEstadoVenta(ventaId, nuevoEstado);
    setProcesandoId(null);
    if (!res.ok) {
      alert(res.error || "No se pudo actualizar el estado de la comanda.");
    }
  };

  const handleEnviarWhatsAppDelivery = (v: Venta) => {
    const matchMapas = v.direccion_delivery?.match(/https:\/\/maps\.google\.com\/\?q=[^\s]+/);
    const mapsLink = matchMapas ? matchMapas[0] : "";
    const direccionLimpia = v.direccion_delivery
      ?.replace(/📍 Ubicación GPS: https:\/\/maps\.google\.com\/\?q=[^\s]+/, "")
      .trim() || "Sin detalles adicionales";

    const itemsTexto = (v.items || [])
      .map((it: any) => `  • ${it.cantidad}x ${it.producto?.nombre || "Producto"}${it.notas_item ? ` (${it.notas_item})` : ""}`)
      .join("\n");

    const esPagado =
      v.estado === "completada" ||
      ["pago_movil", "pago_movil_bs", "binance", "binance_usdt", "zelle", "transferencia", "punto", "punto_bs"].includes(
        v.metodo_pago
      );
    const estadoPago = esPagado
      ? "✅ YA PAGADO (No cobrar)"
      : `💵 COBRAR AL CLIENTE: $${Number(v.total_usd).toFixed(2)} USD / Bs. ${Number(v.total_bs).toFixed(2)}`;

    const mensaje = `🛵 *ENTREGA DE COMIDA — LA PARADA DEL SABOR*
🧾 *Pedido:* #${v.numero_comanda || v.id.slice(0, 6)}
👤 *Cliente:* ${v.cliente?.nombre || "Cliente"}
📱 *Teléfono:* ${v.cliente?.telefono || "No especificado"}
📍 *Sector:* ${v.delivery_zona_nombre || "Delivery"}

🏠 *Dirección / Referencia:*
${direccionLimpia}

🗺️ *Ubicación GPS (Google Maps):*
${mapsLink || "No adjuntó enlace satelital"}

📋 *Contenido:*
${itemsTexto}

💰 *Estado de Pago:*
${estadoPago}`;

    const url = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    window.open(url, "_blank");
  };

  const handleNotificarClienteWhatsApp = (
    v: Venta,
    estadoNotificar: "preparando" | "lista" | "completada"
  ) => {
    const rawTel = v.cliente?.telefono || "";
    let telDigits = rawTel.replace(/\D/g, "");
    if (telDigits.startsWith("0")) {
      telDigits = "58" + telDigits.slice(1);
    } else if (telDigits.length === 10) {
      telDigits = "58" + telDigits;
    }

    const nombreCliente = v.cliente?.nombre || "Estimado cliente";
    const comandaNum = v.numero_comanda || v.id.slice(0, 6);

    let textoEstado = "";
    if (estadoNotificar === "preparando") {
      textoEstado = `¡Hola *${nombreCliente}*! 👋🧑‍🍳\nTu pedido *#${comandaNum}* en *La Parada del Sabor* ya ha sido confirmado y está *EN PREPARACIÓN* en nuestra cocina. Te avisaremos apenas esté listo. ¡Gracias por tu preferencia! 💛`;
    } else if (estadoNotificar === "lista") {
      if (v.tipo_entrega === "delivery") {
        textoEstado = `¡Hola *${nombreCliente}*! 🛵💨\nTu pedido *#${comandaNum}* de *La Parada del Sabor* está *LISTO Y EN CAMINO* con nuestro repartidor a tu dirección. ¡Ten tu método de pago o comprobante a mano! ✨`;
      } else {
        textoEstado = `¡Hola *${nombreCliente}*! 🛍️✨\nTu pedido *#${comandaNum}* de *La Parada del Sabor* está *LISTO PARA RETIRAR* en nuestro local. ¡Te esperamos!`;
      }
    } else if (estadoNotificar === "completada") {
      textoEstado = `¡Hola *${nombreCliente}*! 🎉🍽️\nTu pedido *#${comandaNum}* de *La Parada del Sabor* figura como *ENTREGADO*. ¡Que lo disfrutes al máximo! Si tienes algún comentario estamos siempre a la orden. ¡Buen provecho! 🙌`;
    }

    const waUrl = telDigits
      ? `https://wa.me/${telDigits}?text=${encodeURIComponent(textoEstado)}`
      : `https://wa.me/?text=${encodeURIComponent(textoEstado)}`;

    window.open(waUrl, "_blank");
  };

  const conteoPendientes = useMemo(() => {
    return ventas.filter((v) => v.estado === "pendiente").length;
  }, [ventas]);

  const conteoCredito = useMemo(() => {
    return ventas.filter((v) => v.estado === "credito" || v.metodo_pago === "credito").length;
  }, [ventas]);

  return (
    <main className="recetas-container">
      {/* Header */}
      <div className="recetas-header">
        <div>
          <h1 className="recetas-title">📋 Comandas & Historial de Ventas</h1>
          <p className="recetas-subtitle">
            Monitoreo en tiempo real de pedidos web y comandas de salón. Facturación activa:{" "}
            <strong className="text-primary">${totalVentasUsd.toFixed(2)} USD</strong>
          </p>
        </div>

        {/* Filtros de Estado */}
        <div className="pos-category-pills">
          {[
            { id: "todos", label: "Todas", icon: "📋" },
            { id: "pendiente", label: `Por Confirmar (${conteoPendientes})`, icon: "🟡", badge: conteoPendientes > 0 },
            { id: "preparando", label: "En Cocina", icon: "🍳" },
            { id: "lista", label: "Listas / En Camino", icon: "🛵" },
            { id: "completada", label: "Entregadas", icon: "✅" },
            { id: "credito", label: `A Crédito / Debe (${conteoCredito})`, icon: "⏳", badge: conteoCredito > 0 },
            { id: "cancelada", label: "Canceladas", icon: "❌" },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltroEstado(f.id)}
              className={`cat-pill ${filtroEstado === f.id ? "cat-pill-active" : ""}`}
              style={f.badge ? { border: "2px solid #eab308", background: "rgba(234, 179, 8, 0.15)", fontWeight: 800 } : {}}
            >
              <span>{f.icon}</span> {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Selector de Jornada / Fecha */}
      <div className="comanda-jornada-bar" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>📅 Jornada:</span>
          <button
            type="button"
            onClick={() => setFiltroFecha("hoy")}
            className={`cat-pill ${filtroFecha === "hoy" ? "cat-pill-active" : ""}`}
            style={{ fontSize: 12, padding: "5px 12px" }}
          >
            🔥 Hoy ({hoyStr})
          </button>
          <button
            type="button"
            onClick={() => setFiltroFecha("ayer")}
            className={`cat-pill ${filtroFecha === "ayer" ? "cat-pill-active" : ""}`}
            style={{ fontSize: 12, padding: "5px 12px" }}
          >
            ⏮️ Ayer ({ayerStr})
          </button>
          <button
            type="button"
            onClick={() => setFiltroFecha("todas")}
            className={`cat-pill ${filtroFecha === "todas" ? "cat-pill-active" : ""}`}
            style={{ fontSize: 12, padding: "5px 12px" }}
          >
            📚 Todas las Comandas
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Filtrar por día:</span>
          <input
            type="date"
            value={fechaEspecifica}
            onChange={(e) => {
              setFechaEspecifica(e.target.value);
              if (e.target.value) setFiltroFecha("fecha");
            }}
            style={{
              padding: "5px 10px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--bg)",
              color: "var(--text)",
              fontSize: 12,
              fontWeight: 700,
            }}
          />
        </div>
      </div>

      {/* Lista de Comandas */}
      <div className="comandas-grid">
        {ventasFiltradas.length === 0 ? (
          <div className="recetas-empty-box" style={{ textAlign: "center", padding: "36px 20px" }}>
            <Image
              src="/mascota/stickers/07_pulgar_arriba_confirmado.png"
              alt="Cocina al Día"
              width={90}
              height={90}
              style={{ margin: "0 auto 12px", filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.1))", objectFit: "contain" }}
            />
            <h3 style={{ margin: "0 0 6px" }}>¡Cocina al Día!</h3>
            <p style={{ margin: 0, color: "var(--text-muted)" }}>No hay comandas registradas con este filtro. Cambia de jornada o estado arriba.</p>
          </div>
        ) : (
          ventasFiltradas.map((v) => {
            const fechaStr = new Date(v.fecha).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div key={v.id} className={`comanda-card comanda-${v.estado}`}>
                {/* Cuerpo superior de la comanda (ocupa espacio disponible) */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                  <div className="comanda-card-header">
                    <div>
                      <span className="comanda-number">#{v.numero_comanda}</span>
                      <span className="comanda-time">🕒 {fechaStr}</span>
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
                      <button
                        type="button"
                        onClick={() => setComandaParaEditar(v)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 11,
                          fontWeight: 800,
                          color: "var(--text)",
                          padding: "3px 8px",
                          borderRadius: 8,
                          background: "var(--bg-card)",
                          border: "1px solid var(--border)",
                          cursor: "pointer",
                        }}
                        title="Modificar tipo de entrega, vuelto, método de pago o notas"
                      >
                        ✏️ Editar
                      </button>
                      <span className={`comanda-status-pill status-${v.estado}`}>
                        {v.estado === "pendiente"
                          ? "🟡 Por Confirmar"
                          : v.estado === "preparando"
                          ? "🍳 En Cocina"
                          : v.estado === "lista"
                          ? (v.tipo_entrega === "delivery" ? "🛵 En Camino" : "🛍️ Lista")
                          : v.estado === "completada"
                          ? "✅ Entregada"
                          : v.estado === "credito"
                          ? "⏳ A Crédito / Debe"
                          : "❌ Cancelada"}
                      </span>
                    </div>
                  </div>

                  {/* Nombre y Contacto del Cliente en el Tablero de Cocina */}
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

                  <div className="comanda-type-row">
                    <span className="comanda-badge-type">{v.tipo_entrega.toUpperCase()}</span>
                    
                    {/* Selector rápido de método de pago */}
                    <select
                      value={v.metodo_pago || "efectivo_usd"}
                      disabled={procesandoId === v.id}
                      onChange={(e) => handleCambiarMetodoPago(v, e.target.value as MetodoPago)}
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        background: "var(--bg-subtle)",
                        color: "var(--text)",
                        cursor: "pointer",
                      }}
                      title="Haz clic para cambiar el método de pago de esta comanda"
                    >
                      <option value="pago_movil">📱 Pago Móvil</option>
                      <option value="efectivo_usd">💵 Efectivo USD</option>
                      <option value="efectivo_bs">🇻🇪 Efectivo Bs</option>
                      <option value="transferencia">🏦 Transferencia</option>
                      <option value="binance">🟡 Binance Pay</option>
                      <option value="zelle">🟣 Zelle</option>
                      <option value="credito">⏳ Crédito / Debe</option>
                      {v.metodo_pago === "pago_mixto" && (
                        <option value="pago_mixto" disabled>🔀 Pago Mixto (Editar)</option>
                      )}
                    </select>

                    {v.origen_pedido === "instagram" ? (
                      <span style={{ fontSize: 11, fontWeight: 800, background: "linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)", color: "#ffffff", padding: "2px 8px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 3 }}>
                        📸 Instagram
                      </span>
                    ) : v.origen_pedido === "whatsapp" ? (
                      <span style={{ fontSize: 11, fontWeight: 800, background: "#25D366", color: "#ffffff", padding: "2px 8px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 3 }}>
                        💬 WhatsApp
                      </span>
                    ) : v.origen_pedido === "qr" ? (
                      <span style={{ fontSize: 11, fontWeight: 800, background: "#06b6d4", color: "#ffffff", padding: "2px 8px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 3 }}>
                        📲 QR Mesa
                      </span>
                    ) : v.origen_pedido === "tiktok" ? (
                      <span style={{ fontSize: 11, fontWeight: 800, background: "#000000", color: "#ffffff", border: "1px solid #fe2c55", padding: "2px 8px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 3 }}>
                        🎵 TikTok
                      </span>
                    ) : v.creado_por === "web_cliente" ? (
                      <span style={{ fontSize: 11, fontWeight: 700, background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6", padding: "2px 6px", borderRadius: 4 }}>
                        🌐 Web Directa
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 700, background: "var(--bg-subtle)", color: "var(--text-muted)", padding: "2px 6px", borderRadius: 4 }}>
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
                                +{ext.extra?.nombre || "Extra"}{Number(ext.precio_unitario_usd) > 0 ? ` ($${Number(ext.precio_unitario_usd).toFixed(2)})` : ""}
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

                  {/* Detalle de Delivery y Dirección */}
                  {v.tipo_entrega === "delivery" && (
                    <div style={{ background: "rgba(248, 197, 66, 0.12)", border: "1px solid rgba(248, 197, 66, 0.35)", borderRadius: 8, padding: "8px 10px", marginTop: 8, marginBottom: 4 }}>
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

                      {/* Botones de Acción para el Repartidor */}
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => handleEnviarWhatsAppDelivery(v)}
                          style={{
                            flex: 1,
                            minWidth: 140,
                            padding: "6px 10px",
                            borderRadius: 8,
                            background: "#25D366",
                            color: "#ffffff",
                            border: "none",
                            fontSize: 11.5,
                            fontWeight: 800,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            boxShadow: "0 2px 6px rgba(37, 211, 102, 0.3)",
                          }}
                        >
                          📲 Enviar al Delivery (WhatsApp)
                        </button>
                        {v.direccion_delivery?.match(/https:\/\/maps\.google\.com\/\?q=[^\s]+/) && (
                          <a
                            href={v.direccion_delivery.match(/https:\/\/maps\.google\.com\/\?q=[^\s]+/)?.[0]}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              padding: "6px 10px",
                              borderRadius: 8,
                              background: "var(--bg-card)",
                              color: "var(--text)",
                              border: "1px solid var(--border)",
                              fontSize: 11.5,
                              fontWeight: 800,
                              textDecoration: "none",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            🗺️ Mapa
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {v.metodo_pago === "pago_mixto" && (() => {
                    const fraccion = parsearPagoMixtoDeNotas(v.notas_comanda, Number(v.tasa_bcv) || 1);
                    if (!fraccion || fraccion.length === 0) return null;
                    return (
                      <div style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.35)", borderRadius: 8, padding: "6px 8px", marginTop: 4 }}>
                        <span style={{ fontSize: 10.5, fontWeight: 900, color: "#d97706", display: "block", marginBottom: 2 }}>
                          🔀 Pago Fraccionado:
                        </span>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {fraccion.map((f, fIdx) => {
                            const info = METODOS_FRACCION_INFO[f.metodo] || { label: f.metodo, icon: "💳", moneda: "USD" };
                            return (
                              <span key={fIdx} style={{ fontSize: 10.5, fontWeight: 700, background: "var(--bg-card)", padding: "2px 6px", borderRadius: 4, border: "1px solid var(--border)" }}>
                                {info.icon} ${f.monto_usd.toFixed(2)} {info.label.split(" ")[0]}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {v.notas_comanda && (
                    <div className="comanda-notes-box">
                      <span>📝 {v.notas_comanda}</span>
                    </div>
                  )}
                </div>

                {/* Pie fijo de la comanda (Totales & Acciones alineados abajo) */}
                <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10, paddingTop: 6 }}>
                  {/* Totales */}
                  <div className="comanda-totals">
                    <div className="comanda-total-row">
                      <span>Total:</span>
                      <strong>${Number(v.total_usd).toFixed(2)} USD</strong>
                    </div>
                    <span className="comanda-bs-label">{Number(v.total_bs).toFixed(2)} Bs</span>
                  </div>

                  {/* Acciones de Cocina / Estado */}
                  <div className="comanda-actions">
                    {/* 1. Si está Pendiente (Web) */}
                    {v.estado === "pendiente" && (
                      <div style={{ display: "flex", gap: 6, width: "100%" }}>
                        <button
                          type="button"
                          disabled={procesandoId === v.id}
                          onClick={() => handleCambiarEstado(v.id, "preparando")}
                          className="btn-comanda-complete"
                          style={{ background: "#f97316", flex: 1 }}
                        >
                          {procesandoId === v.id ? "Procesando..." : "🍳 Confirmar & A Cocina"}
                        </button>
                        {v.cliente?.telefono && (
                          <button
                            type="button"
                            onClick={() => handleNotificarClienteWhatsApp(v, "preparando")}
                            style={{
                              background: "#25D366",
                              color: "#fff",
                              border: "none",
                              borderRadius: 12,
                              padding: "0 12px",
                              fontSize: 13,
                              fontWeight: 800,
                              cursor: "pointer",
                            }}
                            title="Avisar al cliente por WhatsApp que su comanda está en preparación"
                          >
                            💬 Avisar
                          </button>
                        )}
                      </div>
                    )}

                    {/* 2. Si está en Cocina (Preparando) */}
                    {v.estado === "preparando" && (
                      <div style={{ display: "flex", gap: 6, width: "100%", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          disabled={procesandoId === v.id}
                          onClick={() => handleCambiarEstado(v.id, "lista")}
                          className="btn-comanda-complete"
                          style={{ background: "#3b82f6", flex: 1 }}
                        >
                          {procesandoId === v.id ? "..." : (v.tipo_entrega === "delivery" ? "🛵 En Camino" : "🛍️ Marcar Lista")}
                        </button>
                        <button
                          type="button"
                          disabled={procesandoId === v.id}
                          onClick={() => handleCambiarEstado(v.id, "completada")}
                          className="btn-comanda-complete"
                        >
                          {procesandoId === v.id ? "..." : "✅ Entregada"}
                        </button>
                        {v.cliente?.telefono && (
                          <button
                            type="button"
                            onClick={() => handleNotificarClienteWhatsApp(v, "lista")}
                            style={{
                              background: "rgba(37, 211, 102, 0.15)",
                              color: "#16a34a",
                              border: "1px solid #25D366",
                              borderRadius: 10,
                              padding: "4px 8px",
                              fontSize: 11.5,
                              fontWeight: 800,
                              cursor: "pointer",
                              width: "100%",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 6,
                            }}
                            title="Avisar al cliente por WhatsApp que su pedido está listo/en camino"
                          >
                            💬 Avisar por WhatsApp ({v.tipo_entrega === "delivery" ? "En Camino" : "Listo"})
                          </button>
                        )}
                      </div>
                    )}

                    {/* 3. Si está Lista */}
                    {v.estado === "lista" && (
                      <div style={{ display: "flex", gap: 6, width: "100%", flexDirection: "column" }}>
                        <button
                          type="button"
                          disabled={procesandoId === v.id}
                          onClick={() => handleCambiarEstado(v.id, "completada")}
                          className="btn-comanda-complete"
                        >
                          {procesandoId === v.id ? "Procesando..." : "✅ Marcar Entregada"}
                        </button>
                        {v.cliente?.telefono && (
                          <button
                            type="button"
                            onClick={() => handleNotificarClienteWhatsApp(v, "lista")}
                            style={{
                              background: "#25D366",
                              color: "#fff",
                              border: "none",
                              borderRadius: 10,
                              padding: "6px 10px",
                              fontSize: 12,
                              fontWeight: 800,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 6,
                            }}
                            title="Reenviar mensaje de WhatsApp al cliente"
                          >
                            💬 Notificar al Cliente por WhatsApp
                          </button>
                        )}
                      </div>
                    )}

                    {/* 3.1 Si está a Crédito / Debe */}
                    {v.estado === "credito" && (() => {
                      const { saldoPendienteUsd } = calcularSaldoPendienteComanda(v, tasaBcv);
                      return (
                        <div style={{ display: "flex", gap: 6, width: "100%", flexDirection: "column" }}>
                          <button
                            type="button"
                            disabled={procesandoId === v.id}
                            onClick={() => abrirModalAbono(v)}
                            className="btn-comanda-complete"
                            style={{ background: "#16a34a" }}
                            title="Marcar como saldada o registrar pago total"
                          >
                            💰 Saldar Deuda (${saldoPendienteUsd.toFixed(2)})
                          </button>
                          <button
                            type="button"
                            onClick={() => abrirModalAbono(v)}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 10,
                              border: "1px solid var(--border)",
                              background: "var(--bg-card)",
                              color: "var(--text)",
                              fontSize: 11.5,
                              fontWeight: 800,
                              cursor: "pointer",
                            }}
                          >
                            🔀 Registrar Abono Parcial
                          </button>
                        </div>
                      );
                    })()}

                    {/* 4. Opción de Cancelar / Reactivar */}
                    {v.estado !== "cancelada" && v.estado !== "completada" && (
                      <button
                        type="button"
                        disabled={procesandoId === v.id}
                        onClick={() => handleCambiarEstado(v.id, "cancelada")}
                        className="btn-comanda-cancel"
                        title="Cancelar comanda y devolver insumos al stock"
                      >
                        ❌ Cancelar
                      </button>
                    )}

                    {v.estado === "cancelada" && (
                      <button
                        type="button"
                        disabled={procesandoId === v.id}
                        onClick={() => handleCambiarEstado(v.id, "preparando")}
                        className="btn-comanda-reactivate"
                      >
                        🔄 Reactivar Comanda
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal para Editar Entrega, Vuelto y Pago de la Comanda */}
      {comandaParaEditar && (
        <ModalEditarComanda
          venta={comandaParaEditar}
          clientes={clientes}
          onCerrar={() => setComandaParaEditar(null)}
          onGuardado={(updatedVenta) => {
            // Actualizar localmente la venta en el estado
            const idx = ventas.findIndex((v) => v.id === updatedVenta.id);
            if (idx >= 0) {
              Object.assign(ventas[idx], updatedVenta);
            }
            setComandaParaEditar(null);
          }}
        />
      )}

      {/* Modal para Asignar Cliente al pasar a Crédito */}
      {comandaAsignarCliente && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div
            className="modal-ticket-card"
            style={{ maxWidth: 440, width: "95%", padding: 20, borderRadius: 16 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: "var(--text)" }}>
                ⏳ Asignar Cliente para Crédito / Fiado
              </h3>
              <button
                type="button"
                onClick={() => {
                  setComandaAsignarCliente(null);
                  setClienteSeleccionadoId("");
                }}
                style={{ background: "transparent", border: "none", fontSize: 18, cursor: "pointer", color: "var(--text-muted)" }}
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 14 }}>
              Esta comanda no tiene un cliente asignado. Para llevar el registro de la cuenta por cobrar en el módulo de Clientes, selecciona a quién pertenece esta deuda:
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text)", display: "block", marginBottom: 4 }}>
                Seleccionar Cliente Registrado:
              </label>
              <select
                value={clienteSeleccionadoId}
                onChange={(e) => setClienteSeleccionadoId(e.target.value)}
                className="payment-select"
                style={{ width: "100%", fontSize: 13, fontWeight: 700 }}
              >
                <option value="">-- Elige un cliente --</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    👤 {c.nombre} {c.telefono ? `(${c.telefono})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setComandaAsignarCliente(null);
                  setClienteSeleccionadoId("");
                }}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--bg-card)",
                  color: "var(--text)",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!clienteSeleccionadoId || procesandoId === comandaAsignarCliente.id}
                onClick={handleConfirmarCreditoConCliente}
                style={{
                  flex: 2,
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "none",
                  background: "#dc2626",
                  color: "#ffffff",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: !clienteSeleccionadoId ? "not-allowed" : "pointer",
                  opacity: !clienteSeleccionadoId ? 0.6 : 1,
                }}
              >
                {procesandoId === comandaAsignarCliente.id ? "Guardando..." : "✅ Asignar Deuda a Crédito"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Abono / Saldar Deuda Directo en Comandas */}
      {comandaAbono && (() => {
        const { totalOriginalUsd, totalAbonadoUsd, saldoPendienteUsd } = calcularSaldoPendienteComanda(comandaAbono, tasaBcv);
        const comandaTotal = saldoPendienteUsd;
        const abonoVal = typeof montoAbonoUsd === "number" ? montoAbonoUsd : 0;
        const restanteUsd = Math.max(0, Number((comandaTotal - abonoVal).toFixed(2)));
        const esTotal = abonoVal >= comandaTotal - 0.01;

        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Registrar Pago o Abono a Crédito"
            className="modal-overlay"
            style={{ zIndex: 1250 }}
            onClick={(e) => {
              if (e.target === e.currentTarget && !procesandoAbono) cerrarModalAbono();
            }}
          >
            <div
              className="modal-recipe-card"
              style={{
                maxWidth: 480,
                width: "95%",
                maxHeight: "90vh",
                overflowY: "auto",
                borderRadius: 20,
              }}
            >
              <div className="modal-recipe-header" style={{ paddingBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 28 }}>💰</span>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 18, color: "var(--text)" }}>
                      Abonar / Saldar Deuda
                    </h2>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
                      Comanda #{comandaAbono.numero_comanda?.toString().padStart(4, "0") || comandaAbono.id.slice(0, 6)} • Saldo Pendiente: ${comandaTotal.toFixed(2)} USD {totalAbonadoUsd > 0 ? `(Abonado: $${totalAbonadoUsd.toFixed(2)} / Original: $${totalOriginalUsd.toFixed(2)})` : ""}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={cerrarModalAbono}
                  disabled={procesandoAbono || eliminandoAbono}
                  className="btn-modal-close"
                >
                  ✕
                </button>
              </div>

              {/* Historial de Abonos Registrados con Botón de Eliminar */}
              {(() => {
                const listaAbonos = parsearAbonosCreditoDeNotas(comandaAbono.notas_comanda, tasaBcv);
                if (listaAbonos.length === 0) return null;
                return (
                  <div
                    style={{
                      background: "rgba(239, 68, 68, 0.05)",
                      border: "1px dashed rgba(239, 68, 68, 0.4)",
                      borderRadius: 12,
                      padding: "10px 12px",
                      marginTop: 8,
                      marginBottom: 6,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#dc2626", textTransform: "uppercase" }}>
                        📋 Historial de Abonos Realizados ({listaAbonos.length})
                      </span>
                      {listaAbonos.length > 1 && (
                        <button
                          type="button"
                          onClick={handleLimpiarTodosAbonos}
                          disabled={eliminandoAbono || procesandoAbono}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#dc2626",
                            fontSize: 10.5,
                            fontWeight: 800,
                            cursor: "pointer",
                            textDecoration: "underline",
                          }}
                        >
                          Limpiar todos los abonos
                        </button>
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {listaAbonos.map((ab, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            background: "var(--bg-card)",
                            padding: "6px 10px",
                            borderRadius: 8,
                            border: "1px solid var(--border)",
                          }}
                        >
                          <div style={{ fontSize: 11.5 }}>
                            <strong style={{ color: "var(--primary-dark)" }}>
                              ${ab.monto_usd.toFixed(2)} USD
                            </strong>{" "}
                            <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
                              vía {ab.metodo_abono.toUpperCase()}
                            </span>
                            {ab.referencia_notas && (
                              <span style={{ color: "var(--text-muted)", display: "block", fontSize: 10.5 }}>
                                Nota: {ab.referencia_notas}
                              </span>
                            )}
                            {ab.fecha_hora && (
                              <span style={{ color: "var(--text-muted)", display: "block", fontSize: 10 }}>
                                🕒 {ab.fecha_hora}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            title="Eliminar este abono y restaurar saldo"
                            onClick={() => handleEliminarAbono(ab.raw_tag)}
                            disabled={eliminandoAbono || procesandoAbono}
                            style={{
                              background: "rgba(239, 68, 68, 0.12)",
                              border: "1px solid rgba(239, 68, 68, 0.3)",
                              color: "#dc2626",
                              borderRadius: 6,
                              padding: "4px 8px",
                              fontSize: 11,
                              fontWeight: 800,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            🗑️ Eliminar
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "12px 0" }}>
                {/* Selector rápido: Pago Total vs Parcial */}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playPop();
                      setMontoAbonoUsd(comandaTotal);
                    }}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: esTotal ? "2px solid #16a34a" : "1px solid var(--border)",
                      background: esTotal ? "rgba(34, 197, 94, 0.12)" : "var(--surface)",
                      color: esTotal ? "#16a34a" : "var(--text)",
                      fontWeight: 800,
                      fontSize: 12.5,
                      cursor: "pointer",
                    }}
                  >
                    ✅ Saldar Deuda (${comandaTotal.toFixed(2)})
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      sounds.playPop();
                      if (esTotal) setMontoAbonoUsd(Number((comandaTotal / 2).toFixed(2)));
                    }}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: !esTotal ? "2px solid var(--primary)" : "1px solid var(--border)",
                      background: !esTotal ? "var(--primary-light)" : "var(--surface)",
                      color: !esTotal ? "var(--primary-dark)" : "var(--text)",
                      fontWeight: 800,
                      fontSize: 12.5,
                      cursor: "pointer",
                    }}
                  >
                    🔀 Abono Parcial
                  </button>
                </div>

                {/* Monto a Abonar Input */}
                <div className="form-field">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text)" }}>
                      Monto a Abonar ($ USD):
                    </label>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      ~Bs. {(abonoVal * tasaBcv).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    max={comandaTotal}
                    value={montoAbonoUsd}
                    onChange={(e) => {
                      const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                      setMontoAbonoUsd(val);
                    }}
                    placeholder={`0.00 (Máx $${comandaTotal.toFixed(2)})`}
                    className="form-input"
                    style={{ fontSize: 16, fontWeight: 900, color: "var(--primary-dark)" }}
                  />
                  {!esTotal && abonoVal > 0 && (
                    <span style={{ fontSize: 11, color: "#dc2626", fontWeight: 700, marginTop: 4, display: "block" }}>
                      ⚠️ Quedará pendiente una deuda de: ${restanteUsd.toFixed(2)} USD (~Bs. {(restanteUsd * tasaBcv).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                    </span>
                  )}
                </div>

                {/* Método de Pago del Abono */}
                <div className="form-field">
                  <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text)", marginBottom: 4 }}>
                    Método de Pago Recibido:
                  </label>
                  <select
                    value={metodoPagoAbono}
                    onChange={(e) => setMetodoPagoAbono(e.target.value as MetodoPago)}
                    className="payment-select"
                    style={{ fontSize: 13, fontWeight: 700 }}
                  >
                    <option value="pago_movil">📱 Pago Móvil (Bs)</option>
                    <option value="efectivo_usd">💵 Efectivo USD</option>
                    <option value="efectivo_bs">🇻🇪 Efectivo Bs</option>
                    <option value="transferencia">🏦 Transferencia Bancaria (Bs)</option>
                    <option value="binance">🟡 Binance Pay (USDT)</option>
                    <option value="zelle">🟣 Zelle (USD)</option>
                    <option value="pago_mixto">🔀 Pago Mixto / Fraccionado</option>
                  </select>
                </div>

                {/* Subpanel si el método de abono es mixto */}
                {metodoPagoAbono === "pago_mixto" && (
                  <div
                    style={{
                      background: "rgba(245, 158, 11, 0.08)",
                      border: "1.5px solid #f59e0b",
                      borderRadius: 12,
                      padding: "10px 12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      maxHeight: "220px",
                      overflowY: "auto",
                      scrollbarWidth: "thin",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span style={{ fontSize: 10.5, color: "var(--text-muted)", display: "block" }}>Meta a Abonar:</span>
                        <strong style={{ fontSize: 13, color: "#d97706", fontWeight: 900 }}>
                          ${abonoVal.toFixed(2)} USD
                        </strong>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: 10, color: "var(--text-muted)", display: "block" }}>Estado Desglose:</span>
                        {Math.abs(abonoMixtoPendienteUsd) < 0.01 ? (
                          <span style={{ fontSize: 10.5, fontWeight: 900, color: "#16a34a", background: "rgba(34, 197, 94, 0.15)", padding: "2px 6px", borderRadius: 4 }}>
                            ✅ Cuadrado
                          </span>
                        ) : abonoMixtoPendienteUsd > 0 ? (
                          <span style={{ fontSize: 10.5, fontWeight: 900, color: "#dc2626", background: "rgba(239, 68, 68, 0.15)", padding: "2px 6px", borderRadius: 4 }}>
                            ⚠️ Faltan ${abonoMixtoPendienteUsd.toFixed(2)}
                          </span>
                        ) : (
                          <span style={{ fontSize: 10.5, fontWeight: 900, color: "#dc2626", background: "rgba(239, 68, 68, 0.15)", padding: "2px 6px", borderRadius: 4 }}>
                            ⚠️ Exceso ${Math.abs(abonoMixtoPendienteUsd).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Desglose: Efectivo USD */}
                    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px" }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", display: "block", marginBottom: 2 }}>💵 Efectivo USD:</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="0.00"
                        value={abonoMixtoEfUsd}
                        onChange={(e) => setAbonoMixtoEfUsd(e.target.value === "" ? "" : parseFloat(e.target.value))}
                        className="cart-notes-input"
                        style={{ fontSize: 12, fontWeight: 800 }}
                      />
                    </div>

                    {/* Desglose: Pago Móvil Bs */}
                    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px" }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", display: "block", marginBottom: 2 }}>📱 Pago Móvil (Bs):</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="0.00"
                        value={abonoMixtoPmBs}
                        onChange={(e) => setAbonoMixtoPmBs(e.target.value === "" ? "" : parseFloat(e.target.value))}
                        className="cart-notes-input"
                        style={{ fontSize: 12, fontWeight: 800 }}
                      />
                    </div>

                    {/* Desglose: Efectivo Bs */}
                    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px" }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", display: "block", marginBottom: 2 }}>🇻🇪 Efectivo Bs:</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="0.00"
                        value={abonoMixtoEfBs}
                        onChange={(e) => setAbonoMixtoEfBs(e.target.value === "" ? "" : parseFloat(e.target.value))}
                        className="cart-notes-input"
                        style={{ fontSize: 12, fontWeight: 800 }}
                      />
                    </div>

                    {/* Desglose: Transferencia Bs */}
                    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px" }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", display: "block", marginBottom: 2 }}>🏦 Transferencia (Bs):</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="0.00"
                        value={abonoMixtoTransfBs}
                        onChange={(e) => setAbonoMixtoTransfBs(e.target.value === "" ? "" : parseFloat(e.target.value))}
                        className="cart-notes-input"
                        style={{ fontSize: 12, fontWeight: 800 }}
                      />
                    </div>

                    {/* Desglose: Binance USDT */}
                    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px" }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", display: "block", marginBottom: 2 }}>🟡 Binance Pay (USDT):</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="0.00"
                        value={abonoMixtoBinance}
                        onChange={(e) => setAbonoMixtoBinance(e.target.value === "" ? "" : parseFloat(e.target.value))}
                        className="cart-notes-input"
                        style={{ fontSize: 12, fontWeight: 800 }}
                      />
                    </div>

                    {/* Desglose: Zelle USD */}
                    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px" }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", display: "block", marginBottom: 2 }}>🟣 Zelle (USD):</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="0.00"
                        value={abonoMixtoZelle}
                        onChange={(e) => setAbonoMixtoZelle(e.target.value === "" ? "" : parseFloat(e.target.value))}
                        className="cart-notes-input"
                        style={{ fontSize: 12, fontWeight: 800 }}
                      />
                    </div>
                  </div>
                )}

                {/* Notas / Referencia de Pago */}
                <div className="form-field">
                  <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text)", marginBottom: 4 }}>
                    Referencia / Nota del Pago:
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Ref #4589 o 'Abonó $10 en efectivo en mostrador'"
                    value={notasAbono}
                    onChange={(e) => setNotasAbono(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              {/* Botones de acción del Modal Abono */}
              <div className="modal-recipe-actions" style={{ marginTop: 8 }}>
                <button
                  type="button"
                  onClick={cerrarModalAbono}
                  disabled={procesandoAbono}
                  className="btn-cancel"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarAbono}
                  disabled={procesandoAbono || !abonoVal || abonoVal <= 0}
                  className="btn-submit-recipe"
                  style={{
                    background: esTotal ? "#16a34a" : "var(--primary-dark)",
                    color: "#ffffff",
                    fontWeight: 800,
                  }}
                >
                  {procesandoAbono
                    ? "Procesando..."
                    : esTotal
                    ? "✅ Confirmar Pago Total"
                    : `💾 Registrar Abono ($${abonoVal.toFixed(2)})`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </main>
  );
}

function ModalEditarComanda({
  venta,
  clientes = [],
  onCerrar,
  onGuardado,
}: {
  venta: Venta;
  clientes?: Cliente[];
  onCerrar: () => void;
  onGuardado: (updated: Partial<Venta> & { id: string }) => void;
}) {
  const tasaBcv = Number(venta.tasa_bcv) || 1;
  const [clienteId, setClienteId] = useState<string>(venta.cliente_id || "");

  // Extraer el subtotal de comida original sin el delivery
  const subtotalComidaUsd = useMemo(() => {
    const itemsTotal = (venta.items || []).reduce(
      (acc, it) => acc + (Number(it.subtotal_usd) || 0),
      0
    );
    if (itemsTotal > 0) return itemsTotal;
    const deliveryAnt = Number(venta.delivery_monto_usd) || 0;
    return Math.max(0, Number(venta.total_usd) - deliveryAnt);
  }, [venta]);

  const [tipoEntrega, setTipoEntrega] = useState<"puerta_cerrada" | "mesa" | "pickup" | "delivery">(
    (venta.tipo_entrega as any) || "puerta_cerrada"
  );
  const [deliveryMontoUsd, setDeliveryMontoUsd] = useState<number | "">(
    Number(venta.delivery_monto_usd) || (venta.tipo_entrega === "delivery" ? 1.5 : "")
  );
  const [deliveryZonaNombre, setDeliveryZonaNombre] = useState<string>(
    venta.delivery_zona_nombre || ""
  );
  const [direccionDelivery, setDireccionDelivery] = useState<string>(
    venta.direccion_delivery || ""
  );
  const [metodoPago, setMetodoPago] = useState<MetodoPago>(venta.metodo_pago || "efectivo_usd");

  // Extraer tags de abonos existentes en notas_comanda
  const [abonosEnComanda, setAbonosEnComanda] = useState<string[]>(() => {
    const regex = /\[ABONO CRÉDITO:[^\]]+\]/gi;
    const matches = (venta.notas_comanda || "").match(regex);
    return matches ? Array.from(matches) : [];
  });

  // Limpiar notas previas quitando cualquier tag previo de vuelto, pago mixto o abono si se edita
  const notasBase = useMemo(() => {
    return (venta.notas_comanda || "")
      .replace(/•?\s*\[[^\]]*(?:[Vv]uelto\s*:)[^\]]*\]/g, "")
      .replace(/•?\s*\[Pago Mixto:\s*[^\]]+\]/gi, "")
      .replace(/•?\s*\[ABONO CRÉDITO:[^\]]+\]/gi, "")
      .trim();
  }, [venta.notas_comanda]);

  const [notasTexto, setNotasTexto] = useState<string>(notasBase);

  // Vuelto en el modal
  const [incluirVuelto, setIncluirVuelto] = useState<boolean>(
    /\[[^\]]*(?:[Vv]uelto\s*:)[^\]]*\]/.test(venta.notas_comanda || "")
  );
  const [billeteRecibidoUsd, setBilleteRecibidoUsd] = useState<number | "">(() => {
    const match = (venta.notas_comanda || "").match(/Paga con \$?([0-9.]+)/i);
    return match ? parseFloat(match[1]) : "";
  });
  const [modoVuelto, setModoVuelto] = useState<"simple" | "mixto">("mixto");
  const [metodoVueltoSimple, setMetodoVueltoSimple] = useState<string>("pago_movil");

  const [vueltoEfUsd, setVueltoEfUsd] = useState<number | "">("");
  const [vueltoPmUsd, setVueltoPmUsd] = useState<number | "">("");
  const [vueltoEfBsUsd, setVueltoEfBsUsd] = useState<number | "">("");

  // Sub-montos para Pago Mixto / Fraccionado (en USD)
  const [pagoMixtoEfUsd, setPagoMixtoEfUsd] = useState<number | "">(() => {
    const items = parsearPagoMixtoDeNotas(venta.notas_comanda, tasaBcv);
    const item = items?.find((i) => i.metodo === "efectivo_usd");
    return item ? item.monto_usd : "";
  });
  const [pagoMixtoPmUsd, setPagoMixtoPmUsd] = useState<number | "">(() => {
    const items = parsearPagoMixtoDeNotas(venta.notas_comanda, tasaBcv);
    const item = items?.find((i) => i.metodo === "pago_movil");
    return item ? item.monto_usd : "";
  });
  const [pagoMixtoEfBsUsd, setPagoMixtoEfBsUsd] = useState<number | "">(() => {
    const items = parsearPagoMixtoDeNotas(venta.notas_comanda, tasaBcv);
    const item = items?.find((i) => i.metodo === "efectivo_bs");
    return item ? item.monto_usd : "";
  });
  const [pagoMixtoPuntoUsd, setPagoMixtoPuntoUsd] = useState<number | "">(() => {
    const items = parsearPagoMixtoDeNotas(venta.notas_comanda, tasaBcv);
    const item = items?.find((i) => i.metodo === "punto");
    return item ? item.monto_usd : "";
  });
  const [pagoMixtoTransfUsd, setPagoMixtoTransfUsd] = useState<number | "">(() => {
    const items = parsearPagoMixtoDeNotas(venta.notas_comanda, tasaBcv);
    const item = items?.find((i) => i.metodo === "transferencia");
    return item ? item.monto_usd : "";
  });
  const [pagoMixtoZelleUsd, setPagoMixtoZelleUsd] = useState<number | "">(() => {
    const items = parsearPagoMixtoDeNotas(venta.notas_comanda, tasaBcv);
    const item = items?.find((i) => i.metodo === "zelle");
    return item ? item.monto_usd : "";
  });
  const [pagoMixtoBinanceUsd, setPagoMixtoBinanceUsd] = useState<number | "">(() => {
    const items = parsearPagoMixtoDeNotas(venta.notas_comanda, tasaBcv);
    const item = items?.find((i) => i.metodo === "binance");
    return item ? item.monto_usd : "";
  });

  const [guardando, setGuardando] = useState(false);

  // Cálculos dinámicos
  const costoDeliveryActual = tipoEntrega === "delivery" ? Math.max(0, Number(deliveryMontoUsd) || 0) : 0;
  const nuevoTotalUsd = Number((subtotalComidaUsd + costoDeliveryActual).toFixed(2));
  const nuevoTotalBs = Number((nuevoTotalUsd * tasaBcv).toFixed(2));

  // Cálculos de Pago Mixto
  const pagoMixtoAsignadoUsd = useMemo(() => {
    if (metodoPago !== "pago_mixto") return 0;
    const efUsd = Number(pagoMixtoEfUsd) || 0;
    const pmUsd = Number(pagoMixtoPmUsd) || 0;
    const efBsUsd = Number(pagoMixtoEfBsUsd) || 0;
    const puntoUsd = Number(pagoMixtoPuntoUsd) || 0;
    const transfUsd = Number(pagoMixtoTransfUsd) || 0;
    const zelleUsd = Number(pagoMixtoZelleUsd) || 0;
    const binanceUsd = Number(pagoMixtoBinanceUsd) || 0;
    return Number(
      (efUsd + pmUsd + efBsUsd + puntoUsd + transfUsd + zelleUsd + binanceUsd).toFixed(2)
    );
  }, [
    metodoPago,
    pagoMixtoEfUsd,
    pagoMixtoPmUsd,
    pagoMixtoEfBsUsd,
    pagoMixtoPuntoUsd,
    pagoMixtoTransfUsd,
    pagoMixtoZelleUsd,
    pagoMixtoBinanceUsd,
  ]);

  const pagoMixtoPendienteUsd = useMemo(() => {
    if (metodoPago !== "pago_mixto") return 0;
    return Number((nuevoTotalUsd - pagoMixtoAsignadoUsd).toFixed(2));
  }, [metodoPago, nuevoTotalUsd, pagoMixtoAsignadoUsd]);

  const vueltoTotalUsd = useMemo(() => {
    if (!incluirVuelto || metodoPago !== "efectivo_usd" || !billeteRecibidoUsd) return 0;
    return Number((Number(billeteRecibidoUsd) - nuevoTotalUsd).toFixed(2));
  }, [incluirVuelto, metodoPago, billeteRecibidoUsd, nuevoTotalUsd]);

  const vueltoAsignadoUsd = useMemo(() => {
    if (!incluirVuelto || metodoPago !== "efectivo_usd" || modoVuelto !== "mixto") return 0;
    return Number(((Number(vueltoEfUsd) || 0) + (Number(vueltoPmUsd) || 0) + (Number(vueltoEfBsUsd) || 0)).toFixed(2));
  }, [incluirVuelto, metodoPago, modoVuelto, vueltoEfUsd, vueltoPmUsd, vueltoEfBsUsd]);

  const vueltoPendienteUsd = useMemo(() => {
    if (!incluirVuelto || metodoPago !== "efectivo_usd" || modoVuelto !== "mixto") return 0;
    return Number((vueltoTotalUsd - vueltoAsignadoUsd).toFixed(2));
  }, [incluirVuelto, metodoPago, modoVuelto, vueltoTotalUsd, vueltoAsignadoUsd]);

  const handleGuardar = async () => {
    if (guardando) return;

    if (metodoPago === "pago_mixto") {
      if (Math.abs(pagoMixtoPendienteUsd) > 0.005) {
        alert(
          `El pago mixto no cuadra con el total ($${nuevoTotalUsd.toFixed(2)} USD). Has asignado $${pagoMixtoAsignadoUsd.toFixed(2)} USD. Ajusta los métodos para completar el 100%.`
        );
        return;
      }
    } else if (incluirVuelto && metodoPago === "efectivo_usd") {
      if (!billeteRecibidoUsd || Number(billeteRecibidoUsd) < nuevoTotalUsd) {
        alert("El billete recibido no puede ser menor al total a pagar.");
        return;
      }
      if (modoVuelto === "mixto" && Math.abs(vueltoPendienteUsd) > 0.005) {
        alert(`Debes asignar el 100% del vuelto ($${vueltoTotalUsd.toFixed(2)} USD). Pendiente: $${vueltoPendienteUsd.toFixed(2)} USD.`);
        return;
      }
    }

    setGuardando(true);

    let notasFinales = notasTexto.trim();
    if (metodoPago === "pago_mixto") {
      const listaDesglose: PagoFraccionItem[] = [];
      const agregar = (metodo: MetodoPagoFraccion, valUsd: number | "") => {
        const u = Number(valUsd) || 0;
        if (u > 0) {
          const b = Number((u * tasaBcv).toFixed(2));
          listaDesglose.push({
            metodo,
            monto_usd: u,
            monto_bs: METODOS_FRACCION_INFO[metodo]?.moneda === "Bs" ? b : 0,
          });
        }
      };

      agregar("efectivo_usd", pagoMixtoEfUsd);
      agregar("pago_movil", pagoMixtoPmUsd);
      agregar("efectivo_bs", pagoMixtoEfBsUsd);
      agregar("punto", pagoMixtoPuntoUsd);
      agregar("transferencia", pagoMixtoTransfUsd);
      agregar("zelle", pagoMixtoZelleUsd);
      agregar("binance", pagoMixtoBinanceUsd);

      if (listaDesglose.length === 0) {
        alert("Debes ingresar al menos un monto en el desglose de pago mixto.");
        setGuardando(false);
        return;
      }

      const tagMixto = generarTagPagoMixto(listaDesglose, tasaBcv);
      notasFinales = notasFinales ? `${tagMixto} • ${notasFinales}` : tagMixto;
    } else if (incluirVuelto && metodoPago === "efectivo_usd" && Number(billeteRecibidoUsd) > 0) {
      const rec = Number(billeteRecibidoUsd);
      if (modoVuelto === "mixto") {
        const partes: string[] = [];
        if (Number(vueltoEfUsd) > 0) partes.push(`$${Number(vueltoEfUsd).toFixed(2)} Efectivo USD`);
        if (Number(vueltoPmUsd) > 0) {
          const pmBs = Number((Number(vueltoPmUsd) * tasaBcv).toFixed(2));
          partes.push(`$${Number(vueltoPmUsd).toFixed(2)} Pago Móvil (~Bs. ${pmBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`);
        }
        if (Number(vueltoEfBsUsd) > 0) {
          const efBs = Number((Number(vueltoEfBsUsd) * tasaBcv).toFixed(2));
          partes.push(`$${Number(vueltoEfBsUsd).toFixed(2)} Efectivo Bs (~Bs. ${efBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`);
        }
        const tag = `[Vuelto: Paga con $${rec.toFixed(2)} | Vuelto: $${vueltoTotalUsd.toFixed(2)} (${partes.join(" + ")})]`;
        notasFinales = notasFinales ? `${notasFinales} • ${tag}` : tag;
      } else {
        const metTxt = metodoVueltoSimple === "pago_movil" ? "Pago Móvil" : metodoVueltoSimple === "efectivo_bs" ? "Efectivo Bs" : "Efectivo USD";
        const vBs = Number((vueltoTotalUsd * tasaBcv).toFixed(2));
        const tag = `[Vuelto: Paga con $${rec.toFixed(2)} | Vuelto: $${vueltoTotalUsd.toFixed(2)} (~Bs. ${vBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) vía ${metTxt}]`;
        notasFinales = notasFinales ? `${notasFinales} • ${tag}` : tag;
      }
    }

    // Si hay tags de abono conservados en la comanda, concatenarlos
    if (abonosEnComanda.length > 0) {
      const tagsAbonosStr = abonosEnComanda.join(" • ");
      notasFinales = notasFinales ? `${tagsAbonosStr} • ${notasFinales}` : tagsAbonosStr;
    }

    if (metodoPago === "credito" && !clienteId) {
      alert("Para registrar una comanda a crédito/debe, debes seleccionar a qué cliente pertenece.");
      return;
    }

    const res = await actualizarDetallesComanda({
      venta_id: venta.id,
      tipo_entrega: tipoEntrega,
      delivery_monto_usd: costoDeliveryActual,
      delivery_zona_nombre: tipoEntrega === "delivery" ? deliveryZonaNombre : null,
      direccion_delivery: tipoEntrega === "delivery" ? direccionDelivery : null,
      metodo_pago: metodoPago,
      notas_comanda: notasFinales || null,
      cliente_id: clienteId || null,
    });

    setGuardando(false);

    if (!res.ok) {
      alert(res.error || "No se pudo actualizar la comanda.");
      return;
    }

    const cliObj = clientes.find((c) => c.id === clienteId);

    onGuardado({
      id: venta.id,
      tipo_entrega: tipoEntrega,
      delivery_monto_usd: costoDeliveryActual,
      delivery_monto_bs: Number((costoDeliveryActual * tasaBcv).toFixed(2)),
      delivery_zona_nombre: tipoEntrega === "delivery" ? deliveryZonaNombre : null,
      direccion_delivery: tipoEntrega === "delivery" ? direccionDelivery : null,
      total_usd: res.total_usd ?? nuevoTotalUsd,
      total_bs: res.total_bs ?? nuevoTotalBs,
      metodo_pago: metodoPago,
      estado: res.estado ?? (metodoPago === "credito" ? "credito" : venta.estado === "credito" ? "completada" : venta.estado),
      notas_comanda: notasFinales || null,
      cliente_id: clienteId || null,
      cliente: cliObj || venta.cliente,
    });
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div
        className="modal-ticket-card"
        style={{
          maxWidth: 500,
          width: "95%",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: 20,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>
            ✏️ Editar Comanda #{venta.numero_comanda}
          </h3>
          <button
            type="button"
            onClick={onCerrar}
            style={{
              background: "transparent",
              border: "none",
              fontSize: 18,
              cursor: "pointer",
              color: "var(--text-muted)",
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Tipo de Entrega */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
              MODALIDAD DE ENTREGA:
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {(["pickup", "delivery", "mesa", "puerta_cerrada"] as const).map((modo) => (
                <button
                  key={modo}
                  type="button"
                  onClick={() => {
                    setTipoEntrega(modo);
                    if (modo === "delivery" && (!deliveryMontoUsd || Number(deliveryMontoUsd) === 0)) {
                      setDeliveryMontoUsd(1.5);
                    }
                  }}
                  style={{
                    padding: "7px 8px",
                    borderRadius: 8,
                    border: tipoEntrega === modo ? "2px solid var(--primary)" : "1px solid var(--border)",
                    background: tipoEntrega === modo ? "var(--primary-light)" : "var(--bg-card)",
                    color: tipoEntrega === modo ? "var(--primary-dark)" : "var(--text)",
                    fontSize: 11.5,
                    fontWeight: 800,
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {modo === "pickup" ? "🛍️ Para Llevar (Pickup)" : modo === "delivery" ? "🛵 Delivery" : modo === "mesa" ? "🍽️ En Mesa" : "🚪 Puerta Cerrada"}
                </button>
              ))}
            </div>
          </div>

          {/* Campos de Delivery */}
          {tipoEntrega === "delivery" && (
            <div style={{ background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text)" }}>
                    Tarifa Delivery ($ USD):
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="1.50"
                    value={deliveryMontoUsd}
                    onChange={(e) => setDeliveryMontoUsd(parseFloat(e.target.value) || "")}
                    className="cart-notes-input"
                    style={{ fontSize: 12, fontWeight: 800 }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text)" }}>
                    Sector / Zona:
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Delivery Centro"
                    value={deliveryZonaNombre}
                    onChange={(e) => setDeliveryZonaNombre(e.target.value)}
                    className="cart-notes-input"
                    style={{ fontSize: 12 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", display: "block", marginBottom: 3 }}>
                  Dirección o Enlace GPS:
                </label>
                <textarea
                  rows={2}
                  placeholder="Dirección, punto de referencia o enlace de Google Maps..."
                  value={direccionDelivery}
                  onChange={(e) => setDireccionDelivery(e.target.value)}
                  className="cart-notes-input"
                  style={{ fontSize: 11.5, resize: "vertical" }}
                />
              </div>
            </div>
          )}

          {/* Método de Pago */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
              MÉTODO DE PAGO:
            </label>
            <select
              value={metodoPago}
              onChange={(e) => setMetodoPago(e.target.value as MetodoPago)}
              className="payment-select"
              style={{ fontSize: 12, fontWeight: 700 }}
            >
              <option value="efectivo_usd">💵 Efectivo USD</option>
              <option value="pago_movil">📱 Pago Móvil</option>
              <option value="efectivo_bs">🇻🇪 Efectivo Bs</option>
              <option value="transferencia">🏦 Transferencia</option>
              <option value="binance">🟡 Binance Pay</option>
              <option value="zelle">🟣 Zelle</option>
              <option value="pago_mixto">🔀 Pago Mixto / Fraccionado</option>
              <option value="credito">⏳ Crédito / Debe</option>
            </select>
          </div>

          {/* Asignación de Cliente obligatoria si es Crédito */}
          {metodoPago === "credito" && (
            <div
              style={{
                background: "rgba(239, 68, 68, 0.08)",
                border: "1.5px solid #dc2626",
                borderRadius: 10,
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <label style={{ fontSize: 11.5, fontWeight: 800, color: "#dc2626" }}>
                ⏳ CLIENTE DEUDOR (Cuentas por Cobrar):
              </label>
              <select
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                className="payment-select"
                style={{ fontSize: 12.5, fontWeight: 700 }}
              >
                <option value="">-- Seleccionar cliente para la deuda --</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    👤 {c.nombre} {c.telefono ? `(${c.telefono})` : ""}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                Al guardar como crédito, esta comanda aparecerá en la sección de Clientes bajo Cuentas por Cobrar y no sumará a caja.
              </span>
            </div>
          )}

          {/* Subpanel de Pago Mixto / Fraccionado en Modal Editar Comanda */}
          {metodoPago === "pago_mixto" && (
            <div
              style={{
                background: "rgba(245, 158, 11, 0.08)",
                border: "1.5px solid #f59e0b",
                borderRadius: 12,
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                maxHeight: "260px",
                overflowY: "auto",
                scrollbarWidth: "thin",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>Total a Pagar:</span>
                  <strong style={{ fontSize: 14, color: "#d97706", fontWeight: 900 }}>
                    ${nuevoTotalUsd.toFixed(2)} USD
                  </strong>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 6 }}>
                    (~Bs. {nuevoTotalBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                  </span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", display: "block" }}>Estado Desglose:</span>
                  {Math.abs(pagoMixtoPendienteUsd) < 0.005 ? (
                    <span style={{ fontSize: 11, fontWeight: 900, color: "#16a34a", background: "rgba(34, 197, 94, 0.15)", padding: "2px 6px", borderRadius: 4 }}>
                      ✅ 100% Cuadrado
                    </span>
                  ) : pagoMixtoPendienteUsd > 0 ? (
                    <span style={{ fontSize: 11, fontWeight: 900, color: "#dc2626", background: "rgba(239, 68, 68, 0.15)", padding: "2px 6px", borderRadius: 4 }}>
                      ⚠️ Faltan ${pagoMixtoPendienteUsd.toFixed(2)}
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 900, color: "#dc2626", background: "rgba(239, 68, 68, 0.15)", padding: "2px 6px", borderRadius: 4 }}>
                      ⚠️ Exceso ${Math.abs(pagoMixtoPendienteUsd).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>

              {/* 1. Efectivo USD */}
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text)" }}>💵 Efectivo USD:</label>
                  {pagoMixtoPendienteUsd > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const actual = Number(pagoMixtoEfUsd) || 0;
                        setPagoMixtoEfUsd(Number((actual + pagoMixtoPendienteUsd).toFixed(2)));
                      }}
                      style={{ fontSize: 10, fontWeight: 800, color: "var(--primary-dark)", background: "var(--primary-light)", border: "none", borderRadius: 4, padding: "2px 6px", cursor: "pointer" }}
                    >
                      + Restante (${pagoMixtoPendienteUsd.toFixed(2)})
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)" }}>$</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={pagoMixtoEfUsd}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setPagoMixtoEfUsd(isNaN(val) ? "" : Math.max(0, val));
                    }}
                    className="cart-notes-input"
                    style={{ fontSize: 12, fontWeight: 800, padding: "4px 8px" }}
                  />
                </div>
              </div>

              {/* 2. Pago Móvil (Bs) */}
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text)" }}>📱 Pago Móvil (Bs):</label>
                  {pagoMixtoPendienteUsd > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const actual = Number(pagoMixtoPmUsd) || 0;
                        setPagoMixtoPmUsd(Number((actual + pagoMixtoPendienteUsd).toFixed(2)));
                      }}
                      style={{ fontSize: 10, fontWeight: 800, color: "var(--primary-dark)", background: "var(--primary-light)", border: "none", borderRadius: 4, padding: "2px 6px", cursor: "pointer" }}
                    >
                      + Restante (${pagoMixtoPendienteUsd.toFixed(2)})
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)" }}>$</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={pagoMixtoPmUsd}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setPagoMixtoPmUsd(isNaN(val) ? "" : Math.max(0, val));
                    }}
                    className="cart-notes-input"
                    style={{ fontSize: 12, fontWeight: 800, padding: "4px 8px" }}
                  />
                </div>
                {Number(pagoMixtoPmUsd) > 0 && (
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: "#16a34a", display: "block", marginTop: 3 }}>
                    📲 Cobrar en Bs: <strong>Bs. {(Number(pagoMixtoPmUsd) * tasaBcv).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  </span>
                )}
              </div>

              {/* 3. Efectivo Bolívares */}
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text)" }}>🇻🇪 Efectivo Bs:</label>
                  {pagoMixtoPendienteUsd > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const actual = Number(pagoMixtoEfBsUsd) || 0;
                        setPagoMixtoEfBsUsd(Number((actual + pagoMixtoPendienteUsd).toFixed(2)));
                      }}
                      style={{ fontSize: 10, fontWeight: 800, color: "var(--primary-dark)", background: "var(--primary-light)", border: "none", borderRadius: 4, padding: "2px 6px", cursor: "pointer" }}
                    >
                      + Restante (${pagoMixtoPendienteUsd.toFixed(2)})
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)" }}>$</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={pagoMixtoEfBsUsd}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setPagoMixtoEfBsUsd(isNaN(val) ? "" : Math.max(0, val));
                    }}
                    className="cart-notes-input"
                    style={{ fontSize: 12, fontWeight: 800, padding: "4px 8px" }}
                  />
                </div>
                {Number(pagoMixtoEfBsUsd) > 0 && (
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: "#16a34a", display: "block", marginTop: 3 }}>
                    🇻🇪 Recibir en Bs: <strong>Bs. {(Number(pagoMixtoEfBsUsd) * tasaBcv).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  </span>
                )}
              </div>

              {/* 4. Transferencia Bancaria Bs */}
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text)" }}>🏦 Transferencia Bs:</label>
                  {pagoMixtoPendienteUsd > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const actual = Number(pagoMixtoTransfUsd) || 0;
                        setPagoMixtoTransfUsd(Number((actual + pagoMixtoPendienteUsd).toFixed(2)));
                      }}
                      style={{ fontSize: 10, fontWeight: 800, color: "var(--primary-dark)", background: "var(--primary-light)", border: "none", borderRadius: 4, padding: "2px 6px", cursor: "pointer" }}
                    >
                      + Restante (${pagoMixtoPendienteUsd.toFixed(2)})
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)" }}>$</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={pagoMixtoTransfUsd}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setPagoMixtoTransfUsd(isNaN(val) ? "" : Math.max(0, val));
                    }}
                    className="cart-notes-input"
                    style={{ fontSize: 12, fontWeight: 800, padding: "4px 8px" }}
                  />
                </div>
                {Number(pagoMixtoTransfUsd) > 0 && (
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: "#16a34a", display: "block", marginTop: 3 }}>
                    🏦 Transferir en Bs: <strong>Bs. {(Number(pagoMixtoTransfUsd) * tasaBcv).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  </span>
                )}
              </div>

              {/* 6. Zelle */}
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text)" }}>🟣 Zelle USD:</label>
                  {pagoMixtoPendienteUsd > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const actual = Number(pagoMixtoZelleUsd) || 0;
                        setPagoMixtoZelleUsd(Number((actual + pagoMixtoPendienteUsd).toFixed(2)));
                      }}
                      style={{ fontSize: 10, fontWeight: 800, color: "var(--primary-dark)", background: "var(--primary-light)", border: "none", borderRadius: 4, padding: "2px 6px", cursor: "pointer" }}
                    >
                      + Restante (${pagoMixtoPendienteUsd.toFixed(2)})
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)" }}>$</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={pagoMixtoZelleUsd}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setPagoMixtoZelleUsd(isNaN(val) ? "" : Math.max(0, val));
                    }}
                    className="cart-notes-input"
                    style={{ fontSize: 12, fontWeight: 800, padding: "4px 8px" }}
                  />
                </div>
              </div>

              {/* 7. Binance */}
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text)" }}>🟡 Binance USDT:</label>
                  {pagoMixtoPendienteUsd > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const actual = Number(pagoMixtoBinanceUsd) || 0;
                        setPagoMixtoBinanceUsd(Number((actual + pagoMixtoPendienteUsd).toFixed(2)));
                      }}
                      style={{ fontSize: 10, fontWeight: 800, color: "var(--primary-dark)", background: "var(--primary-light)", border: "none", borderRadius: 4, padding: "2px 6px", cursor: "pointer" }}
                    >
                      + Restante (${pagoMixtoPendienteUsd.toFixed(2)})
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)" }}>$</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={pagoMixtoBinanceUsd}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setPagoMixtoBinanceUsd(isNaN(val) ? "" : Math.max(0, val));
                    }}
                    className="cart-notes-input"
                    style={{ fontSize: 12, fontWeight: 800, padding: "4px 8px" }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Gestión de Vuelto */}
          {metodoPago === "efectivo_usd" && (
            <div style={{ background: "var(--bg-subtle)", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ fontSize: 12, fontWeight: 800, color: incluirVuelto ? "#d97706" : "var(--text)", cursor: "pointer" }}>
                  🪙 Registrar Vuelto / Cambio
                </label>
                <input
                  type="checkbox"
                  checked={incluirVuelto}
                  onChange={(e) => setIncluirVuelto(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: "pointer", accentColor: "var(--primary)" }}
                />
              </div>

              {incluirVuelto && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>
                      ¿Con qué billete paga? (USD):
                    </span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="Ej. 20"
                      value={billeteRecibidoUsd}
                      onChange={(e) => setBilleteRecibidoUsd(parseFloat(e.target.value) || "")}
                      className="cart-notes-input"
                      style={{ fontSize: 13, fontWeight: 800 }}
                    />
                  </div>

                  {/* Selector modo simple vs mixto */}
                  <div style={{ display: "flex", gap: 6, background: "var(--bg-card)", padding: 2, borderRadius: 6 }}>
                    <button
                      type="button"
                      onClick={() => setModoVuelto("simple")}
                      style={{
                        flex: 1,
                        padding: "4px 6px",
                        borderRadius: 6,
                        border: "none",
                        background: modoVuelto === "simple" ? "var(--primary)" : "transparent",
                        color: modoVuelto === "simple" ? "#fff" : "var(--text-muted)",
                        fontSize: 10.5,
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      Un solo método
                    </button>
                    <button
                      type="button"
                      onClick={() => setModoVuelto("mixto")}
                      style={{
                        flex: 1,
                        padding: "4px 6px",
                        borderRadius: 6,
                        border: "none",
                        background: modoVuelto === "mixto" ? "#f59e0b" : "transparent",
                        color: modoVuelto === "mixto" ? "#fff" : "var(--text-muted)",
                        fontSize: 10.5,
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      🔀 Vuelto Mixto / Dividido
                    </button>
                  </div>

                  {modoVuelto === "simple" ? (
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>
                        Método del vuelto:
                      </span>
                      <select
                        value={metodoVueltoSimple}
                        onChange={(e) => setMetodoVueltoSimple(e.target.value)}
                        className="payment-select"
                        style={{ fontSize: 12 }}
                      >
                        <option value="pago_movil">📱 Pago Móvil (Bs)</option>
                        <option value="efectivo_bs">🇻🇪 Efectivo (Bs)</option>
                        <option value="efectivo_usd">💵 Efectivo (USD)</option>
                      </select>
                    </div>
                  ) : (
                    /* Mixto */
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11 }}>
                        <span>Vuelto Total: <strong>${Math.max(0, vueltoTotalUsd).toFixed(2)} USD</strong></span>
                        {Math.abs(vueltoPendienteUsd) < 0.005 ? (
                          <span style={{ color: "#16a34a", fontWeight: 900 }}>✅ 100% Cuadrado</span>
                        ) : vueltoPendienteUsd > 0 ? (
                          <span style={{ color: "#dc2626", fontWeight: 900 }}>Faltan: ${vueltoPendienteUsd.toFixed(2)}</span>
                        ) : (
                          <span style={{ color: "#dc2626", fontWeight: 900 }}>Exceso: ${Math.abs(vueltoPendienteUsd).toFixed(2)}</span>
                        )}
                      </div>

                      {/* Efectivo USD */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, width: 90, fontWeight: 700 }}>💵 Efectivo USD:</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="0.00"
                          value={vueltoEfUsd}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setVueltoEfUsd(isNaN(val) ? "" : Math.max(0, val));
                          }}
                          className="cart-notes-input"
                          style={{ fontSize: 11.5, padding: "3px 6px" }}
                        />
                        {vueltoPendienteUsd > 0 && (
                          <button
                            type="button"
                            onClick={() => setVueltoEfUsd(Number(((Number(vueltoEfUsd) || 0) + vueltoPendienteUsd).toFixed(2)))}
                            style={{ fontSize: 9.5, padding: "3px 5px", borderRadius: 4, border: "none", background: "var(--primary-light)", color: "var(--primary-dark)", cursor: "pointer", fontWeight: 800 }}
                          >
                            + Resto
                          </button>
                        )}
                      </div>

                      {/* Pago Móvil */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, width: 90, fontWeight: 700 }}>📱 Pago Móvil:</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="0.00"
                          value={vueltoPmUsd}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setVueltoPmUsd(isNaN(val) ? "" : Math.max(0, val));
                          }}
                          className="cart-notes-input"
                          style={{ fontSize: 11.5, padding: "3px 6px" }}
                        />
                        {vueltoPendienteUsd > 0 && (
                          <button
                            type="button"
                            onClick={() => setVueltoPmUsd(Number(((Number(vueltoPmUsd) || 0) + vueltoPendienteUsd).toFixed(2)))}
                            style={{ fontSize: 9.5, padding: "3px 5px", borderRadius: 4, border: "none", background: "var(--primary-light)", color: "var(--primary-dark)", cursor: "pointer", fontWeight: 800 }}
                          >
                            + Resto
                          </button>
                        )}
                      </div>
                      {Number(vueltoPmUsd) > 0 && (
                        <span style={{ fontSize: 10, color: "#16a34a", paddingLeft: 96 }}>
                          Transferir: <strong>Bs. {(Number(vueltoPmUsd) * tasaBcv).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                        </span>
                      )}

                      {/* Efectivo Bs */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, width: 90, fontWeight: 700 }}>🇻🇪 Efectivo Bs:</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="0.00"
                          value={vueltoEfBsUsd}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setVueltoEfBsUsd(isNaN(val) ? "" : Math.max(0, val));
                          }}
                          className="cart-notes-input"
                          style={{ fontSize: 11.5, padding: "3px 6px" }}
                        />
                        {vueltoPendienteUsd > 0 && (
                          <button
                            type="button"
                            onClick={() => setVueltoEfBsUsd(Number(((Number(vueltoEfBsUsd) || 0) + vueltoPendienteUsd).toFixed(2)))}
                            style={{ fontSize: 9.5, padding: "3px 5px", borderRadius: 4, border: "none", background: "var(--primary-light)", color: "var(--primary-dark)", cursor: "pointer", fontWeight: 800 }}
                          >
                            + Resto
                          </button>
                        )}
                      </div>
                      {Number(vueltoEfBsUsd) > 0 && (
                        <span style={{ fontSize: 10, color: "#16a34a", paddingLeft: 96 }}>
                          Entregar: <strong>Bs. {(Number(vueltoEfBsUsd) * tasaBcv).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Abonos Previos Registrados (si existen) */}
          {abonosEnComanda.length > 0 && (
            <div
              style={{
                background: "rgba(239, 68, 68, 0.06)",
                border: "1px dashed rgba(239, 68, 68, 0.4)",
                borderRadius: 8,
                padding: "8px 10px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 10.5, fontWeight: 800, color: "#dc2626" }}>
                  Abonos Previos Registrados ({abonosEnComanda.length})
                </span>
                <button
                  type="button"
                  onClick={() => setAbonosEnComanda([])}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#dc2626",
                    fontSize: 10,
                    fontWeight: 800,
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Quitar todos los abonos
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {abonosEnComanda.map((tag, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      background: "var(--bg-card)",
                      padding: "4px 8px",
                      borderRadius: 6,
                      fontSize: 10.5,
                      border: "1px solid var(--border)",
                    }}
                  >
                    <span style={{ color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "80%" }}>
                      {tag}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAbonosEnComanda((prev) => prev.filter((_, idx) => idx !== i))}
                      style={{
                        background: "rgba(239, 68, 68, 0.15)",
                        border: "none",
                        color: "#dc2626",
                        borderRadius: 4,
                        padding: "2px 6px",
                        fontSize: 10,
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notas de la Comanda */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>
              NOTAS / OBSERVACIONES DE COCINA:
            </label>
            <input
              type="text"
              placeholder="Notas generales..."
              value={notasTexto}
              onChange={(e) => setNotasTexto(e.target.value)}
              className="cart-notes-input"
              style={{ fontSize: 12 }}
            />
          </div>

          {/* Totales Recalculados */}
          <div style={{ background: "rgba(34, 197, 94, 0.1)", border: "1px solid rgba(34, 197, 94, 0.4)", borderRadius: 10, padding: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>
                Comida: ${subtotalComidaUsd.toFixed(2)} {tipoEntrega === "delivery" ? `+ Delivery: $${costoDeliveryActual.toFixed(2)}` : ""}
              </span>
              <strong style={{ fontSize: 16, color: "#16a34a", fontWeight: 900 }}>
                Nuevo Total: ${nuevoTotalUsd.toFixed(2)} USD
              </strong>
            </div>
            <strong style={{ fontSize: 13, color: "var(--text)" }}>
              {nuevoTotalBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs
            </strong>
          </div>

          {/* Botones de Acción */}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button
              type="button"
              onClick={onCerrar}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--bg-card)",
                color: "var(--text)",
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={
                guardando ||
                (metodoPago === "pago_mixto" && Math.abs(pagoMixtoPendienteUsd) > 0.005) ||
                (incluirVuelto && metodoPago === "efectivo_usd" && modoVuelto === "mixto" && Math.abs(vueltoPendienteUsd) > 0.005)
              }
              onClick={handleGuardar}
              style={{
                flex: 2,
                padding: "8px 12px",
                borderRadius: 8,
                border: "none",
                background: "var(--primary)",
                color: "#ffffff",
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
                opacity:
                  guardando ||
                  (metodoPago === "pago_mixto" && Math.abs(pagoMixtoPendienteUsd) > 0.005) ||
                  (incluirVuelto && metodoPago === "efectivo_usd" && modoVuelto === "mixto" && Math.abs(vueltoPendienteUsd) > 0.005)
                    ? 0.6
                    : 1,
              }}
            >
              {guardando
                ? "Guardando..."
                : metodoPago === "pago_mixto" && pagoMixtoPendienteUsd > 0
                ? `⚠️ Falta asignar $${pagoMixtoPendienteUsd.toFixed(2)} USD`
                : metodoPago === "pago_mixto" && pagoMixtoPendienteUsd < 0
                ? `⚠️ Exceso de pago ($${Math.abs(pagoMixtoPendienteUsd).toFixed(2)} USD)`
                : "Guardar Cambios"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
