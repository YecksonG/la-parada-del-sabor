"use client";

import { useState, useEffect, useMemo } from "react";
import { Insumo, UnidadMedida, Proveedor } from "@/types/database";
import { guardarInsumo, ajustarStockInsumo } from "./actions";
import { sounds } from "@/lib/sound-effects";
import {
  getProveedoresPorInsumo,
  parseProveedorInsumos,
} from "@/lib/proveedor-insumos-helper";

interface InsumosClientProps {
  insumos: Insumo[];
  proveedores?: Proveedor[];
}

export default function InsumosClient({
  insumos,
  proveedores = [],
}: InsumosClientProps) {
  const [modoVista, setModoVista] = useState<"grid" | "filas">("grid");
  const [busqueda, setBusqueda] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modalAjusteAbierto, setModalAjusteAbierto] = useState(false);
  const [insumoSeleccionado, setInsumoSeleccionado] = useState<Insumo | null>(null);
  const [nuevoStockAjuste, setNuevoStockAjuste] = useState<number>(0);
  const [guardando, setGuardando] = useState(false);

  // Cargar preferencia guardada al montar
  useEffect(() => {
    const saved = localStorage.getItem("vista_insumos");
    if (saved === "grid" || saved === "filas") {
      setModoVista(saved);
    }
  }, []);

  const cambiarModoVista = (modo: "grid" | "filas") => {
    sounds.playPop();
    setModoVista(modo);
    if (typeof window !== "undefined") {
      localStorage.setItem("vista_insumos", modo);
    }
  };

  // Form states
  const [nombre, setNombre] = useState("");
  const [unidadMedida, setUnidadMedida] = useState<UnidadMedida>("g");
  const [stockActual, setStockActual] = useState<number>(1000);
  const [stockMinimo, setStockMinimo] = useState<number>(200);
  const [costoUnitario, setCostoUnitario] = useState<number>(0.005);
  const [categoriaInsumo, setCategoriaInsumo] = useState("Carnes");
  const [proveedoresSeleccionados, setProveedoresSeleccionados] = useState<string[]>([]);

  const abrirCrear = () => {
    sounds.playPop();
    setInsumoSeleccionado(null);
    setNombre("");
    setUnidadMedida("g");
    setStockActual(1000);
    setStockMinimo(200);
    setCostoUnitario(0.005);
    setCategoriaInsumo("Carnes");
    setProveedoresSeleccionados([]);
    setModalAbierto(true);
  };

  const abrirEditar = (ins: Insumo) => {
    sounds.playPop();
    setInsumoSeleccionado(ins);
    setNombre(ins.nombre);
    setUnidadMedida(ins.unidad_medida);
    setStockActual(Number(ins.stock_actual));
    setStockMinimo(Number(ins.stock_minimo));
    setCostoUnitario(Number(ins.costo_unitario_usd));
    setCategoriaInsumo(ins.categoria_insumo || "General");

    // Identificar proveedores vinculados a este insumo
    const provIds = proveedores
      .filter((p) => parseProveedorInsumos(p.notas).insumos_ids.includes(ins.id))
      .map((p) => p.id);
    setProveedoresSeleccionados(provIds);

    setModalAbierto(true);
  };

  const toggleProveedor = (id: string) => {
    sounds.playPop();
    setProveedoresSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const abrirAjuste = (ins: Insumo) => {
    sounds.playPop();
    setInsumoSeleccionado(ins);
    setNuevoStockAjuste(Number(ins.stock_actual));
    setModalAjusteAbierto(true);
  };

  const insumosFiltrados = useMemo(() => {
    return insumos.filter(
      (ins) =>
        ins.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        ins.categoria_insumo.toLowerCase().includes(busqueda.toLowerCase())
    );
  }, [insumos, busqueda]);

  // Valor total del inventario en despensa
  const valorTotalInventario = useMemo(() => {
    return insumos.reduce((acc, ins) => {
      return acc + Number(ins.stock_actual) * Number(ins.costo_unitario_usd);
    }, 0);
  }, [insumos]);

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || guardando) return;

    setGuardando(true);
    const res = await guardarInsumo({
      id: insumoSeleccionado?.id,
      nombre,
      unidad_medida: unidadMedida,
      stock_actual: Number(stockActual),
      stock_minimo: Number(stockMinimo),
      costo_unitario_usd: Number(costoUnitario),
      categoria_insumo: categoriaInsumo,
      proveedores_ids: proveedoresSeleccionados,
    });
    setGuardando(false);

    if (res.ok) {
      sounds.playKitchenBell();
      setModalAbierto(false);
    } else {
      alert(res.error || "Error al guardar el insumo.");
    }
  };

  const handleAjustarStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!insumoSeleccionado || guardando) return;

    setGuardando(true);
    const res = await ajustarStockInsumo(insumoSeleccionado.id, Number(nuevoStockAjuste));
    setGuardando(false);

    if (res.ok) {
      sounds.playPop();
      setModalAjusteAbierto(false);
    } else {
      alert(res.error || "Error al ajustar el inventario.");
    }
  };

  return (
    <main className="recetas-container">
      {/* Header con Valor Total y Toggle de Vistas */}
      <div className="recetas-header">
        <div>
          <h1 className="recetas-title">📦 Despensa & Stock en Gramos (BOM)</h1>
          <p className="recetas-subtitle">
            Control de inventario en tiempo real para descuento automático al vender en POS.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Valor Total del Inventario */}
          <div className="inventory-total-pill">
            <span>Valor Total:</span>
            <strong>${valorTotalInventario.toFixed(2)} USD</strong>
          </div>

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
            <span>+</span> Nuevo Insumo
          </button>
        </div>
      </div>

      {/* Barra de Búsqueda */}
      <div className="search-input-wrapper">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          placeholder="Buscar ingrediente o insumo por nombre o categoría..."
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

      {insumosFiltrados.length === 0 ? (
        <div className="recetas-empty-box">
          <span style={{ fontSize: 48 }}>📦</span>
          <h3>No se encontraron insumos</h3>
          <p>Prueba con otro término de búsqueda o crea un nuevo insumo.</p>
        </div>
      ) : modoVista === "grid" ? (
        /* VISTA 1: CUADROS / GRID */
        <div className="insumos-grid">
          {insumosFiltrados.map((ins) => {
            const stock = Number(ins.stock_actual);
            const stockMin = Number(ins.stock_minimo);
            const costoUnit = Number(ins.costo_unitario_usd);
            const valorTotal = stock * costoUnit;

            const esAgotado = stock <= 0;
            const esCritico = !esAgotado && stock <= stockMin * 0.5;
            const esBajo = !esAgotado && !esCritico && stock <= stockMin;
            const estado = esAgotado ? "agotado" : esCritico ? "critico" : esBajo ? "bajo" : "ok";

            // Formateo visual
            let stockDisplay = `${stock.toLocaleString()} ${ins.unidad_medida}`;
            let costoRef = "";
            if (ins.unidad_medida === "g") {
              if (stock >= 1000) stockDisplay = `${(stock / 1000).toFixed(2)} kg (${stock.toLocaleString()} g)`;
              costoRef = `$${(costoUnit * 1000).toFixed(2)}/kg`;
            } else if (ins.unidad_medida === "ml") {
              if (stock >= 1000) stockDisplay = `${(stock / 1000).toFixed(2)} L (${stock.toLocaleString()} ml)`;
              costoRef = `$${(costoUnit * 1000).toFixed(2)}/L`;
            }

            const progressWidth = esAgotado
              ? 0
              : Math.min(100, Math.max(5, (stock / (stockMin > 0 ? stockMin * 3 : 1)) * 100));
            const progressClass = esAgotado
              ? "fill-agotado"
              : esCritico
              ? "fill-critico"
              : esBajo
              ? "fill-bajo"
              : "fill-ok";

            return (
              <div key={ins.id} className="insumo-card">
                {/* Fila Superior: Categoría y Botón Discreto de Editar */}
                <div className="insumo-card-topbar">
                  <span className="insumo-cat-tag">{ins.categoria_insumo}</span>
                  <button
                    type="button"
                    onClick={() => abrirEditar(ins)}
                    className="btn-insumo-edit-top"
                    title="Editar Insumo"
                  >
                    ✏️
                  </button>
                </div>

                {/* Header de Tarjeta: Nombre y Badge de Stock */}
                <div className="insumo-card-header">
                  <h3 className="insumo-name">{ins.nombre}</h3>
                  {estado === "agotado" ? (
                    <span className="stock-badge stock-badge-agotado">🔴 Agotado</span>
                  ) : estado === "critico" ? (
                    <span className="stock-badge stock-badge-critico">🟠 Crítico</span>
                  ) : estado === "bajo" ? (
                    <span className="stock-badge stock-badge-bajo">🟡 Bajo</span>
                  ) : (
                    <span className="stock-badge stock-badge-ok">🟢 Óptimo</span>
                  )}
                </div>

                {/* Hero de Stock y Nivel */}
                <div className="insumo-stock-display">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span className="insumo-stock-value">{stockDisplay}</span>
                    <span className="insumo-min-label">Mín: {stockMin.toLocaleString()} {ins.unidad_medida}</span>
                  </div>

                  {/* Barra de Progreso de Stock */}
                  <div className="stock-progress-track">
                    <div
                      className={`stock-progress-fill ${progressClass}`}
                      style={{ width: `${progressWidth}%` }}
                    />
                  </div>
                </div>

                {/* Desglose de Costos & Valor Total */}
                <div className="insumo-cost-details">
                  <div className="cost-detail-item">
                    <span>Costo Unitario</span>
                    <strong>${costoUnit.toFixed(4)} <small style={{ fontWeight: 600, color: "var(--text-muted)", fontSize: 11 }}>/{ins.unidad_medida}</small></strong>
                    {costoRef && (
                      <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700 }}>
                        {costoRef}
                      </span>
                    )}
                  </div>
                  <div className="cost-detail-item" style={{ textAlign: "right", alignItems: "flex-end" }}>
                    <span>Valor en Despensa</span>
                    <strong className="text-primary" style={{ fontSize: 14 }}>${valorTotal.toFixed(2)} USD</strong>
                  </div>
                </div>

                {/* Proveedores Vinculados */}
                {(() => {
                  const proveedoresDelInsumo = getProveedoresPorInsumo(proveedores, ins.id);
                  return (
                    <div className="insumo-suppliers-box">
                      <span className="insumo-suppliers-label">
                        🏢 Proveedores ({proveedoresDelInsumo.length}):
                      </span>
                      {proveedoresDelInsumo.length > 0 ? (
                        <div className="insumos-supplied-chips">
                          {proveedoresDelInsumo.map((p) => (
                            <span
                              key={p.id}
                              className="insumo-supplied-badge"
                              title={p.contacto ? `Contacto: ${p.contacto}` : undefined}
                            >
                              🏢 {p.nombre}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>
                          Sin proveedor asignado
                        </span>
                      )}
                    </div>
                  );
                })()}

                {/* Footer Inferior: Botón Amplio de Ajuste / Merma */}
                <div className="insumo-card-footer">
                  <button
                    type="button"
                    onClick={() => abrirAjuste(ins)}
                    className="btn-insumo-adjust"
                  >
                    ⚖️ Ajustar Stock / Merma
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* VISTA 2: FILAS / LISTA DETALLADA (TODO COMPLETO) */
        <div className="table-responsive-wrapper">
          <table className="custom-detailed-table">
            <thead>
              <tr>
                <th>Insumo & Categoría</th>
                <th>Stock Actual</th>
                <th>Estado & Nivel</th>
                <th>Stock Mínimo</th>
                <th>Costo Unitario</th>
                <th>Costo Referencial (Kg/L)</th>
                <th>Valor Total Inventario</th>
                <th>Proveedores</th>
                <th style={{ textAlign: "right" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {insumosFiltrados.map((ins) => {
                const stock = Number(ins.stock_actual);
                const stockMin = Number(ins.stock_minimo);
                const costoUnit = Number(ins.costo_unitario_usd);
                const valorTotal = stock * costoUnit;
                const proveedoresDelInsumo = getProveedoresPorInsumo(proveedores, ins.id);

                const esAgotado = stock <= 0;
                const esCritico = !esAgotado && stock <= stockMin * 0.5;
                const esBajo = !esAgotado && !esCritico && stock <= stockMin;
                const estado = esAgotado ? "agotado" : esCritico ? "critico" : esBajo ? "bajo" : "ok";

                let stockDisplay = `${stock.toLocaleString()} ${ins.unidad_medida}`;
                let costoRef = "—";
                if (ins.unidad_medida === "g") {
                  if (stock >= 1000) stockDisplay = `${(stock / 1000).toFixed(2)} kg (${stock.toLocaleString()} g)`;
                  costoRef = `$${(costoUnit * 1000).toFixed(2)} / kg`;
                } else if (ins.unidad_medida === "ml") {
                  if (stock >= 1000) stockDisplay = `${(stock / 1000).toFixed(2)} L (${stock.toLocaleString()} ml)`;
                  costoRef = `$${(costoUnit * 1000).toFixed(2)} / Litro`;
                }

                return (
                  <tr key={ins.id} className="detailed-table-row">
                    <td>
                      <div>
                        <strong style={{ fontSize: 14, color: "var(--text)" }}>{ins.nombre}</strong>
                        <div style={{ marginTop: 2 }}>
                          <span className="insumo-cat-tag">{ins.categoria_insumo}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <strong className="text-primary" style={{ fontSize: 14 }}>
                        {stockDisplay}
                      </strong>
                    </td>
                    <td style={{ minWidth: 140 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {estado === "agotado" ? (
                          <span className="stock-badge stock-badge-agotado">🔴 Agotado</span>
                        ) : estado === "critico" ? (
                          <span className="stock-badge stock-badge-critico">🟠 Crítico</span>
                        ) : estado === "bajo" ? (
                          <span className="stock-badge stock-badge-bajo">🟡 Bajo</span>
                        ) : (
                          <span className="stock-badge stock-badge-ok">🟢 Óptimo</span>
                        )}
                        <div className="stock-progress-track" style={{ height: 5 }}>
                          <div
                            className={`stock-progress-fill ${
                              esAgotado
                                ? "fill-agotado"
                                : esCritico
                                ? "fill-critico"
                                : esBajo
                                ? "fill-bajo"
                                : "fill-ok"
                            }`}
                            style={{
                              width: `${
                                esAgotado
                                  ? 0
                                  : Math.min(100, Math.max(5, (stock / (stockMin > 0 ? stockMin * 3 : 1)) * 100))
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 700 }}>
                        {stockMin.toLocaleString()} {ins.unidad_medida}
                      </span>
                    </td>
                    <td>
                      <strong style={{ fontSize: 13 }}>
                        ${costoUnit.toFixed(4)} / {ins.unidad_medida}
                      </strong>
                    </td>
                    <td>
                      <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 700 }}>
                        {costoRef}
                      </span>
                    </td>
                    <td>
                      <strong className="text-green" style={{ fontSize: 14 }}>
                        ${valorTotal.toFixed(2)} USD
                      </strong>
                    </td>
                    <td style={{ maxWidth: 220, fontSize: 12 }}>
                      {proveedoresDelInsumo.length > 0 ? (
                        <div className="insumos-supplied-chips">
                          {proveedoresDelInsumo.map((p) => (
                            <span key={p.id} className="insumo-supplied-badge">
                              🏢 {p.nombre}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: 11 }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => abrirAjuste(ins)}
                          className="btn-insumo-adjust"
                          style={{ padding: "5px 10px", fontSize: 12 }}
                        >
                          ⚖️ Ajustar
                        </button>
                        <button
                          type="button"
                          onClick={() => abrirEditar(ins)}
                          className="btn-insumo-edit"
                          style={{ padding: "5px 10px", fontSize: 12 }}
                        >
                          ✏️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Crear / Editar Insumo */}
      {modalAbierto && (
        <div className="modal-overlay">
          <div className="modal-recipe-card" style={{ maxWidth: 540 }}>
            <div className="modal-recipe-header">
              <h2>{insumoSeleccionado ? "Editar Insumo" : "Nuevo Insumo de Despensa"}</h2>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="btn-modal-close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGuardar} className="recipe-form">
              <div className="form-grid-2">
                <div className="form-field">
                  <label>Nombre del Insumo</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Carne Mechada / Harina PAN / Queso Rallado"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-field">
                  <label>Categoría</label>
                  <select
                    value={categoriaInsumo}
                    onChange={(e) => setCategoriaInsumo(e.target.value)}
                    className="form-input"
                  >
                    {["Carnes", "Masas", "Quesos", "Vegetales", "Salsas", "Bebidas", "Empaque", "General"].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-grid-3">
                <div className="form-field">
                  <label>Unidad de Medida</label>
                  <select
                    value={unidadMedida}
                    onChange={(e) => setUnidadMedida(e.target.value as UnidadMedida)}
                    className="form-input"
                  >
                    <option value="g">Gramos (g)</option>
                    <option value="ml">Mililitros (ml)</option>
                    <option value="und">Unidades (und)</option>
                  </select>
                </div>

                <div className="form-field">
                  <label>Stock Actual Inicial</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={stockActual}
                    onChange={(e) => setStockActual(parseFloat(e.target.value) || 0)}
                    className="form-input"
                  />
                </div>

                <div className="form-field">
                  <label>Stock Mínimo de Alerta</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={stockMinimo}
                    onChange={(e) => setStockMinimo(parseFloat(e.target.value) || 0)}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-field">
                <label>
                  Costo Unitario ($ USD por {unidadMedida}):
                  <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6 }}>
                    {unidadMedida === "g" && `(1 kg = $${(costoUnitario * 1000).toFixed(2)})`}
                    {unidadMedida === "ml" && `(1 Litro = $${(costoUnitario * 1000).toFixed(2)})`}
                  </span>
                </label>
                <input
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  required
                  value={costoUnitario}
                  onChange={(e) => setCostoUnitario(parseFloat(e.target.value) || 0)}
                  className="form-input"
                />
              </div>

              {/* Selector de Proveedores que Suministran este Insumo */}
              {proveedores.length > 0 && (
                <div className="form-field">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <label style={{ margin: 0 }}>
                      🏢 Proveedores que lo Suministran ({proveedoresSeleccionados.length} seleccionados)
                    </label>
                    {proveedoresSeleccionados.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setProveedoresSeleccionados([])}
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
                  <div className="insumos-picker-box" style={{ maxHeight: 140 }}>
                    <div className="insumos-picker-grid">
                      {proveedores.map((p) => {
                        const sel = proveedoresSeleccionados.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => toggleProveedor(p.id)}
                            className={`insumo-chip-item ${sel ? "insumo-chip-active" : ""}`}
                          >
                            <span>{sel ? "✅" : "➕"}</span>
                            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              🏢 {p.nombre}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

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
                  {guardando ? "Guardando..." : "💾 Guardar Insumo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ajuste Rápido de Stock / Merma */}
      {modalAjusteAbierto && insumoSeleccionado && (
        <div className="modal-overlay">
          <div className="modal-recipe-card" style={{ maxWidth: 440 }}>
            <div className="modal-recipe-header">
              <h2>Ajustar Inventario: {insumoSeleccionado.nombre}</h2>
              <button
                type="button"
                onClick={() => setModalAjusteAbierto(false)}
                className="btn-modal-close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAjustarStock} className="recipe-form">
              <div className="form-field">
                <label>
                  Nuevo Stock Real en Despensa ({insumoSeleccionado.unidad_medida}):
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={nuevoStockAjuste}
                  onChange={(e) => setNuevoStockAjuste(parseFloat(e.target.value) || 0)}
                  className="form-input"
                  style={{ fontSize: 20, fontWeight: 800 }}
                />
              </div>

              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                💡 Usa este ajuste al realizar conteo físico al final de jornada o registrar mermas imprevistas.
              </p>

              <div className="modal-recipe-actions">
                <button
                  type="button"
                  onClick={() => setModalAjusteAbierto(false)}
                  className="btn-cancel"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="btn-submit-recipe"
                >
                  {guardando ? "Guardando..." : "⚖️ Confirmar Ajuste"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
