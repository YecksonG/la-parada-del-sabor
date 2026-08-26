"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import ThemeToggle from "@/components/theme-toggle";

type ReciboItemExtra = {
  id: string;
  cantidad: number;
  precio_unitario_usd: number;
  subtotal_usd: number;
  extra?: {
    id: string;
    nombre: string;
  };
};

type ReciboItem = {
  id: string;
  producto_id: string;
  cantidad: number;
  precio_unitario_usd: number;
  subtotal_usd: number;
  notas_item?: string | null;
  producto?: {
    id: string;
    nombre: string;
    icono?: string;
  };
  extras?: ReciboItemExtra[];
};

export type ReciboVenta = {
  id: string;
  numero_comanda: number;
  fecha: string;
  total_usd: number;
  total_bs: number;
  tasa_bcv: number;
  metodo_pago: string;
  tipo_entrega: string;
  estado: string;
  notas_comanda?: string | null;
  cliente?: {
    id: string;
    nombre: string;
    telefono?: string | null;
    direccion_delivery?: string | null;
  };
  items?: ReciboItem[];
};

const METODOS_PAGO_LABEL: Record<string, string> = {
  efectivo_usd: "💵 Efectivo (USD)",
  efectivo_bs: "🇻🇪 Efectivo (Bs)",
  pago_movil: "📱 Pago Móvil",
  transferencia: "🏦 Transferencia Bancaria",
  punto: "💳 Tarjeta / Punto de Venta",
  binance: "🟡 Binance USDT",
  zelle: "🟣 Zelle",
  credito: "📝 A Crédito (Pendiente)",
};

const TIPOS_ENTREGA_LABEL: Record<string, { label: string; icon: string }> = {
  puerta_cerrada: { label: "Puerta Cerrada", icon: "🚪" },
  mesa: { label: "Servicio en Mesa", icon: "🪑" },
  pickup: { label: "Para Llevar / Retiro", icon: "🛍️" },
  delivery: { label: "Servicio Delivery", icon: "🛵" },
};

const ESTADOS_CONFIG: Record<
  string,
  { label: string; icon: string; bg: string; color: string; desc: string }
> = {
  pendiente: {
    label: "Por Confirmar",
    icon: "🟡",
    bg: "rgba(245, 158, 11, 0.12)",
    color: "#b45309",
    desc: "Tu pedido fue recibido y está en cola para ser verificado en caja.",
  },
  preparando: {
    label: "En Cocina",
    icon: "🍳",
    bg: "rgba(249, 115, 22, 0.15)",
    color: "#f97316",
    desc: "Nuestros cocineros están preparando tus arepas con ingredientes frescos.",
  },
  lista: {
    label: "¡Listo para Despacho!",
    icon: "🔔",
    bg: "rgba(59, 130, 246, 0.15)",
    color: "#3b82f6",
    desc: "Tu pedido está listo y empacado para entrega o retiro.",
  },
  completada: {
    label: "Entregado / Despachado",
    icon: "✅",
    bg: "rgba(34, 197, 94, 0.15)",
    color: "#22c55e",
    desc: "¡Buen provecho! Gracias por elegir La Parada del Sabor.",
  },
  cancelada: {
    label: "Cancelado",
    icon: "❌",
    bg: "rgba(239, 68, 68, 0.15)",
    color: "#ef4444",
    desc: "Este pedido fue cancelado. Comunícate con nosotros para cualquier duda.",
  },
};

