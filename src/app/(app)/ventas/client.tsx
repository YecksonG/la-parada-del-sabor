"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { Venta } from "@/types/database";
import type { MetodoPago } from "@/types/database";
import { cambiarEstadoVenta, actualizarMetodoPagoVenta, actualizarDetallesComanda } from "./actions";
import { toFechaCaracasString, fechaHoyEnCaracas } from "@/lib/date-vzla";
import { parsearPagoMixtoDeNotas, METODOS_FRACCION_INFO } from "@/lib/pago-mixto";

interface VentasClientProps {
  ventas: Venta[];
}

export default function VentasClient({ ventas }: VentasClientProps) {
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
                      {v.metodo_pago === "pago_mixto" && (
                        <option value="pago_mixto" disabled>🔀 Pago Mixto (Configurado en POS)</option>
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
    </main>
  );
}

function ModalEditarComanda({
  venta,
  onCerrar,
  onGuardado,
}: {
  venta: Venta;
  onCerrar: () => void;
  onGuardado: (updated: Partial<Venta> & { id: string }) => void;
}) {
  const tasaBcv = Number(venta.tasa_bcv) || 1;

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

  // Limpiar notas previas quitando cualquier tag previo de vuelto o pago mixto si se edita
  const notasBase = useMemo(() => {
    return (venta.notas_comanda || "")
      .replace(/•?\s*\[[^\]]*(?:[Vv]uelto\s*:)[^\]]*\]/g, "")
      .replace(/•?\s*\[Pago Mixto:\s*[^\]]+\]/gi, "")
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

  const [guardando, setGuardando] = useState(false);

  // Cálculos dinámicos
  const costoDeliveryActual = tipoEntrega === "delivery" ? Math.max(0, Number(deliveryMontoUsd) || 0) : 0;
  const nuevoTotalUsd = Number((subtotalComidaUsd + costoDeliveryActual).toFixed(2));
  const nuevoTotalBs = Number((nuevoTotalUsd * tasaBcv).toFixed(2));

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

    if (incluirVuelto && metodoPago === "efectivo_usd") {
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
      const matchMixto = (venta.notas_comanda || "").match(/\[Pago Mixto:\s*[^\]]+\]/i);
      if (matchMixto) {
        notasFinales = notasFinales ? `${notasFinales} • ${matchMixto[0]}` : matchMixto[0];
      }
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

    const res = await actualizarDetallesComanda({
      venta_id: venta.id,
      tipo_entrega: tipoEntrega,
      delivery_monto_usd: costoDeliveryActual,
      delivery_zona_nombre: tipoEntrega === "delivery" ? deliveryZonaNombre : null,
      direccion_delivery: tipoEntrega === "delivery" ? direccionDelivery : null,
      metodo_pago: metodoPago,
      notas_comanda: notasFinales || null,
    });

    setGuardando(false);

    if (!res.ok) {
      alert(res.error || "No se pudo actualizar la comanda.");
      return;
    }

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
      notas_comanda: notasFinales || null,
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
              <option value="pago_movil_bs">📱 Pago Móvil Bs</option>
              <option value="efectivo_bs">🇻🇪 Efectivo Bs</option>
              <option value="punto">💳 Tarjeta / POS</option>
              <option value="punto_bs">💳 Punto de Venta Bs</option>
              <option value="transferencia">🏦 Transferencia</option>
              <option value="binance">🟡 Binance Pay</option>
              <option value="zelle">🟣 Zelle</option>
              <option value="pesos_cop">🇨🇴 Pesos COP</option>
              {venta.metodo_pago === "pago_mixto" && (
                <option value="pago_mixto">🔀 Mantener Pago Mixto Original</option>
              )}
            </select>
          </div>

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
              disabled={guardando || (incluirVuelto && metodoPago === "efectivo_usd" && modoVuelto === "mixto" && Math.abs(vueltoPendienteUsd) > 0.005)}
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
                opacity: (guardando || (incluirVuelto && metodoPago === "efectivo_usd" && modoVuelto === "mixto" && Math.abs(vueltoPendienteUsd) > 0.005)) ? 0.6 : 1,
              }}
            >
              {guardando ? "Guardando..." : "💾 Guardar Cambios"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
