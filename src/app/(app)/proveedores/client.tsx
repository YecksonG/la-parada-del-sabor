"use client";

import { useState, useMemo } from "react";
import { Proveedor } from "@/types/database";
import { guardarProveedor } from "./actions";
import { sounds } from "@/lib/sound-effects";

interface ProveedoresClientProps {
  proveedores: Proveedor[];
  statsCompras: { [id: string]: { conteo: number; totalUsd: number } };
}

export default function ProveedoresClient({
  proveedores,
  statsCompras,
}: ProveedoresClientProps) {
  const [busqueda, setBusqueda] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<Proveedor | null>(null);

  // Form states
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [contacto, setContacto] = useState("");
  const [direccion, setDireccion] = useState("");
  const [rif, setRif] = useState("");
  const [notas, setNotas] = useState("");

  const abrirCrear = () => {
    setProveedorSeleccionado(null);
    setNombre("");
    setTelefono("");
    setContacto("");
    setDireccion("");
    setRif("");
    setNotas("");
    setModalAbierto(true);
  };

  const abrirEditar = (p: Proveedor) => {
    setProveedorSeleccionado(p);
    setNombre(p.nombre);
    setTelefono(p.telefono || "");
    setContacto(p.contacto || "");
    setDireccion(p.direccion || "");
    setRif(p.rif || "");
    setNotas(p.notas || "");
    setModalAbierto(true);
  };

  const proveedoresFiltrados = useMemo(() => {
    return proveedores.filter(
      (p) =>
        p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.contacto?.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.rif?.toLowerCase().includes(busqueda.toLowerCase())
    );
  }, [proveedores, busqueda]);

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || guardando) return;

    setGuardando(true);
    const res = await guardarProveedor({
      id: proveedorSeleccionado?.id,
      nombre,
      telefono,
      contacto,
      direccion,
      rif,
      notas,
    });
    setGuardando(false);

    if (res.ok) {
      sounds.playPop();
      setModalAbierto(false);
    } else {
      alert(res.error || "Error al guardar el proveedor.");
    }
  };

  return (
    <main className="recetas-container">
      <div className="recetas-header">
        <div>
          <h1 className="recetas-title">🏢 Directorio de Proveedores de Despensa</h1>
          <p className="recetas-subtitle">
            Gestión de distribuidores de harina, carnicerías, charcuterías y empaques mayoristas.
          </p>
        </div>
        <button type="button" onClick={abrirCrear} className="btn-primary-action">
          <span>+</span> Nuevo Proveedor
        </button>
      </div>

      <div className="search-input-wrapper">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          placeholder="Buscar por empresa, contacto o RIF..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="pos-search-input"
        />
      </div>

      <div className="insumos-grid">
        {proveedoresFiltrados.length === 0 ? (
          <div className="recetas-empty-box">
            <span style={{ fontSize: 48 }}>🏢</span>
            <h3>No hay proveedores registrados</h3>
            <p>Registra tus distribuidores para asociarlos a las compras de mercancía.</p>
          </div>
        ) : (
          proveedoresFiltrados.map((p) => {
            const stats = statsCompras[p.id] || { conteo: 0, totalUsd: 0 };

            return (
              <div key={p.id} className="insumo-card">
                <div className="insumo-card-header">
                  <div>
                    <h3 className="insumo-name">🏢 {p.nombre}</h3>
                    {p.rif && <span className="receta-cat-badge">RIF: {p.rif}</span>}
                  </div>
                  <span className="badge-ticket">{stats.conteo} Compras</span>
                </div>

                {p.contacto && (
                  <p style={{ fontSize: 13, color: "var(--text)" }}>👤 Contacto: <strong>{p.contacto}</strong></p>
                )}

                {p.telefono && (
                  <p style={{ fontSize: 13, color: "var(--text)" }}>📞 Teléfono: {p.telefono}</p>
                )}

                {p.direccion && (
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>📍 {p.direccion}</p>
                )}

                {p.notas && (
                  <div className="comanda-notes-box">
                    <span>📝 Suministra: {p.notas}</span>
                  </div>
                )}

                <div className="insumo-cost-details">
                  <div className="cost-detail-item">
                    <span>Total Comprado:</span>
                    <strong className="text-primary">${stats.totalUsd.toFixed(2)} USD</strong>
                  </div>
                </div>

                <div className="insumo-card-footer">
                  <button
                    type="button"
                    onClick={() => abrirEditar(p)}
                    className="btn-insumo-adjust"
                  >
                    ✏️ Editar Proveedor
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Proveedor */}
      {modalAbierto && (
        <div className="modal-overlay">
          <div className="modal-recipe-card" style={{ maxWidth: 480 }}>
            <div className="modal-recipe-header">
              <h2>{proveedorSeleccionado ? "Editar Proveedor" : "Nuevo Proveedor"}</h2>
              <button type="button" onClick={() => setModalAbierto(false)} className="btn-modal-close">✕</button>
            </div>

            <form onSubmit={handleGuardar} className="recipe-form">
              <div className="form-grid-2">
                <div className="form-field">
                  <label>Razón Social / Empresa</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Distribuidora Polar / Carnicería Central"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-field">
                  <label>RIF / C.I.</label>
                  <input
                    type="text"
                    placeholder="J-12345678-9"
                    value={rif}
                    onChange={(e) => setRif(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-field">
                  <label>Persona de Contacto</label>
                  <input
                    type="text"
                    placeholder="Ej. Juan González (Ventas)"
                    value={contacto}
                    onChange={(e) => setContacto(e.target.value)}
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
              </div>

              <div className="form-field">
                <label>Dirección</label>
                <input
                  type="text"
                  placeholder="Zona industrial, galpón #4"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-field">
                <label>Insumos que Suministra / Notas</label>
                <input
                  type="text"
                  placeholder="Ej. Harina de maíz, sacos de 20kg y aceite"
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="modal-recipe-actions">
                <button type="button" onClick={() => setModalAbierto(false)} className="btn-cancel">Cancelar</button>
                <button type="submit" disabled={guardando} className="btn-submit-recipe">
                  {guardando ? "Guardando..." : "💾 Guardar Proveedor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
