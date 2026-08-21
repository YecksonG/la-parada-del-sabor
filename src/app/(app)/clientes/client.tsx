"use client";

import { useState, useMemo } from "react";
import { Cliente } from "@/types/database";
import { guardarCliente } from "./actions";

interface ClientesClientProps {
  clientes: Cliente[];
}

export default function ClientesClient({ clientes }: ClientesClientProps) {
  const [busqueda, setBusqueda] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);

  // Form states
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [notas, setNotas] = useState("");

  const abrirCrear = () => {
    setClienteSeleccionado(null);
    setNombre("");
    setTelefono("");
    setDireccion("");
    setNotas("");
    setModalAbierto(true);
  };

  const abrirEditar = (c: Cliente) => {
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
        <button type="button" onClick={abrirCrear} className="btn-primary-action">
          <span>+</span> Nuevo Cliente
        </button>
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
      </div>

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

      {modalAbierto && (
        <div className="modal-overlay">
          <div className="modal-recipe-card" style={{ maxWidth: 460 }}>
            <div className="modal-recipe-header">
              <h2>{clienteSeleccionado ? "Editar Cliente" : "Nuevo Cliente"}</h2>
              <button type="button" onClick={() => setModalAbierto(false)} className="btn-modal-close">✕</button>
            </div>

            <form onSubmit={handleGuardar} className="recipe-form">
              <div className="form-field">
                <label>Nombre y Apellido</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Carlos Pérez"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-field">
                <label>Teléfono (WhatsApp)</label>
                <input
                  type="text"
                  placeholder="0412-1234567"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-field">
                <label>Dirección de Reparto (Delivery)</label>
                <input
                  type="text"
                  placeholder="Calle principal, casa #12, frente al parque"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-field">
                <label>Preferencias / Platos Favoritos</label>
                <input
                  type="text"
                  placeholder="Ej. Pide siempre Reina Pepiada con extra queso"
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="modal-recipe-actions">
                <button type="button" onClick={() => setModalAbierto(false)} className="btn-cancel">Cancelar</button>
                <button type="submit" disabled={guardando} className="btn-submit-recipe">
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
