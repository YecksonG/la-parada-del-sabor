"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Categoria, Producto, ExtraModificador } from "@/types/database";
import { crearPedidoWebPublico, ItemPedidoWeb } from "./actions";

interface MenuClienteViewProps {
  categorias: Categoria[];
  productos: Producto[];
  extras: ExtraModificador[];
  tasaBcv: number;
}

type CarritoItemWeb = {
  tempId: string;
  producto: Producto;
  cantidad: number;
  notas_item?: string;
  extras: ExtraModificador[];
};

export default function MenuClienteView({
  categorias,
  productos,
  extras,
  tasaBcv,
}: MenuClienteViewProps) {
  const router = useRouter();
  const [catSeleccionada, setCatSeleccionada] = useState<string>("todas");
  const [busqueda, setBusqueda] = useState("");
  const [carrito, setCarrito] = useState<CarritoItemWeb[]>([]);
  const [modalItem, setModalItem] = useState<Producto | null>(null);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [notaPersonalizada, setNotaPersonalizada] = useState("");
  const [drawerCheckout, setDrawerCheckout] = useState(false);

  // Bloquear scroll de la página de fondo cuando un modal o bottom sheet está abierto
  useEffect(() => {
    if (drawerCheckout || modalItem) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerCheckout, modalItem]);

  // Formulario Checkout
  const [nombreCliente, setNombreCliente] = useState("");
  const [telefonoCliente, setTelefonoCliente] = useState("");
  const [tipoEntrega, setTipoEntrega] = useState<"pickup" | "delivery">("pickup");
  const [direccionDelivery, setDireccionDelivery] = useState("");
  const [metodoPago, setMetodoPago] = useState("pago_movil");
  const [notasGenerales, setNotasGenerales] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const productosFiltrados = useMemo(() => {
    return productos.filter((p) => {
      const matchCat = catSeleccionada === "todas" || p.categoria_id === catSeleccionada;
      const matchSearch =
        !busqueda ||
        p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.descripcion?.toLowerCase().includes(busqueda.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [productos, catSeleccionada, busqueda]);

  const totalCarritoUsd = useMemo(() => {
    return carrito.reduce((acc, item) => {
      const base = Number(item.producto.precio_usd || (item.producto as any).pvp_usd || 0) * item.cantidad;
      const extrasTotal = item.extras.reduce(
        (eAcc, ext) => eAcc + Number(ext.precio_extra_usd || 0) * item.cantidad,
        0
      );
      return acc + base + extrasTotal;
    }, 0);
  }, [carrito]);

  const totalCarritoBs = Number((totalCarritoUsd * tasaBcv).toFixed(2));
  const totalItemsCount = carrito.reduce((acc, item) => acc + item.cantidad, 0);

  // Abrir modal de configuración de producto
  const handleAbrirModalProducto = (prod: Producto) => {
    setModalItem(prod);
    setSelectedExtras([]);
    setNotaPersonalizada("");
  };

  // Agregar al carrito
  const handleAgregarAlCarrito = () => {
    if (!modalItem) return;

    const extrasElegidos = extras.filter((e) => selectedExtras.includes(e.id));
    const nuevoItem: CarritoItemWeb = {
      tempId: `${modalItem.id}-${Date.now()}-${Math.random()}`,
      producto: modalItem,
      cantidad: 1,
      notas_item: notaPersonalizada.trim() || undefined,
      extras: extrasElegidos,
    };

    setCarrito((prev) => [...prev, nuevoItem]);
    setModalItem(null);
  };

  const handleModificarCantidad = (tempId: string, delta: number) => {
    setCarrito((prev) =>
      prev
        .map((item) => {
          if (item.tempId === tempId) {
            const nuevaCantidad = item.cantidad + delta;
            return nuevaCantidad > 0 ? { ...item, cantidad: nuevaCantidad } : null;
          }
          return item;
        })
        .filter(Boolean) as CarritoItemWeb[]
    );
  };

  const handleConfirmarPedido = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!nombreCliente.trim()) {
      setErrorMsg("Por favor indica tu nombre completo.");
      return;
    }
    if (!telefonoCliente.trim()) {
      setErrorMsg("Por favor indica tu número de WhatsApp para contacto.");
      return;
    }
    if (tipoEntrega === "delivery" && !direccionDelivery.trim()) {
      setErrorMsg("Por favor indica la dirección exacta para el delivery.");
      return;
    }
    if (carrito.length === 0) {
      setErrorMsg("Tu carrito está vacío.");
      return;
    }

    if (tasaBcv <= 0) {
      setErrorMsg("El restaurante está actualizando la tasa del día. Por favor intenta en unos instantes.");
      return;
    }

    setEnviando(true);

    const itemsPayload: ItemPedidoWeb[] = carrito.map((item) => ({
      producto_id: item.producto.id,
      cantidad: item.cantidad,
      notas_item: item.notas_item,
      extras_ids: item.extras.map((e) => e.id),
    }));

    const res = await crearPedidoWebPublico({
      nombre_cliente: nombreCliente,
      telefono: telefonoCliente,
      tipo_entrega: tipoEntrega,
      direccion_delivery: direccionDelivery,
      metodo_pago: metodoPago,
      notas_pedido: notasGenerales,
      items: itemsPayload,
    });

    setEnviando(false);

    if (res.ok && res.venta_id) {
      // Redirigir de inmediato a la Factura Digital Gourmet
      router.push(`/recibo/${res.venta_id}`);
    } else {
      setErrorMsg(res.error || "Ocurrió un error al procesar tu pedido.");
    }
  };

  return (
    <div className="pedir-page-layout">
      {/* Header Público de La Parada del Sabor */}
      <header className="pedir-hero-header">
        <div className="pedir-header-top">
          <Link href="/" className="pedir-brand-brand">
            <Image
              src="/images/logo-badge.png"
              alt="Logo La Parada del Sabor"
              width={42}
              height={42}
              className="pedir-hero-logo-img"
              priority
            />
            <div>
              <span className="pedir-brand-title">La Parada del Sabor</span>
              <span className="pedir-brand-subtitle">Arepas Tradicionales & Más</span>
            </div>
          </Link>

          <div className="pedir-header-actions">
            {tasaBcv > 0 && (
              <div className="pedir-bcv-pill">
                <span className="pedir-bcv-dot"></span>
                <span>Tasa: <strong>{tasaBcv.toFixed(2)} Bs</strong></span>
              </div>
            )}

            {totalItemsCount > 0 && (
              <button
                type="button"
                onClick={() => setDrawerCheckout(true)}
                className="pedir-header-cart-btn"
                aria-label="Ver carrito"
              >
                <span>🛒</span>
                <span className="pedir-header-cart-badge">{totalItemsCount}</span>
              </button>
            )}
          </div>
        </div>

        {/* Buscador de Platos */}
        <div className="pedir-search-container">
          <input
            type="search"
            placeholder="🔍 Buscar arepas, bebidas, rellenos..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pedir-search-input"
          />
        </div>

        {/* Categorías en Chips */}
        <div className="pedir-cats-scroll">
          <button
            type="button"
            onClick={() => setCatSeleccionada("todas")}
            className={`pedir-cat-chip ${catSeleccionada === "todas" ? "active" : ""}`}
          >
            🍽️ Todas
          </button>
          {categorias.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCatSeleccionada(cat.id)}
              className={`pedir-cat-chip ${catSeleccionada === cat.id ? "active" : ""}`}
            >
              <span>{cat.icono || "🫓"}</span>
              <span>{cat.nombre}</span>
            </button>
          ))}
        </div>
      </header>

      {/* Catálogo de Productos */}
      <main className="pedir-products-container">
        {productosFiltrados.length === 0 ? (
          <div className="pedir-empty-catalog">
            <span>🔍</span>
            <h3>No encontramos productos</h3>
            <p>Intenta con otra palabra clave o selecciona otra categoría.</p>
          </div>
        ) : (
          <div className="pedir-products-grid">
            {productosFiltrados.map((prod) => {
              const precioUsd = Number(prod.precio_usd || (prod as any).pvp_usd || 0);
              const precioBs = precioUsd * tasaBcv;

              return (
                <div key={prod.id} className="pedir-product-card">
                  <div className="pedir-product-card-body">
                    <div className="pedir-product-icon-wrap">
                      <span className="pedir-product-glyph">{prod.icono || "🫓"}</span>
                    </div>
                    <div className="pedir-product-details">
                      <div className="pedir-product-head">
                        <h3 className="pedir-product-title">{prod.nombre}</h3>
                        {prod.popular && <span className="pedir-badge-popular">🔥 Top</span>}
                      </div>
                      {prod.descripcion && (
                        <p className="pedir-product-desc">{prod.descripcion}</p>
                      )}
                    </div>
                  </div>

                  <div className="pedir-product-footer">
                    <div className="pedir-product-price-box">
                      <span className="pedir-price-usd">${precioUsd.toFixed(2)}</span>
                      <span className="pedir-price-bs">Bs. {precioBs.toFixed(2)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAbrirModalProducto(prod)}
                      className="pedir-btn-add"
                    >
                      + Agregar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Barra Flotante de Carrito Inferior */}
      {totalItemsCount > 0 && (
        <div className="pedir-floating-cart-bar">
          <div className="pedir-cart-summary">
            <span className="pedir-cart-badge">{totalItemsCount}</span>
            <div className="pedir-cart-prices">
              <strong className="pedir-cart-total-usd">${totalCarritoUsd.toFixed(2)} USD</strong>
              <span className="pedir-cart-total-bs">Bs. {totalCarritoBs.toFixed(2)}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDrawerCheckout(true)}
            className="pedir-cart-btn-open"
          >
            <span>Ver Pedido ➔</span>
          </button>
        </div>
      )}

      {/* Modal para Personalizar Producto / Extras */}
      {modalItem && (
        <div className="modal-overlay" onClick={() => setModalItem(null)}>
          <div className="pedir-modal-custom" onClick={(e) => e.stopPropagation()}>
            <div className="pedir-sheet-drag-handle" aria-hidden="true" />
            <div className="pedir-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 28 }}>{modalItem.icono || "🫓"}</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900 }}>{modalItem.nombre}</h3>
                  <span style={{ fontSize: 13, color: "var(--primary)", fontWeight: 800 }}>
                    ${Number(modalItem.precio_usd || (modalItem as any).pvp_usd || 0).toFixed(2)} USD • Bs. {(Number(modalItem.precio_usd || (modalItem as any).pvp_usd || 0) * tasaBcv).toFixed(2)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalItem(null)}
                className="pedir-btn-close-modal"
              >
                ✕
              </button>
            </div>

            <div className="pedir-modal-body-scroll">
              {modalItem.descripcion && (
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "8px 0 14px 0" }}>
                  {modalItem.descripcion}
                </p>
              )}

              {/* Extras Disponibles */}
              {extras.length > 0 && (
                <div className="pedir-extras-group">
                  <span className="pedir-section-subtitle">¿Deseas agregar extras?</span>
                  <div className="pedir-extras-list">
                    {extras.map((ext) => {
                      const isSelected = selectedExtras.includes(ext.id);
                      const extPriceUsd = Number(ext.precio_extra_usd || 0);

                      return (
                        <label key={ext.id} className={`pedir-extra-option ${isSelected ? "selected" : ""}`}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedExtras((prev) => [...prev, ext.id]);
                              } else {
                                setSelectedExtras((prev) => prev.filter((id) => id !== ext.id));
                              }
                            }}
                          />
                          <span className="pedir-extra-name">{ext.nombre}</span>
                          <span className="pedir-extra-price">
                            {extPriceUsd > 0 ? `+$${extPriceUsd.toFixed(2)}` : "Gratis"}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Nota personalizada */}
              <div style={{ marginTop: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                  Instrucciones especiales para cocina (Opcional):
                </label>
                <input
                  type="text"
                  placeholder="Ej: Bien tostada, sin mayonesa, salsa aparte..."
                  value={notaPersonalizada}
                  onChange={(e) => setNotaPersonalizada(e.target.value)}
                  className="pedir-note-input"
                />
              </div>
            </div>

            <div className="pedir-modal-sticky-footer">
              <button
                type="button"
                onClick={handleAgregarAlCarrito}
                className="pedir-btn-add-confirm"
              >
                ✓ Agregar al Pedido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer Checkout Final del Cliente (Mobile First Bottom Sheet) */}
      {drawerCheckout && (
        <div className="modal-overlay" onClick={() => setDrawerCheckout(false)}>
          <div className="pedir-drawer-checkout" onClick={(e) => e.stopPropagation()}>
            <div className="pedir-sheet-drag-handle" aria-hidden="true" />
            <div className="pedir-drawer-header">
              <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>🛒 Tu Pedido ({totalItemsCount})</h2>
              <button
                type="button"
                onClick={() => setDrawerCheckout(false)}
                className="pedir-btn-close-modal"
              >
                ✕
              </button>
            </div>

            {/* Cuerpo desplazable */}
            <div className="pedir-drawer-body-scroll">
              {/* Lista de Items en Carrito */}
              <div className="pedir-cart-items-list">
                {carrito.map((item) => {
                  const precioTotal =
                    (Number(item.producto.precio_usd || (item.producto as any).pvp_usd || 0) +
                      item.extras.reduce((acc, e) => acc + Number(e.precio_extra_usd || 0), 0)) *
                    item.cantidad;

                  return (
                    <div key={item.tempId} className="pedir-cart-item-row">
                      <div style={{ flex: 1 }}>
                        <strong style={{ fontSize: 13, display: "block" }}>
                          {item.producto.icono} {item.producto.nombre}
                        </strong>
                        {item.extras.length > 0 && (
                          <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>
                            Extras: {item.extras.map((e) => e.nombre).join(", ")}
                          </span>
                        )}
                        {item.notas_item && (
                          <span style={{ fontSize: 11, color: "var(--primary)", fontStyle: "italic", display: "block" }}>
                            Nota: {item.notas_item}
                          </span>
                        )}
                        <span style={{ fontSize: 12, fontWeight: 800, color: "var(--text)" }}>
                          ${precioTotal.toFixed(2)} USD • Bs. {(precioTotal * tasaBcv).toFixed(2)}
                        </span>
                      </div>

                      <div className="pedir-qty-controls">
                        <button
                          type="button"
                          onClick={() => handleModificarCantidad(item.tempId, -1)}
                          className="pedir-qty-btn"
                        >
                          -
                        </button>
                        <span className="pedir-qty-num">{item.cantidad}</span>
                        <button
                          type="button"
                          onClick={() => handleModificarCantidad(item.tempId, 1)}
                          className="pedir-qty-btn"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Formulario de Envío & Datos del Cliente */}
              <form id="pedir-checkout-form-id" onSubmit={handleConfirmarPedido} className="pedir-checkout-form">
                {errorMsg && <div className="pedir-error-alert">{errorMsg}</div>}

                <div className="pedir-form-group">
                  <label>Tu Nombre y Apellido *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Carlos Mendoza"
                    value={nombreCliente}
                    onChange={(e) => setNombreCliente(e.target.value)}
                    className="pedir-form-input"
                  />
                </div>

                <div className="pedir-form-group">
                  <label>Teléfono / WhatsApp *</label>
                  <input
                    type="tel"
                    required
                    placeholder="Ej: 0412 1234567"
                    value={telefonoCliente}
                    onChange={(e) => setTelefonoCliente(e.target.value)}
                    className="pedir-form-input"
                  />
                </div>

                {/* Modalidad de Entrega */}
                <div className="pedir-form-group">
                  <label>Modalidad de Entrega</label>
                  <div className="pedir-delivery-switch">
                    <button
                      type="button"
                      className={`pedir-switch-opt ${tipoEntrega === "pickup" ? "active" : ""}`}
                      onClick={() => setTipoEntrega("pickup")}
                    >
                      🛍️ Para Llevar / Retiro
                    </button>
                    <button
                      type="button"
                      className={`pedir-switch-opt ${tipoEntrega === "delivery" ? "active" : ""}`}
                      onClick={() => setTipoEntrega("delivery")}
                    >
                      🛵 Delivery a Domicilio
                    </button>
                  </div>
                </div>

                {tipoEntrega === "delivery" && (
                  <div className="pedir-form-group">
                    <label>Dirección Exacta de Entrega *</label>
                    <textarea
                      required
                      rows={2}
                      placeholder="Calle, número de casa, punto de referencia..."
                      value={direccionDelivery}
                      onChange={(e) => setDireccionDelivery(e.target.value)}
                      className="pedir-form-input"
                    />
                  </div>
                )}

                {/* Método de Pago */}
                <div className="pedir-form-group">
                  <label>Método de Pago</label>
                  <select
                    value={metodoPago}
                    onChange={(e) => setMetodoPago(e.target.value)}
                    className="pedir-form-input"
                  >
                    <option value="pago_movil">📱 Pago Móvil (Bs)</option>
                    <option value="efectivo_usd">💵 Efectivo USD</option>
                    <option value="efectivo_bs">🇻🇪 Efectivo Bolívares</option>
                    <option value="punto">💳 Tarjeta / Punto de Venta</option>
                    <option value="binance">🟡 Binance USDT</option>
                    <option value="zelle">🟣 Zelle</option>
                  </select>
                </div>

                {/* Datos de Pago Móvil BFC */}
                {metodoPago === "pago_movil" && (
                  <div className="pedir-pm-box">
                    <div className="pedir-pm-header">
                      <span>🏦 Datos para Pago Móvil</span>
                      <span className="pedir-pm-bank">BFC (0151)</span>
                    </div>
                    <div className="pedir-pm-grid">
                      <div className="pedir-pm-item">
                        <span className="pedir-pm-label">Banco:</span>
                        <strong className="pedir-pm-val">Banco Fondo Común (0151)</strong>
                      </div>
                      <div className="pedir-pm-item">
                        <span className="pedir-pm-label">Cédula:</span>
                        <strong className="pedir-pm-val">29.524.904</strong>
                      </div>
                      <div className="pedir-pm-item">
                        <span className="pedir-pm-label">Teléfono:</span>
                        <strong className="pedir-pm-val">0424-4325183</strong>
                      </div>
                    </div>
                    <p className="pedir-pm-hint">
                      💡 Podrás enviar tu comprobante directo a nuestro WhatsApp tras confirmar el pedido.
                    </p>
                  </div>
                )}

                {/* Notas generales */}
                <div className="pedir-form-group">
                  <label>Comentarios adicionales (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ej: Tengo billete de $20 para vuelto..."
                    value={notasGenerales}
                    onChange={(e) => setNotasGenerales(e.target.value)}
                    className="pedir-form-input"
                  />
                </div>
              </form>
            </div>

            {/* Pie Fijo con Resumen y Botón de Enviar Pedido */}
            <div className="pedir-drawer-sticky-footer">
              <div className="pedir-checkout-totals">
                <div className="pedir-checkout-line">
                  <span>Total en Dólares:</span>
                  <strong className="pedir-val-usd">${totalCarritoUsd.toFixed(2)} USD</strong>
                </div>
                <div className="pedir-checkout-line">
                  <span>Total en Bolívares:</span>
                  {tasaBcv > 0 ? (
                    <strong className="pedir-val-bs">Bs. {totalCarritoBs.toFixed(2)}</strong>
                  ) : (
                    <strong className="pedir-val-bs" style={{ fontSize: 13, color: "var(--text-muted)" }}>
                      Tasa en actualización...
                    </strong>
                  )}
                </div>
              </div>

              <button
                type="submit"
                form="pedir-checkout-form-id"
                disabled={enviando}
                className="pedir-btn-submit-order"
              >
                {enviando ? "Enviando Pedido..." : "🚀 Enviar Pedido a Cocina"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Botón flotante de contacto de WhatsApp para dudas */}
      <a
        href="https://wa.me/584122595386?text=¡Hola!%20Tengo%20una%20consulta%20sobre%20mi%20pedido%20en%20La%20Parada%20del%20Sabor"
        target="_blank"
        rel="noopener noreferrer"
        className="pedir-floating-whatsapp-btn"
        title="¿Dudas? Escríbenos al WhatsApp"
        aria-label="Contactar por WhatsApp"
      >
        <span>💬</span>
      </a>
    </div>
  );
}
