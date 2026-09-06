"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { Producto, Categoria, ExtraModificador, Cliente, PedidoPendiente, ZonaDelivery } from "@/types/database";
import {
  registrarVentaPos,
  aceptarPedidoWeb,
  rechazarPedidoWeb,
  crearClienteRapido,
  CartItem,
  CartItemExtra,
} from "./pos-actions";
import { sounds } from "@/lib/sound-effects";
import { getComboArepasCount, getProductImage } from "@/lib/combo-helper";
import ModalPersonalizarCombo from "@/components/modal-personalizar-combo";
import ModalSeleccionarZonaDelivery from "@/components/modal-seleccionar-zona-delivery";

type MetodoVuelto = "pago_movil" | "efectivo_bs" | "efectivo_usd";

type VueltoInfo = {
  recibido: number;
  monedaRecibida: "USD" | "Bs";
  vueltoUsd: number;
  vueltoBs: number;
  metodoVuelto: string;
};

interface PosClientProps {
  categorias: Categoria[];
  productos: Producto[];
  extras: ExtraModificador[];
  tasaBcv: number;
  pedidosPendientes?: PedidoPendiente[];
  clientesIniciales?: Cliente[];
  zonasDelivery?: ZonaDelivery[];
}

const METODOS_PAGO_LABEL: Record<string, string> = {
  efectivo_usd: "💵 Efectivo (USD)",
  efectivo_bs: "🇻🇪 Efectivo (Bs)",
  pago_movil: "📱 Pago Móvil (Bs)",
  pago_movil_bs: "📱 Pago Móvil (Bs)",
  transferencia: "🏦 Transferencia Bancaria (Bs)",
  punto: "💳 Punto de Venta / Tarjeta (Bs)",
  punto_bs: "💳 Punto de Venta / Tarjeta (Bs)",
  binance: "🟡 Binance Pay (USDT)",
  binance_usdt: "🟡 Binance Pay (USDT)",
  zelle: "🟣 Zelle (USD)",
  pesos_cop: "🇨🇴 Pesos Colombianos (COP)",
};

