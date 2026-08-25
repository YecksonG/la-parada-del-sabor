"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

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
  notas_item?: string;
  producto?: {
    id: string;
    nombre: string;
    icono?: string;
  };
  extras?: ReciboItemExtra[];
};

type ReciboVenta = {
  id: string;
  numero_comanda: number;
  fecha: string;
  total_usd: number;
  total_bs: number;
  tasa_bcv: number;
  metodo_pago: string;
  tipo_entrega: string;
  estado: string;
  notas_comanda?: string;
  creado_por?: string;
  cliente?: {
    id: string;
    nombre: string;
    telefono?: string;
    direccion_delivery?: string;
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
    bg: "rgba(234, 179, 8, 0.15)",
    color: "#eab308",
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

  const fechaObj = new Date(venta.fecha);
  const fechaFormateada = fechaObj.toLocaleDateString("es-VE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const horaFormateada = fechaObj.toLocaleTimeString("es-VE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const estadoInfo = ESTADOS_CONFIG[venta.estado] || ESTADOS_CONFIG.completada;
  const entregaInfo = TIPOS_ENTREGA_LABEL[venta.tipo_entrega] || {
    label: "Para Llevar",
    icon: "🛍️",
  };
  const metodoPago = METODOS_PAGO_LABEL[venta.metodo_pago] || venta.metodo_pago;

  const urlRecibo = typeof window !== "undefined" ? window.location.href : "";

  const handleCopiarEnlace = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(urlRecibo);
      setCopiadoLabel("enlace");
      setTimeout(() => setCopiadoLabel(null), 2500);
    }
  };

  const handleCompartirWhatsApp = () => {
    const texto = `🧾 *Recibo de Compra - La Parada del Sabor*\n` +
      `📌 *Comanda:* #${venta.numero_comanda.toString().padStart(4, "0")}\n` +
      `👤 *Cliente:* ${venta.cliente?.nombre || "Cliente Mostrador"}\n` +
      `💰 *Total:* $${Number(venta.total_usd).toFixed(2)} USD / Bs. ${Number(venta.total_bs).toFixed(2)}\n` +
      `🔗 *Ver Detalle & Estado en vivo:* ${urlRecibo}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
  };

  return (
    <div className="recibo-page-wrapper">
      {/* Barra de Navegación Simple para Clientes */}
      <header className="recibo-top-banner">
        <Link href="/" className="recibo-brand-link">
          <Image
            src="/images/logo-badge.png"
            alt="La Parada del Sabor"
            width={34}
            height={34}
            className="recibo-logo-img"
          />
          <span className="recibo-brand-title">
            La Parada <span className="recibo-brand-accent">del Sabor</span>
          </span>
        </Link>

        <div className="recibo-actions-top no-print">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="recibo-btn-pill"
            title="Actualizar estado del pedido"
          >
            🔄 Actualizar
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="recibo-btn-pill"
            title="Imprimir o Guardar en PDF"
          >
            🖨️ Imprimir
          </button>
        </div>
      </header>

      {/* Contenedor Principal del Ticket */}
      <main className="recibo-container">
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
            <a
              href={`https://wa.me/584122595386?text=${encodeURIComponent(
                `¡Hola! 👋 Te adjunto el comprobante de mi Pago Móvil para la comanda #${venta.numero_comanda} por Bs. ${Number(venta.total_bs).toFixed(2)} ($${Number(venta.total_usd).toFixed(2)} USD).\n\n🧾 Ver mi factura digital: ${typeof window !== "undefined" ? window.location.href : ""}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-pm-whatsapp"
            >
              <span>📲 Enviar Comprobante por WhatsApp</span>
            </a>
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
            <a
              href={`https://wa.me/584122595386?text=${encodeURIComponent(
                `¡Hola! 👋 Te adjunto el comprobante de mi Transferencia Bancaria para la comanda #${venta.numero_comanda} por Bs. ${Number(venta.total_bs).toFixed(2)}.\n\n🧾 Ver mi factura digital: ${typeof window !== "undefined" ? window.location.href : ""}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-pm-whatsapp"
            >
              <span>📲 Enviar Comprobante por WhatsApp</span>
            </a>
          </div>
        )}

        {/* 3. Resumen de Binance Pay USDT */}
        {venta.metodo_pago === "binance" && (
          <div className="recibo-pm-card no-print" style={{ borderLeftColor: "#F3BA2F" }}>
            <div className="recibo-pm-title">
              <span>🟡 Binance Pay (USDT)</span>
              <span className="badge-popular" style={{ background: "#F3BA2F", color: "#000" }}>Binance Pay</span>
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
              style={{ background: "#F3BA2F", color: "#000", marginBottom: 12 }}
            >
              <span>{copiadoLabel === "binance_id" ? "✅ ¡Binance ID Copiado!" : "📋 Copiar Binance Pay ID (371902899)"}</span>
            </button>

            <div className="recibo-pm-details">
              <div><span>Binance Pay ID:</span> <strong>371902899</strong></div>
              <div><span>Correo:</span> <strong style={{ fontSize: 11 }}>yecksongonza2002@gmail.com</strong></div>
              <div><span>Monto:</span> <strong style={{ color: "#F3BA2F" }}>${Number(venta.total_usd).toFixed(2)} USDT</strong></div>
            </div>
            <a
              href={`https://wa.me/584122595386?text=${encodeURIComponent(
                `¡Hola! 👋 Te adjunto el comprobante de mi pago por Binance Pay para la comanda #${venta.numero_comanda} por $${Number(venta.total_usd).toFixed(2)} USDT.\n\n🧾 Ver mi factura digital: ${typeof window !== "undefined" ? window.location.href : ""}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-pm-whatsapp"
              style={{ background: "#F3BA2F", color: "#000" }}
            >
              <span>📲 Enviar Comprobante por WhatsApp</span>
            </a>
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
            <a
              href={`https://wa.me/584122595386?text=${encodeURIComponent(
                `¡Hola! 👋 Te adjunto el comprobante de mi pago por Zelle para la comanda #${venta.numero_comanda} por $${Number(venta.total_usd).toFixed(2)} USD.\n\n🧾 Ver mi factura digital: ${typeof window !== "undefined" ? window.location.href : ""}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-pm-whatsapp"
              style={{ background: "#7414CA" }}
            >
              <span>📲 Enviar Comprobante por WhatsApp</span>
            </a>
          </div>
        )}

        {/* Botones de Acción al Pie (No se imprimen) */}
        <div className="recibo-share-actions no-print">
          <button
            type="button"
            onClick={handleCompartirWhatsApp}
            className="recibo-btn-whatsapp"
          >
            <span>📲 Compartir Factura</span>
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
