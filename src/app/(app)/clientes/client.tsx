"use client";

import { useState, useEffect, useMemo } from "react";
import { Cliente, Venta, MetodoPago, EstadoVenta } from "@/types/database";
import { guardarCliente, eliminarCliente } from "./actions";
import { sounds } from "@/lib/sound-effects";

interface ClientesClientProps {
  clientes: Cliente[];
  ventas?: Venta[];
}

function getEstadoBadge(estado: EstadoVenta) {
  switch (estado) {
    case "completada":
      return { label: "Entregada", icon: "✅", bg: "rgba(34, 197, 94, 0.15)", color: "#16a34a" };
    case "lista":
      return { label: "Lista / En Camino", icon: "🛵", bg: "rgba(59, 130, 246, 0.15)", color: "#2563eb" };
    case "preparando":
      return { label: "En Cocina", icon: "🍳", bg: "rgba(245, 158, 11, 0.15)", color: "#d97706" };
    case "pendiente":
      return { label: "Pendiente", icon: "🟡", bg: "rgba(234, 179, 8, 0.15)", color: "#ca8a04" };
    case "cancelada":
      return { label: "Cancelada", icon: "❌", bg: "rgba(239, 68, 68, 0.15)", color: "#dc2626" };
    default:
      return { label: estado, icon: "📋", bg: "var(--bg-subtle)", color: "var(--text)" };
  }
}

function getMetodoBadge(metodo?: MetodoPago | string | null) {
  switch (metodo) {
    case "efectivo_usd":
    case "efectivo":
      return { label: "Efectivo USD", icon: "💵" };
    case "efectivo_bs":
      return { label: "Efectivo Bs", icon: "🇻🇪" };
    case "pago_movil":
    case "pago_movil_bs":
      return { label: "Pago Móvil", icon: "📱" };
    case "punto":
    case "punto_bs":
    case "pos":
      return { label: "Punto / POS", icon: "💳" };
    case "transferencia":
    case "transferencia_bs":
      return { label: "Transferencia", icon: "🏦" };
    case "binance":
    case "binance_usdt":
      return { label: "Binance", icon: "🟡" };
    case "zelle":
      return { label: "Zelle", icon: "🟣" };
    case "pago_mixto":
      return { label: "Pago Mixto", icon: "🔀" };
    default:
      return { label: metodo || "No especificado", icon: "💳" };
  }
}

