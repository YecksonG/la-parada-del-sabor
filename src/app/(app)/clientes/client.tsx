"use client";

import { useState, useMemo } from "react";
import { Cliente } from "@/types/database";
import { guardarCliente } from "./actions";
import { sounds } from "@/lib/sound-effects";

interface ClientesClientProps {
  clientes: Cliente[];
}

export default function ClientesClient({ clientes }: ClientesClientProps) {
  const [modoVista, setModoVista] = useState<"grid" | "filas">("grid");
  const [busqueda, setBusqueda] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);

  // Persistencia de preferencia de vista
  useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("vista_clientes");
      if (saved === "grid" || saved === "filas") {
        setModoVista(saved);
      }
    }
  });

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

  const abrirEditar = (c: Cliente) => {
    sounds.playPop();
    setClienteSeleccionado(c);
    setNombre(c.nombre);
    setTelefono(c.telefono || "");
    setDireccion(c.direccion_delivery || "");
    setNotas(c.notas_preferencias || "");
    setModalAbierto(true);
  };

  const clientesFiltrados = useMemo(() => {
    return clientes.filter(
      (c) =>
        c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        c.telefono?.includes(busqueda) ||
        c.direccion_delivery?.toLowerCase().includes(busqueda.toLowerCase())
    );
  }, [clientes, busqueda]);

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

              <div className="insumo-card-footer">
                <button
                  type="button"
                  onClick={() => abrirEditar(c)}
                  className="btn-insumo-adjust"
                >
                  ✏️ Editar Información
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
                    <button
                      type="button"
                      onClick={() => abrirEditar(c)}
                      className="btn-insumo-adjust"
                      style={{ padding: "5px 12px", fontSize: 12 }}
                    >
                      ✏️ Editar
                    </button>
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

              <div className="modal-recipe-actions">
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
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
