"use client";

import { useState, useMemo } from "react";
import { Producto, Categoria, ExtraModificador } from "@/types/database";
import { registrarVentaPos, CartItem, CartItemExtra } from "./pos-actions";

interface PosClientProps {
  categorias: Categoria[];
  productos: Producto[];
  extras: ExtraModificador[];
  tasaBcv: number;
}

export default function PosClient({
  categorias,
  productos,
  extras,
  tasaBcv,
}: PosClientProps) {
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [carrito, setCarrito] = useState<CartItem[]>([]);
  const [tipoEntrega, setTipoEntrega] = useState<string>("puerta_cerrada");
  const [metodoPago, setMetodoPago] = useState<string>("efectivo_usd");
  const [notasComanda, setNotasComanda] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [comandaExitosa, setComandaExitosa] = useState<{ numero: number; totalUsd: number; totalBs: number } | null>(null);
  const [itemParaExtras, setItemParaExtras] = useState<number | null>(null);

  // Filtrar productos
  const productosFiltrados = useMemo(() => {
    return productos.filter((p) => {
      const coincideCat = !categoriaSeleccionada || p.categoria_id === categoriaSeleccionada;
      const coincideBusqueda =
        !busqueda ||
        p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.descripcion?.toLowerCase().includes(busqueda.toLowerCase());
      return coincideCat && coincideBusqueda;
    });
  }, [productos, categoriaSeleccionada, busqueda]);

  // Agregar producto al carrito
  const agregarAlCarrito = (producto: Producto) => {
    setCarrito((prev) => {
      const index = prev.findIndex((item) => item.producto_id === producto.id && (!item.extras || item.extras.length === 0));
      if (index >= 0) {
        const nuevo = [...prev];
        nuevo[index].cantidad += 1;
        return nuevo;
      }
      return [
        ...prev,
        {
          producto_id: producto.id,
          nombre: producto.nombre,
          precio_unitario_usd: Number(producto.precio_usd),
          cantidad: 1,
          extras: [],
        },
      ];
    });
  };

  const modificarCantidad = (index: number, delta: number) => {
    setCarrito((prev) => {
      const nuevo = [...prev];
      const cant = nuevo[index].cantidad + delta;
      if (cant <= 0) {
        nuevo.splice(index, 1);
      } else {
        nuevo[index].cantidad = cant;
      }
      return nuevo;
    });
  };

  const agregarExtraAItem = (itemIndex: number, extra: ExtraModificador) => {
    setCarrito((prev) => {
      const nuevo = [...prev];
      const item = { ...nuevo[itemIndex] };
      const currentExtras = item.extras ? [...item.extras] : [];
      const extraIndex = currentExtras.findIndex((e) => e.extra_id === extra.id);

      if (extraIndex >= 0) {
        currentExtras[extraIndex].cantidad += 1;
      } else {
        currentExtras.push({
          extra_id: extra.id,
          nombre: extra.nombre,
          precio_unitario_usd: Number(extra.precio_extra_usd),
          cantidad: 1,
        });
      }

      item.extras = currentExtras;
      nuevo[itemIndex] = item;
      return nuevo;
    });
  };

  const removerExtraDeItem = (itemIndex: number, extraIndex: number) => {
    setCarrito((prev) => {
      const nuevo = [...prev];
      const item = { ...nuevo[itemIndex] };
      if (item.extras) {
        const currentExtras = [...item.extras];
        currentExtras.splice(extraIndex, 1);
        item.extras = currentExtras;
        nuevo[itemIndex] = item;
      }
      return nuevo;
    });
  };

  // Cálculos de Totales
  const totalUsd = useMemo(() => {
    return carrito.reduce((acc, item) => {
      const subtotalItem = item.precio_unitario_usd * item.cantidad;
      const subtotalExtras = (item.extras || []).reduce(
        (eAcc, ext) => eAcc + ext.precio_unitario_usd * ext.cantidad,
        0
      );
      return acc + subtotalItem + subtotalExtras;
    }, 0);
  }, [carrito]);

  const totalBs = Number((totalUsd * tasaBcv).toFixed(2));

  // Enviar Comanda a Cocina
  const handleEnviarComanda = async () => {
    if (carrito.length === 0 || procesando) return;

    setProcesando(true);
    const res = await registrarVentaPos({
      metodo_pago: metodoPago,
      tipo_entrega: tipoEntrega,
      tasa_bcv: tasaBcv,
      notas_comanda: notasComanda,
      items: carrito,
    });

    setProcesando(false);

    if (res.ok && res.numero_comanda) {
      setComandaExitosa({
        numero: res.numero_comanda,
        totalUsd,
        totalBs,
      });
      setCarrito([]);
      setNotasComanda("");
    } else {
      alert(res.error || "No se pudo procesar la comanda.");
    }
  };

  return (
    <div className="pos-layout">
      {/* Columna Principal: Catálogo y Categorías */}
      <section className="pos-catalog-section">
        {/* Barra Superior de Búsqueda y Filtros */}
        <div className="pos-search-bar">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Buscar arepa, empanada, bebida..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pos-search-input"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda("")}
                className="btn-clear-search"
              >
                ✕
              </button>
            )}
          </div>

          <div className="pos-category-pills">
            <button
              type="button"
              onClick={() => setCategoriaSeleccionada(null)}
              className={`cat-pill ${!categoriaSeleccionada ? "cat-pill-active" : ""}`}
            >
              <span>🔥</span> Todos ({productos.length})
            </button>
            {categorias.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoriaSeleccionada(cat.id)}
                className={`cat-pill ${categoriaSeleccionada === cat.id ? "cat-pill-active" : ""}`}
              >
                <span>{cat.icono}</span> {cat.nombre}
              </button>
            ))}
          </div>
        </div>

        {/* Cuadrícula de Platos */}
        <div className="pos-products-grid">
          {productosFiltrados.length === 0 ? (
            <div className="pos-empty-catalog">
              <span style={{ fontSize: 48 }}>🫓</span>
              <h3>No encontramos productos</h3>
              <p>Intenta con otra búsqueda o selecciona otra categoría.</p>
            </div>
          ) : (
            productosFiltrados.map((prod) => (
              <button
                key={prod.id}
                type="button"
                onClick={() => agregarAlCarrito(prod)}
                className="pos-product-card"
              >
                <div className="product-card-top">
                  <span className="product-emoji">{prod.icono || "🫓"}</span>
                  {prod.popular && <span className="badge-popular">🔥 Favorito</span>}
                </div>
                <div className="product-card-body">
                  <h4 className="product-title">{prod.nombre}</h4>
                  {prod.descripcion && (
                    <p className="product-desc">{prod.descripcion}</p>
                  )}
                </div>
                <div className="product-card-footer">
                  <div className="price-tag">
                    <span className="price-usd">${Number(prod.precio_usd).toFixed(2)}</span>
                    <span className="price-bs">
                      {(Number(prod.precio_usd) * tasaBcv).toFixed(2)} Bs
                    </span>
                  </div>
                  <span className="btn-add-circle">+</span>
                </div>
              </button>
            ))
          )}
        </div>
      </section>

      {/* Columna Lateral: Comanda & Carrito en Vivo */}
      <aside className="pos-cart-sidebar">
        <div className="cart-header">
          <div className="cart-title-row">
            <span className="cart-icon">🧾</span>
            <h3>Comanda Actual</h3>
            <span className="cart-badge">{carrito.reduce((a, b) => a + b.cantidad, 0)}</span>
          </div>

          {/* Selector de Tipo de Entrega */}
          <div className="delivery-type-selector">
            {[
              { id: "puerta_cerrada", label: "🚪 Puerta", icon: "🚪" },
              { id: "mesa", label: "🪑 Mesa", icon: "🪑" },
              { id: "pickup", label: "🥡 Llevar", icon: "🥡" },
              { id: "delivery", label: "🛵 Delivery", icon: "🛵" },
            ].map((tipo) => (
              <button
                key={tipo.id}
                type="button"
                onClick={() => setTipoEntrega(tipo.id)}
                className={`delivery-btn ${tipoEntrega === tipo.id ? "delivery-btn-active" : ""}`}
              >
                {tipo.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de Items del Carrito */}
        <div className="cart-items-scroll">
          {carrito.length === 0 ? (
            <div className="cart-empty-state">
              <span className="cart-empty-icon">🫓</span>
              <p className="cart-empty-text">Toca cualquier arepa o plato para agregarlo a la comanda</p>
            </div>
          ) : (
            carrito.map((item, idx) => (
              <div key={idx} className="cart-item-row">
                <div className="cart-item-main">
                  <div className="cart-item-info">
                    <span className="cart-item-name">{item.nombre}</span>
                    <span className="cart-item-unit-price">
                      ${item.precio_unitario_usd.toFixed(2)} c/u
                    </span>
                  </div>

                  <div className="cart-item-controls">
                    <button
                      type="button"
                      onClick={() => modificarCantidad(idx, -1)}
                      className="btn-qty"
                    >
                      -
                    </button>
                    <span className="item-qty-value">{item.cantidad}</span>
                    <button
                      type="button"
                      onClick={() => modificarCantidad(idx, 1)}
                      className="btn-qty"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Extras seleccionados para este item */}
                {item.extras && item.extras.length > 0 && (
                  <div className="cart-item-extras-list">
                    {item.extras.map((ext, eIdx) => (
                      <div key={eIdx} className="cart-extra-pill">
                        <span>+ {ext.nombre} (${ext.precio_unitario_usd.toFixed(2)})</span>
                        <button
                          type="button"
                          onClick={() => removerExtraDeItem(idx, eIdx)}
                          className="btn-remove-extra"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Botón para abrir modal de extras */}
                <div className="cart-item-actions">
                  <button
                    type="button"
                    onClick={() => setItemParaExtras(itemParaExtras === idx ? null : idx)}
                    className="btn-add-extra-trigger"
                  >
                    ✨ Modificar / + Extra
                  </button>
                </div>

                {/* Dropdown de Extras */}
                {itemParaExtras === idx && (
                  <div className="extras-selector-box">
                    <p className="extras-box-title">Selecciona un extra:</p>
                    <div className="extras-grid">
                      {extras.map((ext) => (
                        <button
                          key={ext.id}
                          type="button"
                          onClick={() => agregarExtraAItem(idx, ext)}
                          className="btn-extra-option"
                        >
                          <span>{ext.nombre}</span>
                          <strong>+${Number(ext.precio_extra_usd).toFixed(2)}</strong>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Resumen y Envío */}
        <div className="cart-footer">
          {/* Método de Pago */}
          <div className="payment-method-selector">
            <label className="payment-label">Método de Pago:</label>
            <select
              value={metodoPago}
              onChange={(e) => setMetodoPago(e.target.value)}
              className="payment-select"
            >
              <option value="efectivo_usd">💵 Efectivo Divisas ($)</option>
              <option value="pago_movil_bs">📱 Pago Móvil (Bs)</option>
              <option value="punto_bs">💳 Punto de Venta (Bs)</option>
              <option value="binance">🟡 Binance (USDT)</option>
              <option value="pesos_cop">🇨🇴 Pesos Colombianos (COP)</option>
            </select>
          </div>

          {/* Notas de Cocina */}
          <input
            type="text"
            placeholder="Notas de cocina (ej. sin mayonesa, bien tostada)..."
            value={notasComanda}
            onChange={(e) => setNotasComanda(e.target.value)}
            className="cart-notes-input"
          />

          {/* Totales */}
          <div className="cart-totals-box">
            <div className="totals-row-usd">
              <span>Total USD:</span>
              <strong className="amount-usd">${totalUsd.toFixed(2)}</strong>
            </div>
            <div className="totals-row-bs">
              <span>Total en Bolívares (BCV):</span>
              <strong className="amount-bs">{totalBs.toFixed(2)} Bs</strong>
            </div>
          </div>

          {/* Botón de Comanda */}
          <button
            type="button"
            disabled={carrito.length === 0 || procesando}
            onClick={handleEnviarComanda}
            className="btn-submit-comanda"
          >
            {procesando ? (
              <span>⏳ Enviando a cocina...</span>
            ) : (
              <span>🚀 Enviar Comanda a Cocina →</span>
            )}
          </button>
        </div>
      </aside>

      {/* Modal de Comanda Exitosa */}
      {comandaExitosa && (
        <div className="modal-overlay">
          <div className="modal-ticket-card">
            <div className="ticket-header">
              <span className="ticket-icon">🫓</span>
              <h2>¡Comanda #{comandaExitosa.numero} Enviada!</h2>
              <p className="ticket-subtitle">La cocina ha recibido la orden y se han descontado los ingredientes.</p>
            </div>

            <div className="ticket-details">
              <div className="ticket-row">
                <span>Total Cobrado:</span>
                <strong>${comandaExitosa.totalUsd.toFixed(2)} USD</strong>
              </div>
              <div className="ticket-row">
                <span>Equivalente BCV:</span>
                <strong>{comandaExitosa.totalBs.toFixed(2)} Bs</strong>
              </div>
              <div className="ticket-row">
                <span>Tipo:</span>
                <span className="badge-ticket">{tipoEntrega.toUpperCase()}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setComandaExitosa(null)}
              className="btn-ticket-close"
            >
              ✅ Nueva Comanda
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
