"use client";

import { useState, useMemo } from "react";
import { Venta } from "@/types/database";
import { cambiarEstadoVenta } from "./actions";

interface VentasClientProps {
  ventas: Venta[];
}

export default function VentasClient({ ventas }: VentasClientProps) {
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [procesandoId, setProcesandoId] = useState<string | null>(null);

  const ventasFiltradas = useMemo(() => {
    if (filtroEstado === "todos") return ventas;
    return ventas.filter((v) => v.estado === filtroEstado);
  }, [ventas, filtroEstado]);

  const totalVentasUsd = useMemo(() => {
    return ventas
      .filter((v) => v.estado === "preparando" || v.estado === "lista" || v.estado === "completada")
      .reduce((acc, v) => acc + Number(v.total_usd), 0);
  }, [ventas]);

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

      {/* Lista de Comandas */}
      <div className="comandas-grid">
        {ventasFiltradas.length === 0 ? (
          <div className="recetas-empty-box">
            <span style={{ fontSize: 48 }}>📋</span>
            <h3>No hay comandas con este filtro</h3>
            <p>Las ventas realizadas desde el POS y la web aparecerán aquí al instante.</p>
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

                  <div className="comanda-type-row">
                    <span className="comanda-badge-type">{v.tipo_entrega.toUpperCase()}</span>
                    <span className="comanda-badge-payment">
                      {v.metodo_pago.replace("_", " ").toUpperCase()}
                    </span>
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
                      <button
                        type="button"
                        disabled={procesandoId === v.id}
                        onClick={() => handleCambiarEstado(v.id, "preparando")}
                        className="btn-comanda-complete"
                        style={{ background: "#f97316" }}
                      >
                        {procesandoId === v.id ? "Procesando..." : "🍳 Confirmar & Enviar a Cocina"}
                      </button>
                    )}

                    {/* 2. Si está en Cocina (Preparando) */}
                    {v.estado === "preparando" && (
                      <div style={{ display: "flex", gap: 6, width: "100%" }}>
                        <button
                          type="button"
                          disabled={procesandoId === v.id}
                          onClick={() => handleCambiarEstado(v.id, "lista")}
                          className="btn-comanda-complete"
                          style={{ background: "#3b82f6" }}
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
                      </div>
                    )}

                    {/* 3. Si está Lista */}
                    {v.estado === "lista" && (
                      <button
                        type="button"
                        disabled={procesandoId === v.id}
                        onClick={() => handleCambiarEstado(v.id, "completada")}
                        className="btn-comanda-complete"
                      >
                        {procesandoId === v.id ? "Procesando..." : "✅ Marcar Entregada"}
                      </button>
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
