"use client";

import { useState, useMemo } from "react";
import { Producto, Insumo, Categoria } from "@/types/database";
import { guardarPlatoYReceta, eliminarPlato } from "./actions";

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
    setIngredientes((prev) => prev.filter((_, i) => i !== index));
  };

  // Cálculo de Costo de Receta en el Formulario
  const costoTotalReceta = useMemo(() => {
    return ingredientes.reduce((acc, ing) => {
      const insumo = insumos.find((i) => i.id === ing.insumo_id);
      if (!insumo) return acc;
      const costo = Number(insumo.costo_unitario_usd) * (Number(ing.cantidad) || 0);
      return acc + costo;
    }, 0);
  }, [ingredientes, insumos]);

  const margenGanancia = useMemo(() => {
    if (precioUsd <= 0) return 0;
    const ganancia = precioUsd - costoTotalReceta;
    return ((ganancia / precioUsd) * 100).toFixed(1);
  }, [precioUsd, costoTotalReceta]);

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
      ingredientes,
    });
    setGuardando(false);

    if (res.ok) {
      setModalAbierto(false);
    } else {
      alert(res.error || "Error al guardar la receta.");
    }
  };

  const handleEliminar = async (id: string, nombreProd: string) => {
    if (confirm(`¿Estás seguro de eliminar el plato "${nombreProd}"?`)) {
      await eliminarPlato(id);
    }
  };

  return (
    <main className="recetas-container">
      {/* Header */}
      <div className="recetas-header">
        <div>
          <h1 className="recetas-title">🌾 Motor de Recetas & Escandallo</h1>
          <p className="recetas-subtitle">
            Define las proporciones exactas en gramos para el descuento automático de inventario al vender.
          </p>
        </div>
        <button type="button" onClick={abrirCrear} className="btn-primary-action">
          <span>+</span> Nueva Receta / Arepa
        </button>
      </div>

      {/* Grid de Platos y Fórmulas */}
      <div className="recetas-grid">
        {productos.length === 0 ? (
          <div className="recetas-empty-box">
            <span style={{ fontSize: 48 }}>🌾</span>
            <h3>No hay recetas configuradas</h3>
            <p>Crea tu primera arepa o plato con sus ingredientes en gramos.</p>
            <button type="button" onClick={abrirCrear} className="btn-primary-action">
              Crear Primera Receta
            </button>
          </div>
        ) : (
          productos.map((prod) => {
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
          })
        )}
      </div>

      {/* Modal Creador / Editor de Receta */}
      {modalAbierto && (
        <div className="modal-overlay">
          <div className="modal-recipe-card">
            <div className="modal-recipe-header">
              <h2>{editandoId ? "Editar Receta & Escandallo" : "Nueva Receta de Plato"}</h2>
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
                    placeholder="Ej. Arepa Reina Pepiada"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-field">
                  <label>Categoría</label>
                  <select
                    value={categoriaId || ""}
                    onChange={(e) => setCategoriaId(e.target.value || null)}
                    className="form-input"
                  >
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icono} {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-grid-3">
                <div className="form-field">
                  <label>Precio Venta ($ USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={precioUsd}
                    onChange={(e) => setPrecioUsd(parseFloat(e.target.value) || 0)}
                    className="form-input"
                  />
                </div>

                <div className="form-field">
                  <label>Ícono</label>
                  <select
                    value={icono}
                    onChange={(e) => setIcono(e.target.value)}
                    className="form-input"
                  >
                    <option value="🫓">🫓 Arepa</option>
                    <option value="🥟">🥟 Empanada</option>
                    <option value="🥤">🥤 Bebida</option>
                    <option value="🧀">🧀 Ración / Extra</option>
                    <option value="🥩">🥩 Carne</option>
                    <option value="🍗">🍗 Pollo</option>
                    <option value="🥑">🥑 Aguacate</option>
                  </select>
                </div>

                <div className="form-field checkbox-field">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={popular}
                      onChange={(e) => setPopular(e.target.checked)}
                    />
                    <span>🔥 Plato Estrella</span>
                  </label>
                </div>
              </div>

              <div className="form-field">
                <label>Descripción corta</label>
                <input
                  type="text"
                  placeholder="Ej. Pollo desmechado con aguacate y mayonesa casera"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="form-input"
                />
              </div>

              {/* Sección de Ingredientes en Gramos */}
              <div className="recipe-ingredients-builder">
                <div className="builder-header">
                  <h4>🌾 Ingredientes & Desglose en Gramos (BOM)</h4>
                  <button
                    type="button"
                    onClick={agregarFilaIngrediente}
                    className="btn-add-ingredient"
                  >
                    + Agregar Ingrediente
                  </button>
                </div>

                <div className="builder-rows">
                  {ingredientes.map((ing, index) => {
                    const insumoActual = insumos.find((i) => i.id === ing.insumo_id);
                    const costoFila =
                      (Number(insumoActual?.costo_unitario_usd) || 0) * (Number(ing.cantidad) || 0);

                    return (
                      <div key={index} className="builder-row">
                        <select
                          value={ing.insumo_id}
                          onChange={(e) =>
                            modificarIngrediente(index, "insumo_id", e.target.value)
                          }
                          className="form-input select-insumo"
                        >
                          {insumos.map((ins) => (
                            <option key={ins.id} value={ins.id}>
                              {ins.nombre} ({ins.unidad_medida})
                            </option>
                          ))}
                        </select>

                        <div className="input-qty-wrapper">
                          <input
                            type="number"
                            step="any"
                            min="0.01"
                            value={ing.cantidad}
                            onChange={(e) =>
                              modificarIngrediente(index, "cantidad", e.target.value)
                            }
                            className="form-input input-qty"
                          />
                          <span className="qty-unit-label">
                            {insumoActual?.unidad_medida || "g"}
                          </span>
                        </div>

                        <span className="cost-row-preview">
                          ${costoFila.toFixed(3)}
                        </span>

                        <button
                          type="button"
                          onClick={() => eliminarIngrediente(index)}
                          className="btn-remove-row"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Resumen del Costo de Producción */}
                <div className="recipe-cost-summary">
                  <div className="cost-summary-item">
                    <span>Costo Materia Prima:</span>
                    <strong>${costoTotalReceta.toFixed(2)} USD</strong>
                  </div>
                  <div className="cost-summary-item">
                    <span>Margen Estimado:</span>
                    <strong className="text-green">{margenGanancia}%</strong>
                  </div>
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
                  {guardando ? "Guardando..." : "💾 Guardar Fórmula"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
