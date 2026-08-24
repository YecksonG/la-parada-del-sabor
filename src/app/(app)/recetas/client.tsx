"use client";

import { useState, useEffect, useMemo } from "react";
import { Producto, Insumo, Categoria } from "@/types/database";
import { guardarPlatoYReceta, eliminarPlato } from "./actions";
import { sounds } from "@/lib/sound-effects";

interface RecetasClientProps {
  productos: Producto[];
  insumos: Insumo[];
  categorias: Categoria[];
  tasaBcv?: number;
}

type IngredienteForm = {
  insumo_id: string;
  cantidad: number;
  notas: string;
};

export default function RecetasClient({
  productos,
  insumos,
  categorias,
  tasaBcv = 0,
}: RecetasClientProps) {
  const [modoVista, setModoVista] = useState<"grid" | "filas">("grid");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [detalleProducto, setDetalleProducto] = useState<Producto | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  // Cargar preferencia guardada al montar
  useEffect(() => {
    const saved = localStorage.getItem("vista_recetas");
    if (saved === "grid" || saved === "filas") {
      setModoVista(saved);
    }
  }, []);

  const cambiarModoVista = (modo: "grid" | "filas") => {
    sounds.playPop();
    setModoVista(modo);
    if (typeof window !== "undefined") {
      localStorage.setItem("vista_recetas", modo);
    }
  };

  // Form states
  const [nombre, setNombre] = useState("");
  const [categoriaId, setCategoriaId] = useState<string | null>(categorias[0]?.id || null);
  const [descripcion, setDescripcion] = useState("");
  const [precioUsd, setPrecioUsd] = useState<number>(3.5);
  const [icono, setIcono] = useState("🫓");
  const [popular, setPopular] = useState(false);
  const [ingredientes, setIngredientes] = useState<IngredienteForm[]>([
    { insumo_id: insumos[0]?.id || "", cantidad: 150, notas: "" },
  ]);

  const abrirCrear = () => {
    sounds.playPop();
    setEditandoId(null);
    setNombre("");
    setCategoriaId(categorias[0]?.id || null);
    setDescripcion("");
    setPrecioUsd(3.5);
    setIcono("🫓");
    setPopular(false);
    setIngredientes(
      insumos.length > 0
        ? [{ insumo_id: insumos[0].id, cantidad: 150, notas: "" }]
        : []
    );
    setModalAbierto(true);
  };

  const abrirEditar = (prod: Producto) => {
    sounds.playPop();
    setEditandoId(prod.id);
    setNombre(prod.nombre);
    setCategoriaId(prod.categoria_id);
    setDescripcion(prod.descripcion || "");
    setPrecioUsd(Number(prod.precio_usd));
    setIcono(prod.icono || "🫓");
    setPopular(prod.popular);
    setIngredientes(
      (prod.ingredientes || []).map((ing) => ({
        insumo_id: ing.insumo_id,
        cantidad: Number(ing.cantidad),
        notas: ing.notas || "",
      }))
    );
    setModalAbierto(true);
  };

  const abrirDetalle = (prod: Producto) => {
    sounds.playPop();
    setDetalleProducto(prod);
  };

  const agregarFilaIngrediente = () => {
    sounds.playPop();
    if (insumos.length === 0) return;
    setIngredientes((prev) => [
      ...prev,
      { insumo_id: insumos[0].id, cantidad: 50, notas: "" },
    ]);
  };

  const modificarIngrediente = (
    index: number,
    campo: keyof IngredienteForm,
    valor: any
  ) => {
    setIngredientes((prev) => {
      const nuevo = [...prev];
      nuevo[index] = { ...nuevo[index], [campo]: valor };
      return nuevo;
    });
  };

  const eliminarIngrediente = (index: number) => {
    sounds.playDelete();
    setIngredientes((prev) => prev.filter((_, i) => i !== index));
  };

  // Cálculo de Costo de Receta en el Formulario
  const costoTotalReceta = useMemo(() => {
    return ingredientes.reduce((acc, ing) => {
      const insumo = insumos.find((i) => i.id === ing.insumo_id);
      const costoUnit = Number(insumo?.costo_unitario_usd || 0);
      return acc + costoUnit * Number(ing.cantidad);
    }, 0);
  }, [ingredientes, insumos]);

  const gananciaEstimada = precioUsd - costoTotalReceta;
  const margenEstimadoPct =
    precioUsd > 0 ? ((gananciaEstimada / precioUsd) * 100).toFixed(1) : "0.0";

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || guardando) return;

    setGuardando(true);
    const res = await guardarPlatoYReceta({
      producto_id: editandoId || undefined,
      nombre,
      categoria_id: categoriaId,
      descripcion,
      precio_usd: Number(precioUsd),
      icono,
      popular,
      ingredientes: ingredientes.filter((i) => i.insumo_id && i.cantidad > 0),
    });

    setGuardando(false);

    if (res.ok) {
      sounds.playKitchenBell();
      setModalAbierto(false);
    } else {
      alert(res.error || "Hubo un error al guardar la receta.");
    }
  };

  const handleEliminar = async (id: string, nombreProd: string) => {
    if (!confirm(`¿Eliminar ${nombreProd} del menú y sus fórmulas asociadas?`))
      return;

    sounds.playDelete();
    const res = await eliminarPlato(id);
    if (!res.ok) {
      alert(res.error || "No se pudo eliminar el plato.");
    }
  };

  return (
    <main className="recetas-container">
      {/* Header */}
      <div className="recetas-header">
        <div>
          <h1 className="recetas-title">🌾 Recetas & Escandallo por Gramos</h1>
          <p className="recetas-subtitle">
            Define las proporciones exactas en gramos para el descuento automático de inventario al vender.
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
            <span>+</span> Nueva Receta / Arepa
          </button>
        </div>
      </div>

      {productos.length === 0 ? (
        <div className="recetas-empty-box">
          <span style={{ fontSize: 48 }}>🌾</span>
          <h3>No hay recetas configuradas</h3>
          <p>Crea tu primera arepa o plato con sus ingredientes en gramos.</p>
          <button type="button" onClick={abrirCrear} className="btn-primary-action">
            Crear Primera Receta
          </button>
        </div>
      ) : modoVista === "grid" ? (
        /* VISTA 1: CUADROS / GRID */
        <div className="recetas-grid">
          {productos.map((prod) => {
            const costoProd = (prod.ingredientes || []).reduce((acc, ing) => {
              const costoUnit = Number(ing.insumo?.costo_unitario_usd || 0);
              return acc + costoUnit * Number(ing.cantidad);
            }, 0);

            const ganancia = Number(prod.precio_usd) - costoProd;
            const margenPct =
              Number(prod.precio_usd) > 0
                ? ((ganancia / Number(prod.precio_usd)) * 100).toFixed(1)
                : "0.0";

            return (
              <div key={prod.id} className="receta-card">
                <div
                  className="receta-card-header"
                  onClick={() => abrirDetalle(prod)}
                  style={{ cursor: "pointer" }}
                  title="Ver ficha técnica completa"
                >
                  <div className="receta-card-identity">
                    <span className="receta-icon">{prod.icono || "🫓"}</span>
                    <div>
                      <h3 className="receta-name">{prod.nombre}</h3>
                      <span className="receta-cat-badge">
                        {prod.categoria?.nombre || "Sin Categoría"}
                      </span>
                    </div>
                  </div>
                  <div className="receta-price-badge">
                    ${Number(prod.precio_usd).toFixed(2)}
                  </div>
                </div>

                {prod.descripcion && (
                  <p className="receta-desc">{prod.descripcion}</p>
                )}

                {/* Métricas de Costo y Margen */}
                <div
                  className="receta-metrics-row"
                  onClick={() => abrirDetalle(prod)}
                  style={{ cursor: "pointer" }}
                  title="Ver detalles de costos"
                >
                  <div className="metric-box">
                    <span className="metric-label">Costo Insumos:</span>
                    <strong className="metric-val">${costoProd.toFixed(2)}</strong>
                  </div>
                  <div className="metric-box">
                    <span className="metric-label">Ganancia Neta:</span>
                    <strong className="metric-val text-green">${ganancia.toFixed(2)}</strong>
                  </div>
                  <div className="metric-box">
                    <span className="metric-label">Margen:</span>
                    <strong className="metric-val text-primary">{margenPct}%</strong>
                  </div>
                </div>

                {/* Lista de Ingredientes en Gramos */}
                <div
                  className="receta-ingredients-list"
                  onClick={() => abrirDetalle(prod)}
                  style={{ cursor: "pointer" }}
                  title="Ver todos los ingredientes en detalle"
                >
                  <span className="ingredients-title">Fórmula por ración:</span>
                  {(prod.ingredientes || []).length === 0 ? (
                    <span className="no-ingredients-hint">⚠️ Sin ingredientes asignados</span>
                  ) : (
                    (prod.ingredientes || []).map((ing, iIdx) => (
                      <div key={iIdx} className="ingredient-tag">
                        <span>{ing.insumo?.nombre || "Insumo"}</span>
                        <strong>
                          {Number(ing.cantidad)} {ing.insumo?.unidad_medida || "g"}
                        </strong>
                      </div>
                    ))
                  )}
                </div>

                {/* Acciones */}
                <div className="receta-card-footer">
                  <button
                    type="button"
                    onClick={() => abrirEditar(prod)}
                    className="btn-edit-receta"
                  >
                    ✏️ Editar Fórmula
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEliminar(prod.id, prod.nombre)}
                    className="btn-delete-receta"
                    title="Eliminar plato"
                  >
                    🗑️
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
                <th>Plato & Categoría</th>
                <th>Descripción</th>
                <th>PVP Venta</th>
                <th>Costo Materia Prima</th>
                <th>Ganancia Neta</th>
                <th>Margen %</th>
                <th>Fórmula Exacta (Gramos / ml)</th>
                <th style={{ textAlign: "right" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productos.map((prod) => {
                const prodIngredientes = prod.ingredientes || [];
                const costoProd = prodIngredientes.reduce((acc, ing) => {
                  const costoUnit = Number(ing.insumo?.costo_unitario_usd || 0);
                  return acc + costoUnit * Number(ing.cantidad);
                }, 0);

                const ganancia = Number(prod.precio_usd) - costoProd;
                const margenPct =
                  Number(prod.precio_usd) > 0
                    ? ((ganancia / Number(prod.precio_usd)) * 100).toFixed(1)
                    : "0.0";

                return (
                  <tr key={prod.id} className="detailed-table-row">
                    <td
                      onClick={() => abrirDetalle(prod)}
                      style={{ cursor: "pointer" }}
                      title="Ver ficha técnica completa"
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 24 }}>{prod.icono || "🫓"}</span>
                        <div>
                          <strong style={{ fontSize: 14, color: "var(--text)" }}>{prod.nombre}</strong>
                          <div style={{ marginTop: 2 }}>
                            <span className="receta-cat-badge">{prod.categoria?.nombre || "General"}</span>
                            {prod.popular && <span className="badge-popular" style={{ marginLeft: 4 }}>🔥 Popular</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td
                      onClick={() => abrirDetalle(prod)}
                      style={{ maxWidth: 200, fontSize: 12, color: "var(--text-muted)", cursor: "pointer" }}
                    >
                      {prod.descripcion || "—"}
                    </td>
                    <td>
                      <strong className="text-primary" style={{ fontSize: 14 }}>
                        ${Number(prod.precio_usd).toFixed(2)} USD
                      </strong>
                    </td>
                    <td>
                      <strong style={{ fontSize: 13, color: "var(--text)" }}>
                        ${costoProd.toFixed(2)} USD
                      </strong>
                    </td>
                    <td>
                      <strong className="text-green" style={{ fontSize: 13 }}>
                        +${ganancia.toFixed(2)} USD
                      </strong>
                    </td>
                    <td>
                      <span className="tasa-pill-label bcv-tag" style={{ fontSize: 12 }}>
                        {margenPct}%
                      </span>
                    </td>
                    {/* Preview de Fórmula con límite de 3 etiquetas */}
                    <td
                      style={{ maxWidth: 280, cursor: "pointer" }}
                      onClick={() => abrirDetalle(prod)}
                      title="Ver todos los ingredientes en detalle"
                    >
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                        {prodIngredientes.length === 0 ? (
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Sin fórmula</span>
                        ) : (
                          <>
                            {prodIngredientes.slice(0, 3).map((ing, idx) => (
                              <span
                                key={idx}
                                className="ingredient-tag"
                                style={{ fontSize: 11, padding: "2px 6px" }}
                              >
                                {ing.insumo?.nombre}: <strong>{Number(ing.cantidad)}{ing.insumo?.unidad_medida || "g"}</strong>
                              </span>
                            ))}
                            {prodIngredientes.length > 3 && (
                              <span
                                className="ingredient-tag-more"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  abrirDetalle(prod);
                                }}
                                title="Ver todos los ingredientes"
                              >
                                +{prodIngredientes.length - 3} más
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => abrirEditar(prod)}
                          className="btn-insumo-adjust"
                          style={{ padding: "5px 10px", fontSize: 12, width: "auto" }}
                          title="Editar"
                        >
                          ✏️ Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEliminar(prod.id, prod.nombre)}
                          className="btn-delete-receta"
                          style={{ padding: "5px 8px" }}
                          title="Eliminar"
                        >
                          🗑️
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

      {/* Modal Ficha Técnica & Detalle de Receta / Producto */}
      {detalleProducto && (
        <div className="modal-overlay" onClick={() => setDetalleProducto(null)}>
          <div className="modal-product-detail-card" onClick={(e) => e.stopPropagation()}>
            {/* Hero Header */}
            <div className="product-detail-hero">
              <div className="product-detail-info">
                <div className="product-detail-avatar">
                  {detalleProducto.icono || "🫓"}
                </div>
                <div className="product-detail-meta">
                  <h2>{detalleProducto.nombre}</h2>
                  <div className="product-detail-badges">
                    <span className="receta-cat-badge">
                      {detalleProducto.categoria?.nombre || "General"}
                    </span>
                    {detalleProducto.popular && (
                      <span className="badge-popular">🔥 Plato Estrella / Popular</span>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetalleProducto(null)}
                className="btn-modal-close"
                title="Cerrar"
              >
                ✕
              </button>
            </div>

            {detalleProducto.descripcion && (
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
                {detalleProducto.descripcion}
              </p>
            )}

            {/* KPIs Financieros */}
            {(() => {
              const costoTotal = (detalleProducto.ingredientes || []).reduce((acc, ing) => {
                const cUnit = Number(ing.insumo?.costo_unitario_usd || 0);
                return acc + cUnit * Number(ing.cantidad);
              }, 0);
              const pvp = Number(detalleProducto.precio_usd);
              const ganancia = pvp - costoTotal;
              const margen = pvp > 0 ? ((ganancia / pvp) * 100).toFixed(1) : "0.0";
              const pvpBs = tasaBcv > 0 ? pvp * tasaBcv : 0;
              const costoBs = tasaBcv > 0 ? costoTotal * tasaBcv : 0;

              return (
                <>
                  <div className="product-detail-kpis-grid">
                    <div className="product-kpi-card">
                      <span className="product-kpi-label">PVP Venta</span>
                      <strong className="product-kpi-val text-primary">${pvp.toFixed(2)} USD</strong>
                      {tasaBcv > 0 && (
                        <span className="product-kpi-sub">Bs. {pvpBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      )}
                    </div>
                    <div className="product-kpi-card">
                      <span className="product-kpi-label">Costo Insumos</span>
                      <strong className="product-kpi-val">${costoTotal.toFixed(2)} USD</strong>
                      {tasaBcv > 0 && (
                        <span className="product-kpi-sub">Bs. {costoBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      )}
                    </div>
                    <div className="product-kpi-card">
                      <span className="product-kpi-label">Ganancia Neta</span>
                      <strong className="product-kpi-val text-green">+${ganancia.toFixed(2)} USD</strong>
                      <span className="product-kpi-sub">Por ración</span>
                    </div>
                    <div className="product-kpi-card">
                      <span className="product-kpi-label">Margen Utilidad</span>
                      <strong
                        className="product-kpi-val"
                        style={{ color: Number(margen) >= 50 ? "var(--green)" : "var(--primary)" }}
                      >
                        {margen}%
                      </strong>
                      <span className="product-kpi-sub">Rentabilidad</span>
                    </div>
                  </div>

                  {/* Tabla Detallada BOM */}
                  <div className="product-detail-bom-box">
                    <div className="product-detail-bom-header">
                      <span>🌾 Fórmula & Escandallo de Ingredientes</span>
                      <span style={{ color: "var(--text-muted)" }}>
                        {(detalleProducto.ingredientes || []).length} insumos asignados
                      </span>
                    </div>
                    <table className="product-bom-table">
                      <thead>
                        <tr>
                          <th>Insumo</th>
                          <th>Cantidad</th>
                          <th>Costo Unitario</th>
                          <th>Costo en Ración</th>
                          <th style={{ textAlign: "right" }}>% Costo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(detalleProducto.ingredientes || []).length === 0 ? (
                          <tr>
                            <td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)", padding: 20 }}>
                              Este plato no tiene ingredientes configurados en su receta.
                            </td>
                          </tr>
                        ) : (
                          (detalleProducto.ingredientes || []).map((ing, idx) => {
                            const cUnit = Number(ing.insumo?.costo_unitario_usd || 0);
                            const cTotal = cUnit * Number(ing.cantidad);
                            const pct = costoTotal > 0 ? ((cTotal / costoTotal) * 100).toFixed(1) : "0.0";
                            return (
                              <tr key={idx}>
                                <td>
                                  <strong>{ing.insumo?.nombre || "Insumo"}</strong>
                                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                    {ing.insumo?.categoria_insumo || "Despensa"}
                                  </div>
                                </td>
                                <td>
                                  <strong>{Number(ing.cantidad)} {ing.insumo?.unidad_medida || "g"}</strong>
                                </td>
                                <td>
                                  ${cUnit.toFixed(4)} / {ing.insumo?.unidad_medida || "g"}
                                </td>
                                <td>
                                  <strong style={{ color: "var(--text)" }}>${cTotal.toFixed(3)}</strong>
                                </td>
                                <td style={{ textAlign: "right" }}>
                                  <span className="insumo-cat-tag" style={{ fontSize: 11 }}>
                                    {pct}%
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                      {(detalleProducto.ingredientes || []).length > 0 && (
                        <tfoot>
                          <tr>
                            <td colSpan={3} style={{ textAlign: "right" }}>
                              <strong>Costo Total del Plato:</strong>
                            </td>
                            <td colSpan={2}>
                              <strong className="text-primary" style={{ fontSize: 14 }}>
                                ${costoTotal.toFixed(2)} USD
                              </strong>
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </>
              );
            })()}

            {/* Botones de acción */}
            <div className="modal-recipe-actions">
              <button
                type="button"
                onClick={() => setDetalleProducto(null)}
                className="btn-cancel"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => {
                  const prod = detalleProducto;
                  setDetalleProducto(null);
                  abrirEditar(prod);
                }}
                className="btn-submit-recipe"
              >
                ✏️ Editar Receta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear / Editar Receta */}
      {modalAbierto && (
        <div className="modal-overlay" onClick={() => setModalAbierto(false)}>
          <div className="modal-recipe-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-recipe-header">
              <h2>
                <span>🌾</span> {editandoId ? "Editar Receta y Fórmula" : "Nueva Receta de Plato / Arepa"}
              </h2>
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
                  <label>Nombre del Plato / Arepa</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Arepa Pelúa / Empanada de Cazón"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-field">
                  <label>Categoría del Menú</label>
                  <select
                    value={categoriaId || ""}
                    onChange={(e) => setCategoriaId(e.target.value)}
                    className="form-input"
                  >
                    {categorias.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icono} {cat.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-grid-3">
                <div className="form-field">
                  <label>Precio de Venta ($ USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.1"
                    required
                    value={precioUsd}
                    onChange={(e) => setPrecioUsd(parseFloat(e.target.value) || 0)}
                    className="form-input"
                  />
                </div>

                <div className="form-field">
                  <label>Icono / Emoji</label>
                  <input
                    type="text"
                    required
                    value={icono}
                    onChange={(e) => setIcono(e.target.value)}
                    className="form-input"
                    style={{ textAlign: "center", fontSize: 18 }}
                  />
                </div>

                <div className="form-field form-checkbox-center">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={popular}
                      onChange={(e) => setPopular(e.target.checked)}
                    />
                    <span>🔥 Plato Popular</span>
                  </label>
                </div>
              </div>

              <div className="form-field">
                <label>Descripción / Relleno (opcional)</label>
                <input
                  type="text"
                  placeholder="Carne mechada jugosa con abundante queso amarillo rallado"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="form-input"
                />
              </div>

              {/* Sección de Ingredientes / Escandallo en Gramos */}
              <div className="recipe-ingredients-builder">
                <div className="builder-header">
                  <h4>🌾 Ingredientes & Descuento en Gramos ({ingredientes.length})</h4>
                  <button
                    type="button"
                    onClick={agregarFilaIngrediente}
                    className="btn-add-ingredient-row"
                  >
                    + Añadir Insumo
                  </button>
                </div>

                {ingredientes.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "16px", color: "var(--text-muted)", fontSize: 12 }}>
                    No has agregado ingredientes a esta receta. Pulsa <strong>+ Añadir Insumo</strong>.
                  </div>
                ) : (
                  ingredientes.map((ing, index) => {
                    const insumoActual = insumos.find((i) => i.id === ing.insumo_id);
                    const costoFila =
                      (Number(insumoActual?.costo_unitario_usd) || 0) *
                      Number(ing.cantidad);

                    return (
                      <div key={index} className="ingredient-builder-row">
                        <div className="builder-select-col">
                          <select
                            value={ing.insumo_id}
                            onChange={(e) =>
                              modificarIngrediente(index, "insumo_id", e.target.value)
                            }
                            className="form-input"
                          >
                            {insumos.map((i) => (
                              <option key={i.id} value={i.id}>
                                {i.nombre} (${Number(i.costo_unitario_usd).toFixed(4)}/{i.unidad_medida})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="builder-qty-col">
                          <input
                            type="number"
                            step="any"
                            min="0.1"
                            required
                            value={ing.cantidad}
                            onChange={(e) =>
                              modificarIngrediente(
                                index,
                                "cantidad",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="form-input"
                          />
                          <span className="builder-unit-label">
                            {insumoActual?.unidad_medida || "g"}
                          </span>
                        </div>

                        <div className="builder-cost-col" title="Costo generado por esta cantidad">
                          <span className="builder-cost-val">
                            ${costoFila.toFixed(3)}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => eliminarIngrediente(index)}
                          className="btn-remove-ingredient"
                          title="Eliminar ingrediente"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Barra Resumen de Costo & Margen en Tiempo Real */}
              <div className="recipe-calc-summary">
                <div className="calc-summary-item">
                  <span>Costo Materia Prima:</span>
                  <strong style={{ color: "var(--text)" }}>${costoTotalReceta.toFixed(2)} USD</strong>
                </div>
                <div className="calc-summary-item">
                  <span>Ganancia Neta:</span>
                  <strong className="text-green">
                    +${gananciaEstimada.toFixed(2)} USD
                  </strong>
                </div>
                <div className="calc-summary-item">
                  <span>Margen Estimado:</span>
                  <strong
                    style={{
                      color:
                        Number(margenEstimadoPct) >= 50
                          ? "var(--green)"
                          : Number(margenEstimadoPct) >= 30
                          ? "var(--primary)"
                          : "var(--accent)",
                    }}
                  >
                    {margenEstimadoPct}%
                  </strong>
                </div>
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
                  {guardando ? "Guardando..." : "💾 Guardar Receta & Costos"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
