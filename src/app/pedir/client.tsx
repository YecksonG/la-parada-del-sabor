"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/theme-toggle";
import { Categoria, Producto, ExtraModificador, ZonaDelivery } from "@/types/database";
import { crearPedidoWebPublico, ItemPedidoWeb } from "./actions";
import { getComboArepasCount, getProductImage } from "@/lib/combo-helper";
import ModalPersonalizarCombo from "@/components/modal-personalizar-combo";

interface MenuClienteViewProps {
  categorias: Categoria[];
  productos: Producto[];
  extras: ExtraModificador[];
  zonasDelivery?: ZonaDelivery[];
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
  zonasDelivery = [],
  tasaBcv,
}: MenuClienteViewProps) {
  const router = useRouter();
  const [catSeleccionada, setCatSeleccionada] = useState<string>("todas");
  const [busqueda, setBusqueda] = useState("");
  const [carrito, setCarrito] = useState<CarritoItemWeb[]>([]);
  const [drawerCheckout, setDrawerCheckout] = useState(false);
  const [comboModalData, setComboModalData] = useState<{ producto: Producto; totalArepas: number } | null>(null);
  const [modalFotoZoom, setModalFotoZoom] = useState<Producto | null>(null);

  // Bloquear scroll de la página de fondo cuando algún modal o drawer está abierto
  useEffect(() => {
    if (drawerCheckout || modalFotoZoom) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerCheckout, modalFotoZoom]);

  // Cerrar lightbox con tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && modalFotoZoom) {
        setModalFotoZoom(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalFotoZoom]);

  // Formulario Checkout
  const [nombreCliente, setNombreCliente] = useState("");
  const [telefonoCliente, setTelefonoCliente] = useState("");
  const [tipoEntrega, setTipoEntrega] = useState<"pickup" | "delivery">("pickup");
  const [zonaDeliveryId, setZonaDeliveryId] = useState<string>(zonasDelivery[0]?.id || "");
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

  const subtotalComidaUsd = useMemo(() => {
    return carrito.reduce((acc, item) => {
      const base = Number(item.producto.precio_usd || 0) * item.cantidad;
      const extrasTotal = item.extras.reduce(
        (eAcc, ext) => eAcc + Number(ext.precio_extra_usd || 0) * item.cantidad,
        0
      );
      return acc + base + extrasTotal;
    }, 0);
  }, [carrito]);

  const zonaDeliverySeleccionada = useMemo(() => {
    if (!zonasDelivery || zonasDelivery.length === 0) return null;
    return zonasDelivery.find((z) => z.id === zonaDeliveryId) || zonasDelivery[0];
  }, [zonasDelivery, zonaDeliveryId]);

  const costoDeliveryUsd = tipoEntrega === "delivery" ? Number(zonaDeliverySeleccionada?.precio_usd || 0) : 0;
  const totalCarritoUsd = subtotalComidaUsd + costoDeliveryUsd;
  const totalCarritoBs = Number((totalCarritoUsd * tasaBcv).toFixed(2));
  const totalItemsCount = carrito.reduce((acc, item) => acc + item.cantidad, 0);

  // Agregar al carrito directamente (Límite máximo 25 por producto)
  const handleAgregarProductoDirecto = (prod: Producto) => {
    const comboArepas = getComboArepasCount(prod);
    if (comboArepas !== null) {
      setComboModalData({ producto: prod, totalArepas: comboArepas });
      return;
    }

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

  const handleConfirmarCombo = (notasItem: string) => {
    if (!comboModalData) return;
    const prod = comboModalData.producto;
    setCarrito((prev) => [
      ...prev,
      {
        tempId: `${prod.id}-${Date.now()}-${Math.random()}`,
        producto: prod,
        cantidad: 1,
        notas_item: notasItem,
        extras: [],
      },
    ]);
    setComboModalData(null);
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
      delivery_zona_id: tipoEntrega === "delivery" ? (zonaDeliverySeleccionada?.id || zonaDeliveryId) : undefined,
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
              src="/images/logo-horizontal.png"
              alt="La Parada del Sabor"
              width={160}
              height={58}
              className="pedir-hero-logo-img logo-light-only"
              priority
              style={{ objectFit: "contain" }}
            />
            <Image
              src="/images/logo-horizontal-dark.png"
              alt="La Parada del Sabor"
              width={160}
              height={58}
              className="pedir-hero-logo-img logo-dark-only"
              style={{ objectFit: "contain" }}
            />
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
          {categorias
            .filter((c) => !c.nombre.toLowerCase().includes("empanada"))
            .map((cat) => (
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
              const cantidadEnCarrito = carrito
                .filter((item) => item.producto.id === prod.id)
                .reduce((acc, item) => acc + item.cantidad, 0);
              const isCombo = getComboArepasCount(prod) !== null;
              const imgUrl = getProductImage(prod);

              return (
                <div key={prod.id} className="pedir-product-card">
                  <div className="pedir-product-card-body">
                    <div
                      className={`pedir-product-icon-wrap ${imgUrl ? "has-image" : ""}`}
                      onClick={() => {
                        if (imgUrl) setModalFotoZoom(prod);
                      }}
                      onKeyDown={(e) => {
                        if (imgUrl && (e.key === "Enter" || e.key === " ")) {
                          e.preventDefault();
                          setModalFotoZoom(prod);
                        }
                      }}
                      role={imgUrl ? "button" : undefined}
                      tabIndex={imgUrl ? 0 : undefined}
                      aria-label={imgUrl ? `Ver foto ampliada de ${prod.nombre}` : undefined}
                      title={imgUrl ? "Toca para agrandar foto" : undefined}
                    >
                      {imgUrl ? (
                        <div className="pedir-product-image-container">
                          <Image
                            src={imgUrl}
                            alt={prod.nombre}
                            width={76}
                            height={76}
                            className="pedir-product-thumbnail-img"
                          />
                          <span className="pedir-zoom-badge" aria-hidden="true">🔍</span>
                        </div>
                      ) : (
                        <span className="pedir-product-glyph">{prod.icono || "🫓"}</span>
                      )}
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

                    {isCombo ? (
                      <button
                        type="button"
                        onClick={() => handleAgregarProductoDirecto(prod)}
                        className="pedir-btn-add"
                        style={{
                          background: "linear-gradient(135deg, #e65c00, #ff8c00)",
                          color: "#ffffff",
                          fontWeight: 800,
                          fontSize: 13,
                        }}
                      >
                        🍱 Armar Sabores {cantidadEnCarrito > 0 && `(${cantidadEnCarrito})`}
                      </button>
                    ) : cantidadEnCarrito > 0 ? (
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
          <div
            className="pedir-drawer-checkout"
            role="dialog"
            aria-modal="true"
            aria-label="Resumen y confirmación de tu pedido"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pedir-sheet-drag-handle" aria-hidden="true" />
            <div className="pedir-drawer-header">
              <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>🛒 Tu Pedido ({totalItemsCount})</h2>
              <button
                type="button"
                onClick={() => setDrawerCheckout(false)}
                className="pedir-btn-close-modal"
                aria-label="Cerrar resumen de pedido"
              >
                ✕
              </button>
            </div>

            {/* Cuerpo desplazable */}
            <div className="pedir-drawer-body-scroll">
              {/* Lista de Items en Carrito */}
              {carrito.length === 0 ? (
                <div style={{ textAlign: "center", padding: "28px 16px 20px" }}>
                  <Image
                    src="/mascota/stickers/02_triste_agotado.png"
                    alt="Carrito Vacío"
                    width={120}
                    height={120}
                    style={{ margin: "0 auto 12px", filter: "drop-shadow(0 6px 16px rgba(0,0,0,0.12))", objectFit: "contain" }}
                  />
                  <h3 style={{ fontSize: 17, fontWeight: 800, margin: "0 0 6px" }}>
                    ¡Tu carrito está vacío!
                  </h3>
                  <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", margin: 0 }}>
                    Agrega unas ricas arepas o combos para armar tu pedido.
                  </p>
                </div>
              ) : (
                <div className="pedir-cart-items-list">
                  {carrito.map((item) => {
                    const precioTotal =
                      (Number(item.producto.precio_usd || 0) +
                        item.extras.reduce((acc, e) => acc + Number(e.precio_extra_usd || 0), 0)) *
                      item.cantidad;

                    return (
                      <div key={item.tempId} className="pedir-cart-item-row">
                        <div className="pedir-cart-item-info">
                          <div className="pedir-cart-item-name-row">
                            <span className="pedir-cart-item-icon">{item.producto.icono || "🫓"}</span>
                            <span className="pedir-cart-item-name">{item.producto.nombre}</span>
                          </div>
                          {item.extras.length > 0 && (
                            <div className="pedir-cart-item-extras">
                              + {item.extras.map((e) => e.nombre).join(", ")}
                            </div>
                          )}
                          {item.notas_item && (
                            <div className="pedir-cart-item-notes">📝 {item.notas_item}</div>
                          )}
                          <div className="pedir-cart-item-price-wrap">
                            <span className="pedir-cart-item-price-usd">${precioTotal.toFixed(2)} USD</span>
                            <span className="pedir-cart-item-price-sep">•</span>
                            <span className="pedir-cart-item-price-bs">Bs. {(precioTotal * tasaBcv).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        </div>

                        {/* Controles de Cantidad en Carrito */}
                        <div className="pedir-qty-box">
                          <button
                            type="button"
                            onClick={() => handleModificarCantidad(item.tempId, -1)}
                            className="pedir-qty-btn pedir-qty-btn-minus"
                            aria-label={`Restar una unidad de ${item.producto.nombre}`}
                          >
                            −
                          </button>
                          <span className="pedir-qty-val">{item.cantidad}</span>
                          <button
                            type="button"
                            onClick={() => handleModificarCantidad(item.tempId, 1)}
                            className="pedir-qty-btn pedir-qty-btn-plus"
                            aria-label={`Sumar una unidad de ${item.producto.nombre}`}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Formulario de Datos del Cliente */}
              <form id="pedir-checkout-form-id" onSubmit={handleConfirmarPedido} className="pedir-checkout-form">
                <div className="pedir-form-group">
                  <label htmlFor="nombreClienteInput">👤 Tu Nombre y Apellido *</label>
                  <input
                    id="nombreClienteInput"
                    type="text"
                    required
                    placeholder="Ej: María Pérez"
                    value={nombreCliente}
                    onChange={(e) => setNombreCliente(e.target.value)}
                    className="pedir-form-input"
                  />
                </div>

                <div className="pedir-form-group">
                  <label htmlFor="telefonoClienteInput">📱 Teléfono / WhatsApp *</label>
                  <input
                    id="telefonoClienteInput"
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
                  <label className="pedir-form-label-destacado" id="labelModalidadEntrega">
                    Modalidad de Entrega *
                  </label>
                  <div
                    className="pedir-delivery-switch-cards"
                    role="radiogroup"
                    aria-labelledby="labelModalidadEntrega"
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={tipoEntrega === "pickup"}
                      className={`pedir-switch-card ${tipoEntrega === "pickup" ? "active" : ""}`}
                      onClick={() => setTipoEntrega("pickup")}
                    >
                      <div className="pedir-switch-card-icon">🛍️</div>
                      <div className="pedir-switch-card-body">
                        <span className="pedir-switch-card-title">Para Llevar / Retiro</span>
                        <span className="pedir-switch-card-sub">Retiras directo en local</span>
                      </div>
                      <div className="pedir-switch-card-check">
                        {tipoEntrega === "pickup" ? "✓" : ""}
                      </div>
                    </button>

                    <button
                      type="button"
                      role="radio"
                      aria-checked={tipoEntrega === "delivery"}
                      className={`pedir-switch-card ${tipoEntrega === "delivery" ? "active" : ""}`}
                      onClick={() => setTipoEntrega("delivery")}
                    >
                      <div className="pedir-switch-card-icon">🛵</div>
                      <div className="pedir-switch-card-body">
                        <span className="pedir-switch-card-title">Delivery a Domicilio</span>
                        <span className="pedir-switch-card-sub">Te lo llevamos a tu puerta</span>
                      </div>
                      <div className="pedir-switch-card-check">
                        {tipoEntrega === "delivery" ? "✓" : ""}
                      </div>
                    </button>
                  </div>
                </div>

                {tipoEntrega === "delivery" && (
                  <div className="pedir-form-group pedir-delivery-container-highlight">
                    {/* Selector de Zona de Delivery Tarifada */}
                    {zonasDelivery.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <label className="pedir-form-label-destacado" id="labelZonaDelivery" style={{ marginBottom: 8 }}>
                          📍 Selecciona tu Zona / Sector *
                        </label>
                        <div
                          className="pedir-zonas-delivery-grid"
                          role="radiogroup"
                          aria-labelledby="labelZonaDelivery"
                        >
                          {zonasDelivery.map((z) => {
                            const isSel = (zonaDeliverySeleccionada?.id === z.id);
                            return (
                              <button
                                key={z.id}
                                type="button"
                                role="radio"
                                aria-checked={isSel}
                                className={`pedir-zona-card ${isSel ? "active" : ""}`}
                                onClick={() => setZonaDeliveryId(z.id)}
                              >
                                <div className="pedir-zona-card-header">
                                  <span className="pedir-zona-card-name">{z.nombre}</span>
                                  <span className="pedir-zona-card-price">
                                    +${Number(z.precio_usd).toFixed(2)} USD
                                  </span>
                                </div>
                                {z.descripcion && (
                                  <span className="pedir-zona-card-desc">{z.descripcion}</span>
                                )}
                                <div className="pedir-zona-card-footer">
                                  {z.tiempo_estimado_min ? (
                                    <span className="pedir-zona-card-time">⏱️ ~{z.tiempo_estimado_min} min</span>
                                  ) : <span />}
                                  <span className="pedir-zona-card-status">
                                    {isSel ? "✓ Seleccionada" : "Seleccionar"}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Botón GPS Super Destacado */}
                    <button
                      type="button"
                      onClick={handleObtenerUbicacionGps}
                      disabled={cargandoGps}
                      className={`pedir-btn-gps-hero ${gpsOk ? "gps-active" : ""}`}
                      title="Detectar ubicación GPS automáticamente"
                      aria-label="Detectar ubicación GPS automáticamente"
                    >
                      <div className="pedir-btn-gps-hero-icon" aria-hidden="true">
                        {cargandoGps ? "⏳" : gpsOk ? "✅" : "📍"}
                      </div>
                      <div className="pedir-btn-gps-hero-content">
                        <span className="pedir-btn-gps-hero-title" aria-live="polite">
                          {cargandoGps
                            ? "Conectando con Satélites GPS..."
                            : gpsOk
                            ? "¡Ubicación GPS Detectada!"
                            : "Usar mi GPS Actual"}
                        </span>
                        <span className="pedir-btn-gps-hero-sub">
                          {gpsOk
                            ? "Google Maps vinculado para el repartidor ✓"
                            : "1 toque: detecta tu ubicación sin escribir"}
                        </span>
                      </div>
                      <div className="pedir-btn-gps-hero-badge" aria-hidden="true">
                        {cargandoGps ? "Buscando..." : gpsOk ? "ACTIVO" : "RECOMENDADO"}
                      </div>
                    </button>

                    <label htmlFor="direccionDeliveryInput" style={{ marginTop: 12, marginBottom: 6, display: "block" }}>
                      Dirección Exacta / Referencias de Entrega *
                    </label>
                    <textarea
                      id="direccionDeliveryInput"
                      required
                      rows={2}
                      placeholder="Calle, número de casa, edificio o punto de referencia..."
                      value={direccionDelivery}
                      onChange={(e) => setDireccionDelivery(e.target.value)}
                      className="pedir-form-input"
                    />
                    {gpsOk && (
                      <span className="pedir-gps-ok-hint">
                        ✨ ¡Listo! Tu enlace de Google Maps se adjuntará automáticamente a la comanda para el repartidor.
                      </span>
                    )}
                  </div>
                )}

                {/* Método de Pago Simplificado e Intuitivo */}
                <div className="pedir-form-group" style={{ marginBottom: 12 }}>
                  <label className="pedir-form-label-destacado" style={{ marginBottom: 8 }}>
                    💳 ¿Cómo deseas pagar? *
                  </label>
                  <select
                    value={metodoPago}
                    onChange={(e) => setMetodoPago(e.target.value)}
                    className="pedir-form-input"
                    style={{ fontSize: 14, fontWeight: 700, padding: "12px 14px" }}
                  >
                    <option value="pago_movil">📱 Pago Móvil (Bolívares)</option>
                    <option value="transferencia">🏦 Transferencia Bancaria BFC (Bolívares)</option>
                    <option value="binance">🟡 Binance Pay (USDT)</option>
                    <option value="zelle">🟣 Zelle (Dólares)</option>
                    <option value="efectivo_usd">💵 Efectivo Dólares (al recibir o retirar)</option>
                    <option value="efectivo_bs">🇻🇪 Efectivo Bolívares (al recibir o retirar)</option>
                  </select>

                  {/* Mensaje de tranquilidad y flujo claro super llamativo */}
                  <div
                    style={{
                      marginTop: 12,
                      padding: "14px 16px",
                      borderRadius: 16,
                      background: "linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(234, 88, 12, 0.08) 100%)",
                      border: "1.5px solid rgba(245, 158, 11, 0.4)",
                      boxShadow: "0 4px 16px rgba(245, 158, 11, 0.1)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 16 }}>🧾</span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 900,
                          color: "var(--primary-dark)",
                          letterSpacing: 0.5,
                          textTransform: "uppercase",
                        }}
                      >
                        ¿Cómo es el proceso de pago?
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 12.5, color: "var(--text)", lineHeight: 1.45, fontWeight: 700 }}>
                      Al presionar el botón abajo, se generará tu <strong>Factura Digital Oficial</strong> con el monto exacto y los datos para pagar y adjuntar tu captura por WhatsApp.
                    </p>
                  </div>
                </div>

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
                {tipoEntrega === "delivery" && costoDeliveryUsd > 0 && (
                  <>
                    <div className="pedir-checkout-line">
                      <span>Subtotal Comida:</span>
                      <span>${subtotalComidaUsd.toFixed(2)} USD</span>
                    </div>
                    <div className="pedir-checkout-line" style={{ color: "var(--primary)" }}>
                      <span>🛵 Tarifa Delivery:</span>
                      <strong>+${costoDeliveryUsd.toFixed(2)} USD</strong>
                    </div>
                  </>
                )}
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

              {errorMsg && (
                <div className="pedir-error-alert" role="alert" style={{ marginBottom: 10 }}>
                  ⚠️ {errorMsg}
                </div>
              )}

              <button
                type="submit"
                form="pedir-checkout-form-id"
                disabled={enviando || carrito.length === 0}
                className="pedir-btn-submit-order"
              >
                {enviando ? "Generando Factura Oficial..." : "🧾 Confirmar y Ver Factura para Pagar"}
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
              <Image
                src="/mascota/stickers/06_pensativa_duda.png"
                alt="Pensativa"
                width={64}
                height={64}
                style={{ filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.15))", objectFit: "contain" }}
              />
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
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 448 512"
          width="24"
          height="24"
          fill="#ffffff"
          aria-hidden="true"
        >
          <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" />
        </svg>
      </a>

      {/* Modal Interactivo de Personalización de Combos */}
      {comboModalData && (
        <ModalPersonalizarCombo
          producto={comboModalData.producto}
          totalArepas={comboModalData.totalArepas}
          onConfirmar={handleConfirmarCombo}
          onCerrar={() => setComboModalData(null)}
        />
      )}

      {/* Modal Lightbox Zoom de Imagen de Producto */}
      {modalFotoZoom && (
        <div className="modal-overlay" onClick={() => setModalFotoZoom(null)}>
          <div
            className="pedir-modal-zoom-card"
            role="dialog"
            aria-modal="true"
            aria-label={`Foto de ${modalFotoZoom.nombre}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="pedir-modal-zoom-close"
              onClick={() => setModalFotoZoom(null)}
              aria-label="Cerrar imagen"
            >
              ✕
            </button>

            {getProductImage(modalFotoZoom) && (
              <div className="pedir-modal-zoom-img-wrap">
                <Image
                  src={getProductImage(modalFotoZoom)!}
                  alt={modalFotoZoom.nombre}
                  width={600}
                  height={600}
                  className="pedir-modal-zoom-img"
                  priority
                />
              </div>
            )}

            <div className="pedir-modal-zoom-info">
              <div className="pedir-modal-zoom-header">
                <div>
                  <h3 className="pedir-modal-zoom-title">{modalFotoZoom.nombre}</h3>
                  {modalFotoZoom.popular && <span className="pedir-badge-popular">🔥 Más Pedida</span>}
                </div>
                <div className="pedir-modal-zoom-prices">
                  <span className="pedir-price-usd">${Number(modalFotoZoom.precio_usd || 0).toFixed(2)} USD</span>
                  <span className="pedir-price-bs">Bs. {(Number(modalFotoZoom.precio_usd || 0) * tasaBcv).toFixed(2)}</span>
                </div>
              </div>

              {modalFotoZoom.descripcion && (
                <p className="pedir-modal-zoom-desc">{modalFotoZoom.descripcion}</p>
              )}

              <div className="pedir-modal-zoom-actions">
                {getComboArepasCount(modalFotoZoom) !== null ? (
                  <button
                    type="button"
                    onClick={() => {
                      setModalFotoZoom(null);
                      handleAgregarProductoDirecto(modalFotoZoom);
                    }}
                    className="pedir-btn-confirm-order"
                  >
                    🍱 Personalizar Sabores del Combo
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      handleAgregarProductoDirecto(modalFotoZoom);
                      setModalFotoZoom(null);
                    }}
                    className="pedir-btn-confirm-order"
                  >
                    + Agregar a mi Pedido
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
