"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useMemo, useRef } from "react";
import ThemeToggle from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import { obtenerEstadoRecibo } from "./actions";
import { sounds } from "@/lib/sound-effects";

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
  delivery_zona_nombre?: string | null;
  delivery_monto_usd?: number | null;
  delivery_monto_bs?: number | null;
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
  pago_movil_bs: "📱 Pago Móvil",
  transferencia: "🏦 Transferencia Bancaria",
  punto: "💳 Tarjeta / Punto de Venta",
  punto_bs: "💳 Tarjeta / Punto de Venta",
  binance: "🟡 Binance USDT",
  binance_usdt: "🟡 Binance USDT",
  zelle: "🟣 Zelle",
  credito: "📝 A Crédito (Pendiente)",
  pesos_cop: "🇨🇴 Pesos Colombianos (COP)",
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

export default function ReciboClienteView({ venta: ventaInicial }: { venta: ReciboVenta }) {
  const [ventaActual, setVentaActual] = useState<ReciboVenta>(ventaInicial);
  const [actualizadoEnVivo, setActualizadoEnVivo] = useState(false);
  const [refrescandoManual, setRefrescandoManual] = useState(false);
  const [copiadoLabel, setCopiadoLabel] = useState<string | null>(null);
  const [reciboUrl, setReciboUrl] = useState<string>(`https://la-parada-del-sabor.vercel.app/recibo/${ventaInicial.id}`);

  const ultimoEstadoRef = useRef(ventaInicial.estado);
  const lastSoundTimeRef = useRef<number>(0);
  const badgeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Sincronizar si cambia la prop inicial
  useEffect(() => {
    setVentaActual(ventaInicial);
    ultimoEstadoRef.current = ventaInicial.estado;
  }, [ventaInicial]);

  // Manejo de montaje / desmontaje
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (badgeTimeoutRef.current) {
        clearTimeout(badgeTimeoutRef.current);
      }
    };
  }, []);

  // SUSCRIPCIÓN EN TIEMPO REAL ROBUSTA (Supabase Realtime + Polling Inteligente)
  useEffect(() => {
    const notificarCambioEstado = (nuevoEstado: string) => {
      if (!mountedRef.current) return;
      if (nuevoEstado && nuevoEstado !== ultimoEstadoRef.current) {
        ultimoEstadoRef.current = nuevoEstado;

        // Throttling de sonido y vibración (mínimo 2 segundos entre alertas)
        const now = Date.now();
        if (now - lastSoundTimeRef.current > 2000) {
          lastSoundTimeRef.current = now;
          sounds.playSuccess();
          if (typeof navigator !== "undefined" && "vibrate" in navigator) {
            try {
              navigator.vibrate([200, 100, 200]);
            } catch {}
          }
        }

        if (badgeTimeoutRef.current) {
          clearTimeout(badgeTimeoutRef.current);
        }
        setActualizadoEnVivo(true);
        badgeTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            setActualizadoEnVivo(false);
          }
        }, 5000);
      }
    };

    // 1. Canal Supabase Realtime (WebSocket Instantáneo)
    const supabase = createClient();
    const channel = supabase
      .channel(`recibo-live-${ventaInicial.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "ventas",
          filter: `id=eq.${ventaInicial.id}`,
        },
        async (payload: any) => {
          if (!mountedRef.current) return;
          if (payload.new?.estado) {
            notificarCambioEstado(payload.new.estado);
            setVentaActual((prev) => ({
              ...prev,
              estado: payload.new.estado,
              total_usd: Number(payload.new.total_usd ?? prev.total_usd),
              total_bs: Number(payload.new.total_bs ?? prev.total_bs),
              metodo_pago: payload.new.metodo_pago ?? prev.metodo_pago,
              tipo_entrega: payload.new.tipo_entrega ?? prev.tipo_entrega,
            }));
          }
          // Sincronizar todos los datos completos de forma segura
          const res = await obtenerEstadoRecibo(ventaInicial.id);
          if (mountedRef.current && res.ok && res.venta) {
            setVentaActual(res.venta);
          }
        }
      )
      .subscribe();

    // 2. Polling activo de respaldo cada 3.5 segundos (se pausa si la orden ya finalizó)
    const interval = setInterval(async () => {
      if (!mountedRef.current) return;
      if (typeof document !== "undefined" && document.hidden) return;
      if (ultimoEstadoRef.current === "completada" || ultimoEstadoRef.current === "cancelada") {
        return; // Detener polling innecesario en estados terminales
      }

      const res = await obtenerEstadoRecibo(ventaInicial.id);
      if (mountedRef.current && res.ok && res.venta) {
        if (res.venta.estado !== ultimoEstadoRef.current) {
          notificarCambioEstado(res.venta.estado);
        }
        setVentaActual(res.venta);
      }
    }, 3500);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      if (badgeTimeoutRef.current) {
        clearTimeout(badgeTimeoutRef.current);
      }
    };
  }, [ventaInicial.id]);

  const refrescarManual = async () => {
    sounds.playPop();
    setRefrescandoManual(true);
    const res = await obtenerEstadoRecibo(ventaInicial.id);
    if (mountedRef.current && res.ok && res.venta) {
      if (res.venta.estado !== ultimoEstadoRef.current) {
        ultimoEstadoRef.current = res.venta.estado;
        sounds.playSuccess();
      }
      setVentaActual(res.venta);
    }
    setTimeout(() => {
      if (mountedRef.current) setRefrescandoManual(false);
    }, 600);
  };

  const venta = ventaActual;

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

  const stickerEstado = useMemo(() => {
    if (esDelivery && venta.estado === "lista") {
      return "/mascota/stickers/10_delivery_en_camino.png";
    }
    switch (venta.estado) {
      case "completada":
        return "/mascota/stickers/01_celebracion_exito.png";
      case "lista":
        return "/mascota/stickers/09_ojos_corazon_favorito.png";
      case "preparando":
        return "/mascota/stickers/03_delicioso_amor.png";
      case "pendiente":
        return "/mascota/stickers/07_pulgar_arriba_confirmado.png";
      case "cancelada":
        return "/mascota/stickers/08_facepalm_error.png";
      default:
        return "/mascota/stickers/07_pulgar_arriba_confirmado.png";
    }
  }, [venta.estado, esDelivery]);

  const [modalFeedback, setModalFeedback] = useState(false);
  const [calificacion, setCalificacion] = useState<number>(5);
  const [saborComida, setSaborComida] = useState("🔥 ¡Exquisito!");
  const [rapidezServicio, setRapidezServicio] = useState("⚡ Súper rápido");
  const [experienciaWeb, setExperienciaWeb] = useState("📱 Muy fácil y cómodo");
  const [comentarioFeedback, setComentarioFeedback] = useState("");
  const [enviadoFeedback, setEnviadoFeedback] = useState(false);

  const handleCompartirWhatsApp = () => {
    const texto = `🧾 *Recibo de Compra - La Parada del Sabor*\n` +
      `📌 *Comanda:* #${venta.numero_comanda.toString().padStart(4, "0")}\n` +
      `👤 *Cliente:* ${venta.cliente?.nombre || "Cliente Mostrador"}\n` +
      `💰 *Total:* $${Number(venta.total_usd).toFixed(2)} USD / Bs. ${Number(venta.total_bs).toFixed(2)}\n` +
      `🔗 *Ver Detalle & Estado en vivo:* ${reciboUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
  };

  const handleEnviarFeedbackWhatsApp = () => {
    const stars = "⭐".repeat(calificacion);
    const texto = `🌟 *Encuesta de Calidad - La Parada del Sabor*\n` +
      `📌 *Comanda:* #${venta.numero_comanda.toString().padStart(4, "0")}\n` +
      `👤 *Cliente:* ${venta.cliente?.nombre || "Cliente"}\n` +
      `⭐ *Puntuación Global:* ${calificacion}/5 (${stars})\n` +
      `🫓 *Sabor & Calidad:* ${saborComida}\n` +
      `⏱️ *Rapidez de Atención:* ${rapidezServicio}\n` +
      `📱 *Experiencia del Menú Web:* ${experienciaWeb}\n` +
      (comentarioFeedback.trim() ? `💬 *Comentario / Sugerencia:* "${comentarioFeedback.trim()}"\n` : "") +
      `🔗 *Recibo Digital:* ${reciboUrl}`;
    window.open(`https://wa.me/584122595386?text=${encodeURIComponent(texto)}`, "_blank");
    setEnviadoFeedback(true);
  };

  // Stepper dinámico según tipo de entrega
  const pasosEstado = useMemo(() => [
    { key: "pendiente", label: "Por Confirmar", icon: "🟡" },
    { key: "preparando", label: "En Cocina", icon: "🍳" },
    { key: "lista", label: esDelivery ? "En Camino" : "Listo p/ Retirar", icon: esDelivery ? "🛵" : "🛍️" },
    { key: "completada", label: esDelivery ? "Entregado" : "Retirado", icon: "✅" },
  ], [esDelivery]);

  const pasoIndexActual = useMemo(() => {
    switch (venta.estado) {
      case "pendiente": return 0;
      case "preparando": return 1;
      case "lista": return 2;
      case "completada": return 3;
      default: return 0;
    }
  }, [venta.estado]);

  return (
    <div className="recibo-page-wrapper">
      {/* Barra de Navegación Simple para Clientes */}
      <header className="recibo-top-banner no-print">
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
            onClick={refrescarManual}
            disabled={refrescandoManual}
            className="recibo-btn-pill"
            title="Actualizar estado del pedido"
          >
            🔄 <span>{refrescandoManual ? "Actualizando..." : "Actualizar"}</span>
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
        {/* Banner de Estado Pendiente en el Top */}
        {venta.estado === "pendiente" && ["pago_movil", "pago_movil_bs", "transferencia", "binance", "binance_usdt", "zelle"].includes(venta.metodo_pago) && (
          <div
            className="no-print"
            style={{
              background: "linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(234, 88, 12, 0.1))",
              border: "1.5px solid #f59e0b",
              borderRadius: 16,
              padding: "14px 18px",
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 12,
              boxShadow: "0 4px 16px rgba(245, 158, 11, 0.15)",
            }}
          >
            <span style={{ fontSize: 24, lineHeight: 1 }}>📌</span>
            <div>
              <strong style={{ fontSize: 13.5, color: "var(--text)", display: "block" }}>
                ¡Orden #{venta.numero_comanda.toString().padStart(4, "0")} Registrada!
              </strong>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", fontWeight: 600, lineHeight: 1.35 }}>
                Verifica tu factura abajo, realiza tu transferencia y toca el botón verde para adjuntar tu comprobante por WhatsApp.
              </p>
            </div>
          </div>
        )}

        <div className="recibo-ticket-card">
          {/* Mancha de Salsa Gourmet Realista */}
          <div className="salsa-stain-decor" aria-hidden="true">
            <Image
              src="/images/mancha-salsa.webp"
              alt="Mancha de salsa gourmet"
              width={140}
              height={152}
              className="salsa-stain-img"
              unoptimized
            />
          </div>

          {/* Sello Gourmet Oficial */}
          <div className="sello-gourmet-badge" aria-hidden="true">
            <span>AUTÉNTICO</span>
            <strong>SABOR</strong>
          </div>

          {/* Encabezado del Recibo con Logotipo Horizontal Oficial */}
          <div className="recibo-header">
            <div className="recibo-hero-horizontal-logo-wrap">
              <Image
                src="/images/logo-horizontal.png"
                alt="La Parada del Sabor"
                width={190}
                height={55}
                className="recibo-hero-horizontal-logo logo-light-only"
                priority
                style={{ objectFit: "contain", height: "48px", width: "auto" }}
              />
              <Image
                src="/images/logo-horizontal-dark.png"
                alt="La Parada del Sabor"
                width={190}
                height={55}
                className="recibo-hero-horizontal-logo logo-dark-only"
                priority
                style={{ objectFit: "contain", height: "48px", width: "auto" }}
              />
            </div>
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
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: "#22c55e",
                    boxShadow: "0 0 8px #22c55e",
                    animation: "pulse 2s infinite",
                  }}
                />
                <span>En Vivo • Auto-actualizable</span>
              </div>

              {actualizadoEnVivo && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: "#ffffff",
                    background: "#22c55e",
                    padding: "2px 6px",
                    borderRadius: 6,
                    animation: "bounce 0.4s ease",
                  }}
                >
                  🔔 ¡Estado Actualizado!
                </span>
              )}
            </div>

            <div className="recibo-status-head" style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Image
                src={stickerEstado}
                alt="Estado de Orden"
                width={56}
                height={56}
                style={{ filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.12))", flexShrink: 0, objectFit: "contain" }}
              />
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

            {Number(venta.delivery_monto_usd || 0) > 0 && (
              <div className="recibo-total-line" style={{ color: "var(--primary)" }}>
                <span>🛵 Delivery ({venta.delivery_zona_nombre || "Sector"}):</span>
                <strong>
                  +${Number(venta.delivery_monto_usd).toFixed(2)} USD • Bs. {Number(venta.delivery_monto_bs || (Number(venta.delivery_monto_usd) * Number(venta.tasa_bcv))).toFixed(2)}
                </strong>
              </div>
            )}

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

        {/* ==============================================================================
            CENTRO DE PAGO Y CONFIRMACIÓN GOURMET (FLUJO LINEAL GUIADO)
            ============================================================================== */}
        <div className="no-print" style={{ marginTop: 20 }}>
          {/* Banner de Estado del Pedido (cuando no está pendiente) */}
          {venta.estado === "cancelada" ? (
            <div
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                border: "1.5px solid #ef4444",
                borderRadius: 20,
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginBottom: 16,
              }}
            >
              <span style={{ fontSize: 32 }}>❌</span>
              <div>
                <strong style={{ fontSize: 15, color: "#dc2626", display: "block", marginBottom: 2 }}>
                  Pedido Cancelado
                </strong>
                <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
                  Esta comanda fue cancelada en el sistema. Si requieres asistencia, comunícate con nosotros por WhatsApp.
                </p>
              </div>
            </div>
          ) : venta.estado === "completada" ? (
            <div
              style={{
                background: "rgba(34, 197, 94, 0.1)",
                border: "1.5px solid #22c55e",
                borderRadius: 20,
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginBottom: 16,
              }}
            >
              <span style={{ fontSize: 32 }}>🎉</span>
              <div>
                <strong style={{ fontSize: 15, color: "#15803d", display: "block", marginBottom: 2 }}>
                  ¡Pedido Entregado y Completado!
                </strong>
                <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
                  ¡Esperamos que lo disfrutes al máximo! Gracias por preferir el auténtico sabor de La Parada del Sabor.
                </p>
              </div>
            </div>
          ) : venta.estado !== "pendiente" ? (
            <div
              style={{
                background: "rgba(34, 197, 94, 0.1)",
                border: "1.5px solid #22c55e",
                borderRadius: 20,
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginBottom: 16,
              }}
            >
              <span style={{ fontSize: 32 }}>{venta.estado === "lista" ? "🛵" : "🍳"}</span>
              <div>
                <strong style={{ fontSize: 15, color: "#15803d", display: "block", marginBottom: 2 }}>
                  {venta.estado === "lista" ? "¡Tu Pedido está Listo!" : "¡Pago Verificado & Pedido en Cocina!"}
                </strong>
                <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
                  {venta.estado === "lista"
                    ? `Tu comanda #${venta.numero_comanda.toString().padStart(4, "0")} está lista para su entrega.`
                    : `Tu comanda #${venta.numero_comanda.toString().padStart(4, "0")} está siendo preparada con ingredientes frescos.`}
                </p>
              </div>
            </div>
          ) : null}

          {/* Tarjeta de Datos de Pago (Siempre visible como respaldo financiero del cliente) */}
          <div
            style={{
              background: "var(--bg-card)",
              border: "1.5px solid var(--border)",
              borderRadius: 22,
              padding: "22px 18px",
              boxShadow: "0 14px 35px -8px rgba(0,0,0,0.15)",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {/* Encabezado: Datos de Pago Oficiales */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 900,
                    background: "var(--primary-light)",
                    color: "var(--primary-dark)",
                    padding: "3px 10px",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    letterSpacing: 0.5,
                  }}
                >
                  {venta.estado === "pendiente" ? "PASO 1 DE 2" : "DATOS DE PAGO"}
                </span>
                <span style={{ fontSize: 14, fontWeight: 900, color: "var(--text)" }}>
                  💳 Datos para Pagar
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
                {venta.estado === "pendiente"
                  ? "Transfiere el monto exacto mediante los datos oficiales de abajo:"
                  : "Datos oficiales de la cuenta asignada a esta factura:"}
              </p>
            </div>

              {/* 1. Datos de Pago Móvil BFC */}
              {(venta.metodo_pago === "pago_movil" || venta.metodo_pago === "pago_movil_bs") && (
                <div className="recibo-pm-card" style={{ margin: 0 }}>
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

              {/* 2. Datos de Transferencia Bancaria BFC */}
              {venta.metodo_pago === "transferencia" && (
                <div className="recibo-pm-card" style={{ margin: 0 }}>
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

              {/* 3. Datos de Binance Pay USDT */}
              {(venta.metodo_pago === "binance" || venta.metodo_pago === "binance_usdt") && (
                <div className="recibo-pm-card" style={{ margin: 0, borderLeftColor: "#F3BA2F" }}>
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

              {/* 4. Datos de Zelle */}
              {venta.metodo_pago === "zelle" && (
                <div className="recibo-pm-card" style={{ margin: 0, borderLeftColor: "#7414CA" }}>
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

              {/* Paso 2: Reportar Comprobante por WhatsApp */}
              {["pago_movil", "pago_movil_bs", "transferencia", "binance", "binance_usdt", "zelle"].includes(venta.metodo_pago) ? (() => {
                const tieneGps = Boolean(venta.cliente?.direccion_delivery?.includes("maps.google.com"));
                const requiereUbicacionWa = venta.tipo_entrega === "delivery" && !tieneGps;

                return (
                  <div
                    style={{
                      borderTop: "1.5px dashed var(--border)",
                      paddingTop: 18,
                      marginTop: 4,
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                      background: "rgba(37, 211, 102, 0.06)",
                      padding: "18px 16px",
                      borderRadius: 18,
                      border: "1.5px solid rgba(37, 211, 102, 0.35)",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 900,
                            background: "#25D366",
                            color: "#ffffff",
                            padding: "3px 10px",
                            borderRadius: 12,
                            letterSpacing: 0.5,
                            boxShadow: "0 2px 8px rgba(37, 211, 102, 0.4)",
                          }}
                        >
                          ⚡ PASO FINAL INDISPENSABLE
                        </span>
                      </div>
                      <h4 style={{ margin: "4px 0 2px 0", fontSize: 15, fontWeight: 900, color: "var(--text)" }}>
                        📲 Envía tu Comprobante a Cocina
                      </h4>
                      <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", fontWeight: 600, lineHeight: 1.4 }}>
                        Toca el botón verde abajo para abrir WhatsApp con tu Comanda #{venta.numero_comanda.toString().padStart(4, "0")} ya vinculada para adjuntar tu comprobante de pago{requiereUbicacionWa ? " y compartir tu ubicación en tiempo real" : ""}:
                      </p>
                    </div>

                    <a
                      href={`https://wa.me/584122595386?text=${encodeURIComponent(
                        `¡Hola La Parada del Sabor! 🫓 Acabo de registrar mi pedido #${venta.numero_comanda.toString().padStart(4, "0")} por la web ($${Number(venta.total_usd).toFixed(2)} USD / Bs. ${Number(venta.total_bs).toFixed(2)}).\n\nAdjunto mi comprobante de pago${requiereUbicacionWa ? " y mi ubicación para el repartidor" : ""}.\n\n🔗 Factura digital & estado en vivo:\n${reciboUrl}`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)",
                        color: "#ffffff",
                        padding: "16px 20px",
                        borderRadius: 16,
                        fontWeight: 900,
                        fontSize: 15,
                        textDecoration: "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 10,
                        boxShadow: "0 8px 24px rgba(37, 211, 102, 0.4)",
                        textAlign: "center",
                      }}
                    >
                      <span>💬 Enviar Comprobante {requiereUbicacionWa ? "+ Ubicación " : ""}al WhatsApp</span>
                    </a>
                    {requiereUbicacionWa && (
                      <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--text-muted)", textAlign: "center", fontWeight: 600 }}>
                        💡 <em>Tip: En el chat de WhatsApp puedes tocar el clip 📎 y seleccionar <strong>Ubicación</strong> para que el repartidor llegue directo a tu puerta.</em>
                      </div>
                    )}
                  </div>
                );
              })() : (
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, textAlign: "center" }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#16a34a" }}>
                    💵 ¡Tu orden está registrada en caja! Por favor ten a mano el monto exacto (${Number(venta.total_usd).toFixed(2)} USD / Bs. ${Number(venta.total_bs).toFixed(2)}) al recibir o retirar tu pedido.
                  </p>
                </div>
              )}
            </div>
          </div>

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
            onClick={() => setModalFeedback(true)}
            className="recibo-btn-secondary"
            style={{
              background: "linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(234, 88, 12, 0.12))",
              borderColor: "#f59e0b",
              color: "var(--text)",
              fontWeight: 800,
            }}
          >
            <span>⭐ Dejar Opinión / Feedback</span>
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

      {/* Modal Interactivo de Feedback / Calificación del Cliente */}
      {modalFeedback && (
        <div className="modal-overlay" onClick={() => setModalFeedback(false)}>
          <div className="modal-recipe-card" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-recipe-header">
              <h2>⭐ Tu Opinión nos Importa</h2>
              <button
                type="button"
                onClick={() => setModalFeedback(false)}
                className="btn-modal-close"
              >
                ✕
              </button>
            </div>

            {enviadoFeedback ? (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <span style={{ fontSize: 48 }}>🎉</span>
                <h3 style={{ margin: "10px 0 6px", fontSize: 18, fontWeight: 800 }}>¡Muchas Gracias por tu Feedback!</h3>
                <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                  Tus comentarios nos ayudan a seguir preparando las mejores arepas gourmet de la ciudad.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setModalFeedback(false);
                    setEnviadoFeedback(false);
                  }}
                  className="btn-primary-action"
                  style={{ marginTop: 14 }}
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
                  ¿Cómo estuvo tu experiencia y el sabor de tu comida en la comanda #{venta.numero_comanda.toString().padStart(4, "0")}?
                </p>

                {/* Selector de Estrellas */}
                <div style={{ display: "flex", justifyContent: "center", gap: 10, padding: "4px 0" }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setCalificacion(star)}
                      style={{
                        background: "transparent",
                        border: "none",
                        fontSize: 32,
                        cursor: "pointer",
                        filter: star <= calificacion ? "grayscale(0%)" : "grayscale(100%) opacity(30%)",
                        transition: "transform 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.2)")}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                    >
                      ⭐
                    </button>
                  ))}
                </div>

                <div style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: "#d97706" }}>
                  {calificacion === 5 && "🌟 ¡Excelente sabor y atención!"}
                  {calificacion === 4 && "👍 Muy bueno todo"}
                  {calificacion === 3 && "👌 Sabor aceptable / Regular"}
                  {calificacion === 2 && "⚠️ Por mejorar"}
                  {calificacion === 1 && "❌ Tuve inconvenientes"}
                </div>

                {/* Pregunta 1: Sabor & Calidad */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text)" }}>
                    🫓 1. ¿Cómo estuvo el sabor y la comida?
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {["🔥 ¡Exquisito!", "👌 Muy bueno", "🙂 Normal", "⚠️ Mejorable"].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setSaborComida(opt)}
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "5px 10px",
                          borderRadius: 8,
                          border: saborComida === opt ? "1px solid var(--primary)" : "1px solid var(--border)",
                          background: saborComida === opt ? "rgba(249, 115, 22, 0.12)" : "var(--bg-subtle)",
                          color: saborComida === opt ? "var(--primary-dark)" : "var(--text-muted)",
                          cursor: "pointer",
                        }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pregunta 2: Rapidez del Servicio */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text)" }}>
                    ⚡ 2. ¿Qué tal el tiempo de preparación / entrega?
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {["⚡ Súper rápido", "⏱️ A tiempo", "⏳ Tardó un poco", "🐢 Muy demorado"].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setRapidezServicio(opt)}
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "5px 10px",
                          borderRadius: 8,
                          border: rapidezServicio === opt ? "1px solid var(--primary)" : "1px solid var(--border)",
                          background: rapidezServicio === opt ? "rgba(249, 115, 22, 0.12)" : "var(--bg-subtle)",
                          color: rapidezServicio === opt ? "var(--primary-dark)" : "var(--text-muted)",
                          cursor: "pointer",
                        }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pregunta 3: Experiencia Web */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text)" }}>
                    📱 3. ¿Fue fácil hacer el pedido por la web?
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {["📱 Muy fácil y cómodo", "👍 Bien", "🤔 Difícil de usar"].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setExperienciaWeb(opt)}
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "5px 10px",
                          borderRadius: 8,
                          border: experienciaWeb === opt ? "1px solid var(--primary)" : "1px solid var(--border)",
                          background: experienciaWeb === opt ? "rgba(249, 115, 22, 0.12)" : "var(--bg-subtle)",
                          color: experienciaWeb === opt ? "var(--primary-dark)" : "var(--text-muted)",
                          cursor: "pointer",
                        }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Comentario Opcional */}
                <div className="form-field">
                  <label style={{ fontSize: 12, fontWeight: 800 }}>💬 Comentario o Sugerencia (Opcional):</label>
                  <textarea
                    rows={2}
                    placeholder="¿Algún plato o ingrediente que te gustaría ver en el menú? ¿Algo que podamos mejorar?"
                    value={comentarioFeedback}
                    onChange={(e) => setComentarioFeedback(e.target.value)}
                    style={{
                      width: "100%",
                      borderRadius: 10,
                      padding: "8px 10px",
                      border: "1px solid var(--border)",
                      background: "var(--bg-subtle)",
                      color: "var(--text)",
                      fontSize: 12,
                      resize: "none",
                    }}
                  />
                </div>

                <div className="form-actions" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button
                    type="button"
                    onClick={handleEnviarFeedbackWhatsApp}
                    className="btn-primary-action"
                    style={{
                      background: "#25D366",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      fontSize: 14,
                      fontWeight: 800,
                    }}
                  >
                    💬 Enviar Encuesta a Gerencia (WhatsApp)
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalFeedback(false)}
                    className="btn-cancel"
                    style={{ textAlign: "center" }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
