"use client";

import { useState, useMemo } from "react";
import { Insumo, UnidadMedida, Proveedor } from "@/types/database";
import { guardarInsumo, ajustarStockInsumo, eliminarInsumo } from "./actions";
import { sounds } from "@/lib/sound-effects";
import {
  parseProveedorInsumos,
} from "@/lib/proveedor-insumos-helper";

interface InsumosClientProps {
  insumos: Insumo[];
  proveedores?: Proveedor[];
  preciosReferenciales?: { [insumoId: string]: { [provId: string]: number } };
}

export default function InsumosClient({
  insumos,
  proveedores = [],
  preciosReferenciales = {},
}: InsumosClientProps) {
  const [modoVista, setModoVista] = useState<"grid" | "filas">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("vista_insumos");
      if (saved === "grid" || saved === "filas") return saved;
    }
    return "grid";
  });
  const [busqueda, setBusqueda] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modalGestionAbierto, setModalGestionAbierto] = useState(false);
  const [modoGestionStock, setModoGestionStock] = useState<"recargar" | "ajustar">("recargar");
  const [insumoGestion, setInsumoGestion] = useState<Insumo | null>(null);
  const [insumoSeleccionado, setInsumoSeleccionado] = useState<Insumo | null>(null);
  const [nuevoStockAjuste, setNuevoStockAjuste] = useState<number>(0);
  const [cantidadRecarga, setCantidadRecarga] = useState<number>(1000);
  const [guardando, setGuardando] = useState(false);

  // Mapa memoizado de proveedores por insumo para evitar O(N·M) parses por render
  const proveedoresPorInsumo = useMemo(() => {
    const map = new Map<string, Proveedor[]>();
    for (const ins of insumos) {
      map.set(ins.id, []);
    }
    for (const p of proveedores) {
      const { insumos_ids } = parseProveedorInsumos(p.notas);
      for (const id of insumos_ids) {
        const arr = map.get(id);
        if (arr && !arr.some((existing) => existing.id === p.id)) {
          arr.push(p);
        }
      }
    }
    return map;
  }, [insumos, proveedores]);

  const cambiarModoVista = (modo: "grid" | "filas") => {
    sounds.playPop();
    setModoVista(modo);
    if (typeof window !== "undefined") {
      localStorage.setItem("vista_insumos", modo);
    }
  };

  // Form states
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("todas");
  const [nombre, setNombre] = useState("");
  const [unidadMedida, setUnidadMedida] = useState<UnidadMedida>("g");
  const [stockActual, setStockActual] = useState<number>(1000);
  const [stockMinimo, setStockMinimo] = useState<number>(200);
  const [costoUnitario, setCostoUnitario] = useState<number>(0.005);
  const [categoriaInsumo, setCategoriaInsumo] = useState("Pre-elaborados");
  const [proveedoresSeleccionados, setProveedoresSeleccionados] = useState<string[]>([]);

  const abrirCrear = () => {
    sounds.playPop();
    setInsumoSeleccionado(null);
    setNombre("");
    setUnidadMedida("g");
    setStockActual(1000);
    setStockMinimo(200);
    setCostoUnitario(0.005);
    setCategoriaInsumo("Pre-elaborados");
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

  // Insumos clasificados como pre-elaborados (tolerante a espacios/saltos de línea en DB)
  const insumosPreelaborados = useMemo(() => {
    return insumos.filter((ins) => {
      const cat = (ins.categoria_insumo || "").toLowerCase().replace(/\s+/g, "");
      return cat.includes("pre-elaborado") || cat.includes("preelaborado");
    });
  }, [insumos]);

  const abrirModalGestion = (ins: Insumo, modoInicial: "recargar" | "ajustar" = "recargar") => {
    sounds.playPop();
    setInsumoGestion(ins);
    setModoGestionStock(modoInicial);
    setNuevoStockAjuste(Number(ins.stock_actual));
    // Default sugerido para recarga: 1000g para peso, 1000ml para volumen, 10 para unidades
    setCantidadRecarga(ins.unidad_medida === "und" ? 10 : 1000);
    setModalGestionAbierto(true);
  };

  const handleGuardarGestionStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!insumoGestion || guardando) return;

    setGuardando(true);
    let nuevoTotal = Number(insumoGestion.stock_actual);

    if (modoGestionStock === "recargar") {
      if (cantidadRecarga <= 0) {
        setGuardando(false);
        alert("La cantidad a recargar debe ser mayor a 0.");
        return;
      }
      nuevoTotal = Number(insumoGestion.stock_actual) + Number(cantidadRecarga);
    } else {
      if (nuevoStockAjuste < 0) {
        setGuardando(false);
        alert("El stock físico no puede ser negativo.");
        return;
      }
      nuevoTotal = Number(nuevoStockAjuste);
    }

    const res = await ajustarStockInsumo(insumoGestion.id, nuevoTotal);
    setGuardando(false);

    if (res.ok) {
      if (modoGestionStock === "recargar") {
        sounds.playKitchenBell();
      } else {
        sounds.playPop();
      }
      setModalGestionAbierto(false);
    } else {
      alert(res.error || "Error al actualizar el stock del insumo.");
    }
  };

  const CATEGORIAS_LISTA = [
    "Pre-elaborados",
    "Carnes",
    "Masas",
    "Quesos",
    "Lácteos",
    "Vegetales",
    "Salsas",
    "Grasas",
    "Condimentos",
    "Bebidas",
    "Empaques",
    "Desechables",
    "General",
  ];

  const insumosFiltrados = useMemo(() => {
    return insumos.filter((ins) => {
      const catInsumo = ins.categoria_insumo?.toLowerCase() || "general";
      const coincideBusqueda =
        ins.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        catInsumo.includes(busqueda.toLowerCase());

      // Nota: el solape entre "Empaques" y "Desechables" es DELIBERADO — retro-compatibilidad con valores legacy (singular/plural) en categoria_insumo; NO marcar como bug.
      const coincideCategoria =
        categoriaFiltro === "todas" ||
        catInsumo === categoriaFiltro.toLowerCase() ||
        (categoriaFiltro === "Empaques" && (catInsumo === "empaque" || catInsumo === "empaques" || catInsumo === "desechables")) ||
        (categoriaFiltro === "Desechables" && (catInsumo === "desechable" || catInsumo === "desechables" || catInsumo === "empaques"));

      return coincideBusqueda && coincideCategoria;
    });
  }, [insumos, busqueda, categoriaFiltro]);

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


  const handleEliminarInsumo = async (insumo: Insumo) => {
    if (
      !confirm(
        `¿Estás seguro de que deseas eliminar permanentemente el insumo "${insumo.nombre}"?\n\nEsta acción eliminará su registro de recetas asociadas y proveedores.`
      )
    ) {
      return;
    }

    const res = await eliminarInsumo(insumo.id);
    if (res.ok) {
      sounds.playDelete();
    } else {
      alert(res.error || "Error al eliminar el insumo.");
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

          <button
            type="button"
            onClick={() => {
              const primerPre = insumosPreelaborados[0] || insumos[0];
              if (primerPre) abrirModalGestion(primerPre, "recargar");
            }}
            className="btn-primary-action"
            style={{ background: "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)", color: "#fff" }}
            title="Registrar preparación de guiso o producción en cocina"
          >
            <span>🍲</span> Recargar Guiso
          </button>

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

      {/* Pestañas / Filtros Rápidos por Categoría */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 10, marginBottom: 12 }}>
        <button
          type="button"
          onClick={() => { sounds.playPop(); setCategoriaFiltro("todas"); }}
          className={`view-mode-btn ${categoriaFiltro === "todas" ? "active" : ""}`}
          style={{ padding: "6px 14px", borderRadius: "999px", fontSize: 13, whiteSpace: "nowrap" }}
        >
          🌐 Todos ({insumos.length})
        </button>
        <button
          type="button"
          onClick={() => { sounds.playPop(); setCategoriaFiltro("Pre-elaborados"); }}
          className={`view-mode-btn ${categoriaFiltro === "Pre-elaborados" ? "active" : ""}`}
          style={{ 
            padding: "6px 14px", 
            borderRadius: "999px", 
            fontSize: 13, 
            whiteSpace: "nowrap",
            background: categoriaFiltro === "Pre-elaborados" ? "var(--primary)" : "rgba(249, 115, 22, 0.12)",
            color: categoriaFiltro === "Pre-elaborados" ? "#fff" : "var(--primary)",
            borderColor: "var(--primary)"
          }}
        >
          🍳 Pre-elaborados / Guisos
        </button>
        {["Carnes", "Masas", "Quesos", "Lácteos", "Vegetales", "Salsas", "Grasas", "Condimentos", "Bebidas", "Empaques", "Desechables"].map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => { sounds.playPop(); setCategoriaFiltro(cat); }}
            className={`view-mode-btn ${categoriaFiltro === cat ? "active" : ""}`}
            style={{ padding: "6px 14px", borderRadius: "999px", fontSize: 13, whiteSpace: "nowrap" }}
          >
            {cat}
          </button>
        ))}
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
                  <span className={`insumo-cat-tag ${(ins.categoria_insumo || "General").toLowerCase().includes("pre-elaborado") ? "tag-pre-elaborado" : ""}`}>
                    {(ins.categoria_insumo || "General").toLowerCase().includes("pre-elaborado") ? "🍳 " : ""}{ins.categoria_insumo || "General"}
                  </span>
                  <button
                    type="button"
                    onClick={() => abrirEditar(ins)}
                    className="btn-insumo-edit-top"
                    title="Editar Insumo"
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEliminarInsumo(ins)}
                    className="btn-insumo-edit-top"
                    title="Eliminar Insumo"
                    style={{ color: "var(--danger)" }}
                  >
                    🗑️
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
                  const proveedoresDelInsumo = proveedoresPorInsumo.get(ins.id) || [];
                  return (
                    <div className="insumo-suppliers-box">
                      <span className="insumo-suppliers-label">
                        🏢 Proveedores ({proveedoresDelInsumo.length}):
                      </span>
                      {proveedoresDelInsumo.length > 0 ? (
                        <div className="insumos-supplied-chips">
                          {proveedoresDelInsumo.slice(0, 2).map((p) => {
                            const pRef = preciosReferenciales[ins.id]?.[p.id];
                            return (
                              <span
                                key={p.id}
                                className="insumo-supplied-badge"
                                title={p.contacto ? `Contacto: ${p.contacto}` : undefined}
                                style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                              >
                                <span>🏢 {p.nombre.split(" (")[0]}</span>
                                {pRef !== undefined && (
                                  <strong style={{ color: "var(--accent-hover)", fontSize: 10 }}>
                                    ${pRef.toFixed(2)}{ins.unidad_medida === "g" ? "/kg" : ins.unidad_medida === "ml" ? "/L" : ""}
                                  </strong>
                                )}
                              </span>
                            );
                          })}
                          {proveedoresDelInsumo.length > 2 && (
                            <button
                              type="button"
                              onClick={() => abrirEditar(ins)}
                              className="insumo-supplied-badge-more"
                              title={proveedoresDelInsumo.slice(2).map((p) => p.nombre).join(", ")}
                            >
                              +{proveedoresDelInsumo.length - 2} más
                            </button>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>
                          Sin proveedor asignado
                        </span>
                      )}
                    </div>
                  );
                })()}

                {/* Footer Inferior: Botón Amplio de Recargar / Ajustar */}
                <div className="insumo-card-footer">
                  <button
                    type="button"
                    onClick={() => abrirModalGestion(ins, "recargar")}
                    className="btn-insumo-adjust"
                  >
                    🍲 Recargar / Ajustar
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
                <th>Costo Unitario</th>
                <th>Valor en Despensa</th>
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
                const proveedoresDelInsumo = proveedoresPorInsumo.get(ins.id) || [];

                const esAgotado = stock <= 0;
                const esCritico = !esAgotado && stock <= stockMin * 0.5;
                const esBajo = !esAgotado && !esCritico && stock <= stockMin;
                const estado = esAgotado ? "agotado" : esCritico ? "critico" : esBajo ? "bajo" : "ok";

                let stockDisplay = `${stock.toLocaleString()} ${ins.unidad_medida}`;
                let costoRef = "";
                if (ins.unidad_medida === "g") {
                  if (stock >= 1000) stockDisplay = `${(stock / 1000).toFixed(2)} kg (${stock.toLocaleString()} g)`;
                  costoRef = `$${(costoUnit * 1000).toFixed(2)} / kg`;
                } else if (ins.unidad_medida === "ml") {
                  if (stock >= 1000) stockDisplay = `${(stock / 1000).toFixed(2)} L (${stock.toLocaleString()} ml)`;
                  costoRef = `$${(costoUnit * 1000).toFixed(2)} / L`;
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
                      <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginTop: 2 }}>
                        Mín: {stockMin.toLocaleString()} {ins.unidad_medida}
                      </div>
                    </td>
                    <td style={{ minWidth: 130 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
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
                            className={`stock-progress-fill ${progressClass}`}
                            style={{ width: `${progressWidth}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>
                        <strong style={{ fontSize: 13, color: "var(--text)" }}>
                          ${costoUnit.toFixed(4)} <small style={{ color: "var(--text-muted)", fontWeight: 600 }}>/{ins.unidad_medida}</small>
                        </strong>
                        {costoRef && (
                          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, marginTop: 2 }}>
                            {costoRef}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <strong className="text-green" style={{ fontSize: 14 }}>
                        ${valorTotal.toFixed(2)} USD
                      </strong>
                    </td>
                    <td style={{ minWidth: 200, maxWidth: 300, fontSize: 12 }}>
                      {proveedoresDelInsumo.length > 0 ? (
                        <div className="insumos-supplied-chips">
                          {proveedoresDelInsumo.slice(0, 2).map((p) => {
                            const pRef = preciosReferenciales[ins.id]?.[p.id];
                            return (
                              <span
                                key={p.id}
                                className="insumo-supplied-badge"
                                style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                              >
                                <span>🏢 {p.nombre.split(" (")[0]}</span>
                                {pRef !== undefined && (
                                  <strong style={{ color: "var(--accent-hover)", fontSize: 10 }}>
                                    ${pRef.toFixed(2)}{ins.unidad_medida === "g" ? "/kg" : ins.unidad_medida === "ml" ? "/L" : ""}
                                  </strong>
                                )}
                              </span>
                            );
                          })}
                          {proveedoresDelInsumo.length > 2 && (
                            <button
                              type="button"
                              onClick={() => abrirEditar(ins)}
                              className="insumo-supplied-badge-more"
                              title={proveedoresDelInsumo.slice(2).map((p) => p.nombre).join(", ")}
                            >
                              +{proveedoresDelInsumo.length - 2} más
                            </button>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: 11 }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => abrirModalGestion(ins, "recargar")}
                          className="btn-insumo-adjust"
                          style={{ padding: "6px 12px", fontSize: 12, width: "auto" }}
                          title="Recargar stock producido o ajustar por merma/inventario"
                        >
                          🍲 Recargar / Ajustar
                        </button>
                        <button
                          type="button"
                          onClick={() => abrirEditar(ins)}
                          className="btn-insumo-edit"
                          style={{ padding: "6px 10px", fontSize: 12 }}
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEliminarInsumo(ins)}
                          className="btn-insumo-edit"
                          style={{ padding: "6px 10px", fontSize: 12, color: "var(--danger)" }}
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
                    {CATEGORIAS_LISTA.map((c) => (
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

      {/* Modal Unificado: Recargar / Ajustar Inventario */}
      {modalGestionAbierto && insumoGestion && (
        <div className="modal-overlay">
          <div className="modal-recipe-card" style={{ maxWidth: 490 }}>
            <div className="modal-recipe-header">
              <div>
                <h2 style={{ fontSize: 18, marginBottom: 2 }}>
                  {modoGestionStock === "recargar" ? "🍲 Recargar Stock / Producción" : "⚖️ Ajuste Directo / Merma"}
                </h2>
                <span style={{ fontSize: 13, color: "var(--primary-dark)", fontWeight: 800 }}>
                  {insumoGestion.nombre}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setModalGestionAbierto(false)}
                className="btn-modal-close"
              >
                ✕
              </button>
            </div>

            {/* Pestañas / Tabs Segmentadas: Recargar vs Ajustar */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 6,
                background: "var(--bg-subtle)",
                padding: 4,
                borderRadius: 14,
                border: "1px solid var(--border-subtle)",
                marginTop: 10,
                marginBottom: 14,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  sounds.playPop();
                  setModoGestionStock("recargar");
                }}
                style={{
                  padding: "9px 12px",
                  borderRadius: 10,
                  border: "none",
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  transition: "all 0.15s ease",
                  background: modoGestionStock === "recargar" ? "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)" : "transparent",
                  color: modoGestionStock === "recargar" ? "#ffffff" : "var(--text-muted)",
                  boxShadow: modoGestionStock === "recargar" ? "0 2px 8px rgba(234, 88, 12, 0.3)" : "none",
                }}
              >
                <span>🍲</span> Recargar / Sumar
              </button>

              <button
                type="button"
                onClick={() => {
                  sounds.playPop();
                  setModoGestionStock("ajustar");
                  setNuevoStockAjuste(Number(insumoGestion.stock_actual));
                }}
                style={{
                  padding: "9px 12px",
                  borderRadius: 10,
                  border: "none",
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  transition: "all 0.15s ease",
                  background: modoGestionStock === "ajustar" ? "var(--bg-card)" : "transparent",
                  color: modoGestionStock === "ajustar" ? "var(--text)" : "var(--text-muted)",
                  boxShadow: modoGestionStock === "ajustar" ? "0 2px 8px rgba(0, 0, 0, 0.08)" : "none",
                  borderWidth: modoGestionStock === "ajustar" ? "1px" : "0",
                  borderColor: "var(--border)",
                  borderStyle: "solid",
                }}
              >
                <span>⚖️</span> Ajustar / Merma
              </button>
            </div>

            <form onSubmit={handleGuardarGestionStock} className="recipe-form">
              {/* Selector de Insumo (permite alternar si se abrió desde el encabezado general) */}
              <div className="form-field">
                <label>Insumo a gestionar:</label>
                <select
                  value={insumoGestion.id}
                  onChange={(e) => {
                    const sel = insumos.find((i) => i.id === e.target.value);
                    if (sel) {
                      setInsumoGestion(sel);
                      setNuevoStockAjuste(Number(sel.stock_actual));
                      setCantidadRecarga(sel.unidad_medida === "und" ? 10 : 1000);
                    }
                  }}
                  className="form-input"
                  style={{ fontSize: 14, fontWeight: 700 }}
                  required
                >
                  <optgroup label="🍳 Pre-elaborados (Guisos & Preparados)">
                    {insumosPreelaborados.map((ins) => (
                      <option key={ins.id} value={ins.id}>
                        {ins.nombre} (Stock actual: {Number(ins.stock_actual).toLocaleString()} {ins.unidad_medida})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="📦 Todos los demás Insumos">
                    {insumos
                      .filter((ins) => !insumosPreelaborados.some((p) => p.id === ins.id))
                      .map((ins) => (
                        <option key={ins.id} value={ins.id}>
                          {ins.nombre} ({Number(ins.stock_actual).toLocaleString()} {ins.unidad_medida})
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>

              {modoGestionStock === "recargar" ? (
                /* VISTA: SUMAR RECARGA */
                <>
                  <div className="form-field">
                    <label>
                      Cantidad producida o ingresada a SUMAR ({insumoGestion.unidad_medida}):
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      required
                      value={cantidadRecarga}
                      onChange={(e) => setCantidadRecarga(parseFloat(e.target.value) || 0)}
                      className="form-input"
                      style={{ fontSize: 22, fontWeight: 900, color: "var(--primary-dark)" }}
                      placeholder={insumoGestion.unidad_medida === "g" ? "Ej. 3500 para 3.5 kg" : "Ej. 24"}
                      autoFocus
                    />
                    {insumoGestion.unidad_medida === "g" && (
                      <span style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
                        Equivale a: <strong>{((Number(cantidadRecarga) || 0) / 1000).toFixed(2)} kg</strong>
                      </span>
                    )}
                  </div>

                  {(() => {
                    const stockActualNum = Number(insumoGestion.stock_actual || 0);
                    const cantNum = Number(cantidadRecarga) || 0;
                    const nuevoProyectado = stockActualNum + cantNum;
                    const unidad = insumoGestion.unidad_medida;

                    return (
                      <div
                        style={{
                          background: "rgba(34, 197, 94, 0.08)",
                          border: "1px solid rgba(34, 197, 94, 0.3)",
                          borderRadius: 12,
                          padding: "12px 14px",
                        }}
                      >
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
                          Stock proyectado tras la recarga:
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: "#16a34a" }}>
                          {stockActualNum.toLocaleString()} {unidad} + {cantNum.toLocaleString()} {unidad} ={" "}
                          <span>{nuevoProyectado.toLocaleString()} {unidad}</span>
                          {unidad === "g" && nuevoProyectado >= 1000 && ` (${(nuevoProyectado / 1000).toFixed(2)} kg)`}
                        </div>
                      </div>
                    );
                  })()}
                </>
              ) : (
                /* VISTA: AJUSTE DIRECTO / MERMA */
                <>
                  <div className="form-field">
                    <label>
                      Nuevo Stock Físico Real en Despensa ({insumoGestion.unidad_medida}):
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      required
                      value={nuevoStockAjuste}
                      onChange={(e) => setNuevoStockAjuste(parseFloat(e.target.value) || 0)}
                      className="form-input"
                      style={{ fontSize: 22, fontWeight: 900 }}
                      placeholder="0"
                      autoFocus
                    />
                    {insumoGestion.unidad_medida === "g" && (
                      <span style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
                        Equivale a: <strong>{((Number(nuevoStockAjuste) || 0) / 1000).toFixed(2)} kg</strong>
                      </span>
                    )}
                  </div>

                  {(() => {
                    const actual = Number(insumoGestion.stock_actual || 0);
                    const nuevo = Number(nuevoStockAjuste) || 0;
                    const dif = nuevo - actual;
                    const esNegativo = dif < 0;
                    const unidad = insumoGestion.unidad_medida;

                    return (
                      <div
                        style={{
                          background: esNegativo ? "rgba(239, 68, 68, 0.08)" : "rgba(59, 130, 246, 0.08)",
                          border: `1px solid ${esNegativo ? "rgba(239, 68, 68, 0.3)" : "rgba(59, 130, 246, 0.3)"}`,
                          borderRadius: 12,
                          padding: "12px 14px",
                        }}
                      >
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
                          Diferencia respecto al inventario registrado:
                        </div>
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 900,
                            color: esNegativo ? "#dc2626" : dif > 0 ? "#2563eb" : "var(--text)",
                          }}
                        >
                          {actual.toLocaleString()} {unidad} → {nuevo.toLocaleString()} {unidad}
                          {" ("}
                          {dif > 0 ? `+${dif.toLocaleString()}` : dif.toLocaleString()} {unidad}
                          {esNegativo ? " 📉 Merma detectada" : dif > 0 ? " 📈 Ajuste positivo" : " Sin cambios"}
                          {")"}
                        </div>
                      </div>
                    );
                  })()}

                  <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: 0 }}>
                    💡 Usa esta opción durante el cierre diario para registrar el pesaje físico real o asentar mermas imprevistas.
                  </p>
                </>
              )}

              <div className="modal-recipe-actions">
                <button
                  type="button"
                  onClick={() => setModalGestionAbierto(false)}
                  className="btn-cancel"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="btn-submit-recipe"
                  style={{
                    background:
                      modoGestionStock === "recargar"
                        ? "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)"
                        : "var(--primary)",
                    color: "#ffffff",
                  }}
                >
                  {guardando
                    ? "Guardando..."
                    : modoGestionStock === "recargar"
                    ? "🍲 Confirmar Recarga"
                    : "⚖️ Confirmar Ajuste"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