export default function ReciboClienteView({ venta }: { venta: ReciboVenta }) {
  const [copiadoLabel, setCopiadoLabel] = useState<string | null>(null);
  const [reciboUrl, setReciboUrl] = useState<string>(`https://la-parada-del-sabor.vercel.app/recibo/${venta.id}`);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setReciboUrl(`${window.location.origin}/recibo/${venta.id}`);
    }
  }, [venta.id]);

  const fechaObj = new Date(venta.fecha);
  const fechaFormateada = fechaObj.toLocaleDateString("es-VE", {
    weekday: "short",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const horaFormateada = fechaObj.toLocaleTimeString("es-VE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const esDelivery = venta.tipo_entrega === "delivery";

  // Estado contextual según tipo de entrega (Delivery vs Retiro)
  const estadoInfo = useMemo(() => {
    if (venta.estado === "lista") {
      return esDelivery
        ? {
            label: "¡En Camino a tu Dirección!",
            icon: "🛵",
            bg: "rgba(59, 130, 246, 0.15)",
            color: "#3b82f6",
            desc: "Tu repartidor ya va en camino con tu pedido calientito a tu ubicación.",
          }
        : {
            label: "¡Listo para Retirar!",
            icon: "🛍️",
            bg: "rgba(59, 130, 246, 0.15)",
            color: "#3b82f6",
            desc: "Tu pedido está listo y empacado en mostrador. ¡Puedes pasar a retirarlo!",
          };
    }
    return ESTADOS_CONFIG[venta.estado] || ESTADOS_CONFIG.completada;
  }, [venta.estado, esDelivery]);

  const entregaInfo = TIPOS_ENTREGA_LABEL[venta.tipo_entrega] || {
    label: "Para Llevar",
    icon: "🛍️",
  };
  const metodoPago = METODOS_PAGO_LABEL[venta.metodo_pago] || venta.metodo_pago;

  const handleCopiarEnlace = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(reciboUrl);
      setCopiadoLabel("enlace");
      setTimeout(() => setCopiadoLabel(null), 2500);
    }
  };

  const handleCompartirWhatsApp = () => {
    const texto = `🧾 *Recibo de Compra - La Parada del Sabor*\n` +
      `📌 *Comanda:* #${venta.numero_comanda.toString().padStart(4, "0")}\n` +
      `👤 *Cliente:* ${venta.cliente?.nombre || "Cliente Mostrador"}\n` +
      `💰 *Total:* $${Number(venta.total_usd).toFixed(2)} USD / Bs. ${Number(venta.total_bs).toFixed(2)}\n` +
      `🔗 *Ver Detalle & Estado en vivo:* ${reciboUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
  };

  // Stepper dinámico según tipo de entrega
  const pasosEstado = useMemo(() => [
    { key: "pendiente", label: "Por Confirmar", icon: "🟡" },
    { key: "preparando", label: "En Cocina", icon: "🍳" },
    { key: "lista", label: esDelivery ? "En Camino" : "Listo p/ Retirar", icon: esDelivery ? "🛵" : "🛍️" },
    { key: "completada", label: esDelivery ? "Entregado" : "Retirado", icon: "✅" },
  ], [esDelivery]);

  const pasoIndexActual = (() => {
    switch (venta.estado) {
      case "pendiente": return 0;
      case "preparando": return 1;
      case "lista": return 2;
      case "completada": return 3;
      default: return 0;
    }
  })();

  return (
    <div className="recibo-page-wrapper">
      {/* Barra de Navegación Simple para Clientes */}
      <header className="recibo-top-banner no-print">
        <Link href="/" className="recibo-brand-link">
          <Image
            src="/images/logo-badge.png"
            alt="La Parada del Sabor"
            width={32}
            height={32}
            className="recibo-logo-img"
          />
          <span className="recibo-brand-title">
            La Parada <span className="recibo-brand-accent">del Sabor</span>
          </span>
        </Link>

        <div className="recibo-actions-top">
          <ThemeToggle />
          <Link
            href="/pedir"
            className="recibo-btn-pill"
            style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            🛍️ <span>Nuevo Pedido</span>
          </Link>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="recibo-btn-pill"
            title="Actualizar estado del pedido"
          >
            🔄 <span>Actualizar</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="recibo-btn-pill"
            title="Imprimir o Guardar en PDF"
          >
            🖨️ <span>PDF</span>
          </button>
        </div>
      </header>

      {/* Contenedor Principal del Ticket */}
      <main className="recibo-container">
        {/* Callout Indispensable: Enviar Comprobante a Cocina (Solo para métodos digitales con comprobante) */}
        {["pago_movil", "transferencia", "binance", "zelle"].includes(venta.metodo_pago) && (
          <div
            className="no-print"
            style={{
              background: "linear-gradient(135deg, #128C7E, #075E54)",
              borderRadius: 18,
              padding: "20px 18px",
              color: "#ffffff",
              boxShadow: "0 10px 25px rgba(18, 140, 126, 0.35)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              textAlign: "center",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                background: "rgba(255, 255, 255, 0.2)",
                borderRadius: 9999,
                padding: "4px 14px",
                width: "fit-content",
                margin: "0 auto",
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: 0.5,
              }}
            >
              ⚡ PASO INDISPENSABLE
            </div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: "#ffffff" }}>
              📲 Envía tu comprobante a nuestro WhatsApp
            </h3>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.95, lineHeight: 1.4 }}>
              Para que cocina confirme tu pago y comience a preparar tus arepas calientitas sin demora, envíanos el comprobante por WhatsApp:
            </p>
            <a
              href={`https://wa.me/584122595386?text=${encodeURIComponent(
                `¡Hola La Parada del Sabor! 👋 Adjunto mi comprobante para la comanda #${venta.numero_comanda.toString().padStart(4, "0")}.\n\n🧾 Factura digital & estado en vivo:\n${reciboUrl}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: "#25D366",
                color: "#ffffff",
                padding: "14px 20px",
                borderRadius: 14,
                fontWeight: 900,
                fontSize: 15,
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow: "0 4px 14px rgba(0, 0, 0, 0.25)",
                marginTop: 4,
              }}
            >
              <span>💬 Enviar Comprobante al WhatsApp (+58 412-2595386)</span>
            </a>
          </div>
        )}

        <div className="recibo-ticket-card">
          {/* Mancha de Salsa Gourmet Artística Decorativa (SVG) */}
          <div className="salsa-stain-decor" aria-hidden="true">
            <svg viewBox="0 0 160 160" width="160" height="160" fill="none">
              <path
                d="M45 20C75 10 115 35 130 65C145 95 125 135 90 145C55 155 20 130 15 95C10 60 15 30 45 20Z"
                fill="url(#salsaGrad)"
                opacity="0.75"
              />
              <circle cx="135" cy="45" r="7" fill="#e65c00" opacity="0.6" />
              <circle cx="145" cy="85" r="4" fill="#e65c00" opacity="0.4" />
              <circle cx="30" cy="130" r="5" fill="#e65c00" opacity="0.5" />
              <defs>
                <radialGradient id="salsaGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ff7b00" stopOpacity="0.8" />
                  <stop offset="60%" stopColor="#e65c00" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#9a3412" stopOpacity="0" />
                </radialGradient>
              </defs>
            </svg>
          </div>

          {/* Sello Gourmet Oficial */}
          <div className="sello-gourmet-badge" aria-hidden="true">
            <span>AUTÉNTICO</span>
            <strong>SABOR</strong>
          </div>

          {/* Encabezado del Recibo */}
          <div className="recibo-header">
            <div className="recibo-logo-wrapper">
              <Image
                src="/images/logo-badge.png"
                alt="Logo La Parada del Sabor"
                width={70}
                height={70}
                className="recibo-hero-logo"
                priority
              />
            </div>
            <h1 className="recibo-title">LA PARADA DEL SABOR</h1>
            <p className="recibo-subtitle">Arepería Tradicional & Comida Rápida</p>
            <div className="recibo-badge-comanda">
              <span>ORDEN DE SERVICIO</span>
              <strong>#{venta.numero_comanda.toString().padStart(4, "0")}</strong>
            </div>
            <p className="recibo-fecha">
              {fechaFormateada} • {horaFormateada}
            </p>
          </div>

          {/* Stepper Visual de Progreso del Pedido */}
          {venta.estado !== "cancelada" && (
            <nav
              aria-label="Progreso de preparación del pedido"
              className="recibo-stepper no-print"
              style={{
                display: "flex",
                justifyContent: "space-between",
                margin: "12px 0 16px",
                padding: "10px 12px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
              }}
            >
              {pasosEstado.map((p, idx) => {
                const activo = idx <= pasoIndexActual;
                const actual = idx === pasoIndexActual;
                return (
                  <div
                    key={p.key}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                      flex: 1,
                      opacity: activo ? 1 : 0.4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: actual ? 22 : 16,
                        transform: actual ? "scale(1.15)" : "none",
                        transition: "transform 0.2s",
                      }}
                    >
                      {p.icon}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: actual ? 800 : 600,
                        color: actual ? "var(--primary-dark)" : "var(--text-muted)",
                        textAlign: "center",
                      }}
                    >
                      {p.label}
                    </span>
                  </div>
                );
              })}
            </nav>
          )}

          {/* Tarjeta de Estado en Vivo (Live Status) */}
          <div
            className="recibo-status-card"
            style={{
              backgroundColor: estadoInfo.bg,
              borderColor: estadoInfo.color,
            }}
          >
            <div className="recibo-status-head">
              <span className="recibo-status-icon">{estadoInfo.icon}</span>
              <div>
                <span className="recibo-status-label" style={{ color: estadoInfo.color }}>
                  ESTADO: {estadoInfo.label.toUpperCase()}
                </span>
                <p className="recibo-status-desc">{estadoInfo.desc}</p>
              </div>
            </div>
          </div>

          {/* Información del Cliente & Entrega */}
          <div className="recibo-info-grid">
            <div className="recibo-info-box">
              <span className="recibo-info-lbl">Cliente</span>
              <strong className="recibo-info-val">
                {venta.cliente?.nombre || "Cliente Mostrador"}
              </strong>
              {venta.cliente?.telefono && (
                <span className="recibo-info-sub">📞 {venta.cliente.telefono}</span>
              )}
            </div>

            <div className="recibo-info-box">
              <span className="recibo-info-lbl">Modalidad</span>
              <strong className="recibo-info-val">
                {entregaInfo.icon} {entregaInfo.label}
              </strong>
              {venta.cliente?.direccion_delivery && venta.tipo_entrega === "delivery" && (
                <span className="recibo-info-sub">📍 {venta.cliente.direccion_delivery}</span>
              )}
            </div>
          </div>

          {/* Desglose de Productos */}
          <div className="recibo-items-section">
            <h2 className="recibo-section-title">DETALLE DE CONSUMO</h2>
            <div className="recibo-items-table">
              {(venta.items || []).map((item, idx) => {
                const precioTotalItem = Number(item.subtotal_usd || 0);
                const precioUnitario = Number(item.precio_unitario_usd || 0);
                const bsItem = precioTotalItem * Number(venta.tasa_bcv || 1);

                return (
                  <div key={item.id || idx} className="recibo-item-row">
                    <div className="recibo-item-main">
                      <div className="recibo-item-name-box">
                        <span className="recibo-item-qty">{item.cantidad}x</span>
                        <span className="recibo-item-name">
                          {item.producto?.icono || "🫓"} {item.producto?.nombre || "Producto"}
                        </span>
                      </div>
                      <div className="recibo-item-prices">
                        <span className="recibo-item-total-usd">
                          ${precioTotalItem.toFixed(2)}
                        </span>
                        <span className="recibo-item-total-bs">
                          Bs. {bsItem.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Extras / Modificadores del Item */}
                    {item.extras && item.extras.length > 0 && (
                      <div className="recibo-item-extras">
                        {item.extras.map((ext, eIdx) => (
                          <div key={ext.id || eIdx} className="recibo-extra-pill">
                            <span>+ {ext.extra?.nombre || "Extra"}</span>
                            {ext.precio_unitario_usd > 0 && (
                              <span>(+${(ext.precio_unitario_usd * ext.cantidad).toFixed(2)})</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Notas específicas del plato */}
                    {item.notas_item && (
                      <p className="recibo-item-note">💬 Nota: {item.notas_item}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notas generales de la comanda */}
          {venta.notas_comanda && (
            <div className="recibo-order-note">
              <span className="recibo-order-note-title">Observaciones:</span>
              <p>{venta.notas_comanda}</p>
            </div>
          )}

          {/* Resumen Financiero Dual */}
          <div className="recibo-totals-box">
            <div className="recibo-total-line">
              <span>Método de Pago:</span>
              <strong>{metodoPago}</strong>
            </div>
            <div className="recibo-total-line">
              <span>Tasa de Cambio Aplicada:</span>
              <strong>{Number(venta.tasa_bcv).toFixed(2)} Bs / USD</strong>
            </div>

            <div className="recibo-divider-dashed"></div>

            <div className="recibo-grand-total">
              <div className="recibo-total-labels">
                <span className="recibo-total-title">TOTAL A PAGAR</span>
                <span className="recibo-total-subtitle">Monto final verificado</span>
              </div>
              <div className="recibo-total-values">
                <span className="recibo-price-usd">${Number(venta.total_usd).toFixed(2)} USD</span>
                <span className="recibo-price-bs">Bs. {Number(venta.total_bs).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Pie de Ticket Gourmet */}
          <div className="recibo-footer">
            <div className="recibo-cut-line" aria-hidden="true">
              <span>• • • • • • • • • • • • • • • • • • • • • • • • • • • •</span>
            </div>
            <p className="recibo-footer-message">
              ¡Gracias por preferir la auténtica sazón venezolana! 🫓🔥
            </p>
            <p className="recibo-footer-sub">
              La Parada del Sabor • Comprobante Digital Oficial
            </p>
          </div>
        </div>

        {/* 1. Resumen de Pago Móvil para el Cliente */}
        {venta.metodo_pago === "pago_movil" && (
          <div className="recibo-pm-card no-print">
            <div className="recibo-pm-title">
              <span>📱 Datos de Pago Móvil</span>
              <span className="badge-popular">BFC (0151)</span>
            </div>

            <button
              type="button"
              onClick={() => {
                if (typeof navigator !== "undefined" && navigator.clipboard) {
                  navigator.clipboard.writeText("0151 04244325183 29524904");
                  setCopiadoLabel("pm");
                  setTimeout(() => setCopiadoLabel(null), 2500);
                }
              }}
              className="pedir-btn-copy-all"
              style={{ marginBottom: 12 }}
            >
              <span>{copiadoLabel === "pm" ? "✅ ¡Datos Copiados para Banco!" : "📋 Copiar Datos (Pegar en tu Banco)"}</span>
            </button>

            <div className="recibo-pm-details">
              <div><span>Banco:</span> <strong>Banco Fondo Común (0151)</strong></div>
              <div><span>Cédula:</span> <strong>29.524.904</strong></div>
              <div><span>Teléfono:</span> <strong>0424-4325183</strong></div>
              <div><span>Monto a Transferir:</span> <strong style={{ color: "var(--primary)" }}>Bs. {Number(venta.total_bs).toFixed(2)}</strong></div>
            </div>
          </div>
        )}

        {/* 2. Resumen de Transferencia Bancaria BFC */}
        {venta.metodo_pago === "transferencia" && (
          <div className="recibo-pm-card no-print">
            <div className="recibo-pm-title">
              <span>🏦 Transferencia Bancaria (VES)</span>
              <span className="badge-popular">BFC (0151)</span>
            </div>

            <button
              type="button"
              onClick={() => {
                if (typeof navigator !== "undefined" && navigator.clipboard) {
                  navigator.clipboard.writeText("01510035451002204840");
                  setCopiadoLabel("transf");
                  setTimeout(() => setCopiadoLabel(null), 2500);
                }
              }}
              className="pedir-btn-copy-all"
              style={{ marginBottom: 12 }}
            >
              <span>{copiadoLabel === "transf" ? "✅ ¡Número de Cuenta Copiado!" : "📋 Copiar N° de Cuenta (20 Dígitos)"}</span>
            </button>

            <div className="recibo-pm-details">
              <div><span>Banco:</span> <strong>Banco Fondo Común (BFC)</strong></div>
              <div><span>Titular:</span> <strong>GONZALEZ NOGUERA YECKSON</strong></div>
              <div><span>Cédula:</span> <strong>V-29524904</strong></div>
              <div><span>N° Cuenta:</span> <strong style={{ fontSize: 11 }}>01510035451002204840</strong></div>
              <div><span>Monto:</span> <strong style={{ color: "var(--primary)" }}>Bs. {Number(venta.total_bs).toFixed(2)}</strong></div>
            </div>
          </div>
        )}

        {/* 3. Resumen de Binance Pay USDT */}
        {venta.metodo_pago === "binance" && (
          <div className="recibo-pm-card no-print" style={{ borderLeftColor: "#F3BA2F" }}>
            <div className="recibo-pm-title">
              <span>🟡 Binance Pay (USDT)</span>
              <span className="badge-popular" style={{ background: "#F3BA2F", color: "#1e293b", fontWeight: 800 }}>Binance Pay</span>
            </div>

            <button
              type="button"
              onClick={() => {
                if (typeof navigator !== "undefined" && navigator.clipboard) {
                  navigator.clipboard.writeText("371902899");
                  setCopiadoLabel("binance_id");
                  setTimeout(() => setCopiadoLabel(null), 2500);
                }
              }}
              className="pedir-btn-copy-all"
              style={{ background: "#F3BA2F", color: "#1e293b", fontWeight: 800, marginBottom: 12 }}
            >
              <span>{copiadoLabel === "binance_id" ? "✅ ¡Binance ID Copiado!" : "📋 Copiar Binance Pay ID (371902899)"}</span>
            </button>

            <div className="recibo-pm-details">
              <div><span>Binance Pay ID:</span> <strong>371902899</strong></div>
              <div><span>Correo:</span> <strong style={{ fontSize: 11 }}>yecksongonza2002@gmail.com</strong></div>
              <div><span>Monto:</span> <strong style={{ color: "#d97706" }}>${Number(venta.total_usd).toFixed(2)} USDT</strong></div>
            </div>
          </div>
        )}

        {/* 4. Resumen de Zelle */}
        {venta.metodo_pago === "zelle" && (
          <div className="recibo-pm-card no-print" style={{ borderLeftColor: "#7414CA" }}>
            <div className="recibo-pm-title">
              <span>🟣 Pago por Zelle (USD)</span>
              <span className="badge-popular" style={{ background: "#7414CA" }}>Zelle</span>
            </div>

            <button
              type="button"
              onClick={() => {
                if (typeof navigator !== "undefined" && navigator.clipboard) {
                  navigator.clipboard.writeText("yasbetnoguer@hotmail.com");
                  setCopiadoLabel("zelle");
                  setTimeout(() => setCopiadoLabel(null), 2500);
                }
              }}
              className="pedir-btn-copy-all"
              style={{ background: "#7414CA", marginBottom: 12 }}
            >
              <span>{copiadoLabel === "zelle" ? "✅ ¡Correo Zelle Copiado!" : "📋 Copiar Correo Zelle"}</span>
            </button>

            <div className="recibo-pm-details">
              <div><span>Correo Zelle:</span> <strong>yasbetnoguer@hotmail.com</strong></div>
              <div><span>Monto a Enviar:</span> <strong style={{ color: "#7414CA" }}>${Number(venta.total_usd).toFixed(2)} USD</strong></div>
            </div>
          </div>
        )}

        {/* Botones de Acción al Pie (No se imprimen) */}
        <div className="recibo-share-actions no-print">
          <button
            type="button"
            onClick={handleCompartirWhatsApp}
            className="recibo-btn-whatsapp"
          >
            <span>📤 Compartir Factura</span>
          </button>

          <button
            type="button"
            onClick={handleCopiarEnlace}
            className="recibo-btn-secondary"
          >
            <span>{copiadoLabel === "enlace" ? "✅ ¡Enlace Copiado!" : "🔗 Copiar Enlace"}</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="recibo-btn-secondary"
          >
            <span>🖨️ Descargar Comprobante (PDF)</span>
          </button>
        </div>
      </main>
    </div>
  );
}