export default function ClientesClient({ clientes, ventas = [] }: ClientesClientProps) {
  const [listaClientes, setListaClientes] = useState<Cliente[]>(clientes);
  const [modoVista, setModoVista] = useState<"grid" | "filas">("grid");
  const [busqueda, setBusqueda] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);

  // Estado para modal de confirmación de eliminación
  const [clienteAEliminar, setClienteAEliminar] = useState<Cliente | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

  // Sincronizar clientes cuando cambian las props
  useEffect(() => {
    setListaClientes(clientes);
  }, [clientes]);

  // Cargar preferencia guardada al montar
  useEffect(() => {
    const saved = localStorage.getItem("vista_clientes");
    if (saved === "grid" || saved === "filas") {
      setModoVista(saved);
    }
  }, []);

  const cambiarModoVista = (modo: "grid" | "filas") => {
    sounds.playPop();
    setModoVista(modo);
    if (typeof window !== "undefined") {
      localStorage.setItem("vista_clientes", modo);
    }
  };

  // Form states
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [notas, setNotas] = useState("");

  const abrirCrear = () => {
    sounds.playPop();
    setClienteSeleccionado(null);
    setNombre("");
    setTelefono("");
    setDireccion("");
    setNotas("");
    setModalAbierto(true);
  };

  const [modalHistorial, setModalHistorial] = useState(false);
  const [clienteHistorial, setClienteHistorial] = useState<Cliente | null>(null);
  const [tabModalCliente, setTabModalCliente] = useState<"ventas" | "perfil">("ventas");

  const abrirHistorial = (c: Cliente, tabInicial: "ventas" | "perfil" = "perfil") => {
    sounds.playPop();
    setClienteHistorial(c);
    setTabModalCliente(tabInicial);
    setModalHistorial(true);
  };

  const abrirEditar = (c: Cliente) => {
    sounds.playPop();
    setClienteSeleccionado(c);
    setNombre(c.nombre);
    setTelefono(c.telefono || "");
    setDireccion(c.direccion_delivery || "");
    setNotas(c.notas_preferencias || "");
    setModalAbierto(true);
  };

  const pedirConfirmacionEliminar = (c: Cliente) => {
    sounds.playPop();
    setErrorEliminar(null);
    setClienteAEliminar(c);
  };

  const ejecutarEliminar = async () => {
    if (!clienteAEliminar || eliminando) return;

    setEliminando(true);
    setErrorEliminar(null);
    const targetId = clienteAEliminar.id;
    const res = await eliminarCliente(targetId);
    setEliminando(false);

    if (res.ok) {
      sounds.playDelete();
      setListaClientes((prev) => prev.filter((c) => c.id !== targetId));
      setClienteAEliminar(null);
      setModalAbierto(false);
      setModalHistorial(false);
    } else {
      setErrorEliminar(res.error || "No se pudo eliminar el cliente.");
    }
  };

  const clientesFiltrados = useMemo(() => {
    return listaClientes.filter(
      (c) =>
        c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        c.telefono?.includes(busqueda) ||
        c.direccion_delivery?.toLowerCase().includes(busqueda.toLowerCase())
    );
  }, [listaClientes, busqueda]);

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || guardando) return;

    setGuardando(true);
    const res = await guardarCliente({
      id: clienteSeleccionado?.id,
      nombre,
      telefono,
      direccion_delivery: direccion,
      notas_preferencias: notas,
    });
    setGuardando(false);

    if (res.ok) {
      sounds.playKitchenBell();
      setModalAbierto(false);
    } else {
      alert(res.error || "Error al guardar cliente.");
    }
  };

  return (
    <main className="recetas-container">
      <div className="recetas-header">
        <div>
          <h1 className="recetas-title">👥 Directorio de Clientes & Delivery</h1>
          <p className="recetas-subtitle">
            Gestión de clientes habituales, direcciones para reparto y preferencias culinarias.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Toggle de Vista: Cuadros vs Filas */}
          <div className="view-mode-toggle">
            <button
              type="button"
              onClick={() => cambiarModoVista("grid")}
              className={`view-mode-btn ${modoVista === "grid" ? "active" : ""}`}
              title="Vista en Tarjetas / Cuadros"
            >
              ⊞ Cuadros
            </button>
            <button
              type="button"
              onClick={() => cambiarModoVista("filas")}
              className={`view-mode-btn ${modoVista === "filas" ? "active" : ""}`}
              title="Vista en Filas / Lista Detallada"
            >
              ☰ Filas
            </button>
          </div>

          <button type="button" onClick={abrirCrear} className="btn-primary-action">
            <span>+</span> Nuevo Cliente
          </button>
        </div>
      </div>

      <div className="search-input-wrapper">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          placeholder="Buscar por nombre, teléfono o dirección..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="pos-search-input"
        />
        {busqueda && (
          <button type="button" onClick={() => setBusqueda("")} className="btn-clear-search">
            ✕
          </button>
        )}
      </div>

      {clientesFiltrados.length === 0 ? (
        <div className="recetas-empty-box">
          <span style={{ fontSize: 48 }}>👥</span>
          <h3>No se encontraron clientes</h3>
          <p>Registra tus clientes de confianza para agilizar comandas y deliveries.</p>
        </div>
      ) : modoVista === "grid" ? (
        /* VISTA 1: CUADROS / GRID */
        <div className="insumos-grid">
          {clientesFiltrados.map((c) => (
            <div key={c.id} className="insumo-card">
              <div className="insumo-card-header">
                <h3 className="insumo-name">👤 {c.nombre}</h3>
                <span className="badge-ticket">{c.total_pedidos} Pedidos</span>
              </div>

              {c.telefono && (
                <p style={{ fontSize: 13, color: "var(--text)" }}>📞 {c.telefono}</p>
              )}

              {c.direccion_delivery && (
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  🛵 {c.direccion_delivery}
                </p>
              )}

              {c.notas_preferencias && (
                <div className="comanda-notes-box">
                  <span>⭐ {c.notas_preferencias}</span>
                </div>
              )}

              <div className="insumo-card-footer" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => abrirHistorial(c, "ventas")}
                  className="btn-insumo-adjust"
                  style={{ background: "rgba(248, 197, 66, 0.15)", borderColor: "var(--primary)", color: "var(--primary-dark)", fontWeight: 700 }}
                  title="Ver historial de ventas de este cliente"
                >
                  🛍️ Ventas
                </button>
                <button
                  type="button"
                  onClick={() => abrirHistorial(c, "perfil")}
                  className="btn-insumo-adjust"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                  title="Ver perfil completo del cliente"
                >
                  👤 Perfil
                </button>
                <button
                  type="button"
                  onClick={() => abrirEditar(c)}
                  className="btn-insumo-adjust"
                >
                  ✏️ Editar
                </button>
                <button
                  type="button"
                  onClick={() => pedirConfirmacionEliminar(c)}
                  className="btn-insumo-adjust"
                  style={{ color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.3)" }}
                  title="Eliminar cliente"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* VISTA 2: FILAS / LISTA DETALLADA (TODO COMPLETO) */
        <div className="table-responsive-wrapper">
          <table className="custom-detailed-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Teléfono / WhatsApp</th>
                <th>Dirección Delivery</th>
                <th>Pedidos Totales</th>
                <th>Preferencias Culinarias / Notas</th>
                <th style={{ textAlign: "right" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clientesFiltrados.map((c) => (
                <tr key={c.id} className="detailed-table-row">
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 20 }}>👤</span>
                      <strong style={{ fontSize: 14, color: "var(--text)" }}>{c.nombre}</strong>
                    </div>
                  </td>
                  <td>
                    {c.telefono ? (
                      <span style={{ fontSize: 13, fontWeight: 700 }}>
                        📞 {c.telefono}
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>
                    )}
                  </td>
                  <td style={{ maxWidth: 220, fontSize: 12 }}>
                    {c.direccion_delivery ? (
                      <span>🛵 {c.direccion_delivery}</span>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>—</span>
                    )}
                  </td>
                  <td>
                    <span className="badge-ticket" style={{ fontSize: 12 }}>
                      {c.total_pedidos} Pedidos
                    </span>
                  </td>
                  <td style={{ maxWidth: 250, fontSize: 12 }}>
                    {c.notas_preferencias ? (
                      <span style={{ color: "var(--primary-dark)", fontWeight: 600 }}>
                        ⭐ {c.notas_preferencias}
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>Sin notas especiales</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => abrirHistorial(c, "ventas")}
                        className="btn-insumo-adjust"
                        style={{ padding: "5px 10px", fontSize: 12, background: "rgba(248, 197, 66, 0.15)", borderColor: "var(--primary)", color: "var(--primary-dark)", fontWeight: 700 }}
                        title="Ver registro y detalle de ventas de este cliente"
                      >
                        🛍️ Ventas
                      </button>
                      <button
                        type="button"
                        onClick={() => abrirHistorial(c, "perfil")}
                        className="btn-insumo-adjust"
                        style={{ padding: "5px 10px", fontSize: 12, background: "var(--surface)", border: "1px solid var(--border)" }}
                        title="Ver perfil completo del cliente"
                      >
                        👤 Perfil
                      </button>
                      <button
                        type="button"
                        onClick={() => abrirEditar(c)}
                        className="btn-insumo-adjust"
                        style={{ padding: "5px 12px", fontSize: 12 }}
                      >
                        ✏️ Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => pedirConfirmacionEliminar(c)}
                        className="btn-insumo-adjust"
                        style={{ padding: "5px 10px", fontSize: 12, color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.3)" }}
                        title="Eliminar cliente"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalAbierto && (
        <div className="modal-overlay">
          <div className="modal-recipe-card" style={{ maxWidth: 460 }}>
            <div className="modal-recipe-header">
              <h2>{clienteSeleccionado ? "Editar Cliente" : "Nuevo Cliente"}</h2>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="btn-modal-close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGuardar} className="recipe-form">
              <div className="form-field">
                <label>Nombre y Apellido</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Carlos Mendoza"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-field">
                <label>Teléfono / WhatsApp</label>
                <input
                  type="text"
                  placeholder="0414-1234567"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-field">
                <label>Dirección de Entrega / Delivery</label>
                <input
                  type="text"
                  placeholder="Calle principal, casa #12, frente a la plaza"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-field">
                <label>Preferencias y Notas</label>
                <input
                  type="text"
                  placeholder="Ej. Le gusta la arepa bien tostada y sin mayonesa"
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="modal-recipe-actions" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {clienteSeleccionado ? (
                  <button
                    type="button"
                    onClick={() => {
                      setModalAbierto(false);
                      pedirConfirmacionEliminar(clienteSeleccionado);
                    }}
                    className="btn-cancel"
                    style={{ color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.4)" }}
                  >
                    🗑️ Eliminar
                  </button>
                ) : (
                  <div></div>
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setModalAbierto(false)}
                    className="btn-cancel"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={guardando}
                    className="btn-submit-recipe"
                  >
                    {guardando ? "Guardando..." : "💾 Guardar Cliente"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Perfil & Historial de Ventas del Cliente */}
      {modalHistorial && clienteHistorial && (() => {
        const ventasCliente = ventas.filter((v) => v.cliente_id === clienteHistorial.id);
        const totalGastadoUsd = ventasCliente
          .filter((v) => v.estado !== "cancelada")
          .reduce((acc, v) => acc + (Number(v.total_usd) || 0), 0);

        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Perfil y Registro de Ventas del Cliente"
            className="modal-overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget) setModalHistorial(false);
            }}
          >
            <div className="modal-recipe-card" style={{ maxWidth: 640, width: "95%", maxHeight: "90vh", overflowY: "auto", borderRadius: 20 }}>
              <div className="modal-recipe-header" style={{ paddingBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 28 }}>👤</span>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 18, color: "var(--text)" }}>{clienteHistorial.nombre}</h2>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
                      {clienteHistorial.telefono || "Sin teléfono"} • {ventasCliente.length} Comandas registradas
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModalHistorial(false)}
                  className="btn-modal-close"
                  aria-label="Cerrar modal"
                >
                  ✕
                </button>
              </div>

              {/* Selector de Pestañas: Registro de Ventas vs Perfil */}
              <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border)", padding: "4px 0 10px", marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setTabModalCliente("ventas")}
                  className={`cat-pill ${tabModalCliente === "ventas" ? "cat-pill-active" : ""}`}
                  style={{
                    fontSize: 12.5,
                    padding: "6px 14px",
                    fontWeight: 800,
                    borderRadius: 9999,
                    cursor: "pointer",
                  }}
                >
                  🛍️ Registro de Ventas ({ventasCliente.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTabModalCliente("perfil")}
                  className={`cat-pill ${tabModalCliente === "perfil" ? "cat-pill-active" : ""}`}
                  style={{
                    fontSize: 12.5,
                    padding: "6px 14px",
                    fontWeight: 800,
                    borderRadius: 9999,
                    cursor: "pointer",
                  }}
                >
                  👤 Datos de Perfil & Delivery
                </button>
              </div>

              {tabModalCliente === "ventas" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "14px 0" }}>
                  {/* Tarjetas de Resumen Financiero del Cliente */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                    <div style={{ background: "rgba(248, 197, 66, 0.08)", border: "1px solid rgba(248, 197, 66, 0.3)", padding: "10px 14px", borderRadius: 12 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "var(--text-muted)", display: "block" }}>
                        Total Consumido
                      </span>
                      <strong style={{ fontSize: 20, color: "var(--primary-dark)" }}>
                        ${totalGastadoUsd.toFixed(2)} USD
                      </strong>
                    </div>

                    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "10px 14px", borderRadius: 12 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "var(--text-muted)", display: "block" }}>
                        Pedidos Totales
                      </span>
                      <strong style={{ fontSize: 20, color: "var(--text)" }}>
                        {clienteHistorial.total_pedidos} Pedidos
                      </strong>
                    </div>

                    <div style={{ background: "rgba(34, 197, 94, 0.08)", border: "1px solid rgba(34, 197, 94, 0.3)", padding: "10px 14px", borderRadius: 12 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "var(--text-muted)", display: "block" }}>
                        Ticket Promedio
                      </span>
                      <strong style={{ fontSize: 20, color: "#16a34a" }}>
                        ${ventasCliente.length > 0 ? (totalGastadoUsd / (ventasCliente.filter(v => v.estado !== "cancelada").length || 1)).toFixed(2) : "0.00"} USD
                      </strong>
                    </div>
                  </div>

                  {/* Listado de Ventas del Cliente */}
                  <div style={{ marginTop: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 8 }}>
                      📋 Historial Cronológico de Comandas ({ventasCliente.length}):
                    </span>

                    {ventasCliente.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "28px 16px", background: "var(--bg-subtle)", borderRadius: 12, color: "var(--text-muted)" }}>
                        <span style={{ fontSize: 32, display: "block", marginBottom: 6 }}>🧾</span>
                        <strong style={{ fontSize: 14, color: "var(--text)" }}>Sin ventas registradas aún</strong>
                        <p style={{ margin: "4px 0 0", fontSize: 12 }}>
                          Cuando este cliente realice pedidos por POS o web, aparecerán aquí con su fecha y detalle.
                        </p>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {ventasCliente.map((v) => {
                          const est = getEstadoBadge(v.estado);
                          const met = getMetodoBadge(v.metodo_pago);
                          const fechaObj = new Date(v.fecha);
                          const fechaFormateada = fechaObj.toLocaleDateString("es-VE", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          });
                          const horaFormateada = fechaObj.toLocaleTimeString("es-VE", {
                            hour: "2-digit",
                            minute: "2-digit",
                          });

                          return (
                            <div
                              key={v.id}
                              style={{
                                background: "var(--bg-card)",
                                border: "1px solid var(--border)",
                                borderRadius: 12,
                                padding: "12px 14px",
                                display: "flex",
                                flexDirection: "column",
                                gap: 8,
                                boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
                              }}
                            >
                              {/* Fila Cabecera: Comanda, Fecha, Estado y Monto */}
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span style={{ fontWeight: 900, color: "var(--primary-dark)", fontSize: 14 }}>
                                    #{v.numero_comanda?.toString().padStart(4, "0") || v.id.slice(0, 6)}
                                  </span>
                                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                    🗓️ {fechaFormateada} • {horaFormateada}
                                  </span>
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span
                                    style={{
                                      background: est.bg,
                                      color: est.color,
                                      padding: "3px 8px",
                                      borderRadius: 6,
                                      fontSize: 11,
                                      fontWeight: 800,
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 4,
                                    }}
                                  >
                                    <span>{est.icon}</span>
                                    <span>{est.label}</span>
                                  </span>

                                  <div style={{ textAlign: "right" }}>
                                    <strong style={{ fontSize: 16, color: "var(--primary-dark)", display: "block" }}>
                                      ${Number(v.total_usd).toFixed(2)} USD
                                    </strong>
                                    {Number(v.total_bs) > 0 && (
                                      <span style={{ fontSize: 10.5, color: "var(--text-muted)", display: "block" }}>
                                        Bs. {Number(v.total_bs).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Fila Detalles: Tipo de entrega y Método de Pago */}
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 11.5 }}>
                                <span style={{ background: "var(--bg-subtle)", padding: "2px 6px", borderRadius: 4, fontWeight: 700, color: "var(--text-muted)" }}>
                                  {v.tipo_entrega === "delivery" ? `🛵 Delivery (${v.delivery_zona_nombre || "Tarifa Nivel"})` : `🛍️ ${v.tipo_entrega?.toUpperCase() || "RETIRO"}`}
                                </span>
                                <span style={{ background: "var(--bg-subtle)", padding: "2px 6px", borderRadius: 4, fontWeight: 700, color: "var(--text-muted)" }}>
                                  {met.icon} {met.label}
                                </span>
                                {v.direccion_delivery && (
                                  <span style={{ color: "var(--text-muted)", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={v.direccion_delivery}>
                                    📍 {v.direccion_delivery}
                                  </span>
                                )}
                              </div>

                              {/* Desglose de Items Comprados */}
                              {v.items && v.items.length > 0 ? (
                                <div style={{ background: "var(--bg-subtle)", padding: "8px 10px", borderRadius: 8, marginTop: 2 }}>
                                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: "var(--text)" }}>
                                    {v.items.map((it: any) => (
                                      <li key={it.id} style={{ marginBottom: 2 }}>
                                        <strong>{it.cantidad}x {it.producto?.nombre || "Plato / Combo"}</strong>
                                        <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>
                                          (${Number(it.subtotal_usd || (it.precio_unitario_usd * it.cantidad)).toFixed(2)})
                                        </span>
                                        {it.notas_item && (
                                          <div style={{ fontSize: 11, color: "var(--primary-dark)", fontStyle: "italic" }}>
                                            ↳ {it.notas_item}
                                          </div>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : v.notas_comanda ? (
                                <div style={{ fontSize: 12, color: "var(--text)", background: "var(--bg-subtle)", padding: "6px 10px", borderRadius: 6 }}>
                                  📝 {v.notas_comanda}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Pestaña de Datos de Perfil & Delivery */
                <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "16px 0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 36 }}>👑</span>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 18, color: "var(--text)" }}>{clienteHistorial.nombre}</h3>
                      <span className="badge-ticket" style={{ fontSize: 12 }}>
                        ⭐ {clienteHistorial.total_pedidos} Pedidos Realizados
                      </span>
                    </div>
                  </div>

                  <div style={{ background: "var(--surface)", padding: 14, borderRadius: 12, border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block", textTransform: "uppercase", fontWeight: 700 }}>Teléfono / WhatsApp</span>
                      <strong style={{ fontSize: 14 }}>{clienteHistorial.telefono || "No registrado"}</strong>
                    </div>

                    <div>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block", textTransform: "uppercase", fontWeight: 700 }}>Dirección de Delivery</span>
                      <p style={{ margin: 0, fontSize: 13 }}>{clienteHistorial.direccion_delivery || "Sin dirección fija registrada"}</p>
                    </div>

                    <div>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block", textTransform: "uppercase", fontWeight: 700 }}>Preferencias & Notas</span>
                      <p style={{ margin: 0, fontSize: 13, color: "var(--primary-dark)", fontWeight: 600 }}>
                        {clienteHistorial.notas_preferencias || "Sin notas especiales registradas"}
                      </p>
                    </div>
                  </div>

                  {clienteHistorial.telefono && (() => {
                    const rawDigits = clienteHistorial.telefono.replace(/\D/g, "");
                    const cleanPhone = rawDigits.startsWith("58") ? rawDigits.slice(2) : rawDigits.replace(/^0/, "");
                    return (
                      <a
                        href={`https://wa.me/58${cleanPhone}?text=${encodeURIComponent(
                          `¡Hola ${clienteHistorial.nombre}! 👋 Te escribimos de La Parada del Sabor 🫓`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-submit-recipe"
                        style={{
                          textAlign: "center",
                          textDecoration: "none",
                          background: "#25D366",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                        }}
                      >
                        <span>💬 Abrir Chat de WhatsApp</span>
                      </a>
                    );
                  })()}
                </div>
              )}

              {/* Acciones del Footer */}
              <div className="modal-recipe-actions" style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                <button
                  type="button"
                  onClick={() => {
                    setModalHistorial(false);
                    pedirConfirmacionEliminar(clienteHistorial);
                  }}
                  className="btn-cancel"
                  style={{ color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.4)" }}
                >
                  🗑️ Eliminar
                </button>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setModalHistorial(false);
                      abrirEditar(clienteHistorial);
                    }}
                    className="btn-insumo-adjust"
                  >
                    ✏️ Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalHistorial(false)}
                    className="btn-cancel"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal de Confirmación de Eliminación */}
      {clienteAEliminar && (
        <div className="modal-overlay" onClick={() => setClienteAEliminar(null)}>
          <div className="modal-recipe-card" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-recipe-header">
              <h2 style={{ color: "#ef4444" }}>⚠️ Eliminar Cliente</h2>
              <button
                type="button"
                onClick={() => setClienteAEliminar(null)}
                className="btn-modal-close"
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "16px 0" }}>
              <p style={{ margin: 0, fontSize: 14, color: "var(--text)" }}>
                ¿Estás seguro de que deseas eliminar permanentemente a <strong>{clienteAEliminar.nombre}</strong> del directorio?
              </p>
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                Esta acción no se puede deshacer. Sus ventas históricas no se borrarán pero quedarán desvinculadas.
              </p>

              {errorEliminar && (
                <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(239, 68, 68, 0.12)", color: "#ef4444", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
                  ⚠️ {errorEliminar}
                </div>
              )}
            </div>

            <div className="modal-recipe-actions">
              <button
                type="button"
                onClick={() => setClienteAEliminar(null)}
                className="btn-cancel"
                disabled={eliminando}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={ejecutarEliminar}
                disabled={eliminando}
                className="btn-submit-recipe"
                style={{ background: "#ef4444", color: "#ffffff" }}
              >
                {eliminando ? "Eliminando..." : "🗑️ Sí, Eliminar Cliente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
