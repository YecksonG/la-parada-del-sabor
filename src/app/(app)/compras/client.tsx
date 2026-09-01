"use client";

import { useState, useMemo } from "react";
import { Insumo, Proveedor } from "@/types/database";
import { registrarCompraInsumo } from "./actions";

interface ComprasClientProps {
  compras: any[];
  insumos: Insumo[];
  proveedores: Proveedor[];
  tasaBcv: number;
}

const UNIDADES_COMPRA = [
  { id: "saco_20kg", label: "Saco 20 kg (20,000 g)", factor: 20000 },
  { id: "saco_25kg", label: "Saco 25 kg (25,000 g)", factor: 25000 },
  { id: "bulto_10kg", label: "Bulto 10 kg (10,000 g)", factor: 10000 },
  { id: "kg", label: "Kilogramos (1,000 g)", factor: 1000 },
  { id: "litro", label: "Litro (1,000 ml)", factor: 1000 },
  { id: "g", label: "Gramos directos (1 g)", factor: 1 },
  { id: "paquete_100und", label: "Paquete 100 unds", factor: 100 },
  { id: "paquete_500und", label: "Paquete 500 unds", factor: 500 },
  { id: "und", label: "Unidad directa (1 und)", factor: 1 },
];

export default function ComprasClient({
  compras,
  insumos,
  proveedores,
  tasaBcv,
}: ComprasClientProps) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Form states
  const [insumoId, setInsumoId] = useState(insumos[0]?.id || "");
  const [proveedorId, setProveedorId] = useState<string | null>(null);
  const [cantidadComprada, setCantidadComprada] = useState<number>(1);
  const [unidadCompraId, setUnidadCompraId] = useState("saco_20kg");
  const [totalUsd, setTotalUsd] = useState<number>(24.0);
  const [metodoPago, setMetodoPago] = useState("efectivo_usd");
  const [comprobante, setComprobante] = useState("");
  const [notas, setNotas] = useState("");

  const insumoSeleccionado = insumos.find((i) => i.id === insumoId);
  const unidadConfig = UNIDADES_COMPRA.find((u) => u.id === unidadCompraId) || UNIDADES_COMPRA[0];

  const totalGramosCalculados = cantidadComprada * unidadConfig.factor;
  const costoPorGramoCalculado =
    totalGramosCalculados > 0 ? (totalUsd / totalGramosCalculados).toFixed(5) : "0";

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!insumoId || guardando || totalUsd <= 0 || cantidadComprada <= 0) return;

    setGuardando(true);
    try {
      const res = await registrarCompraInsumo({
        proveedor_id: proveedorId,
        insumo_id: insumoId,
        cantidad_comprada: Number(cantidadComprada),
        unidad_compra: unidadConfig.id,
        factor_conversion: unidadConfig.factor,
        total_usd: Number(totalUsd),
        tasa_bcv: tasaBcv,
        metodo_pago: metodoPago,
        comprobante,
        notas,
      });

      if (res.ok) {
        setModalAbierto(false);
      } else {
        alert(res.error || "Error al registrar la compra.");
      }
    } catch (err) {
      console.error("Error al registrar compra:", err);
      alert("Ocurrió un error inesperado. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <main className="recetas-container">
      {/* Header */}
      <div className="recetas-header">
        <div>
          <h1 className="recetas-title">🚚 Compras & Ingreso de Materia Prima</h1>
          <p className="recetas-subtitle">
            Conversión automática de Sacos/Bultos/Kg a gramos con recálculo de Costo Promedio Ponderado (PPMC).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalAbierto(true)}
          className="btn-primary-action"
        >
          <span>+</span> Registrar Entrada / Compra
        </button>
      </div>

      {/* Grid de Compras Realizadas */}
      <div className="comandas-grid">
        {compras.length === 0 ? (
          <div className="recetas-empty-box">
            <span style={{ fontSize: 48 }}>🚚</span>
            <h3>No hay compras registradas</h3>
            <p>Registra las compras de sacos de harina, carnes y quesos para surtir la despensa.</p>
          </div>
        ) : (
          compras.map((compra) => {
            const item = (compra.items || [])[0];
            const insumoNombre = item?.insumo?.nombre || "Insumo";
            const gramosAgregados = Number(item?.cantidad_base_total || 0);

            return (
              <div key={compra.id} className="comanda-card">
                <div className="comanda-card-header">
                  <div>
                    <h3 className="receta-name">{insumoNombre}</h3>
                    <span className="comanda-time">
                      📅 {new Date(compra.fecha).toLocaleDateString()}
                    </span>
                  </div>
                  <span className="stock-badge stock-badge-optimo">
                    +{(gramosAgregados / (item?.insumo?.unidad_medida === "g" ? 1000 : 1)).toFixed(2)}{" "}
                    {item?.insumo?.unidad_medida === "g" ? "kg" : item?.insumo?.unidad_medida}
                  </span>
                </div>

                <div className="comanda-type-row">
                  <span className="comanda-badge-type">
                    {item?.cantidad_comprada}x {item?.unidad_compra}
                  </span>
                  <span className="comanda-badge-payment">
                    {(compra.metodo_pago || "").replaceAll("_", " ").toUpperCase()}
                  </span>
                </div>

                <div className="receta-metrics-row">
                  <div className="metric-box">
                    <span className="metric-label">Total USD:</span>
                    <strong className="metric-val text-primary">
                      ${Number(compra.total_usd).toFixed(2)}
                    </strong>
                  </div>
                  <div className="metric-box">
                    <span className="metric-label">Total Bs:</span>
                    <strong className="metric-val">
                      {Number(compra.total_bs).toFixed(2)} Bs
                    </strong>
                  </div>
                  <div className="metric-box">
                    <span className="metric-label">Costo /{item?.insumo?.unidad_medida}:</span>
                    <strong className="metric-val">
                      ${Number(item?.precio_unitario_usd || 0).toFixed(4)}
                    </strong>
                  </div>
                </div>

                {compra.proveedor && (
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    🏢 Proveedor: {compra.proveedor.nombre}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal de Registro de Compra */}
      {modalAbierto && (
        <div className="modal-overlay">
          <div className="modal-recipe-card">
            <div className="modal-recipe-header">
              <h2>🚚 Registrar Ingreso de Insumos</h2>
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
                  <label>Insumo a Recibir</label>
                  <select
                    value={insumoId}
                    onChange={(e) => setInsumoId(e.target.value)}
                    className="form-input"
                  >
                    {insumos.map((ins) => (
                      <option key={ins.id} value={ins.id}>
                        {ins.nombre} ({ins.unidad_medida})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label>Proveedor (Opcional)</label>
                  <select
                    value={proveedorId || ""}
                    onChange={(e) => setProveedorId(e.target.value || null)}
                    className="form-input"
                  >
                    <option value="">-- Compra Local / Sin Registro --</option>
                    {proveedores.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-field">
                  <label>Cantidad de Bultos / Empaques</label>
                  <input
                    type="number"
                    step="any"
                    min="0.1"
                    required
                    value={cantidadComprada}
                    onChange={(e) => setCantidadComprada(parseFloat(e.target.value) || 0)}
                    className="form-input"
                  />
                </div>

                <div className="form-field">
                  <label>Formato / Unidad de Compra</label>
                  <select
                    value={unidadCompraId}
                    onChange={(e) => setUnidadCompraId(e.target.value)}
                    className="form-input"
                  >
                    {UNIDADES_COMPRA.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-field">
                  <label>Total Pagado ($ USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={totalUsd}
                    onChange={(e) => setTotalUsd(parseFloat(e.target.value) || 0)}
                    className="form-input"
                  />
                </div>

                <div className="form-field">
                  <label>Método de Pago</label>
                  <select
                    value={metodoPago}
                    onChange={(e) => setMetodoPago(e.target.value)}
                    className="form-input"
                  >
                    <option value="efectivo_usd">💵 Efectivo USD</option>
                    <option value="pago_movil_bs">📱 Pago Móvil (Bs)</option>
                    <option value="transferencia_bs">🏦 Transferencia (Bs)</option>
                    <option value="binance">🟡 Binance (USDT)</option>
                  </select>
                </div>
              </div>

              {/* Conversión en Tiempo Real */}
              <div className="recipe-ingredients-builder">
                <span className="ingredients-title">Conversión Automática al Stock:</span>
                <div className="recipe-cost-summary">
                  <div className="cost-summary-item">
                    <span>Gramos/Unidades a Ingresar:</span>
                    <strong className="text-green">
                      +{totalGramosCalculados.toLocaleString()}{" "}
                      {insumoSeleccionado?.unidad_medida || "g"}
                    </strong>
                  </div>
                  <div className="cost-summary-item">
                    <span>Nuevo Costo Unitario Base:</span>
                    <strong className="text-primary">
                      ${costoPorGramoCalculado} USD / {insumoSeleccionado?.unidad_medida || "g"}
                    </strong>
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
                  {guardando ? "Procesando..." : "📥 Confirmar Ingreso de Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
