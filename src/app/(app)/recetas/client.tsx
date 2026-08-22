"use client";

import { useState, useMemo } from "react";
import { Producto, Insumo, Categoria } from "@/types/database";
import { guardarPlatoYReceta, eliminarPlato } from "./actions";
import { sounds } from "@/lib/sound-effects";

interface RecetasClientProps {
  productos: Producto[];
  insumos: Insumo[];
  categorias: Categoria[];
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
}: RecetasClientProps) {
  const [modoVista, setModoVista] = useState<"grid" | "filas">("grid");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

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
              onClick={() => {
                sounds.playPop();
                setModoVista("grid");
              }}
              className={`view-mode-btn ${modoVista === "grid" ? "active" : ""}`}
              title="Vista en Tarjetas / Cuadros"
            >
              ⊞ Cuadros
            </button>
            <button
              type="button"
              onClick={() => {
                sounds.playPop();
                setModoVista("filas");
              }}
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
                <div className="receta-card-header">
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
                <div className="receta-metrics-row">
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
                <div className="receta-ingredients-list">
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
                  <tr key={prod.id} className="detailed-table-row">
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 22 }}>{prod.icono || "🫓"}</span>
                        <div>
                          <strong style={{ fontSize: 14, color: "var(--text)" }}>{prod.nombre}</strong>
                          <div>
                            <span className="receta-cat-badge">{prod.categoria?.nombre || "General"}</span>
                            {prod.popular && <span className="badge-popular" style={{ marginLeft: 4 }}>🔥 Popular</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ maxWidth: 220, fontSize: 12, color: "var(--text-muted)" }}>
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
                    <td style={{ maxWidth: 280 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {(prod.ingredientes || []).length === 0 ? (
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Sin fórmula</span>
                        ) : (
                          (prod.ingredientes || []).map((ing, idx) => (
                            <span key={idx} className="ingredient-tag" style={{ fontSize: 11, padding: "2px 6px" }}>
                              {ing.insumo?.nombre}: <strong>{Number(ing.cantidad)}{ing.insumo?.unidad_medida || "g"}</strong>
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => abrirEditar(prod)}
                          className="btn-insumo-adjust"
                          style={{ padding: "4px 8px", fontSize: 12 }}
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEliminar(prod.id, prod.nombre)}
                          className="btn-delete-receta"
                          style={{ padding: "4px 8px" }}
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

      {/* Modal Crear / Editar Receta */}
      {modalAbierto && (
        <div className="modal-overlay">
          <div className="modal-recipe-card">
            <div className="modal-recipe-header">
              <h2>{editandoId ? "Editar Receta y Fórmula" : "Nueva Receta de Plato"}</h2>
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
                  <label>Categoría</label>
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
                  />
                </div>

                <div className="form-field form-checkbox-center">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={popular}
                      onChange={(e) => setPopular(e.target.checked)}
                    />
                    <span>🔥 Plato Estrella / Popular</span>
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
                  <h4>🌾 Ingredientes & Descuento en Gramos (BOM)</h4>
                  <button
                    type="button"
                    onClick={agregarFilaIngrediente}
                    className="btn-add-ingredient-row"
                  >
                    + Añadir Insumo
                  </button>
                </div>

                {ingredientes.map((ing, index) => {
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

                      <div className="builder-cost-col">
                        <span className="builder-cost-val">
                          ${costoFila.toFixed(3)}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => eliminarIngrediente(index)}
                        className="btn-remove-ingredient"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Barra Resumen de Costo & Margen en Tiempo Real */}
              <div className="recipe-calc-summary">
                <div className="calc-summary-item">
                  <span>Costo Materia Prima:</span>
                  <strong>${costoTotalReceta.toFixed(2)} USD</strong>
                </div>
                <div className="calc-summary-item">
                  <span>Ganancia Neta:</span>
                  <strong className="text-green">
                    ${gananciaEstimada.toFixed(2)} USD
                  </strong>
                </div>
                <div className="calc-summary-item">
                  <span>Margen de Ganancia:</span>
                  <strong className="text-primary">{margenEstimadoPct}%</strong>
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
