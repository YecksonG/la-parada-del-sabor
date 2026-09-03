"use client";

import { useState, useEffect, useMemo } from "react";
import { Proveedor, Insumo } from "@/types/database";
import { guardarProveedor, eliminarProveedor } from "./actions";
import { sounds } from "@/lib/sound-effects";
import { parseProveedorInsumos } from "@/lib/proveedor-insumos-helper";

interface ProveedoresClientProps {
  proveedores: Proveedor[];
  insumos: Insumo[];
  statsCompras: { [id: string]: { conteo: number; totalUsd: number; totalBs?: number } };
  preciosReferenciales?: { [provId: string]: { [insumoId: string]: number } };
}

export default function ProveedoresClient({
  proveedores,
  insumos,
  statsCompras,
  preciosReferenciales = {},
}: ProveedoresClientProps) {
  const [modoVista, setModoVista] = useState<"grid" | "filas">("grid");
  const [busqueda, setBusqueda] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<Proveedor | null>(null);

  // Mapa rápido de insumos por ID
  const insumosMap = useMemo(() => new Map(insumos.map((i) => [i.id, i])), [insumos]);

  // Cargar preferencia guardada al montar
  useEffect(() => {
    const saved = localStorage.getItem("vista_proveedores");
    if (saved === "grid" || saved === "filas") {
      setModoVista(saved);
    }
  }, []);

  const cambiarModoVista = (modo: "grid" | "filas") => {
    sounds.playPop();
    setModoVista(modo);
    if (typeof window !== "undefined") {
      localStorage.setItem("vista_proveedores", modo);
    }
  };

  // Form states
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [contacto, setContacto] = useState("");
  const [direccion, setDireccion] = useState("");
  const [rif, setRif] = useState("");
  const [notas, setNotas] = useState("");
  const [insumosSeleccionados, setInsumosSeleccionados] = useState<string[]>([]);
  const [filtroInsumosModal, setFiltroInsumosModal] = useState("");

  const abrirCrear = () => {
    sounds.playPop();
    setProveedorSeleccionado(null);
    setNombre("");
    setTelefono("");
    setContacto("");
    setDireccion("");
    setRif("");
    setNotas("");
    setInsumosSeleccionados([]);
    setFiltroInsumosModal("");
    setModalAbierto(true);
  };

  const abrirEditar = (p: Proveedor) => {
    sounds.playPop();
    setProveedorSeleccionado(p);
    setNombre(p.nombre);
    setTelefono(p.telefono || "");
    setContacto(p.contacto || "");
    setDireccion(p.direccion || "");
    setRif(p.rif || "");
    const parsed = parseProveedorInsumos(p.notas);
    setInsumosSeleccionados(parsed.insumos_ids);
    setNotas(parsed.notas_texto);
    setFiltroInsumosModal("");
    setModalAbierto(true);
  };

  const toggleInsumo = (id: string) => {
    sounds.playPop();
    setInsumosSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const insumosModalFiltrados = useMemo(() => {
    if (!filtroInsumosModal.trim()) return insumos;
    const term = filtroInsumosModal.toLowerCase();
    return insumos.filter(
      (ins) =>
        ins.nombre.toLowerCase().includes(term) ||
        ins.categoria_insumo.toLowerCase().includes(term)
    );
  }, [insumos, filtroInsumosModal]);

  const proveedoresFiltrados = useMemo(() => {
    const term = busqueda.toLowerCase().trim();
    if (!term) return proveedores;

    return proveedores.filter((p) => {
      const matchBasico =
        p.nombre.toLowerCase().includes(term) ||
        p.contacto?.toLowerCase().includes(term) ||
        p.rif?.toLowerCase().includes(term);

      if (matchBasico) return true;

      // Buscar si suministra algún insumo que coincida
      const { insumos_ids, notas_texto } = parseProveedorInsumos(p.notas);
      if (notas_texto.toLowerCase().includes(term)) return true;

      const nombresInsumos = insumos_ids
        .map((id) => insumosMap.get(id)?.nombre.toLowerCase() || "")
        .join(" ");

      return nombresInsumos.includes(term);
    });
  }, [proveedores, busqueda, insumosMap]);

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
      insumos_ids: insumosSeleccionados,
    });
    setGuardando(false);

    if (res.ok) {
      sounds.playKitchenBell();
      setModalAbierto(false);
    } else {
      alert(res.error || "Error al guardar el proveedor.");
    }
  };

  const handleEliminar = async (id: string, nombreProv: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar al proveedor "${nombreProv}"? Esta acción desvinculará sus registros sin alterar tus cuentas.`)) return;
    sounds.playDelete();
    setGuardando(true);
    const res = await eliminarProveedor(id);
    setGuardando(false);
    if (res.ok) {
      sounds.playKitchenBell();
      setModalAbierto(false);
    } else {
      alert(res.error || "Error al eliminar el proveedor.");
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
            <span>+</span> Nuevo Proveedor
          </button>
        </div>
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
        {busqueda && (
          <button type="button" onClick={() => setBusqueda("")} className="btn-clear-search">
            ✕
          </button>
        )}
      </div>

      {proveedoresFiltrados.length === 0 ? (
        <div className="recetas-empty-box">
          <span style={{ fontSize: 48 }}>🏢</span>
          <h3>No hay proveedores registrados</h3>
          <p>Registra tus distribuidores para asociarlos a las compras de mercancía.</p>
        </div>
      ) : modoVista === "grid" ? (
        /* VISTA 1: CUADROS / GRID */
        <div className="insumos-grid">
          {proveedoresFiltrados.map((p) => {
            const stats = statsCompras[p.id] || { conteo: 0, totalUsd: 0, totalBs: 0 };
            const { insumos_ids, notas_texto } = parseProveedorInsumos(p.notas);
            const insumosSuministrados = insumos_ids
              .map((id) => insumosMap.get(id))
              .filter(Boolean) as Insumo[];

            return (
              <div key={p.id} className="insumo-card">
                <div className="insumo-card-header">
                  <div>
                    <h3 className="insumo-name">🏢 {p.nombre}</h3>
                    {p.rif && <span className="receta-cat-badge">RIF: {p.rif}</span>}
                  </div>
                  <span className="badge-ticket">{stats.conteo} Movimientos</span>
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

                {/* Insumos que Suministra */}
                <div className="insumo-suppliers-box">
                  <span className="insumo-suppliers-label">
                    📦 Insumos de Despensa ({insumosSuministrados.length}):
                  </span>
                  {insumosSuministrados.length > 0 ? (
                    <div className="insumos-supplied-chips">
                      {insumosSuministrados.map((ins) => {
                        const precioRef = preciosReferenciales[p.id]?.[ins.id];
                        return (
                          <span key={ins.id} className="insumo-supplied-badge" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <span>{ins.categoria_insumo === "Carnes" ? "🥩" : ins.categoria_insumo === "Masas" ? "🌽" : ins.categoria_insumo === "Quesos" || ins.categoria_insumo === "Lácteos" ? "🧀" : ins.categoria_insumo === "Vegetales" ? "🥬" : ins.categoria_insumo === "Salsas" ? "🥫" : "📦"} {ins.nombre}</span>
                            {precioRef !== undefined && (
                              <strong style={{ color: "var(--accent-hover)", fontSize: 10, background: "rgba(255,255,255,0.08)", padding: "1px 5px", borderRadius: 4 }}>
                                ${precioRef.toFixed(2)}{ins.unidad_medida === "g" ? "/kg" : ins.unidad_medida === "ml" ? "/L" : ""}
                              </strong>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {notas_texto || "Sin insumos de despensa vinculados"}
                    </span>
                  )}
                  {notas_texto && insumosSuministrados.length > 0 && (
                    <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                      📝 {notas_texto}
                    </p>
                  )}
                </div>

                <div className="insumo-cost-details">
                  <div className="cost-detail-item">
                    <span>Total Facturado:</span>
                    <strong className="text-primary">
                      ${(Number(stats.totalUsd) || 0).toFixed(2)} USD
                      {stats.totalBs ? <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>Bs. {stats.totalBs.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</span> : null}
                    </strong>
                  </div>
                </div>

                <div className="insumo-card-footer" style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => abrirEditar(p)}
                    className="btn-insumo-adjust"
                    style={{ flex: 1 }}
                  >
                    ✏️ Editar Proveedor
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEliminar(p.id, p.nombre)}
                    className="btn-danger-outline"
                    style={{ padding: "6px 12px", fontSize: 13, borderRadius: 8 }}
                    title="Eliminar Proveedor"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* VISTA 2: FILAS / LISTA DETALLADA */
        <div className="table-responsive-wrapper">
          <table className="custom-detailed-table">
            <thead>
              <tr>
                <th>Empresa / Razón Social</th>
                <th>Contacto Directo</th>
                <th>Teléfono / WhatsApp</th>
                <th>Dirección</th>
                <th>Insumos que Suministra</th>
                <th>Compras Realizadas</th>
                <th>Total Facturado</th>
                <th style={{ textAlign: "right" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {proveedoresFiltrados.map((p) => {
                const stats = statsCompras[p.id] || { conteo: 0, totalUsd: 0 };
                const { insumos_ids, notas_texto } = parseProveedorInsumos(p.notas);
                const insumosSuministrados = insumos_ids
                  .map((id) => insumosMap.get(id))
                  .filter(Boolean) as Insumo[];

                return (
                  <tr key={p.id} className="detailed-table-row">
                    <td>
                      <div>
                        <strong style={{ fontSize: 14, color: "var(--text)" }}>🏢 {p.nombre}</strong>
                        {p.rif && <div><span className="receta-cat-badge">RIF: {p.rif}</span></div>}
                      </div>
                    </td>
                    <td>
                      {p.contacto ? (
                        <span style={{ fontSize: 13, fontWeight: 700 }}>👤 {p.contacto}</span>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td>
                      {p.telefono ? (
                        <span style={{ fontSize: 13 }}>📞 {p.telefono}</span>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td style={{ maxWidth: 200, fontSize: 12 }}>
                      {p.direccion ? <span>📍 {p.direccion}</span> : <span style={{ color: "var(--text-muted)" }}>—</span>}
                    </td>
                    <td style={{ maxWidth: 260, fontSize: 12 }}>
                      {insumosSuministrados.length > 0 ? (
                        <div className="insumos-supplied-chips">
                          {insumosSuministrados.map((ins) => {
                            const precioRef = preciosReferenciales[p.id]?.[ins.id];
                            return (
                              <span key={ins.id} className="insumo-supplied-badge" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                {ins.nombre}
                                {precioRef !== undefined && (
                                  <strong style={{ color: "var(--accent-hover)", fontSize: 10 }}>
                                    (${precioRef.toFixed(2)}{ins.unidad_medida === "g" ? "/kg" : ins.unidad_medida === "ml" ? "/L" : ""})
                                  </strong>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      ) : notas_texto ? (
                        <span style={{ color: "var(--primary-dark)", fontWeight: 600 }}>📝 {notas_texto}</span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                    <td>
                      <span className="badge-ticket" style={{ fontSize: 12 }}>{stats.conteo} Movimientos</span>
                    </td>
                    <td>
                      <strong className="text-primary" style={{ fontSize: 14 }}>
                        ${(Number(stats.totalUsd) || 0).toFixed(2)} USD
                        {stats.totalBs ? <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>Bs. {stats.totalBs.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</span> : null}
                      </strong>
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button
                        type="button"
                        onClick={() => abrirEditar(p)}
                        className="btn-insumo-adjust"
                        style={{ padding: "5px 12px", fontSize: 12, marginRight: 6 }}
                      >
                        ✏️ Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEliminar(p.id, p.nombre)}
                        className="btn-danger-outline"
                        style={{ padding: "5px 10px", fontSize: 12, borderRadius: 6 }}
                        title="Eliminar Proveedor"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Proveedor */}
      {modalAbierto && (
        <div className="modal-overlay">
          <div className="modal-recipe-card" style={{ maxWidth: 560 }}>
            <div className="modal-recipe-header">
              <h2>{proveedorSeleccionado ? "Editar Proveedor" : "Nuevo Proveedor"}</h2>
              <button type="button" onClick={() => setModalAbierto(false)} className="btn-modal-close">✕</button>
            </div>

            <form onSubmit={handleGuardar} className="recipe-form">
              <div className="form-grid-2">
                <div className="form-field">
                  <label>Razón Social / Empresa *</label>
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

              {/* Selector Estructurado de Insumos de la Despensa */}
              <div className="form-field">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <label style={{ margin: 0 }}>
                    📦 Insumos de la Despensa que Suministra ({insumosSeleccionados.length} seleccionados)
                  </label>
                  {insumosSeleccionados.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setInsumosSeleccionados([])}
                      style={{
                        background: "none",
                        border: "none",
                        fontSize: 11,
                        color: "var(--accent)",
                        cursor: "pointer",
                        fontWeight: 700,
                      }}
                    >
                      Deseleccionar todos
                    </button>
                  )}
                </div>

                <div style={{ marginBottom: 6 }}>
                  <input
                    type="text"
                    placeholder="Filtrar insumos (ej. Harina, Queso, Carne)..."
                    value={filtroInsumosModal}
                    onChange={(e) => setFiltroInsumosModal(e.target.value)}
                    className="form-input"
                    style={{ fontSize: 12, padding: "6px 10px" }}
                  />
                </div>

                <div className="insumos-picker-box">
                  {insumosModalFiltrados.length === 0 ? (
                    <span style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: 10 }}>
                      No se encontraron insumos que coincidan con la búsqueda.
                    </span>
                  ) : (
                    <div className="insumos-picker-grid">
                      {insumosModalFiltrados.map((ins) => {
                        const seleccionado = insumosSeleccionados.includes(ins.id);
                        return (
                          <button
                            key={ins.id}
                            type="button"
                            onClick={() => toggleInsumo(ins.id)}
                            className={`insumo-chip-item ${seleccionado ? "insumo-chip-active" : ""}`}
                          >
                            <span>{seleccionado ? "✅" : "➕"}</span>
                            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {ins.nombre}
                              </span>
                              <span style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase" }}>
                                {ins.categoria_insumo}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="form-field">
                <label>Notas Adicionales / Horarios de Despacho</label>
                <input
                  type="text"
                  placeholder="Ej. Despachan martes y jueves, crédito a 7 días..."
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="modal-recipe-actions" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  {proveedorSeleccionado && (
                    <button
                      type="button"
                      onClick={() => handleEliminar(proveedorSeleccionado.id, proveedorSeleccionado.nombre)}
                      className="btn-danger-outline"
                      style={{ padding: "8px 14px", fontSize: 13 }}
                    >
                      🗑️ Eliminar Proveedor
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={() => setModalAbierto(false)} className="btn-cancel">Cancelar</button>
                  <button type="submit" disabled={guardando} className="btn-submit-recipe">
                    {guardando ? "Guardando..." : "💾 Guardar Proveedor"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
