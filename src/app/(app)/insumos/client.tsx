"use client";

import { useState, useMemo } from "react";
import { Insumo, UnidadMedida } from "@/types/database";
import { guardarInsumo, ajustarStockInsumo } from "./actions";

interface InsumosClientProps {
  insumos: Insumo[];
}

export default function InsumosClient({ insumos }: InsumosClientProps) {
  const [busqueda, setBusqueda] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modalAjusteAbierto, setModalAjusteAbierto] = useState(false);
  const [insumoSeleccionado, setInsumoSeleccionado] = useState<Insumo | null>(null);
  const [nuevoStockAjuste, setNuevoStockAjuste] = useState<number>(0);
  const [guardando, setGuardando] = useState(false);

  // Form states
  const [nombre, setNombre] = useState("");
  const [unidadMedida, setUnidadMedida] = useState<UnidadMedida>("g");
  const [stockActual, setStockActual] = useState<number>(1000);
  const [stockMinimo, setStockMinimo] = useState<number>(200);
  const [costoUnitario, setCostoUnitario] = useState<number>(0.005);
  const [categoriaInsumo, setCategoriaInsumo] = useState("Carnes");

  const abrirCrear = () => {
    setInsumoSeleccionado(null);
    setNombre("");
    setUnidadMedida("g");
    setStockActual(1000);
    setStockMinimo(200);
    setCostoUnitario(0.005);
    setCategoriaInsumo("Carnes");
    setModalAbierto(true);
  };

  const abrirEditar = (ins: Insumo) => {
    setInsumoSeleccionado(ins);
    setNombre(ins.nombre);
    setUnidadMedida(ins.unidad_medida);
    setStockActual(Number(ins.stock_actual));
    setStockMinimo(Number(ins.stock_minimo));
    setCostoUnitario(Number(ins.costo_unitario_usd));
    setCategoriaInsumo(ins.categoria_insumo || "General");
    setModalAbierto(true);
  };

  const abrirAjuste = (ins: Insumo) => {
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
    });
    setGuardando(false);

    if (res.ok) {
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
      setModalAjusteAbierto(false);
    } else {
      alert(res.error || "Error al ajustar el stock.");
    }
  };

  return (
    <main className="recetas-container">
      {/* Header */}
      <div className="recetas-header">
        <div>
          <h1 className="recetas-title">📦 Despensa & Stock de Materia Prima</h1>
          <p className="recetas-subtitle">
            Control de insumos en gramos (`g`), mililitros (`ml`) y unidades (`und`). Valor total en despensa:{" "}
            <strong className="text-primary">${valorTotalInventario.toFixed(2)} USD</strong>
          </p>
        </div>
        <button type="button" onClick={abrirCrear} className="btn-primary-action">
          <span>+</span> Nuevo Insumo
        </button>
      </div>

      {/* Barra de Búsqueda */}
      <div className="search-input-wrapper">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          placeholder="Buscar ingrediente o insumo en despensa..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="pos-search-input"
        />
      </div>

      {/* Grid de Insumos */}
      <div className="insumos-grid">
        {insumosFiltrados.map((ins) => {
          const stock = Number(ins.stock_actual);
          const min = Number(ins.stock_minimo);
          const estado = stock <= 0 ? "agotado" : stock <= min ? "bajo" : "optimo";

          // Formateo de cantidad para mostrar kg si son más de 1000g
          const stockFormateado =
            ins.unidad_medida === "g" && stock >= 1000
              ? `${(stock / 1000).toFixed(2)} kg (${stock.toLocaleString()} g)`
              : `${stock.toLocaleString()} ${ins.unidad_medida}`;

          const valorFila = stock * Number(ins.costo_unitario_usd);

          return (
            <div key={ins.id} className="insumo-card">
              <div className="insumo-card-header">
                <div>
                  <span className="insumo-cat-tag">{ins.categoria_insumo}</span>
                  <h3 className="insumo-name">{ins.nombre}</h3>
                </div>
                <span className={`stock-badge stock-badge-${estado}`}>
                  {estado === "optimo" ? "🟢 Óptimo" : estado === "bajo" ? "🟡 Bajo" : "🔴 Agotado"}
                </span>
              </div>

              <div className="insumo-stock-display">
                <span className="insumo-stock-value">{stockFormateado}</span>
                <span className="insumo-min-label">Mínimo sugerido: {min.toLocaleString()} {ins.unidad_medida}</span>
              </div>

              <div className="insumo-cost-details">
                <div className="cost-detail-item">
                  <span>Costo / {ins.unidad_medida}:</span>
                  <strong>${Number(ins.costo_unitario_usd).toFixed(4)}</strong>
                </div>
                <div className="cost-detail-item">
                  <span>Valor en Stock:</span>
                  <strong className="text-primary">${valorFila.toFixed(2)}</strong>
                </div>
              </div>

              <div className="insumo-card-footer">
                <button
                  type="button"
                  onClick={() => abrirAjuste(ins)}
                  className="btn-insumo-adjust"
                >
                  ⚖️ Ajustar Stock
                </button>
                <button
                  type="button"
                  onClick={() => abrirEditar(ins)}
                  className="btn-insumo-edit"
                >
                  ✏️
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Insumo Crear/Editar */}
      {modalAbierto && (
        <div className="modal-overlay">
          <div className="modal-recipe-card">
            <div className="modal-recipe-header">
              <h2>{insumoSeleccionado ? "Editar Insumo" : "Nuevo Insumo de Despensa"}</h2>
              <button type="button" onClick={() => setModalAbierto(false)} className="btn-modal-close">✕</button>
            </div>

            <form onSubmit={handleGuardar} className="recipe-form">
              <div className="form-grid-2">
                <div className="form-field">
                  <label>Nombre del Insumo</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Queso Amarillo Rallado"
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
                    <option value="Masas">Masas & Harinas</option>
                    <option value="Carnes">Carnes & Rellenos</option>
                    <option value="Lácteos">Lácteos & Quesos</option>
                    <option value="Vegetales">Vegetales</option>
                    <option value="Salsas">Salsas & Condimentos</option>
                    <option value="Bebidas">Bebidas & Jugos</option>
                    <option value="Empaque">Empaque & Envases</option>
                    <option value="General">General</option>
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
                  <label>Stock Actual</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={stockActual}
                    onChange={(e) => setStockActual(parseFloat(e.target.value) || 0)}
                    className="form-input"
                  />
                </div>

                <div className="form-field">
                  <label>Stock Mínimo</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={stockMinimo}
                    onChange={(e) => setStockMinimo(parseFloat(e.target.value) || 0)}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-field">
                <label>Costo Promedio por {unidadMedida} ($ USD)</label>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  required
                  value={costoUnitario}
                  onChange={(e) => setCostoUnitario(parseFloat(e.target.value) || 0)}
                  className="form-input"
                />
              </div>

              <div className="modal-recipe-actions">
                <button type="button" onClick={() => setModalAbierto(false)} className="btn-cancel">Cancelar</button>
                <button type="submit" disabled={guardando} className="btn-submit-recipe">
                  {guardando ? "Guardando..." : "💾 Guardar Insumo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ajuste Rápido de Stock */}
      {modalAjusteAbierto && insumoSeleccionado && (
        <div className="modal-overlay">
          <div className="modal-recipe-card" style={{ maxWidth: 420 }}>
            <div className="modal-recipe-header">
              <h2>⚖️ Ajustar Stock Físico</h2>
              <button type="button" onClick={() => setModalAjusteAbierto(false)} className="btn-modal-close">✕</button>
            </div>

            <form onSubmit={handleAjustarStock} className="recipe-form">
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Ajustando inventario para: <strong>{insumoSeleccionado.nombre}</strong>
              </p>

              <div className="form-field">
                <label>Nuevo Stock Real ({insumoSeleccionado.unidad_medida})</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={nuevoStockAjuste}
                  onChange={(e) => setNuevoStockAjuste(parseFloat(e.target.value) || 0)}
                  className="form-input"
                />
              </div>

              <div className="modal-recipe-actions">
                <button type="button" onClick={() => setModalAjusteAbierto(false)} className="btn-cancel">Cancelar</button>
                <button type="submit" disabled={guardando} className="btn-submit-recipe">
                  {guardando ? "Guardando..." : "✅ Confirmar Ajuste"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
