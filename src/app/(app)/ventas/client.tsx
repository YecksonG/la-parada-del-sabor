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
      .filter((v) => v.estado !== "cancelada")
      .reduce((acc, v) => acc + Number(v.total_usd), 0);
  }, [ventas]);

  const handleCambiarEstado = async (
    ventaId: string,
    nuevoEstado: "preparando" | "completada" | "cancelada"
  ) => {
    setProcesandoId(ventaId);
    await cambiarEstadoVenta(ventaId, nuevoEstado);
    setProcesandoId(null);
  };

  return (
    <main className="recetas-container">
      {/* Header */}
      <div className="recetas-header">
        <div>
          <h1 className="recetas-title">📋 Comandas & Historial de Ventas</h1>
          <p className="recetas-subtitle">
            Monitoreo en tiempo real. Total facturado activo:{" "}
            <strong className="text-primary">${totalVentasUsd.toFixed(2)} USD</strong>
          </p>
        </div>

        {/* Filtros de Estado */}
        <div className="pos-category-pills">
          {[
            { id: "todos", label: "Todas", icon: "📋" },
            { id: "preparando", label: "En Cocina", icon: "🍳" },
            { id: "completada", label: "Completadas", icon: "✅" },
            { id: "cancelada", label: "Canceladas", icon: "❌" },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltroEstado(f.id)}
              className={`cat-pill ${filtroEstado === f.id ? "cat-pill-active" : ""}`}
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
            <h3>No hay comandas registradas</h3>
            <p>Las ventas realizadas desde el POS aparecerán aquí al instante.</p>
          </div>
        ) : (
          ventasFiltradas.map((v) => {
            const fechaStr = new Date(v.fecha).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div key={v.id} className={`comanda-card comanda-${v.estado}`}>
                <div className="comanda-card-header">
                  <div>
                    <span className="comanda-number">#{v.numero_comanda}</span>
                    <span className="comanda-time">🕒 {fechaStr}</span>
                  </div>
                  <span className={`comanda-status-pill status-${v.estado}`}>
                    {v.estado === "preparando"
                      ? "🍳 En Cocina"
                      : v.estado === "completada"
                      ? "✅ Entregada"
                      : "❌ Cancelada"}
                  </span>
                </div>

                <div className="comanda-type-row">
                  <span className="comanda-badge-type">{v.tipo_entrega.toUpperCase()}</span>
                  <span className="comanda-badge-payment">
                    {v.metodo_pago.replace("_", " ").toUpperCase()}
                  </span>
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
                    </div>
                  ))}
                </div>

                {v.notas_comanda && (
                  <div className="comanda-notes-box">
                    <span>📝 {v.notas_comanda}</span>
                  </div>
                )}

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
                  {v.estado === "preparando" && (
                    <button
                      type="button"
                      disabled={procesandoId === v.id}
                      onClick={() => handleCambiarEstado(v.id, "completada")}
                      className="btn-comanda-complete"
                    >
                      ✅ Marcar Entregada
                    </button>
                  )}
                  {v.estado !== "cancelada" && (
                    <button
                      type="button"
                      disabled={procesandoId === v.id}
                      onClick={() => handleCambiarEstado(v.id, "cancelada")}
                      className="btn-comanda-cancel"
                      title="Cancelar comanda y devolver insumos al stock"
                    >
                      ❌ Cancelar & Devolver Stock
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
            );
          })
        )}
      </div>
    </main>
  );
}
