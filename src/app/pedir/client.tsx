"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/theme-toggle";
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
  const [origenPedido, setOrigenPedido] = useState<string>("directo");
  const [enviando, setEnviando] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [modalLimitePedidos, setModalLimitePedidos] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [cargandoGps, setCargandoGps] = useState(false);
  const [gpsOk, setGpsOk] = useState(false);

  // Modal límite: Escape key + focus trap
  const modalLimiteRef = useRef<HTMLDivElement>(null);

  const handleModalLimiteKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setModalLimitePedidos(false);
        return;
      }
      if (e.key === "Tab" && modalLimiteRef.current) {
        const focusable = modalLimiteRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    },
    []
  );

  useEffect(() => {
    if (modalLimitePedidos) {
      const timer = setTimeout(() => {
        const el = modalLimiteRef.current;
        if (el) {
          const btn = el.querySelector<HTMLElement>("button");
          btn?.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [modalLimitePedidos]);

  // RASTREO MULTI-CANAL ROBUSTO DE ORIGEN (WhatsApp / Instagram / TikTok / QR / Directo)
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      const rawParam = (
        params.get("ref") ||
        params.get("origen") ||
        params.get("source") ||
        params.get("src") ||
        params.get("canal") ||
        params.get("utm_source") ||
        params.get("utm_medium") ||
        (params.has("wa") ? "whatsapp" : "") ||
        (params.has("whatsapp") ? "whatsapp" : "") ||
        (params.has("ig") ? "instagram" : "") ||
        (params.has("instagram") ? "instagram" : "") ||
        ""
      ).toLowerCase().trim();

      const ua = (navigator.userAgent || "").toLowerCase();
      const refUrl = (document.referrer || "").toLowerCase();

      let detectado = "directo";

      // 1. Detección por Parámetros de URL
      if (rawParam.includes("whatsapp") || rawParam === "wa" || rawParam === "ws") {
        detectado = "whatsapp";
      } else if (rawParam.includes("instagram") || rawParam === "ig") {
        detectado = "instagram";
      } else if (rawParam.includes("tiktok") || rawParam === "tt") {
        detectado = "tiktok";
      } else if (rawParam.includes("qr")) {
        detectado = "qr";
      } else if (rawParam) {
        detectado = rawParam;
      }
      // 2. Detección por In-App Browser (User Agent de WhatsApp / Instagram)
      else if (ua.includes("whatsapp")) {
        detectado = "whatsapp";
      } else if (ua.includes("instagram")) {
        detectado = "instagram";
      } else if (ua.includes("musical_ly") || ua.includes("bytedance") || ua.includes("tiktok")) {
        detectado = "tiktok";
      } else if (ua.includes("fban") || ua.includes("fbav")) {
        detectado = "facebook";
      }
      // 3. Detección por Referrer
      else if (refUrl.includes("whatsapp.com") || refUrl.includes("wa.me")) {
        detectado = "whatsapp";
      } else if (refUrl.includes("instagram.com")) {
        detectado = "instagram";
      } else if (refUrl.includes("tiktok.com")) {
        detectado = "tiktok";
      } else if (refUrl.includes("facebook.com")) {
        detectado = "facebook";
      }

      // Persistencia en sesión y storage
      const storedRef = sessionStorage.getItem("laparada_ref_origen") || localStorage.getItem("laparada_ref_origen");
      if (detectado !== "directo") {
        sessionStorage.setItem("laparada_ref_origen", detectado);
        localStorage.setItem("laparada_ref_origen", detectado);
        setOrigenPedido(detectado);
      } else if (storedRef) {
        setOrigenPedido(storedRef);
      } else {
        sessionStorage.setItem("laparada_ref_origen", "directo");
        setOrigenPedido("directo");
      }
    } catch {}
  }, []);

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
      const base = Number(item.producto.precio_usd || 0) * item.cantidad;
      const extrasTotal = item.extras.reduce(
        (eAcc, ext) => eAcc + Number(ext.precio_extra_usd || 0) * item.cantidad,
        0
      );
      return acc + base + extrasTotal;
    }, 0);
  }, [carrito]);

  const totalCarritoBs = Number((totalCarritoUsd * tasaBcv).toFixed(2));
  const totalItemsCount = carrito.reduce((acc, item) => acc + item.cantidad, 0);

  // Agregar al carrito directamente (Límite máximo 25 por producto)
  const handleAgregarProductoDirecto = (prod: Producto) => {
    setCarrito((prev) => {
      const existingIdx = prev.findIndex((item) => item.producto.id === prod.id);
      if (existingIdx >= 0) {
        if (prev[existingIdx].cantidad >= 25) {
          setErrorMsg("Límite alcanzado: máximo 25 unidades de este producto por pedido.");
          return prev;
        }
        const next = [...prev];
        next[existingIdx] = {
          ...next[existingIdx],
          cantidad: Math.min(25, next[existingIdx].cantidad + 1),
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
            const nuevaCantidad = Math.min(25, item.cantidad + delta);
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
            const nuevaCantidad = Math.min(25, item.cantidad + delta);
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
      origen_pedido: origenPedido,
      items: itemsPayload,
    });

    setEnviando(false);

    if (res.ok && res.venta_id) {
      // Redirigir de inmediato a la Factura Digital Gourmet
      router.push(`/recibo/${res.venta_id}`);
    } else if (
      res.code === "LIMIT_PENDING_ORDERS" ||
      res.error?.toLowerCase().includes("2 pedidos") ||
      res.error?.toLowerCase().includes("pedidos en espera")
    ) {
      setModalLimitePedidos(true);
      setErrorMsg("");
    } else {
      setErrorMsg(res.error || "Ocurrió un error al procesar tu pedido.");
    }
  };

  return (
    <div className="pedir-page-layout">
      {/* Header Público de La Parada del Sabor */}
      <header className="pedir-hero-header">
        <div className="pedir-header-top">
          <div
            className="pedir-brand-brand"
            style={{ cursor: "pointer", userSelect: "none" }}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            role="button"
            tabIndex={0}
          >
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
          </div>

          <div className="pedir-header-actions">
            <ThemeToggle />
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
              const precioUsd = Number(prod.precio_usd || 0);
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
                    (Number(item.producto.precio_usd || 0) +
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

                {/* Método de Pago */}
                <div className="pedir-form-group">
                  <label>Método de Pago</label>
                  <select
                    value={metodoPago}
                    onChange={(e) => setMetodoPago(e.target.value)}
                    className="pedir-form-input"
                  >
                    <option value="pago_movil">📱 Pago Móvil (Bs)</option>
                    <option value="transferencia">🏦 Transferencia Bancaria (Bs)</option>
                    <option value="binance">🟡 Binance USDT (Pay ID)</option>
                    <option value="zelle">🟣 Zelle (USD)</option>
                    <option value="efectivo_usd">💵 Efectivo USD</option>
                    <option value="efectivo_bs">🇻🇪 Efectivo Bolívares</option>
                  </select>
                </div>

                {/* 1. Datos de Pago Móvil BFC */}
                {metodoPago === "pago_movil" && (
                  <div className="pedir-pm-box">
                    <div className="pedir-pm-header">
                      <span>📱 Datos para Pago Móvil</span>
                      <span className="pedir-pm-bank">BFC (0151)</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopiarTexto("0151 04244325183 29524904", "todo_pm")}
                      className="pedir-btn-copy-all"
                    >
                      <span>{copiado === "todo_pm" ? "✅ ¡Datos Copiados para Banco!" : "📋 Copiar Datos (Pegar en tu Banco)"}</span>
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
                        <span className="pedir-pm-label">Monto Exacto:</span>
                        <div className="pedir-pm-val-wrap">
                          <strong className="pedir-pm-val" style={{ color: "var(--primary)" }}>
                            Bs. {totalCarritoBs.toFixed(2)}
                          </strong>
                          <button
                            type="button"
                            onClick={() => handleCopiarTexto(totalCarritoBs.toFixed(2), "monto_bs")}
                            className="pedir-btn-mini-copy"
                            title="Copiar monto en Bs"
                          >
                            {copiado === "monto_bs" ? "✓" : "📋"}
                          </button>
                        </div>
                      </div>
                    </div>

                    <p className="pedir-pm-hint">
                      💡 Copia los datos para pegarlos directamente en la app de tu banco y luego envíanos la captura por WhatsApp.
                    </p>
                  </div>
                )}

                {/* 2. Datos para Transferencia Bancaria BFC */}
                {metodoPago === "transferencia" && (
                  <div className="pedir-pm-box">
                    <div className="pedir-pm-header">
                      <span>🏦 Transferencia Bancaria (VES)</span>
                      <span className="pedir-pm-bank">BFC (0151)</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopiarTexto("01510035451002204840", "cuenta_bfc")}
                      className="pedir-btn-copy-all"
                    >
                      <span>{copiado === "cuenta_bfc" ? "✅ ¡Número de Cuenta Copiado!" : "📋 Copiar Número de Cuenta (20 Dígitos)"}</span>
                    </button>

                    <div className="pedir-pm-grid">
                      <div className="pedir-pm-item">
                        <span className="pedir-pm-label">Banco:</span>
                        <strong className="pedir-pm-val">Banco Fondo Común (BFC)</strong>
                      </div>

                      <div className="pedir-pm-item">
                        <span className="pedir-pm-label">Titular:</span>
                        <div className="pedir-pm-val-wrap">
                          <strong className="pedir-pm-val" style={{ fontSize: 11 }}>GONZALEZ NOGUERA YECKSON</strong>
                          <button
                            type="button"
                            onClick={() => handleCopiarTexto("GONZALEZ NOGUERA YECKSON", "titular")}
                            className="pedir-btn-mini-copy"
                            title="Copiar nombre"
                          >
                            {copiado === "titular" ? "✓" : "📋"}
                          </button>
                        </div>
                      </div>

                      <div className="pedir-pm-item">
                        <span className="pedir-pm-label">Cédula:</span>
                        <div className="pedir-pm-val-wrap">
                          <strong className="pedir-pm-val">V-29524904</strong>
                          <button
                            type="button"
                            onClick={() => handleCopiarTexto("29524904", "ci_transf")}
                            className="pedir-btn-mini-copy"
                            title="Copiar cédula"
                          >
                            {copiado === "ci_transf" ? "✓" : "📋"}
                          </button>
                        </div>
                      </div>

                      <div className="pedir-pm-item">
                        <span className="pedir-pm-label">N° de Cuenta:</span>
                        <div className="pedir-pm-val-wrap">
                          <strong className="pedir-pm-val" style={{ fontSize: 11 }}>01510035451002204840</strong>
                          <button
                            type="button"
                            onClick={() => handleCopiarTexto("01510035451002204840", "cta_mini")}
                            className="pedir-btn-mini-copy"
                            title="Copiar cuenta"
                          >
                            {copiado === "cta_mini" ? "✓" : "📋"}
                          </button>
                        </div>
                      </div>

                      <div className="pedir-pm-item">
                        <span className="pedir-pm-label">Monto a Transferir:</span>
                        <div className="pedir-pm-val-wrap">
                          <strong className="pedir-pm-val" style={{ color: "var(--primary)" }}>
                            Bs. {totalCarritoBs.toFixed(2)}
                          </strong>
                          <button
                            type="button"
                            onClick={() => handleCopiarTexto(totalCarritoBs.toFixed(2), "monto_transf")}
                            className="pedir-btn-mini-copy"
                            title="Copiar monto"
                          >
                            {copiado === "monto_transf" ? "✓" : "📋"}
                          </button>
                        </div>
                      </div>
                    </div>

                    <p className="pedir-pm-hint">
                      💡 Realiza la transferencia desde BFC u otros bancos y envíanos el comprobante digital al WhatsApp.
                    </p>
                  </div>
                )}

                {/* 3. Datos para Binance USDT */}
                {metodoPago === "binance" && (
                  <div className="pedir-pm-box" style={{ borderLeftColor: "#F3BA2F" }}>
                    <div className="pedir-pm-header">
                      <span>🟡 Binance Pay (USDT)</span>
                      <span className="pedir-pm-bank" style={{ color: "#F3BA2F", borderColor: "#F3BA2F" }}>Binance Pay</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopiarTexto("371902899", "binance_id")}
                      className="pedir-btn-copy-all"
                      style={{ background: "#F3BA2F", color: "#000000" }}
                    >
                      <span>{copiado === "binance_id" ? "✅ ¡Binance ID Copiado!" : "📋 Copiar Binance Pay ID (371902899)"}</span>
                    </button>

                    <div className="pedir-pm-grid">
                      <div className="pedir-pm-item">
                        <span className="pedir-pm-label">Binance Pay ID:</span>
                        <div className="pedir-pm-val-wrap">
                          <strong className="pedir-pm-val">371902899</strong>
                          <button
                            type="button"
                            onClick={() => handleCopiarTexto("371902899", "pay_id")}
                            className="pedir-btn-mini-copy"
                            title="Copiar ID"
                          >
                            {copiado === "pay_id" ? "✓" : "📋"}
                          </button>
                        </div>
                      </div>

                      <div className="pedir-pm-item">
                        <span className="pedir-pm-label">Correo Binance:</span>
                        <div className="pedir-pm-val-wrap">
                          <strong className="pedir-pm-val" style={{ fontSize: 11 }}>yecksongonza2002@gmail.com</strong>
                          <button
                            type="button"
                            onClick={() => handleCopiarTexto("yecksongonza2002@gmail.com", "binance_email")}
                            className="pedir-btn-mini-copy"
                            title="Copiar correo"
                          >
                            {copiado === "binance_email" ? "✓" : "📋"}
                          </button>
                        </div>
                      </div>

                      <div className="pedir-pm-item">
                        <span className="pedir-pm-label">Monto a Enviar:</span>
                        <div className="pedir-pm-val-wrap">
                          <strong className="pedir-pm-val" style={{ color: "#F3BA2F" }}>
                            ${totalCarritoUsd.toFixed(2)} USDT
                          </strong>
                          <button
                            type="button"
                            onClick={() => handleCopiarTexto(totalCarritoUsd.toFixed(2), "monto_usdt")}
                            className="pedir-btn-mini-copy"
                            title="Copiar monto"
                          >
                            {copiado === "monto_usdt" ? "✓" : "📋"}
                          </button>
                        </div>
                      </div>
                    </div>

                    <p className="pedir-pm-hint">
                      💡 Puedes transferir por Binance Pay usando el ID o correo sin comisión.
                    </p>
                  </div>
                )}

                {/* 4. Datos para Zelle */}
                {metodoPago === "zelle" && (
                  <div className="pedir-pm-box" style={{ borderLeftColor: "#7414CA" }}>
                    <div className="pedir-pm-header">
                      <span>🟣 Pago por Zelle (USD)</span>
                      <span className="pedir-pm-bank" style={{ color: "#7414CA", borderColor: "#7414CA" }}>Zelle</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopiarTexto("yasbetnoguer@hotmail.com", "zelle_email")}
                      className="pedir-btn-copy-all"
                      style={{ background: "#7414CA" }}
                    >
                      <span>{copiado === "zelle_email" ? "✅ ¡Correo Zelle Copiado!" : "📋 Copiar Correo Zelle"}</span>
                    </button>

                    <div className="pedir-pm-grid">
                      <div className="pedir-pm-item">
                        <span className="pedir-pm-label">Correo Zelle:</span>
                        <div className="pedir-pm-val-wrap">
                          <strong className="pedir-pm-val" style={{ fontSize: 11 }}>yasbetnoguer@hotmail.com</strong>
                          <button
                            type="button"
                            onClick={() => handleCopiarTexto("yasbetnoguer@hotmail.com", "zelle_mail_mini")}
                            className="pedir-btn-mini-copy"
                            title="Copiar correo"
                          >
                            {copiado === "zelle_mail_mini" ? "✓" : "📋"}
                          </button>
                        </div>
                      </div>

                      <div className="pedir-pm-item">
                        <span className="pedir-pm-label">Monto Exacto:</span>
                        <div className="pedir-pm-val-wrap">
                          <strong className="pedir-pm-val" style={{ color: "#7414CA" }}>
                            ${totalCarritoUsd.toFixed(2)} USD
                          </strong>
                          <button
                            type="button"
                            onClick={() => handleCopiarTexto(totalCarritoUsd.toFixed(2), "monto_zelle")}
                            className="pedir-btn-mini-copy"
                            title="Copiar monto"
                          >
                            {copiado === "monto_zelle" ? "✓" : "📋"}
                          </button>
                        </div>
                      </div>
                    </div>

                    <p className="pedir-pm-hint">
                      💡 Envía tu comprobante de transferencia Zelle al confirmar el pedido.
                    </p>
                  </div>
                )}

                {/* 5. Efectivo USD */}
                {metodoPago === "efectivo_usd" && (
                  <div className="pedir-pm-box" style={{ borderLeftColor: "#22c55e" }}>
                    <div className="pedir-pm-header">
                      <span>💵 Pago en Efectivo (Dólares)</span>
                      <span className="pedir-pm-bank" style={{ color: "#22c55e", borderColor: "#22c55e" }}>Efectivo USD</span>
                    </div>
                    <p className="pedir-pm-hint" style={{ color: "var(--text)" }}>
                      Total a pagar: <strong>${totalCarritoUsd.toFixed(2)} USD</strong>. Por favor entrega billetes en buen estado (sin roturas ni manchas). Si requieres vuelto, indícalo abajo en comentarios.
                    </p>
                  </div>
                )}

                {/* 6. Efectivo Bs */}
                {metodoPago === "efectivo_bs" && (
                  <div className="pedir-pm-box" style={{ borderLeftColor: "#3b82f6" }}>
                    <div className="pedir-pm-header">
                      <span>🇻🇪 Pago en Efectivo (Bolívares)</span>
                      <span className="pedir-pm-bank" style={{ color: "#3b82f6", borderColor: "#3b82f6" }}>Efectivo Bs</span>
                    </div>
                    <p className="pedir-pm-hint" style={{ color: "var(--text)" }}>
                      Total a pagar: <strong>Bs. {totalCarritoBs.toFixed(2)}</strong>. Por favor ten a mano el monto exacto o indica la denominación de tus billetes en las notas de abajo.
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

      {/* Modal Blindaje #2: Límite de Pedidos Pendientes Simultáneos */}
      {modalLimitePedidos && (
        <div
          className="modal-overlay"
          onClick={() => setModalLimitePedidos(false)}
          style={{ zIndex: 1050 }}
        >
          <div
            ref={modalLimiteRef}
            className="pedir-modal-limite-card"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleModalLimiteKeyDown}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-limite-title"
            aria-describedby="modal-limite-desc"
          >
            <div className="pedir-modal-limite-header">
              <div className="pedir-modal-limite-icon" aria-hidden="true">👨‍🍳</div>
              <h3 id="modal-limite-title" className="pedir-modal-limite-title">
                ¡Estamos procesando tus pedidos!
              </h3>
            </div>

            <div className="pedir-modal-limite-body">
              <p id="modal-limite-desc" className="pedir-modal-limite-desc">
                Actualmente ya tienes <strong>2 pedidos en cola de confirmación</strong> asociados a tu número de teléfono.
              </p>

              <div className="pedir-modal-limite-info-box">
                <span className="pedir-modal-limite-info-badge">⏳ En cola hacia cocina</span>
                <p>
                  Para garantizar la máxima frescura y calidad de servicio, en cuanto nuestro equipo de cocina <strong>comience a preparar uno de tus pedidos anteriores</strong>, podrás registrar el siguiente de inmediato.
                </p>
              </div>

              <div className="pedir-modal-limite-actions">
                <button
                  type="button"
                  onClick={() => setModalLimitePedidos(false)}
                  className="btn btn-primary pedir-limite-btn-primary"
                >
                  ✅ Entendido, esperaré un momento
                </button>
                <a
                  href="https://wa.me/584122595386?text=¡Hola!%20Quisiera%20consultar%20el%20estado%20de%20mis%20pedidos%20en%20La%20Parada%20del%20Sabor"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline pedir-limite-btn-outline"
                >
                  💬 Consultar por WhatsApp (+58 412-2595386)
                </a>
              </div>
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