export default function PosClient({
  categorias,
  productos,
  extras,
  tasaBcv,
  pedidosPendientes = [],
  clientesIniciales = [],
  zonasDelivery = [],
}: PosClientProps) {
  const [modoVista, setModoVista] = useState<"grid" | "filas">("grid");
  const [modalPedidosWeb, setModalPedidosWeb] = useState(false);
  const [procesandoWebId, setProcesandoWebId] = useState<string | null>(null);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [carrito, setCarrito] = useState<CartItem[]>([]);
  const [comboModalData, setComboModalData] = useState<{ producto: Producto; totalArepas: number } | null>(null);

  // Gestión de Clientes en POS
  const [listaClientes, setListaClientes] = useState<Cliente[]>(clientesIniciales);
  const [clienteSeleccionadoId, setClienteSeleccionadoId] = useState<string | null>(null);
  const [modalSeleccionarCliente, setModalSeleccionarCliente] = useState(false);
  const [busquedaClienteModal, setBusquedaClienteModal] = useState("");
  const [modalNuevoCliente, setModalNuevoCliente] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoTelefono, setNuevoTelefono] = useState("");
  const [nuevaDireccion, setNuevaDireccion] = useState("");
  const [guardandoCliente, setGuardandoCliente] = useState(false);

  // Gestión de Delivery en POS
  const [zonaDeliveryId, setZonaDeliveryId] = useState<string | null>(() => {
    return zonasDelivery.length > 0 ? zonasDelivery[0].id : null;
  });
  const [modalZonaDeliveryPos, setModalZonaDeliveryPos] = useState(false);
  const [direccionDeliveryPos, setDireccionDeliveryPos] = useState("");

  // Cliente actualmente seleccionado
  const clienteActual = useMemo(() => {
    return listaClientes.find((c) => c.id === clienteSeleccionadoId) || null;
  }, [listaClientes, clienteSeleccionadoId]);

  // Clientes filtrados dentro del modal flotante de selección
  const clientesFiltradosModal = useMemo(() => {
    if (!busquedaClienteModal.trim()) return listaClientes;
    const q = busquedaClienteModal.toLowerCase().trim();
    return listaClientes.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        c.telefono?.includes(q) ||
        c.direccion_delivery?.toLowerCase().includes(q)
    );
  }, [listaClientes, busquedaClienteModal]);

  // Sincronizar clientes cuando cambian las props
  useEffect(() => {
    if (clientesIniciales.length > 0) {
      setListaClientes(clientesIniciales);
    }
  }, [clientesIniciales]);

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
  const [darVuelto, setDarVuelto] = useState<boolean>(false);
  const [billeteRecibidoUsd, setBilleteRecibidoUsd] = useState<number | "">("");
  const [billeteRecibidoBs, setBilleteRecibidoBs] = useState<number | "">("");
  const [metodoVuelto, setMetodoVuelto] = useState<"pago_movil" | "efectivo_bs" | "efectivo_usd">("pago_movil");
  const [notasComanda, setNotasComanda] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [comandaExitosa, setComandaExitosa] = useState<{
    numero: number;
    totalUsd: number;
    totalBs: number;
    metodoPago: string;
    ventaId?: string;
    clienteNombre?: string;
    clienteTelefono?: string | null;
    vueltoInfo?: VueltoInfo | null;
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

  // Agregar producto al carrito con sonido pop (Límite máximo 50 por item)
  const agregarAlCarrito = (producto: Producto) => {
    const comboArepas = getComboArepasCount(producto);
    if (comboArepas !== null) {
      setComboModalData({ producto, totalArepas: comboArepas });
      return;
    }

    sounds.playPop();
    setCarrito((prev) => {
      const index = prev.findIndex((item) => item.producto_id === producto.id && (!item.extras || item.extras.length === 0));
      if (index >= 0) {
        const nuevo = [...prev];
        nuevo[index] = { ...nuevo[index], cantidad: Math.min(50, nuevo[index].cantidad + 1) };
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

  const handleConfirmarComboPos = ({ notasItem, extrasIds }: import("@/components/modal-personalizar-combo").ComboConfirmResult) => {
    if (!comboModalData) return;
    const producto = comboModalData.producto;
    // Convertir UUIDs de extras a CartItemExtra (forma requerida por pos-actions)
    const extrasSeleccionados: CartItemExtra[] = extrasIds
      .map((eid) => extras.find((e) => e.id === eid))
      .filter((e): e is ExtraModificador => !!e)
      .map((e) => ({
        extra_id: e.id,
        nombre: e.nombre,
        precio_unitario_usd: Number(e.precio_extra_usd || 0),
        cantidad: 1,
      }));
    setCarrito((prev) => [
      ...prev,
      {
        producto_id: producto.id,
        nombre: producto.nombre,
        precio_unitario_usd: Number(producto.precio_usd),
        cantidad: 1,
        notas_item: notasItem,
        extras: extrasSeleccionados,
      },
    ]);
    setComboModalData(null);
  };

  const modificarCantidad = (index: number, delta: number) => {
    if (delta > 0) sounds.playPop();
    else sounds.playDelete();

    setCarrito((prev) => {
      const nuevo = [...prev];
      const cant = Math.min(50, nuevo[index].cantidad + delta);
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

  // Sincronizar dirección de delivery si el cliente seleccionado ya tiene una guardada
  useEffect(() => {
    if (clienteActual?.direccion_delivery) {
      setDireccionDeliveryPos(clienteActual.direccion_delivery);
    }
  }, [clienteActual]);

  // Cálculos de Totales y Delivery en POS
  const zonaDeliveryActual = useMemo(() => {
    if (tipoEntrega !== "delivery" || !zonaDeliveryId) return null;
    return zonasDelivery.find((z) => z.id === zonaDeliveryId) || null;
  }, [tipoEntrega, zonaDeliveryId, zonasDelivery]);

  const tarifaDeliveryUsd = zonaDeliveryActual ? Number(zonaDeliveryActual.precio_usd || 0) : 0;

  const subtotalItemsUsd = useMemo(() => {
    return carrito.reduce((acc, item) => {
      const subtotalItem = item.precio_unitario_usd * item.cantidad;
      const subtotalExtras = (item.extras || []).reduce(
        (eAcc, ext) => eAcc + ext.precio_unitario_usd * ext.cantidad,
        0
      );
      return acc + subtotalItem + subtotalExtras;
    }, 0);
  }, [carrito]);

  const totalUsd = subtotalItemsUsd + (tipoEntrega === "delivery" ? tarifaDeliveryUsd : 0);
  const totalBs = Number((totalUsd * tasaBcv).toFixed(2));

  // Bloquear envío si el cajero declaró vuelto pero el billete declarado es insuficiente
  const vueltoInsuficiente =
    !darVuelto
      ? false
      : metodoPago === "efectivo_usd"
      ? Number(billeteRecibidoUsd) > 0 && Number(billeteRecibidoUsd) < totalUsd
      : metodoPago === "efectivo_bs"
      ? Number(billeteRecibidoBs) > 0 && Number(billeteRecibidoBs) < totalBs
      : false;

  // Guardar Cliente Rápido desde el POS
  const handleGuardarClienteRapido = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoNombre.trim() || guardandoCliente) return;

    setGuardandoCliente(true);
    const res = await crearClienteRapido({
      nombre: nuevoNombre.trim(),
      telefono: nuevoTelefono.trim(),
      direccion_delivery: nuevaDireccion.trim(),
    });
    setGuardandoCliente(false);

    if (res.ok && res.cliente) {
      sounds.playPop();
      setListaClientes((prev) => [res.cliente, ...prev]);
      setClienteSeleccionadoId(res.cliente.id);
      setModalNuevoCliente(false);
      setNuevoNombre("");
      setNuevoTelefono("");
      setNuevaDireccion("");
    } else {
      alert(res.error || "No se pudo registrar el cliente.");
    }
  };

  const handleEnviarWhatsAppDeliveryPOS = (p: PedidoPendiente) => {
    const direccion = p.cliente?.direccion_delivery || "";
    const matchMapas = direccion.match(/https:\/\/maps\.google\.com\/\?q=[^\s]+/);
    const mapsLink = matchMapas ? matchMapas[0] : "";
    const direccionLimpia = direccion
      .replace(/📍 Ubicación GPS: https:\/\/maps\.google\.com\/\?q=[^\s]+/, "")
      .trim() || "Sin detalles adicionales";

    const itemsTexto = (p.items || [])
      .map((it: any) => `  • ${it.cantidad}x ${it.producto?.nombre || "Producto"}${it.notas_item ? ` (${it.notas_item})` : ""}`)
      .join("\n");

    const metodoPagoVal = p.metodo_pago;
    const esPagado =
      p.estado === "completada" ||
      ["pago_movil", "pago_movil_bs", "binance", "binance_usdt", "zelle", "transferencia", "punto", "punto_bs"].includes(
        metodoPagoVal || ""
      );
    const estadoPago = esPagado
      ? "✅ YA PAGADO (No cobrar)"
      : `💵 COBRAR AL CLIENTE: $${Number(p.total_usd).toFixed(2)} USD / Bs. ${Number(p.total_bs).toFixed(2)}`;

    const mensaje = `🛵 *ENTREGA DE COMIDA — LA PARADA DEL SABOR*
🧾 *Pedido:* #${p.numero_comanda || p.id.slice(0, 6)}
👤 *Cliente:* ${p.cliente?.nombre || "Cliente"}
📱 *Teléfono:* ${p.cliente?.telefono || "No especificado"}
📍 *Modalidad:* Delivery a Domicilio

🏠 *Dirección / Referencia:*
${direccionLimpia}

🗺️ *Ubicación GPS (Google Maps):*
${mapsLink || "No adjuntó enlace satelital"}

📋 *Contenido:*
${itemsTexto}

💰 *Estado de Pago:*
${estadoPago}`;

    const url = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    window.open(url, "_blank");
  };

  // Enviar Comanda a Cocina
  const handleEnviarComanda = async () => {
    if (carrito.length === 0 || procesando) return;

    if (tasaBcv <= 0) {
      alert("No hay tasa de cambio configurada para hoy. Sincroniza la tasa en la sección de Tasas antes de enviar comandas.");
      return;
    }

    // Si se especificó vuelto, registrarlo de forma legible en las notas de la comanda
    let notasFinales = notasComanda.trim();
    let vueltoResumen: VueltoInfo | null = null;

    if (darVuelto) {
      if (metodoPago === "efectivo_usd" && Number(billeteRecibidoUsd) > 0) {
        const recibido = Number(billeteRecibidoUsd);
        const vueltoUsd = Number((recibido - totalUsd).toFixed(2));
        const vueltoBs = Number((vueltoUsd * tasaBcv).toFixed(2));
        const metodoTexto = metodoVuelto === "pago_movil" ? "Pago Móvil" : metodoVuelto === "efectivo_bs" ? "Efectivo Bs" : "Efectivo USD";
        // Bloquear vuelto negativo: el billete declarado no cubre el total
        if (vueltoUsd < 0) {
          alert(`El billete recibido ($${recibido.toFixed(2)}) no alcanza el total a pagar ($${totalUsd.toFixed(2)}). Faltan $${Math.abs(vueltoUsd).toFixed(2)} USD. Verifica el monto antes de enviar la comanda.`);
          return;
        }
        const tagVuelto = `[Vuelto: Paga con $${recibido.toFixed(2)} | Vuelto: $${vueltoUsd.toFixed(2)} (~Bs. ${vueltoBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) vía ${metodoTexto}]`;
        notasFinales = notasFinales ? `${notasFinales} • ${tagVuelto}` : tagVuelto;
        vueltoResumen = {
          recibido,
          monedaRecibida: "USD",
          vueltoUsd,
          vueltoBs,
          metodoVuelto: metodoTexto,
        };
      } else if (metodoPago === "efectivo_bs" && Number(billeteRecibidoBs) > 0) {
        const recibidoBs = Number(billeteRecibidoBs);
        const vueltoBs = Number((recibidoBs - totalBs).toFixed(2));
        const vueltoUsd = tasaBcv > 0 ? Number((vueltoBs / tasaBcv).toFixed(2)) : 0;
        if (vueltoBs < 0) {
          alert(`El efectivo recibido (Bs. ${recibidoBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) no alcanza el total a pagar (Bs. ${totalBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}). Faltan Bs. ${Math.abs(vueltoBs).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Verifica el monto antes de enviar la comanda.`);
          return;
        }
        const tagVuelto = `[Vuelto: Paga con Bs. ${recibidoBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Vuelto: Bs. ${vueltoBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (~$${vueltoUsd.toFixed(2)})]`;
        notasFinales = notasFinales ? `${notasFinales} • ${tagVuelto}` : tagVuelto;
        vueltoResumen = {
          recibido: recibidoBs,
          monedaRecibida: "Bs",
          vueltoUsd,
          vueltoBs,
          metodoVuelto: "Efectivo Bs",
        };
      }
    }

    setProcesando(true);
    const res = await registrarVentaPos({
      cliente_id: clienteSeleccionadoId,
      metodo_pago: metodoPago,
      tipo_entrega: tipoEntrega,
      delivery_zona_id: tipoEntrega === "delivery" ? (zonaDeliveryActual?.id || null) : null,
      delivery_zona_nombre: tipoEntrega === "delivery" ? (zonaDeliveryActual?.nombre || null) : null,
      delivery_tarifa_usd: tipoEntrega === "delivery" ? tarifaDeliveryUsd : 0,
      direccion_delivery: tipoEntrega === "delivery" ? direccionDeliveryPos.trim() : null,
      tasa_bcv: tasaBcv,
      notas_comanda: notasFinales,
      items: carrito,
    });

    setProcesando(false);

    if (res.ok && res.numero_comanda) {
      sounds.playKitchenBell();
      setTimeout(() => sounds.playCashRegister(), 300);
      const clienteObj = listaClientes.find((c) => c.id === clienteSeleccionadoId);
      setComandaExitosa({
        numero: res.numero_comanda,
        totalUsd,
        totalBs,
        metodoPago,
        ventaId: res.venta_id,
        clienteNombre: clienteObj?.nombre,
        clienteTelefono: clienteObj?.telefono,
        vueltoInfo: vueltoResumen,
      });
      setCarrito([]);
      setNotasComanda("");
      setDarVuelto(false);
      setBilleteRecibidoUsd("");
      setBilleteRecibidoBs("");
      setClienteSeleccionadoId(null);
      setDireccionDeliveryPos("");
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
                  {(() => {
                    const imgUrl = getProductImage(prod);
                    return imgUrl ? (
                      <div style={{ position: "relative", width: "48px", height: "48px", borderRadius: "10px", overflow: "hidden", flexShrink: 0, boxShadow: "0 2px 6px rgba(0,0,0,0.1)" }}>
                        <Image src={imgUrl} alt={prod.nombre} fill sizes="48px" style={{ objectFit: "cover" }} />
                      </div>
                    ) : (
                      <span className="product-emoji">{prod.icono || "🫓"}</span>
                    );
                  })()}
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
                  {(() => {
                    const imgUrl = getProductImage(prod);
                    return imgUrl ? (
                      <div style={{ position: "relative", width: "36px", height: "36px", borderRadius: "8px", overflow: "hidden", flexShrink: 0, boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
                        <Image src={imgUrl} alt={prod.nombre} fill sizes="36px" style={{ objectFit: "cover" }} />
                      </div>
                    ) : (
                      <span className="product-emoji" style={{ fontSize: 28 }}>{prod.icono || "🫓"}</span>
                    );
                  })()}
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

          {/* Selector de Cliente en POS */}
          <div style={{ background: "var(--surface)", borderRadius: 12, padding: "10px 12px", marginBottom: 12, border: "1px solid var(--border)", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                👤 Cliente Asignado:
              </span>
              <button
                type="button"
                onClick={() => setModalNuevoCliente(true)}
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: "var(--primary)",
                  background: "rgba(249, 115, 22, 0.1)",
                  border: "1px solid rgba(249, 115, 22, 0.2)",
                  cursor: "pointer",
                  padding: "2px 8px",
                  borderRadius: 6,
                }}
              >
                ➕ Nuevo
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                sounds.playPop();
                setBusquedaClienteModal("");
                setModalSeleccionarCliente(true);
              }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 10px",
                background: clienteActual ? "rgba(249, 115, 22, 0.08)" : "var(--bg-subtle)",
                border: clienteActual ? "1px solid var(--primary)" : "1px solid var(--border)",
                borderRadius: 8,
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.2s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
                <span style={{ fontSize: 18 }}>{clienteActual ? "👑" : "👤"}</span>
                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <strong style={{ fontSize: 13, color: "var(--text)", display: "block" }}>
                    {clienteActual ? clienteActual.nombre : "Mostrador / Casual"}
                  </strong>
                  {clienteActual?.telefono ? (
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      📞 {clienteActual.telefono}
                    </span>
                  ) : (
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                      {clienteActual ? "Sin teléfono registrado" : "Cliente sin registrar"}
                    </span>
                  )}
                </div>
              </div>
              <span style={{ fontSize: 11, color: "var(--primary)", fontWeight: 700, flexShrink: 0 }}>
                {clienteActual ? "Cambiar ⇄" : "Buscar 🔍"}
              </span>
            </button>
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

          {/* Configuración de Zona y Dirección de Delivery en POS */}
          {tipoEntrega === "delivery" && (
            <div
              style={{
                marginTop: 10,
                padding: "10px 12px",
                background: "linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(234, 88, 12, 0.06))",
                border: "1.5px dashed var(--primary)",
                borderRadius: 14,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  <span style={{ fontSize: 16 }}>📍</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {zonaDeliveryActual ? zonaDeliveryActual.nombre : "Seleccionar Zona de Delivery"}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--primary-dark)" }}>
                      {tarifaDeliveryUsd > 0
                        ? `+${tarifaDeliveryUsd.toFixed(2)} USD (Bs. ${(tarifaDeliveryUsd * tasaBcv).toFixed(2)})`
                        : "Sin zona seleccionada"}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModalZonaDeliveryPos(true)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 8,
                    background: "var(--primary)",
                    color: "#ffffff",
                    border: "none",
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  {zonaDeliveryActual ? "Cambiar ⇄" : "Elegir 📍"}
                </button>
              </div>

              <input
                type="text"
                placeholder="🛵 Dirección / Referencia o Link de Google Maps..."
                value={direccionDeliveryPos}
                onChange={(e) => setDireccionDeliveryPos(e.target.value)}
                className="cart-notes-input"
                style={{ fontSize: 12, padding: "8px 10px", borderRadius: 8, background: "var(--bg-card)" }}
              />
            </div>
          )}
        </div>

        {/* Lista de Items en la Comanda */}
        <div className="cart-items-scroll">
          {carrito.length === 0 ? (
            <div className="cart-empty-state" style={{ textAlign: "center", padding: "24px 12px" }}>
              <Image
                src="/mascota/stickers/05_dormida_cerrado.png"
                alt="Comanda en Espera"
                width={80}
                height={80}
                style={{ margin: "0 auto 8px", filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.1))", objectFit: "contain" }}
              />
              <p style={{ fontWeight: 800, margin: "0 0 4px" }}>Comanda en Espera</p>
              <small style={{ color: "var(--text-muted)" }}>Selecciona productos o combos para armar la orden</small>
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
                      {item.notas_item && (
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--primary-dark)", background: "var(--primary-light)", padding: "2px 6px", borderRadius: 4, marginTop: 3 }}>
                          🍱 {item.notas_item}
                        </div>
                      )}
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
              onChange={(e) => {
                setMetodoPago(e.target.value);
                if (e.target.value !== "efectivo_usd" && e.target.value !== "efectivo_bs") {
                  setDarVuelto(false);
                }
              }}
              className="payment-select"
            >
              <option value="pago_movil">📱 Pago Móvil (Bs)</option>
              <option value="efectivo_usd">💵 Efectivo (USD)</option>
              <option value="efectivo_bs">🇻🇪 Efectivo (Bs)</option>
              <option value="punto">💳 Tarjeta / Punto de Venta (Bs)</option>
              <option value="transferencia">🏦 Transferencia Bancaria (Bs)</option>
              <option value="binance">🟡 Binance Pay (USDT)</option>
              <option value="zelle">🟣 Zelle (USD)</option>
              <option value="pesos_cop">🇨🇴 Pesos Colombianos (COP)</option>
            </select>
          </div>

          {/* Calculadora de Vuelto / Cambio Rápido para Efectivo */}
          {(metodoPago === "efectivo_usd" || metodoPago === "efectivo_bs") && (
            <div
              style={{
                background: darVuelto ? "rgba(245, 158, 11, 0.08)" : "var(--bg-subtle)",
                border: darVuelto ? "1.5px solid #f59e0b" : "1px solid var(--border)",
                borderRadius: 12,
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                transition: "all 0.2s ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                }}
                onClick={() => {
                  sounds.playPop();
                  setDarVuelto(!darVuelto);
                }}
              >
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: darVuelto ? "#d97706" : "var(--text)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    cursor: "pointer",
                  }}
                >
                  <span>🪙</span> ¿Requiere vuelto / cambio?
                </label>
                <input
                  type="checkbox"
                  checked={darVuelto}
                  onChange={(e) => setDarVuelto(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: "pointer", accentColor: "var(--primary)" }}
                />
              </div>

              {darVuelto && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 4 }}>
                  {metodoPago === "efectivo_usd" ? (
                    <>
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                          ¿Con qué billete paga el cliente? (USD):
                        </span>
                        {/* Botones de denominación rápida */}
                        <div style={{ display: "flex", gap: 5, marginBottom: 6, flexWrap: "wrap" }}>
                          {[5, 10, 20, 50, 100].map((billete) => (
                            <button
                              key={billete}
                              type="button"
                              onClick={() => {
                                sounds.playPop();
                                setBilleteRecibidoUsd(billete);
                              }}
                              style={{
                                flex: 1,
                                minWidth: 42,
                                padding: "5px 0",
                                borderRadius: 8,
                                border: billeteRecibidoUsd === billete ? "1.5px solid var(--primary)" : "1px solid var(--border)",
                                background: billeteRecibidoUsd === billete ? "var(--primary-light)" : "var(--bg-card)",
                                color: billeteRecibidoUsd === billete ? "var(--primary-dark)" : "var(--text)",
                                fontSize: 12,
                                fontWeight: 800,
                                cursor: "pointer",
                              }}
                            >
                              ${billete}
                            </button>
                          ))}
                        </div>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="Otro monto recibido ($)..."
                          value={billeteRecibidoUsd}
                          onChange={(e) => setBilleteRecibidoUsd(parseFloat(e.target.value) || "")}
                          className="cart-notes-input"
                          style={{ fontSize: 13, fontWeight: 800 }}
                        />
                      </div>

                      {/* Modalidad de Entrega del Vuelto */}
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                          ¿Cómo se le entrega el vuelto?:
                        </span>
                        <select
                          value={metodoVuelto}
                          onChange={(e) => setMetodoVuelto(e.target.value as MetodoVuelto)}
                          className="payment-select"
                          style={{ fontSize: 12, fontWeight: 700 }}
                        >
                          <option value="pago_movil">📱 Pago Móvil (Bs)</option>
                          <option value="efectivo_bs">🇻🇪 Efectivo (Bs)</option>
                          <option value="efectivo_usd">💵 Efectivo (USD)</option>
                        </select>
                      </div>

                      {/* Cálculo en vivo de Vuelto */}
                      {Number(billeteRecibidoUsd) > 0 && (() => {
                        const recibido = Number(billeteRecibidoUsd);
                        const vueltoUsd = Number((recibido - totalUsd).toFixed(2));
                        const vueltoBs = Number((vueltoUsd * tasaBcv).toFixed(2));

                        if (vueltoUsd < 0) {
                          return (
                            <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid #ef4444", borderRadius: 8, padding: "6px 10px", fontSize: 11.5, color: "#dc2626", fontWeight: 700 }}>
                              ⚠️ El billete (${recibido.toFixed(2)}) es menor al total a pagar (${totalUsd.toFixed(2)}). Faltan ${Math.abs(vueltoUsd).toFixed(2)} USD.
                            </div>
                          );
                        }

                        return (
                          <div
                            style={{
                              background: "rgba(34, 197, 94, 0.1)",
                              border: "1.5px solid rgba(34, 197, 94, 0.4)",
                              borderRadius: 10,
                              padding: "8px 10px",
                              display: "flex",
                              flexDirection: "column",
                              gap: 2,
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>
                              <span>Paga con: ${recibido.toFixed(2)} USD</span>
                              <span>Total: ${totalUsd.toFixed(2)} USD</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                              <strong style={{ fontSize: 12, color: "#16a34a" }}>
                                Vuelto a entregar ({metodoVuelto === "pago_movil" ? "📱 Pago Móvil" : metodoVuelto === "efectivo_bs" ? "🇻🇪 Efectivo Bs" : "💵 Efectivo USD"}):
                              </strong>
                              <strong style={{ fontSize: 16, color: "#16a34a", fontWeight: 900 }}>
                                {metodoVuelto === "efectivo_usd"
                                  ? `$${vueltoUsd.toFixed(2)} USD`
                                  : `Bs. ${vueltoBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                              </strong>
                            </div>
                            {metodoVuelto !== "efectivo_usd" && (
                              <span style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "right" }}>
                                Equivale a: <strong>${vueltoUsd.toFixed(2)} USD</strong> (Tasa: {tasaBcv.toFixed(2)})
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </>
                  ) : (
                    /* EFECTIVO BOLÍVARES */
                    <>
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                          Monto recibido en Efectivo (Bs):
                        </span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder={`Ej: ${Math.ceil(totalBs / 50) * 50 || 500}`}
                          value={billeteRecibidoBs}
                          onChange={(e) => setBilleteRecibidoBs(parseFloat(e.target.value) || "")}
                          className="cart-notes-input"
                          style={{ fontSize: 13, fontWeight: 800 }}
                        />
                      </div>

                      {Number(billeteRecibidoBs) > 0 && (() => {
                        const recibidoBs = Number(billeteRecibidoBs);
                        const vueltoBs = Number((recibidoBs - totalBs).toFixed(2));
                        const vueltoUsd = tasaBcv > 0 ? Number((vueltoBs / tasaBcv).toFixed(2)) : 0;

                        if (vueltoBs < 0) {
                          return (
                            <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid #ef4444", borderRadius: 8, padding: "6px 10px", fontSize: 11.5, color: "#dc2626", fontWeight: 700 }}>
                              ⚠️ El efectivo recibido es menor al total a pagar. Faltan Bs. {Math.abs(vueltoBs).toFixed(2)}.
                            </div>
                          );
                        }

                        return (
                          <div
                            style={{
                              background: "rgba(34, 197, 94, 0.1)",
                              border: "1.5px solid rgba(34, 197, 94, 0.4)",
                              borderRadius: 10,
                              padding: "8px 10px",
                              display: "flex",
                              flexDirection: "column",
                              gap: 2,
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                              <strong style={{ fontSize: 12, color: "#16a34a" }}>
                                Vuelto a entregar:
                              </strong>
                              <strong style={{ fontSize: 16, color: "#16a34a", fontWeight: 900 }}>
                                Bs. {vueltoBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </strong>
                            </div>
                            <span style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "right" }}>
                              Equivale a: <strong>${vueltoUsd.toFixed(2)} USD</strong> (Tasa: {tasaBcv.toFixed(2)})
                            </span>
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

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
            {tipoEntrega === "delivery" && tarifaDeliveryUsd > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)", marginBottom: 4, fontWeight: 700 }}>
                <span>Subtotal Comida:</span>
                <span>${subtotalItemsUsd.toFixed(2)} USD</span>
              </div>
            )}
            {tipoEntrega === "delivery" && tarifaDeliveryUsd > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--primary-dark)", marginBottom: 6, fontWeight: 800 }}>
                <span>🛵 Tarifa Delivery:</span>
                <span>+${tarifaDeliveryUsd.toFixed(2)} USD</span>
              </div>
            )}
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
            disabled={carrito.length === 0 || procesando || vueltoInsuficiente}
            onClick={handleEnviarComanda}
            className="btn-submit-comanda"
          >
            {procesando ? "Enviando a Cocina..." : vueltoInsuficiente ? "⚠️ El billete no alcanza el total" : "🍳 Enviar Comanda a Cocina"}
          </button>
        </div>
      </aside>

      {/* Modal de Comanda Exitosa con botón de impresión */}
      {comandaExitosa && (
        <div className="modal-overlay">
          <div className="modal-ticket-card">
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
              <Image
                src="/mascota/stickers/01_celebracion_exito.png"
                alt="Comanda Exitosa"
                width={80}
                height={80}
                style={{ filter: "drop-shadow(0 6px 16px rgba(0,0,0,0.12))", objectFit: "contain" }}
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
                <span>Método de Cobro:</span>
                <strong style={{ color: "var(--primary)", fontWeight: 800 }}>
                  {METODOS_PAGO_LABEL[comandaExitosa.metodoPago] || comandaExitosa.metodoPago}
                </strong>
              </div>
              <div className="ticket-row">
                <span>Total Cobrado:</span>
                <strong>${comandaExitosa.totalUsd.toFixed(2)} USD</strong>
              </div>
              <div className="ticket-row">
                <span>En Bolívares:</span>
                <span>{comandaExitosa.totalBs.toFixed(2)} Bs</span>
              </div>
              {comandaExitosa.vueltoInfo && (
                <>
                  <div className="ticket-row" style={{ color: "var(--text-muted)", fontSize: 12 }}>
                    <span>Pagó con ({comandaExitosa.vueltoInfo.monedaRecibida}):</span>
                    <strong>
                      {comandaExitosa.vueltoInfo.monedaRecibida === "USD"
                        ? `$${comandaExitosa.vueltoInfo.recibido.toFixed(2)} USD`
                        : `Bs. ${comandaExitosa.vueltoInfo.recibido.toLocaleString("es-VE", { minimumFractionDigits: 2 })}`}
                    </strong>
                  </div>
                  <div className="ticket-row" style={{ background: "rgba(34, 197, 94, 0.1)", padding: "6px 8px", borderRadius: 8, marginTop: 2 }}>
                    <span style={{ color: "#16a34a", fontWeight: 800 }}>
                      🪙 Vuelto ({comandaExitosa.vueltoInfo.metodoVuelto}):
                    </span>
                    <strong style={{ color: "#16a34a", fontSize: 14 }}>
                      {comandaExitosa.vueltoInfo.metodoVuelto === "Efectivo USD"
                        ? `$${comandaExitosa.vueltoInfo.vueltoUsd.toFixed(2)} USD`
                        : `Bs. ${comandaExitosa.vueltoInfo.vueltoBs.toLocaleString("es-VE", { minimumFractionDigits: 2 })}`}
                    </strong>
                  </div>
                </>
              )}
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
                  const clienteTxt = comandaExitosa.clienteNombre ? `\n👤 *Cliente:* ${comandaExitosa.clienteNombre}` : "";
                  const vueltoTxt = comandaExitosa.vueltoInfo
                    ? `\n💵 *Recibido:* ${comandaExitosa.vueltoInfo.monedaRecibida === "USD" ? `$${comandaExitosa.vueltoInfo.recibido.toFixed(2)} USD` : `Bs. ${comandaExitosa.vueltoInfo.recibido.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}\n🪙 *Vuelto entregado (${comandaExitosa.vueltoInfo.metodoVuelto}):* ${comandaExitosa.vueltoInfo.metodoVuelto === "Efectivo USD" ? `$${comandaExitosa.vueltoInfo.vueltoUsd.toFixed(2)} USD` : `Bs. ${comandaExitosa.vueltoInfo.vueltoBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}`
                    : "";
                  const txt = `🧾 *Factura Digital Gourmet - La Parada del Sabor*${clienteTxt}\n📌 *Comanda:* #${comandaExitosa.numero}\n💰 *Total:* $${comandaExitosa.totalUsd.toFixed(2)} USD / Bs. ${comandaExitosa.totalBs.toFixed(2)}${vueltoTxt}\n🔗 *Ver Factura & Estado:* ${url}\n\n¡Gracias por tu compra!`;
                  
                  const telDigits = (comandaExitosa.clienteTelefono || "").replace(/\D/g, "");
                  let waPhone = "";
                  if (telDigits.length >= 7) {
                    if (telDigits.startsWith("58")) waPhone = telDigits;
                    else if (telDigits.startsWith("0")) waPhone = "58" + telDigits.slice(1);
                    else waPhone = "58" + telDigits;
                  }
                  const waLink = waPhone ? `https://wa.me/${waPhone}?text=${encodeURIComponent(txt)}` : `https://wa.me/?text=${encodeURIComponent(txt)}`;
                  window.open(waLink, "_blank");
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
                📲 Enviar Factura al Cliente por WhatsApp {comandaExitosa.clienteNombre ? `(${comandaExitosa.clienteNombre})` : ""}
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

      {/* Modal Flotante de Selección de Clientes (Estilo Gourmet) */}
      {modalSeleccionarCliente && (
        <div className="modal-overlay" onClick={() => setModalSeleccionarCliente(false)}>
          <div
            className="modal-recipe-card"
            style={{ maxWidth: 480, maxHeight: "88vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-recipe-header">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 24 }}>👥</span>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18 }}>Seleccionar Cliente</h2>
                  <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>
                    Asigna un cliente a la orden para registrar historial y enviar factura
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalSeleccionarCliente(false)}
                className="btn-modal-close"
              >
                ✕
              </button>
            </div>

            {/* Barra de Búsqueda y Botón Nuevo */}
            <div style={{ display: "flex", gap: 8, margin: "14px 0 10px" }}>
              <div className="search-input-wrapper" style={{ flex: 1 }}>
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Buscar por nombre o teléfono..."
                  value={busquedaClienteModal}
                  onChange={(e) => setBusquedaClienteModal(e.target.value)}
                  className="pos-search-input"
                  style={{ fontSize: 13 }}
                  autoFocus
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalSeleccionarCliente(false);
                  setModalNuevoCliente(true);
                }}
                className="btn-primary-action"
                style={{ padding: "0 14px", fontSize: 12, flexShrink: 0 }}
              >
                ➕ Nuevo
              </button>
            </div>

            {/* Opción Cliente Casual / Mostrador */}
            <button
              type="button"
              onClick={() => {
                sounds.playPop();
                setClienteSeleccionadoId(null);
                setModalSeleccionarCliente(false);
              }}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 10,
                border: !clienteSeleccionadoId ? "2px solid var(--primary)" : "1px solid var(--border)",
                background: !clienteSeleccionadoId ? "rgba(249, 115, 22, 0.1)" : "var(--bg-subtle)",
                color: "var(--text)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                marginBottom: 10,
                textAlign: "left",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 22 }}>👤</span>
                <div>
                  <strong style={{ display: "block", fontSize: 13 }}>Cliente Mostrador / Casual</strong>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Venta rápida sin registrar cliente</span>
                </div>
              </div>
              {!clienteSeleccionadoId && (
                <span style={{ color: "var(--primary)", fontWeight: 900, fontSize: 14 }}>✓ Activo</span>
              )}
            </button>

            {/* Lista de Clientes Registrados */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto", paddingRight: 2 }}>
              {clientesFiltradosModal.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: 13 }}>
                  No se encontraron clientes con "{busquedaClienteModal}".
                </div>
              ) : (
                clientesFiltradosModal.map((c) => {
                  const isSelected = clienteSeleccionadoId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        sounds.playPop();
                        setClienteSeleccionadoId(c.id);
                        setModalSeleccionarCliente(false);
                      }}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: isSelected ? "2px solid var(--primary)" : "1px solid var(--border)",
                        background: isSelected ? "rgba(249, 115, 22, 0.1)" : "var(--surface)",
                        color: "var(--text)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 20 }}>👑</span>
                        <div>
                          <strong style={{ fontSize: 13, color: "var(--text)", display: "block" }}>{c.nombre}</strong>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                            {c.telefono && (
                              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                📞 {c.telefono}
                              </span>
                            )}
                            <span className="badge-ticket" style={{ fontSize: 10, padding: "1px 6px" }}>
                              {c.total_pedidos} Pedidos
                            </span>
                          </div>
                        </div>
                      </div>
                      {isSelected ? (
                        <span style={{ color: "var(--primary)", fontWeight: 900, fontSize: 14 }}>✓</span>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Seleccionar →</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Rápido: Registrar Nuevo Cliente desde POS */}
      {modalNuevoCliente && (
        <div className="modal-overlay" onClick={() => setModalNuevoCliente(false)}>
          <div className="modal-recipe-card" style={{ maxWidth: 450 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-recipe-header">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 24 }}>✨</span>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18 }}>Registrar Nuevo Cliente</h2>
                  <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>
                    Guarda sus datos para agilizar futuros pedidos y enviar tickets por WhatsApp
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalNuevoCliente(false)}
                className="btn-modal-close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGuardarClienteRapido} className="recipe-form" style={{ marginTop: 12 }}>
              <div className="form-field">
                <label style={{ fontSize: 12, fontWeight: 800 }}>👤 Nombre y Apellido *</label>
                <input
                  type="text"
                  placeholder="Ej: Carlos Mendoza"
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  required
                  autoFocus
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "var(--bg-subtle)",
                    color: "var(--text)",
                    fontSize: 13,
                  }}
                />
              </div>

              <div className="form-field">
                <label style={{ fontSize: 12, fontWeight: 800 }}>📱 Teléfono / WhatsApp (Recomendado)</label>
                <input
                  type="tel"
                  placeholder="Ej: 04141234567"
                  value={nuevoTelefono}
                  onChange={(e) => setNuevoTelefono(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "var(--bg-subtle)",
                    color: "var(--text)",
                    fontSize: 13,
                  }}
                />
              </div>

              <div className="form-field">
                <label style={{ fontSize: 12, fontWeight: 800 }}>🛵 Dirección de Delivery / Referencia (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: Calle 4 con Carrera 2, Casa #12"
                  value={nuevaDireccion}
                  onChange={(e) => setNuevaDireccion(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "var(--bg-subtle)",
                    color: "var(--text)",
                    fontSize: 13,
                  }}
                />
              </div>

              <div className="form-actions" style={{ marginTop: 16 }}>
                <button
                  type="button"
                  onClick={() => setModalNuevoCliente(false)}
                  className="btn-cancel"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoCliente || !nuevoNombre.trim()}
                  className="btn-submit-recipe"
                  style={{ fontWeight: 800 }}
                >
                  {guardandoCliente ? "Guardando..." : "✅ Guardar & Asignar a Comanda"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Bandeja de Pedidos Web / WhatsApp */}
      {modalPedidosWeb && (
        <div className="modal-overlay" onClick={() => setModalPedidosWeb(false)}>
          <div
            className="modal-ticket-card modal-pedidos-web"
            style={{
              maxWidth: 540,
              maxHeight: "88vh",
              display: "flex",
              flexDirection: "column",
              padding: "20px",
              boxSizing: "border-box",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexShrink: 0 }}>
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
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  overflowY: "auto",
                  paddingRight: 4,
                  minHeight: 0,
                  flex: 1,
                }}
              >
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
                        <div style={{ background: "rgba(248, 197, 66, 0.12)", border: "1px solid rgba(248, 197, 66, 0.35)", borderRadius: 8, padding: "6px 8px" }}>
                          <p style={{ fontSize: 11, color: "var(--text)", margin: "0 0 6px", lineHeight: 1.3 }}>
                            📍 Dirección: {p.cliente.direccion_delivery}
                          </p>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <button
                              type="button"
                              onClick={() => handleEnviarWhatsAppDeliveryPOS(p)}
                              style={{
                                flex: 1,
                                padding: "5px 8px",
                                borderRadius: 6,
                                background: "#25D366",
                                color: "#ffffff",
                                border: "none",
                                fontSize: 11,
                                fontWeight: 800,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 4,
                              }}
                            >
                              📲 Enviar al Delivery
                            </button>
                            {p.cliente.direccion_delivery.match(/https:\/\/maps\.google\.com\/\?q=[^\s]+/) && (
                              <a
                                href={p.cliente.direccion_delivery.match(/https:\/\/maps\.google\.com\/\?q=[^\s]+/)?.[0]}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  padding: "5px 8px",
                                  borderRadius: 6,
                                  background: "var(--bg-card)",
                                  color: "var(--text)",
                                  border: "1px solid var(--border)",
                                  fontSize: 11,
                                  fontWeight: 800,
                                  textDecoration: "none",
                                  display: "inline-flex",
                                  alignItems: "center",
                                }}
                              >
                                🗺️ Mapa
                              </a>
                            )}
                          </div>
                        </div>
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

      {/* Modal Interactivo de Personalización de Combos POS */}
      {comboModalData && (
        <ModalPersonalizarCombo
          producto={comboModalData.producto}
          totalArepas={comboModalData.totalArepas}
          extras={extras}
          onConfirmar={handleConfirmarComboPos}
          onCerrar={() => setComboModalData(null)}
        />
      )}

      {/* Modal Interactivo de Selección de Zona de Delivery en POS */}
      <ModalSeleccionarZonaDelivery
        abierto={modalZonaDeliveryPos}
        onClose={() => setModalZonaDeliveryPos(false)}
        zonas={zonasDelivery}
        zonaSeleccionadaId={zonaDeliveryId || ""}
        onSeleccionarZona={(id) => {
          setZonaDeliveryId(id);
          setModalZonaDeliveryPos(false);
          sounds.playPop();
        }}
        tasaBcv={tasaBcv}
      />
    </div>
  );
}
