"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { Venta } from "@/types/database";
import type { MetodoPago } from "@/types/database";
import { cambiarEstadoVenta, actualizarMetodoPagoVenta } from "./actions";
import { toFechaCaracasString, fechaHoyEnCaracas } from "@/lib/date-vzla";

interface VentasClientProps {
  ventas: Venta[];
}

export default function VentasClient({ ventas }: VentasClientProps) {
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [filtroFecha, setFiltroFecha] = useState<"hoy" | "ayer" | "todas" | "fecha">("hoy");
  const [fechaEspecifica, setFechaEspecifica] = useState<string>("");
  const [procesandoId, setProcesandoId] = useState<string | null>(null);

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
      if (filtroEstado !== "todos" && v.estado !== filtroEstado) {
        return false;
      }

      return true;
    });
  }, [ventas, filtroEstado, filtroFecha, fechaEspecifica, hoyStr, ayerStr]);

  const totalVentasUsd = useMemo(() => {
    return ventasFiltradas
      .filter((v) => v.estado === "preparando" || v.estado === "lista" || v.estado === "completada")
      .reduce((acc, v) => acc + Number(v.total_usd), 0);
  }, [ventasFiltradas]);

  const handleCambiarMetodoPago = async (ventaId: string, nuevoMetodo: MetodoPago) => {
    setProcesandoId(ventaId);
    const res = await actualizarMetodoPagoVenta(ventaId, nuevoMetodo);
    setProcesandoId(null);
    if (!res.ok) {
      alert(res.error || "No se pudo actualizar el método de pago.");
    }
  };

  const handleCambiarEstado = async (
    ventaId: string,
    nuevoEstado: "pendiente" | "preparando" | "lista" | "completada" | "cancelada"
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
                      <span className={`comanda-status-pill status-${v.estado}`}>
                        {v.estado === "pendiente"
                          ? "🟡 Por Confirmar"
                          : v.estado === "preparando"
                          ? "🍳 En Cocina"
                          : v.estado === "lista"
                          ? (v.tipo_entrega === "delivery" ? "🛵 En Camino" : "🛍️ Lista")
                          : v.estado === "completada"
                          ? "✅ Entregada"
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
                      onChange={(e) => handleCambiarMetodoPago(v.id, e.target.value as MetodoPago)}
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
                      <option value="pago_movil_bs">📱 Pago Móvil Bs</option>
                      <option value="efectivo_usd">💵 Efectivo USD</option>
                      <option value="efectivo_bs">🇻🇪 Efectivo Bs</option>
                      <option value="punto">💳 Tarjeta / POS</option>
                      <option value="punto_bs">💳 Punto de Venta Bs</option>
                      <option value="transferencia">🏦 Transferencia</option>
                      <option value="binance">🟡 Binance Pay</option>
                      <option value="zelle">🟣 Zelle</option>
                      <option value="pesos_cop">🇨🇴 Pesos COP</option>
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
    </main>
  );
}
