"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { Producto, Categoria, ExtraModificador } from "@/types/database";
import {
  registrarVentaPos,
  aceptarPedidoWeb,
  rechazarPedidoWeb,
  CartItem,
  CartItemExtra,
} from "./pos-actions";
import { sounds } from "@/lib/sound-effects";

interface PosClientProps {
  categorias: Categoria[];
  productos: Producto[];
  extras: ExtraModificador[];
  tasaBcv: number;
  pedidosPendientes?: any[];
}

export default function PosClient({
  categorias,
  productos,
  extras,
  tasaBcv,
  pedidosPendientes = [],
}: PosClientProps) {
  const [modoVista, setModoVista] = useState<"grid" | "filas">("grid");
  const [modalPedidosWeb, setModalPedidosWeb] = useState(false);
  const [procesandoWebId, setProcesandoWebId] = useState<string | null>(null);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [carrito, setCarrito] = useState<CartItem[]>([]);

  // Cargar preferencia guardada al montar
  useEffect(() => {
    const saved = localStorage.getItem("vista_pos");
    if (saved === "grid" || saved === "filas") {
      setModoVista(saved);
    }
  }, []);

  const cambiarModoVista = (modo: "grid" | "filas") => {
    sounds.playPop();
    setModoVista(modo);
    if (typeof window !== "undefined") {
      localStorage.setItem("vista_pos", modo);
    }
  };
  const [tipoEntrega, setTipoEntrega] = useState<string>("puerta_cerrada");
  const [metodoPago, setMetodoPago] = useState<string>("efectivo_usd");
  const [notasComanda, setNotasComanda] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [comandaExitosa, setComandaExitosa] = useState<{
    numero: number;
    totalUsd: number;
    totalBs: number;
    ventaId?: string;
  } | null>(null);
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

  // Agregar producto al carrito con sonido pop
  const agregarAlCarrito = (producto: Producto) => {
    sounds.playPop();
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
    if (delta > 0) sounds.playPop();
    else sounds.playDelete();

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
    sounds.playPop();
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
    sounds.playDelete();
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
      sounds.playKitchenBell();
      setTimeout(() => sounds.playCashRegister(), 300);
      setComandaExitosa({
        numero: res.numero_comanda,
        totalUsd,
        totalBs,
        ventaId: res.venta_id,
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
        {/* Barra de Búsqueda y Filtro de Categorías */}
        <div className="pos-search-bar">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Buscar arepa, empanada, jugo, salsa..."
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

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div className="pos-category-pills">
              <button
                type="button"
                onClick={() => {
                  sounds.playPop();
                  setCategoriaSeleccionada(null);
                }}
                className={`cat-pill ${!categoriaSeleccionada ? "cat-pill-active" : ""}`}
              >
                <span>🔥</span> Todas
              </button>
              {categorias.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    sounds.playPop();
                    setCategoriaSeleccionada(cat.id);
                  }}
                  className={`cat-pill ${
                    categoriaSeleccionada === cat.id ? "cat-pill-active" : ""
                  }`}
                >
                  <span>{cat.icono}</span> {cat.nombre}
                </button>
              ))}
            </div>

            {/* Botón de Pedidos Web Entrantes */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  sounds.playPop();
                  setModalPedidosWeb(true);
                }}
                className={`btn-pedidos-web-inbox ${pedidosPendientes.length > 0 ? "has-orders" : ""}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                  background: pedidosPendientes.length > 0 ? "rgba(234, 179, 8, 0.2)" : "var(--bg-subtle)",
                  color: pedidosPendientes.length > 0 ? "#eab308" : "var(--text-muted)",
                  border: pedidosPendientes.length > 0 ? "1px solid #eab308" : "1px solid var(--border)",
                }}
              >
                <span>{pedidosPendientes.length > 0 ? "🔔" : "📱"}</span>
                <span>Pedidos Web ({pedidosPendientes.length})</span>
              </button>

              {/* Toggle de Vistas POS */}
              <div className="view-mode-toggle">
                <button
                  type="button"
                  onClick={() => cambiarModoVista("grid")}
                  className={`view-mode-btn ${modoVista === "grid" ? "active" : ""}`}
                  title="Vista en Cuadros"
                >
                  ⊞ Cuadros
                </button>
                <button
                  type="button"
                  onClick={() => cambiarModoVista("filas")}
                  className={`view-mode-btn ${modoVista === "filas" ? "active" : ""}`}
                  title="Vista en Filas"
                >
                  ☰ Filas
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Catálogo en Modo Grid o Filas */}
        {modoVista === "grid" ? (
          <div className="pos-products-grid">
            {productosFiltrados.map((prod) => (
              <button
                key={prod.id}
                type="button"
                onClick={() => agregarAlCarrito(prod)}
                className="pos-product-card"
              >
                <div className="product-card-top">
                  <span className="product-emoji">{prod.icono || "🫓"}</span>
                  {prod.popular && <span className="badge-popular">🔥 Estrella</span>}
                </div>

                <div className="product-card-info">
                  <h3 className="product-title">{prod.nombre}</h3>
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
            ))}
          </div>
        ) : (
          <div className="pos-products-rows-list">
            {productosFiltrados.map((prod) => (
              <button
                key={prod.id}
                type="button"
                onClick={() => agregarAlCarrito(prod)}
                className="pos-product-row-card"
              >
                <div className="pos-row-left">
                  <span className="product-emoji" style={{ fontSize: 28 }}>{prod.icono || "🫓"}</span>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <strong className="product-title" style={{ fontSize: 15 }}>{prod.nombre}</strong>
                      {prod.popular && <span className="badge-popular">🔥 Estrella</span>}
                    </div>
                    {prod.descripcion && (
                      <p className="product-desc" style={{ fontSize: 12, margin: 0 }}>{prod.descripcion}</p>
                    )}
                  </div>
                </div>

                <div className="pos-row-right">
                  <div className="price-tag" style={{ textAlign: "right" }}>
                    <span className="price-usd" style={{ fontSize: 16 }}>${Number(prod.precio_usd).toFixed(2)}</span>
                    <span className="price-bs" style={{ fontSize: 12 }}>
                      {(Number(prod.precio_usd) * tasaBcv).toFixed(2)} Bs
                    </span>
                  </div>
                  <span className="btn-add-circle" style={{ width: 34, height: 34, fontSize: 18 }}>+</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Columna Lateral: Comanda / Carrito */}
      <aside className="pos-cart-sidebar">
        <div className="cart-header">
          <div className="cart-title-row">
            <span className="cart-icon">🛒</span>
            <h3>Comanda Actual</h3>
            {carrito.length > 0 && (
              <span className="cart-badge">
                {carrito.reduce((a, b) => a + b.cantidad, 0)}
              </span>
            )}
          </div>

          {/* Selector de Entrega */}
          <div className="delivery-type-selector">
            {[
              { id: "puerta_cerrada", label: "🚪 Puerta" },
              { id: "mesa", label: "🪑 Mesa" },
              { id: "pickup", label: "🥡 Llevar" },
              { id: "delivery", label: "🛵 Delivery" },
            ].map((tipo) => (
              <button
                key={tipo.id}
                type="button"
                onClick={() => {
                  sounds.playPop();
                  setTipoEntrega(tipo.id);
                }}
                className={`delivery-btn ${
                  tipoEntrega === tipo.id ? "delivery-btn-active" : ""
                }`}
              >
                {tipo.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de Items en la Comanda */}
        <div className="cart-items-scroll">
          {carrito.length === 0 ? (
            <div className="cart-empty-state">
              <span className="cart-empty-icon">🫓</span>
              <p>Comanda vacía</p>
              <small>Toca cualquier arepa o producto para armar el pedido</small>
            </div>
          ) : (
            carrito.map((item, index) => {
              const subtotalItem =
                item.precio_unitario_usd * item.cantidad +
                (item.extras || []).reduce(
                  (acc, e) => acc + e.precio_unitario_usd * e.cantidad,
                  0
                );

              return (
                <div key={index} className="cart-item-row">
                  <div className="cart-item-main">
                    <div className="cart-item-info">
                      <strong className="cart-item-name">{item.nombre}</strong>
                      <span className="cart-item-unit-price">
                        ${item.precio_unitario_usd.toFixed(2)} c/u
                      </span>
                    </div>

                    <div className="cart-item-controls">
                      <button
                        type="button"
                        onClick={() => modificarCantidad(index, -1)}
                        className="btn-qty"
                      >
                        -
                      </button>
                      <span className="item-qty-value">{item.cantidad}</span>
                      <button
                        type="button"
                        onClick={() => modificarCantidad(index, 1)}
                        className="btn-qty"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Extras del Item */}
                  {item.extras && item.extras.length > 0 && (
                    <div className="cart-item-extras-list">
                      {item.extras.map((extra, eIdx) => (
                        <div key={eIdx} className="cart-extra-pill">
                          <span>
                            {extra.cantidad}x {extra.nombre} (+${extra.precio_unitario_usd.toFixed(2)})
                          </span>
                          <button
                            type="button"
                            onClick={() => removerExtraDeItem(index, eIdx)}
                            className="btn-remove-extra"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Botón para añadir modificador */}
                  <div className="cart-item-extra-action">
                    <button
                      type="button"
                      onClick={() =>
                        setItemParaExtras(itemParaExtras === index ? null : index)
                      }
                      className="btn-add-extra-trigger"
                    >
                      {itemParaExtras === index ? "▲ Cerrar Extras" : "+ Agregar Extra / Modificador"}
                    </button>
                  </div>

                  {/* Panel desplegable de Extras */}
                  {itemParaExtras === index && (
                    <div className="extras-selector-box">
                      <span className="extras-box-title">Extras Disponibles:</span>
                      <div className="extras-grid">
                        {extras.map((extra) => (
                          <button
                            key={extra.id}
                            type="button"
                            onClick={() => agregarExtraAItem(index, extra)}
                            className="btn-extra-option"
                          >
                            <span>{extra.nombre}</span>
                            <strong>+${Number(extra.precio_extra_usd).toFixed(2)}</strong>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer del Carrito / Totales y Envío a Cocina */}
        <div className="cart-footer">
          {/* Método de Pago */}
          <div className="payment-method-selector">
            <label className="payment-label">Método de Cobro:</label>
            <select
              value={metodoPago}
              onChange={(e) => setMetodoPago(e.target.value)}
              className="payment-select"
            >
              <option value="efectivo_usd">💵 Efectivo USD</option>
              <option value="pago_movil_bs">📱 Pago Móvil (Bs)</option>
              <option value="punto_bs">💳 Punto de Venta (Bs)</option>
              <option value="binance">🟡 Binance Pay (USDT)</option>
              <option value="pesos_cop">🇨🇴 Pesos Colombianos (COP)</option>
            </select>
          </div>

          {/* Notas de Cocina */}
          <input
            type="text"
            placeholder="Notas (ej. sin cebolla, bien tostada, extra salsa)..."
            value={notasComanda}
            onChange={(e) => setNotasComanda(e.target.value)}
            className="cart-notes-input"
          />

          {/* Totales */}
          <div className="cart-totals-box">
            <div className="totals-row-usd">
              <span>Total a Pagar:</span>
              <strong className="amount-usd">${totalUsd.toFixed(2)} USD</strong>
            </div>
            <div className="totals-row-bs">
              <span>En Bolívares (BCV {tasaBcv.toFixed(2)}):</span>
              <strong className="amount-bs">{totalBs.toLocaleString()} Bs</strong>
            </div>
          </div>

          {/* Botón de Enviar Comanda */}
          <button
            type="button"
            disabled={carrito.length === 0 || procesando}
            onClick={handleEnviarComanda}
            className="btn-submit-comanda"
          >
            {procesando ? "Enviando a Cocina..." : "🍳 Enviar Comanda a Cocina"}
          </button>
        </div>
      </aside>

      {/* Modal de Comanda Exitosa con botón de impresión */}
      {comandaExitosa && (
        <div className="modal-overlay">
          <div className="modal-ticket-card">
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
              <Image
                src="/images/logo-badge.png"
                alt="Logo La Parada del Sabor"
                width={70}
                height={70}
                style={{ borderRadius: "50%" }}
              />
            </div>
            <div className="ticket-header">
              <h2>¡Comanda #{comandaExitosa.numero} en Cocina!</h2>
              <p className="ticket-subtitle">
                Los ingredientes y extras fueron descontados de la despensa en gramos.
              </p>
            </div>

            <div className="ticket-details">
              <div className="ticket-row">
                <span>Número de Comanda:</span>
                <strong className="badge-ticket">#{comandaExitosa.numero}</strong>
              </div>
              <div className="ticket-row">
                <span>Total Cobrado:</span>
                <strong>${comandaExitosa.totalUsd.toFixed(2)} USD</strong>
              </div>
              <div className="ticket-row">
                <span>En Bolívares:</span>
                <span>{comandaExitosa.totalBs.toFixed(2)} Bs</span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
              {comandaExitosa.ventaId && (
                <a
                  href={`/recibo/${comandaExitosa.ventaId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-ticket-close"
                  style={{
                    background: "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)",
                    color: "#ffffff",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    fontWeight: 800,
                  }}
                >
                  🧾 Ver Factura Digital Gourmet
                </a>
              )}

              <button
                type="button"
                onClick={() => {
                  const url = `${window.location.origin}/recibo/${comandaExitosa.ventaId || ""}`;
                  const txt = `🧾 *Recibo de Compra - La Parada del Sabor*\n📌 *Comanda:* #${comandaExitosa.numero}\n💰 *Total:* $${comandaExitosa.totalUsd.toFixed(2)} USD / Bs. ${comandaExitosa.totalBs.toFixed(2)}\n🔗 *Ver Factura & Estado:* ${url}`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
                }}
                className="btn-ticket-close"
                style={{
                  background: "#25d366",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  fontWeight: 800,
                }}
              >
                📲 Enviar Factura por WhatsApp
              </button>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn-ticket-close"
                  style={{
                    background: "var(--bg-subtle)",
                    color: "var(--text)",
                    border: "1px solid var(--border)",
                    flex: 1,
                  }}
                >
                  🖨️ Imprimir
                </button>
                <button
                  type="button"
                  onClick={() => setComandaExitosa(null)}
                  className="btn-ticket-close"
                  style={{ flex: 1 }}
                >
                  ✅ Nueva Orden
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Bandeja de Pedidos Web / WhatsApp */}
      {modalPedidosWeb && (
        <div className="modal-overlay" onClick={() => setModalPedidosWeb(false)}>
          <div
            className="modal-ticket-card"
            style={{ maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>
                📱 Bandeja de Pedidos Web / WhatsApp
              </h2>
              <button
                type="button"
                onClick={() => setModalPedidosWeb(false)}
                className="pedir-btn-close-modal"
              >
                ✕
              </button>
            </div>

            {pedidosPendientes.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 10px", color: "var(--text-muted)" }}>
                <span style={{ fontSize: 40, display: "block", marginBottom: 6 }}>📭</span>
                <strong style={{ display: "block", fontSize: 15, color: "var(--text)" }}>
                  No hay pedidos web pendientes
                </strong>
                <p style={{ fontSize: 12, marginTop: 4 }}>
                  Los pedidos que tus clientes hagan desde <code>/pedir</code> o WhatsApp aparecerán aquí al instante para ser confirmados.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {pedidosPendientes.map((p) => {
                  return (
                    <div
                      key={p.id}
                      style={{
                        background: "var(--bg-subtle)",
                        border: "1px solid var(--border)",
                        borderRadius: 14,
                        padding: 14,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <strong style={{ fontSize: 14, color: "var(--text)" }}>
                            #{p.numero_comanda} • {p.cliente?.nombre || "Cliente Web"}
                          </strong>
                          {p.cliente?.telefono && (
                            <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>
                              📞 {p.cliente.telefono}
                            </span>
                          )}
                        </div>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            padding: "2px 8px",
                            borderRadius: 6,
                            background: "rgba(234, 179, 8, 0.15)",
                            color: "#eab308",
                          }}
                        >
                          {p.tipo_entrega === "delivery" ? "🛵 Delivery" : "🛍️ Retiro"}
                        </span>
                      </div>

                      {p.cliente?.direccion_delivery && p.tipo_entrega === "delivery" && (
                        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
                          📍 Dirección: {p.cliente.direccion_delivery}
                        </p>
                      )}

                      {/* Items del pedido */}
                      <div style={{ borderTop: "1px dashed var(--border)", paddingTop: 6 }}>
                        {(p.items || []).map((it: any, iIdx: number) => (
                          <div key={iIdx} style={{ fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                            <span>
                              <strong>{it.cantidad}x</strong> {it.producto?.icono} {it.producto?.nombre}
                              {it.notas_item && <em style={{ color: "var(--primary)" }}> ({it.notas_item})</em>}
                            </span>
                            <span>${Number(it.subtotal_usd).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>

                      {p.notas_comanda && (
                        <p style={{ fontSize: 11, color: "var(--primary)", margin: 0, fontStyle: "italic" }}>
                          💬 Nota: {p.notas_comanda}
                        </p>
                      )}

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: 6 }}>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          Total: <strong style={{ color: "var(--text)", fontSize: 13 }}>${Number(p.total_usd).toFixed(2)} USD</strong> ({Number(p.total_bs).toFixed(2)} Bs)
                        </span>

                        <a
                          href={`/recibo/${p.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 11, fontWeight: 800, color: "var(--primary)", textDecoration: "none" }}
                        >
                          🧾 Ver Factura
                        </a>
                      </div>

                      {/* Botones de Acción */}
                      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                        <button
                          type="button"
                          disabled={procesandoWebId === p.id}
                          onClick={async () => {
                            setProcesandoWebId(p.id);
                            const res = await aceptarPedidoWeb(p.id);
                            setProcesandoWebId(null);
                            if (res.ok) {
                              sounds.playKitchenBell();
                              // Si tiene teléfono, ofrecer abrir WhatsApp
                              if (p.cliente?.telefono) {
                                const url = `${window.location.origin}/recibo/${p.id}`;
                                const txt = `¡Hola ${p.cliente.nombre}! 🫓 Tu pedido en *La Parada del Sabor* ha sido confirmado y ya está en cocina 🍳.\n\n🔗 Puedes seguir el estado y ver tu factura aquí: ${url}`;
                                window.open(`https://wa.me/${p.cliente.telefono.replace(/\D/g, "")}?text=${encodeURIComponent(txt)}`, "_blank");
                              }
                            }
                          }}
                          className="btn-ticket-close"
                          style={{
                            background: "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)",
                            color: "#ffffff",
                            flex: 2,
                            padding: "8px 12px",
                            fontSize: 12,
                          }}
                        >
                          {procesandoWebId === p.id ? "Procesando..." : "✅ Aceptar & Enviar a Cocina"}
                        </button>

                        <button
                          type="button"
                          disabled={procesandoWebId === p.id}
                          onClick={async () => {
                            if (confirm("¿Seguro que deseas rechazar este pedido web?")) {
                              setProcesandoWebId(p.id);
                              await rechazarPedidoWeb(p.id);
                              setProcesandoWebId(null);
                            }
                          }}
                          className="btn-ticket-close"
                          style={{
                            background: "var(--bg-subtle)",
                            color: "#ef4444",
                            border: "1px solid var(--border)",
                            flex: 1,
                            padding: "8px 10px",
                            fontSize: 12,
                          }}
                        >
                          ❌ Rechazar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
