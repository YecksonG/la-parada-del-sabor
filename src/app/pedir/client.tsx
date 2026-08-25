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
  const [drawerCheckout, setDrawerCheckout] = useState(false);

  // Bloquear scroll de la página de fondo cuando el drawer de checkout está abierto
  useEffect(() => {
    if (drawerCheckout) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerCheckout]);

  // Formulario Checkout
  const [nombreCliente, setNombreCliente] = useState("");
  const [telefonoCliente, setTelefonoCliente] = useState("");
  const [tipoEntrega, setTipoEntrega] = useState<"pickup" | "delivery">("pickup");
  const [direccionDelivery, setDireccionDelivery] = useState("");
  const [metodoPago, setMetodoPago] = useState("pago_movil");
  const [notasGenerales, setNotasGenerales] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [copiado, setCopiado] = useState<string | null>(null);
  const [cargandoGps, setCargandoGps] = useState(false);
  const [gpsOk, setGpsOk] = useState(false);

  const handleCopiarTexto = (texto: string, label: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(texto);
      setCopiado(label);
      setTimeout(() => setCopiado(null), 2500);
    }
  };

  const handleObtenerUbicacionGps = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setErrorMsg("Tu navegador no soporta geolocalización GPS. Por favor escribe tu dirección manualmente.");
      return;
    }

    setCargandoGps(true);
    setErrorMsg("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const mapsUrl = `https://maps.google.com/?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
        
        setDireccionDelivery((prev) => {
          const gpsTag = `📍 Ubicación GPS: ${mapsUrl}`;
          if (!prev.trim()) {
            return `${gpsTag}\n(Casa/Piso/Punto de referencia: )`;
          }
          if (prev.includes("maps.google.com")) {
            return prev.replace(/📍 Ubicación GPS: https:\/\/maps\.google\.com\/\?q=[^\s]+/, gpsTag);
          }
          return `${prev.trim()}\n${gpsTag}`;
        });

        setGpsOk(true);
        setCargandoGps(false);
      },
      (err) => {
        setCargandoGps(false);
        let msg = "No se pudo obtener la ubicación GPS.";
        if (err.code === 1) {
          msg = "Permiso de ubicación denegado. Por favor permite el acceso al GPS en tu navegador o escribe tu dirección.";
        } else if (err.code === 2) {
          msg = "Ubicación no disponible en este momento. Por favor escribe tu dirección manualmente.";
        } else if (err.code === 3) {
          msg = "Tiempo de espera agotado al conectar con el GPS.";
        }
        setErrorMsg(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

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

  // Agregar al carrito directamente
  const handleAgregarProductoDirecto = (prod: Producto) => {
    setCarrito((prev) => {
      const existingIdx = prev.findIndex((item) => item.producto.id === prod.id);
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = {
          ...next[existingIdx],
          cantidad: next[existingIdx].cantidad + 1,
        };
        return next;
      }
      return [
        ...prev,
        {
          tempId: `${prod.id}-${Date.now()}-${Math.random()}`,
          producto: prod,
          cantidad: 1,
          extras: [],
        },
      ];
    });
  };

  const handleModificarCantidadPorProducto = (productoId: string, delta: number) => {
    setCarrito((prev) =>
      prev
        .map((item) => {
          if (item.producto.id === productoId) {
            const nuevaCantidad = item.cantidad + delta;
            return nuevaCantidad > 0 ? { ...item, cantidad: nuevaCantidad } : null;
          }
          return item;
        })
        .filter(Boolean) as CarritoItemWeb[]
    );
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
              const itemEnCarrito = carrito.find((item) => item.producto.id === prod.id);
              const cantidadEnCarrito = itemEnCarrito ? itemEnCarrito.cantidad : 0;

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

                    {cantidadEnCarrito > 0 ? (
                      <div className="pedir-card-qty-controls">
                        <button
                          type="button"
                          onClick={() => handleModificarCantidadPorProducto(prod.id, -1)}
                          className="pedir-card-qty-btn"
                          aria-label="Restar una unidad"
                        >
                          -
                        </button>
                        <span className="pedir-card-qty-num">{cantidadEnCarrito}</span>
                        <button
                          type="button"
                          onClick={() => handleModificarCantidadPorProducto(prod.id, 1)}
                          className="pedir-card-qty-btn plus"
                          aria-label="Sumar una unidad"
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAgregarProductoDirecto(prod)}
                        className="pedir-btn-add"
                      >
                        + Agregar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Barra Flotante de Carrito Inferior (Oculta si el checkout está abierto) */}
      {totalItemsCount > 0 && !drawerCheckout && (
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
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <label style={{ margin: 0 }}>Dirección Exacta de Entrega *</label>
                      <button
                        type="button"
                        onClick={handleObtenerUbicacionGps}
                        disabled={cargandoGps}
                        className="pedir-btn-gps"
                        title="Detectar ubicación GPS automáticamente"
                      >
                        {cargandoGps ? "⏳ Buscando satélites..." : gpsOk ? "📍 GPS Detectado ✓" : "📍 Usar mi GPS Actual"}
                      </button>
                    </div>
                    <textarea
                      required
                      rows={2}
                      placeholder="Calle, número de casa, punto de referencia o enlace GPS..."
                      value={direccionDelivery}
                      onChange={(e) => setDireccionDelivery(e.target.value)}
                      className="pedir-form-input"
                    />
                    {gpsOk && (
                      <span style={{ fontSize: 11, color: "var(--green)", fontWeight: 700, marginTop: 4, display: "block" }}>
                        ✨ Tu enlace de Google Maps se adjuntará automáticamente a la comanda para el repartidor.
                      </span>
                    )}
                  </div>
                )}

                {/* Método de Pago (Sin Punto de Venta para pedidos web) */}
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
                    <option value="binance">🟡 Binance USDT</option>
                    <option value="zelle">🟣 Zelle</option>
                  </select>
                </div>

                {/* Datos de Pago Móvil BFC con Botones de Copiado Rápido */}
                {metodoPago === "pago_movil" && (
                  <div className="pedir-pm-box">
                    <div className="pedir-pm-header">
                      <span>🏦 Datos para Pago Móvil</span>
                      <span className="pedir-pm-bank">BFC (0151)</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopiarTexto("0151 04244325183 29524904", "todo")}
                      className="pedir-btn-copy-all"
                    >
                      <span>{copiado === "todo" ? "✅ ¡Datos Copiados para Banco!" : "📋 Copiar Datos (Pegar en tu Banco)"}</span>
                    </button>

                    <div className="pedir-pm-grid">
                      <div className="pedir-pm-item">
                        <span className="pedir-pm-label">Banco:</span>
                        <div className="pedir-pm-val-wrap">
                          <strong className="pedir-pm-val">Fondo Común (0151)</strong>
                          <button
                            type="button"
                            onClick={() => handleCopiarTexto("0151", "banco")}
                            className="pedir-btn-mini-copy"
                            title="Copiar código de banco"
                          >
                            {copiado === "banco" ? "✓" : "📋"}
                          </button>
                        </div>
                      </div>

                      <div className="pedir-pm-item">
                        <span className="pedir-pm-label">Cédula:</span>
                        <div className="pedir-pm-val-wrap">
                          <strong className="pedir-pm-val">29.524.904</strong>
                          <button
                            type="button"
                            onClick={() => handleCopiarTexto("29524904", "ci")}
                            className="pedir-btn-mini-copy"
                            title="Copiar cédula"
                          >
                            {copiado === "ci" ? "✓" : "📋"}
                          </button>
                        </div>
                      </div>

                      <div className="pedir-pm-item">
                        <span className="pedir-pm-label">Teléfono:</span>
                        <div className="pedir-pm-val-wrap">
                          <strong className="pedir-pm-val">0424-4325183</strong>
                          <button
                            type="button"
                            onClick={() => handleCopiarTexto("04244325183", "tlf")}
                            className="pedir-btn-mini-copy"
                            title="Copiar teléfono"
                          >
                            {copiado === "tlf" ? "✓" : "📋"}
                          </button>
                        </div>
                      </div>

                      <div className="pedir-pm-item">
                        <span className="pedir-pm-label">Monto Bs:</span>
                        <div className="pedir-pm-val-wrap">
                          <strong className="pedir-pm-val" style={{ color: "var(--primary)" }}>
                            Bs. {totalCarritoBs.toFixed(2)}
                          </strong>
                          <button
                            type="button"
                            onClick={() => handleCopiarTexto(totalCarritoBs.toFixed(2), "monto")}
                            className="pedir-btn-mini-copy"
                            title="Copiar monto en Bs"
                          >
                            {copiado === "monto" ? "✓" : "📋"}
                          </button>
                        </div>
                      </div>
                    </div>

                    <p className="pedir-pm-hint">
                      💡 Copia los datos para pegarlos directamente en la app de tu banco y luego envíanos la captura por WhatsApp.
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
