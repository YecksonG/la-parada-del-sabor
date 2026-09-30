"use client";

import { useState, useMemo, useTransition } from "react";
import { TetasInventario, TetasVenta, TetasCategoria, CATEGORIAS_TETAS } from "@/types/database";
import TetaVisual from "@/components/teta-visual";
import { calcularTotalTetasUsd } from "@/lib/tetas-precios";
import {
  registrarVentaMultiTetasAction,
  abastecerStockTetasAction,
  crearSaborTetaAction,
} from "./actions";
import { PagoFraccionItem, MetodoPagoFraccion } from "@/lib/pago-mixto";

interface ItemBandeja {
  saborId: string;
  cantidad: number;
}

interface TetasClientProps {
  inventario: TetasInventario[];
  ventas: TetasVenta[];
  tasaBcv: number;
  metricas: {
    ventasMesUsd: number;
    costoMesUsd: number;
    utilidadMesUsd: number;
    unidadesMes: number;
  };
  operador: string;
}

export default function TetasClient({
  inventario,
  ventas,
  tasaBcv,
  metricas,
  operador,
}: TetasClientProps) {
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("todas");
  const [busqueda, setBusqueda] = useState("");
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Bandeja de despacho multi-sabor
  const [bandeja, setBandeja] = useState<ItemBandeja[]>([]);
  const [modalVenta, setModalVenta] = useState(false);
  const [modalAbastecer, setModalAbastecer] = useState(false);
  const [modalNuevoSabor, setModalNuevoSabor] = useState(false);

  // Estados Form Venta
  const [metodoPago, setMetodoPago] = useState<string>("efectivo_usd");
  const [notasVenta, setNotasVenta] = useState("");
  const [clienteCredito, setClienteCredito] = useState("");
  const [mixtoUsdMonto, setMixtoUsdMonto] = useState("");
  const [mixtoUsdMetodo, setMixtoUsdMetodo] = useState<MetodoPagoFraccion>("efectivo_usd");
  const [mixtoBsMetodo, setMixtoBsMetodo] = useState<MetodoPagoFraccion>("pago_movil");

  // Estados Abastecer Freezer
  const [abastecerSaborId, setAbastecerSaborId] = useState<string>(inventario[0]?.id || "");
  const [abastecerCantidad, setAbastecerCantidad] = useState("10");
  const [abastecerCosto, setAbastecerCosto] = useState("0.35");
  const [abastecerRegistrarGasto, setAbastecerRegistrarGasto] = useState(true);

  // Estados Nuevo Sabor
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoCategoria, setNuevoCategoria] = useState<TetasCategoria>("con_chocolate");
  const [nuevoCosto, setNuevoCosto] = useState("0.35");
  const [nuevoPrecio, setNuevoPrecio] = useState("0.80");
  const [nuevoStock, setNuevoStock] = useState("0");

  const saboresMap = useMemo(() => {
    return new Map(inventario.map((s) => [s.id, s]));
  }, [inventario]);

  // Totales de la bandeja
  const totalUnidades = useMemo(() => {
    return bandeja.reduce((acc, it) => acc + it.cantidad, 0);
  }, [bandeja]);

  const totalUsd = useMemo(() => {
    return calcularTotalTetasUsd(totalUnidades, 0.80);
  }, [totalUnidades]);

  const totalBs = useMemo(() => {
    return Number((totalUsd * tasaBcv).toFixed(2));
  }, [totalUsd, tasaBcv]);

  const paresPromo = useMemo(() => Math.floor(totalUnidades / 2), [totalUnidades]);
  const sueltasPromo = useMemo(() => totalUnidades % 2, [totalUnidades]);

  const showNotify = (msg: string, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(""), 5000);
    } else {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(""), 4000);
    }
  };

  // MÉTODOS DE BANDEJA
  const agregarSabor = (saborId: string, cantidad = 1) => {
    const s = saboresMap.get(saborId);
    if (!s) return;
    const stock = Number(s.stock_unidades) || 0;
    if (stock <= 0) {
      showNotify(`No hay stock disponible de "${s.sabor}".`, true);
      return;
    }

    const itemExistente = bandeja.find((it) => it.saborId === saborId);
    const cantActual = itemExistente ? itemExistente.cantidad : 0;
    if (cantActual + cantidad > stock) {
      showNotify(`Stock máximo en freezer para "${s.sabor}": ${stock} unidades.`, true);
      return;
    }

    setBandeja((prev) => {
      const idx = prev.findIndex((it) => it.saborId === saborId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], cantidad: cantActual + cantidad };
        return copy;
      }
      return [...prev, { saborId, cantidad }];
    });
  };

  const cambiarCantidad = (saborId: string, delta: number) => {
    const s = saboresMap.get(saborId);
    const stock = Number(s?.stock_unidades) || 0;
    const itemExistente = bandeja.find((it) => it.saborId === saborId);
    if (!itemExistente) return;

    const nueva = itemExistente.cantidad + delta;
    if (nueva > stock) {
      showNotify(`Stock máximo disponible para "${s?.sabor}": ${stock} unidades.`, true);
      return;
    }

    setBandeja((prev) =>
      prev
        .map((it) => (it.saborId === saborId ? { ...it, cantidad: nueva } : it))
        .filter((it) => it.cantidad > 0)
    );
  };

  const removerSabor = (saborId: string) => {
    setBandeja((prev) => prev.filter((it) => it.saborId !== saborId));
  };

  const limpiarBandeja = () => {
    setBandeja([]);
  };

  // Filtrado de sabores
  const saboresFiltrados = useMemo(() => {
    return inventario.filter((s) => {
      const matchCat = categoriaFiltro === "todas" || s.categoria === categoriaFiltro;
      const matchBusq = s.sabor.toLowerCase().includes(busqueda.toLowerCase());
      return matchCat && matchBusq;
    });
  }, [inventario, categoriaFiltro, busqueda]);

  // SUBMIT VENTA MULTI-SABOR
  const handleRegistrarVenta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bandeja.length === 0) {
      showNotify("Debes seleccionar al menos un sabor para despachar.", true);
      return;
    }

    let desglose_mixto: PagoFraccionItem[] | undefined;
    if (metodoPago === "pago_mixto") {
      const montoUsdNum = parseFloat(mixtoUsdMonto) || 0;
      if (montoUsdNum <= 0 || montoUsdNum >= totalUsd) {
        showNotify(`La parte en dólares debe ser mayor a 0 y menor al total ($${totalUsd.toFixed(2)} USD).`, true);
        return;
      }
      const restoUsd = Number((totalUsd - montoUsdNum).toFixed(2));
      const restoBs = Number((restoUsd * tasaBcv).toFixed(2));

      desglose_mixto = [
        { metodo: mixtoUsdMetodo, monto_usd: montoUsdNum, monto_bs: Number((montoUsdNum * tasaBcv).toFixed(2)) },
        { metodo: mixtoBsMetodo, monto_usd: restoUsd, monto_bs: restoBs },
      ];
    }

    startTransition(async () => {
      const res = await registrarVentaMultiTetasAction({
        items: bandeja.map((b) => ({ sabor_id: b.saborId, cantidad: b.cantidad })),
        metodo_pago: metodoPago,
        tasa_bcv: tasaBcv,
        cliente_credito: clienteCredito,
        notas: notasVenta,
        desglose_mixto,
      });

      if (!res.ok) {
        showNotify(res.error || "Error al asentar venta de tetas.", true);
      } else {
        showNotify(`Despacho registrado: ${res.totalUnidades} tetas por $${res.totalUsd} USD (~${res.totalBs} Bs)`);
        setModalVenta(false);
        limpiarBandeja();
        setNotasVenta("");
        setClienteCredito("");
        setMixtoUsdMonto("");
      }
    });
  };

  // SUBMIT ABASTECER FREEZER
  const handleAbastecer = async (e: React.FormEvent) => {
    e.preventDefault();
    const cant = parseInt(abastecerCantidad);
    if (!cant || cant <= 0) {
      showNotify("Cantidad inválida", true);
      return;
    }

    startTransition(async () => {
      const res = await abastecerStockTetasAction({
        sabor_id: abastecerSaborId,
        cantidad: cant,
        costo_compra_unitario_usd: parseFloat(abastecerCosto) || 0.35,
        registrar_gasto: abastecerRegistrarGasto,
      });

      if (!res.ok) {
        showNotify(res.error || "Error al abastecer freezer.", true);
      } else {
        showNotify(`Stock abastecido: +${cant} unidades ingresadas al freezer.`);
        setModalAbastecer(false);
      }
    });
  };

  // SUBMIT NUEVO SABOR
  const handleNuevoSabor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoNombre.trim()) {
      showNotify("El nombre del sabor es requerido.", true);
      return;
    }

    startTransition(async () => {
      const res = await crearSaborTetaAction(
        nuevoNombre,
        nuevoCategoria,
        parseFloat(nuevoCosto) || 0.35,
        parseFloat(nuevoPrecio) || 0.80,
        parseInt(nuevoStock) || 0
      );

      if (!res.ok) {
        showNotify(res.error || "Error al crear sabor.", true);
      } else {
        showNotify(`Sabor "${nuevoNombre}" incorporado con éxito al catálogo.`);
        setModalNuevoSabor(false);
        setNuevoNombre("");
      }
    });
  };

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "20px 24px 80px", color: "var(--text)" }}>
      {/* CABECERA PRINCIPAL */}
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: "20px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: 1,
                padding: "3px 8px",
                borderRadius: 6,
                background: "var(--primary-light)",
                color: "var(--primary-dark)",
                border: "1px solid var(--border)",
              }}
            >
              Módulo Especializado
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>
              Regla Oficial: 1x$0.80 • 2x$1.50 (Promo Pares)
            </span>
          </div>

          <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0, color: "var(--text)" }}>
            Tetas Cream • Inventario y Despacho
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0 0" }}>
            Helados artesanales rellenos en freezer • Tasa POS Oficial:{" "}
            <strong style={{ color: "var(--text)" }}>{tasaBcv.toFixed(2)} Bs/$</strong> • Operador: {operador}
          </p>
        </div>

        {/* BOTONES DE ACCIÓN */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setModalAbastecer(true)}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              background: "var(--bg-subtle)",
              color: "var(--text)",
              border: "1px solid var(--border)",
              cursor: "pointer",
            }}
          >
            Abastecer Freezer
          </button>
          <button
            type="button"
            onClick={() => setModalNuevoSabor(true)}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              background: "var(--bg-subtle)",
              color: "var(--text)",
              border: "1px solid var(--border)",
              cursor: "pointer",
            }}
          >
            Nuevo Sabor
          </button>
          <button
            type="button"
            onClick={() => setModalVenta(true)}
            style={{
              padding: "10px 20px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 800,
              background: "var(--primary)",
              color: "#ffffff",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 4px 12px var(--primary-glow)",
            }}
          >
            <span>Despachar Venta</span>
            {totalUnidades > 0 && (
              <span
                style={{
                  background: "#ffffff",
                  color: "var(--primary-dark)",
                  fontSize: 11,
                  fontWeight: 900,
                  padding: "2px 7px",
                  borderRadius: 12,
                }}
              >
                {totalUnidades}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ALERTAS */}
      {errorMsg && (
        <div
          style={{
            marginTop: 14,
            padding: "12px 16px",
            borderRadius: 10,
            background: "#fee2e2",
            color: "#dc2626",
            border: "1px solid #fca5a5",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div
          style={{
            marginTop: 14,
            padding: "12px 16px",
            borderRadius: 10,
            background: "var(--green-light)",
            color: "var(--green-text)",
            border: "1px solid var(--green)",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {successMsg}
        </div>
      )}

      {/* TARJETAS DE MÉTRICAS */}
      <div
        style={{
          marginTop: 20,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
        }}
      >
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: "16px 20px",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
            Tetas Despachadas (Mes)
          </span>
          <div style={{ fontSize: 26, fontWeight: 900, color: "var(--text)", marginTop: 4 }}>
            {metricas.unidadesMes}
          </div>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Unidades físicas salidas</span>
        </div>

        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: "16px 20px",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
            Ventas Brutas
          </span>
          <div style={{ fontSize: 26, fontWeight: 900, color: "var(--primary-dark)", marginTop: 4 }}>
            ${metricas.ventasMesUsd.toFixed(2)}
          </div>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            ~{(metricas.ventasMesUsd * tasaBcv).toLocaleString("es-VE", { maximumFractionDigits: 2 })} Bs
          </span>
        </div>

        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: "16px 20px",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
            Costo Materia Prima
          </span>
          <div style={{ fontSize: 26, fontWeight: 900, color: "var(--chart-costos)", marginTop: 4 }}>
            ${metricas.costoMesUsd.toFixed(2)}
          </div>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Leche, frutas y rellenos</span>
        </div>

        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: "16px 20px",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
            Utilidad Estimada
          </span>
          <div style={{ fontSize: 26, fontWeight: 900, color: "var(--green-text)", marginTop: 4 }}>
            ${metricas.utilidadMesUsd.toFixed(2)}
          </div>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Margen neto de freezer</span>
        </div>
      </div>

      {/* BARRA DE FILTROS Y BÚSQUEDA */}
      <div
        style={{
          marginTop: 24,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        {/* Tabs de Categorías */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          {CATEGORIAS_TETAS.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoriaFiltro(cat.id)}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 700,
                whiteSpace: "nowrap",
                border: "1px solid",
                borderColor: categoriaFiltro === cat.id ? "var(--primary)" : "var(--border)",
                background: categoriaFiltro === cat.id ? "var(--primary)" : "var(--bg-card)",
                color: categoriaFiltro === cat.id ? "#ffffff" : "var(--text-muted)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Buscador */}
        <div style={{ width: 260 }}>
          <input
            type="text"
            placeholder="Buscar sabor..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 14px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--bg-card)",
              color: "var(--text)",
              fontSize: 13,
              outline: "none",
            }}
          />
        </div>
      </div>

      {/* GRID DE SABORES Y FREEZER */}
      <div
        style={{
          marginTop: 20,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 16,
        }}
      >
        {saboresFiltrados.map((s) => {
          const stock = Number(s.stock_unidades) || 0;
          const agotado = stock <= 0;
          const enBandeja = bandeja.find((b) => b.saborId === s.id);

          return (
            <div
              key={s.id}
              style={{
                background: "var(--bg-card)",
                border: enBandeja ? "2px solid var(--primary)" : "1px solid var(--border)",
                borderRadius: 14,
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: enBandeja ? "0 4px 14px var(--primary-glow)" : "var(--shadow-sm)",
                opacity: agotado ? 0.6 : 1,
                transition: "all 0.15s ease",
              }}
            >
              <div>
                {/* Categoría y Stock Badge */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: "var(--bg-subtle)",
                      color: "var(--text-muted)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {s.categoria.replace("_", " ")}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      padding: "3px 8px",
                      borderRadius: 10,
                      background: agotado ? "#fee2e2" : stock <= 3 ? "#fef3c7" : "var(--green-light)",
                      color: agotado ? "#dc2626" : stock <= 3 ? "#b45309" : "var(--green-text)",
                    }}
                  >
                    {agotado ? "Agotado" : `${stock} en freezer`}
                  </span>
                </div>

                {/* Gráfico SVG y Título */}
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 12 }}>
                  <TetaVisual sabor={s.sabor} categoria={s.categoria} size={60} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3
                      style={{
                        fontSize: 16,
                        fontWeight: 800,
                        margin: 0,
                        color: "var(--text)",
                        lineHeight: 1.2,
                        wordBreak: "break-word",
                      }}
                    >
                      {s.sabor}
                    </h3>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--primary-dark)", marginTop: 4 }}>
                      ${Number(s.precio_venta_unitario_usd).toFixed(2)}{" "}
                      <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)" }}>c/u</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Botón o Stepper de Bandeja */}
              <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                {enBandeja ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: "var(--bg-subtle)",
                      borderRadius: 8,
                      padding: "4px 8px",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>En orden:</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => cambiarCantidad(s.id, -1)}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 6,
                          border: "1px solid var(--border)",
                          background: "var(--bg-card)",
                          color: "var(--text)",
                          fontWeight: 900,
                          cursor: "pointer",
                        }}
                      >
                        -
                      </button>
                      <span style={{ fontSize: 13, fontWeight: 900, color: "var(--primary-dark)", minWidth: 16, textAlign: "center" }}>
                        {enBandeja.cantidad}
                      </span>
                      <button
                        type="button"
                        onClick={() => cambiarCantidad(s.id, 1)}
                        disabled={enBandeja.cantidad >= stock}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 6,
                          border: "1px solid var(--border)",
                          background: "var(--bg-card)",
                          color: "var(--text)",
                          fontWeight: 900,
                          cursor: enBandeja.cantidad >= stock ? "not-allowed" : "pointer",
                          opacity: enBandeja.cantidad >= stock ? 0.3 : 1,
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => agregarSabor(s.id, 1)}
                    disabled={agotado}
                    style={{
                      width: "100%",
                      padding: "8px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 800,
                      background: agotado ? "var(--bg-subtle)" : "var(--bg-subtle)",
                      color: agotado ? "var(--text-muted)" : "var(--text)",
                      border: "1px solid var(--border)",
                      cursor: agotado ? "not-allowed" : "pointer",
                      transition: "all 0.1s ease",
                    }}
                  >
                    {agotado ? "Sin stock en freezer" : "+ Agregar a la orden"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* BARRA FLOTANTE DE DESPACHO INMEDIATO */}
      {bandeja.length > 0 && !modalVenta && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 40,
            background: "var(--bg-card)",
            border: "2px solid var(--primary)",
            padding: "14px 24px",
            borderRadius: 16,
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            display: "flex",
            alignItems: "center",
            gap: 24,
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
              Orden activa: {totalUnidades} {totalUnidades === 1 ? "teta" : "tetas"}
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "var(--text)" }}>
              ${totalUsd.toFixed(2)} USD{" "}
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>
                (~{totalBs.toLocaleString("es-VE", { minimumFractionDigits: 2 })} Bs)
              </span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={limpiarBandeja}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                background: "transparent",
                color: "var(--text-muted)",
                border: "1px solid var(--border)",
                cursor: "pointer",
              }}
            >
              Vaciar
            </button>
            <button
              type="button"
              onClick={() => setModalVenta(true)}
              style={{
                padding: "8px 18px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 900,
                background: "var(--primary)",
                color: "#ffffff",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 2px 8px var(--primary-glow)",
              }}
            >
              Cobrar Ahora
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE DESPACHO Y COBRO */}
      {modalVenta && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              maxWidth: 520,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 24,
              boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
              <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0, color: "var(--text)" }}>Despachar Tetas Cream</h2>
              <button
                type="button"
                onClick={() => setModalVenta(false)}
                style={{ background: "none", border: "none", fontSize: 14, fontWeight: 700, color: "var(--text-muted)", cursor: "pointer" }}
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={handleRegistrarVenta} style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
              {/* LISTA DE ITEMS */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                  Sabores en la orden ({totalUnidades} unidades):
                </label>
                {bandeja.length === 0 ? (
                  <div style={{ padding: 16, textAlign: "center", border: "1px dashed var(--border)", borderRadius: 10, fontSize: 13, color: "var(--text-muted)" }}>
                    No has agregado ningún sabor a la orden.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto", paddingRight: 4 }}>
                    {bandeja.map((it) => {
                      const s = saboresMap.get(it.saborId);
                      const stock = Number(s?.stock_unidades) || 0;
                      return (
                        <div
                          key={it.saborId}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "8px 12px",
                            borderRadius: 8,
                            background: "var(--bg-subtle)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <TetaVisual sabor={s?.sabor || ""} categoria={s?.categoria || ""} size={28} />
                            <div>
                              <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", display: "block" }}>{s?.sabor}</span>
                              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{stock} disp.</span>
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => cambiarCantidad(it.saborId, -1)}
                              style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", fontWeight: 900, cursor: "pointer" }}
                            >
                              -
                            </button>
                            <span style={{ fontSize: 13, fontWeight: 900, color: "var(--primary-dark)", minWidth: 16, textAlign: "center" }}>
                              {it.cantidad}
                            </span>
                            <button
                              type="button"
                              onClick={() => cambiarCantidad(it.saborId, 1)}
                              disabled={it.cantidad >= stock}
                              style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", fontWeight: 900, cursor: "pointer" }}
                            >
                              +
                            </button>
                            <button
                              type="button"
                              onClick={() => removerSabor(it.saborId)}
                              style={{ marginLeft: 6, fontSize: 11, color: "#dc2626", background: "none", border: "none", cursor: "pointer" }}
                            >
                              Quitar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* TOTAL CON DESGLOSE */}
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: 10,
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--border)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block" }}>
                    Total Calculado ({totalUnidades} tetas)
                  </span>
                  <span style={{ fontSize: 12, color: "var(--primary-dark)", fontWeight: 600 }}>
                    {paresPromo > 0 ? `${paresPromo} par(es) combo ($1.50 c/u) ` : ""}
                    {sueltasPromo > 0 ? `+ ${sueltasPromo} suelta ($0.80)` : ""}
                  </span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "var(--text)" }}>${totalUsd.toFixed(2)} USD</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>
                    ~{totalBs.toLocaleString("es-VE", { minimumFractionDigits: 2 })} Bs
                  </div>
                </div>
              </div>

              {/* MÉTODO DE PAGO */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                  Método de Pago
                </label>
                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--bg-card)",
                    color: "var(--text)",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  <option value="efectivo_usd">Efectivo USD (Divisas)</option>
                  <option value="pago_movil">Pago Móvil (Bs)</option>
                  <option value="efectivo_bs">Efectivo Bolívares</option>
                  <option value="punto">Punto de Venta (Tarjeta)</option>
                  <option value="pago_mixto">Pago Mixto (Parte USD + Parte Bs)</option>
                  <option value="credito">Cuenta por Cobrar (Crédito)</option>
                </select>
              </div>

              {/* PAGO MIXTO */}
              {metodoPago === "pago_mixto" && (
                <div style={{ padding: 12, borderRadius: 8, background: "var(--bg-subtle)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 2 }}>
                        Método Divisas:
                      </label>
                      <select
                        value={mixtoUsdMetodo}
                        onChange={(e) => setMixtoUsdMetodo(e.target.value as MetodoPagoFraccion)}
                        style={{ width: "100%", padding: 6, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text)", fontSize: 12 }}
                      >
                        <option value="efectivo_usd">Efectivo USD</option>
                        <option value="zelle">Zelle USD</option>
                        <option value="binance">Binance USDT</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 2 }}>
                        Monto USD:
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Ej. 1.00"
                        value={mixtoUsdMonto}
                        onChange={(e) => setMixtoUsdMonto(e.target.value)}
                        style={{ width: "100%", padding: 6, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text)", fontSize: 12 }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 2 }}>
                      Método para el Restante en Bs:
                    </label>
                    <select
                      value={mixtoBsMetodo}
                      onChange={(e) => setMixtoBsMetodo(e.target.value as MetodoPagoFraccion)}
                      style={{ width: "100%", padding: 6, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text)", fontSize: 12 }}
                    >
                      <option value="pago_movil">Pago Móvil (Bs)</option>
                      <option value="efectivo_bs">Efectivo (Bs)</option>
                      <option value="punto">Punto de Venta (Bs)</option>
                    </select>
                  </div>

                  {parseFloat(mixtoUsdMonto) > 0 && parseFloat(mixtoUsdMonto) < totalUsd && (
                    <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
                      Restante en Bs: ~${(totalUsd - parseFloat(mixtoUsdMonto)).toFixed(2)} USD (
                      {((totalUsd - parseFloat(mixtoUsdMonto)) * tasaBcv).toFixed(2)} Bs)
                    </p>
                  )}
                </div>
              )}

              {/* CRÉDITO */}
              {metodoPago === "credito" && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 2 }}>
                    Nombre del Deudor / Cliente
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Vecino Carlos"
                    value={clienteCredito}
                    onChange={(e) => setClienteCredito(e.target.value)}
                    style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text)", fontSize: 13 }}
                  />
                </div>
              )}

              {/* NOTAS */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 2 }}>
                  Notas opcionales
                </label>
                <input
                  type="text"
                  placeholder="Ej. Pago con billete de $5"
                  value={notasVenta}
                  onChange={(e) => setNotasVenta(e.target.value)}
                  style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text)", fontSize: 13 }}
                />
              </div>

              {/* BOTÓN CONFIRMAR */}
              <button
                type="submit"
                disabled={isPending || totalUnidades === 0}
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 900,
                  background: totalUnidades > 0 ? "var(--primary)" : "var(--border)",
                  color: "#ffffff",
                  border: "none",
                  cursor: totalUnidades > 0 ? "pointer" : "not-allowed",
                  boxShadow: "0 2px 8px var(--primary-glow)",
                  marginTop: 6,
                }}
              >
                {isPending ? "Asentando venta..." : `Confirmar Cobro ($${totalUsd.toFixed(2)} USD)`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ABASTECER FREEZER */}
      {modalAbastecer && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              maxWidth: 440,
              width: "100%",
              padding: 24,
              boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 16px", color: "var(--text)" }}>Abastecer Stock en Freezer</h2>
            <form onSubmit={handleAbastecer} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 2 }}>
                  Sabor a Recargar
                </label>
                <select
                  value={abastecerSaborId}
                  onChange={(e) => setAbastecerSaborId(e.target.value)}
                  style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text)", fontSize: 13, fontWeight: 700 }}
                >
                  {inventario.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.sabor} (Stock actual: {s.stock_unidades})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 2 }}>
                  Cantidad Producida (Unidades)
                </label>
                <input
                  type="number"
                  min="1"
                  value={abastecerCantidad}
                  onChange={(e) => setAbastecerCantidad(e.target.value)}
                  style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text)", fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 2 }}>
                  Costo Unitario de Producción ($ USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={abastecerCosto}
                  onChange={(e) => setAbastecerCosto(e.target.value)}
                  style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text)", fontSize: 13 }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <input
                  type="checkbox"
                  id="chkGasto"
                  checked={abastecerRegistrarGasto}
                  onChange={(e) => setAbastecerRegistrarGasto(e.target.checked)}
                />
                <label htmlFor="chkGasto" style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
                  Registrar costo total en gastos del negocio
                </label>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setModalAbastecer(false)}
                  style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontWeight: 700, cursor: "pointer" }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  style={{ flex: 1, padding: 8, borderRadius: 8, border: "none", background: "var(--primary)", color: "#ffffff", fontWeight: 800, cursor: "pointer" }}
                >
                  {isPending ? "Guardando..." : "Ingresar a Freezer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NUEVO SABOR */}
      {modalNuevoSabor && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              maxWidth: 440,
              width: "100%",
              padding: 24,
              boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 16px", color: "var(--text)" }}>Incorporar Nuevo Sabor</h2>
            <form onSubmit={handleNuevoSabor} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 2 }}>
                  Nombre del Sabor
                </label>
                <input
                  type="text"
                  placeholder="Ej. Parchita con Chocolate"
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text)", fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 2 }}>
                  Categoría
                </label>
                <select
                  value={nuevoCategoria}
                  onChange={(e) => setNuevoCategoria(e.target.value as TetasCategoria)}
                  style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text)", fontSize: 13, fontWeight: 700 }}
                >
                  <option value="con_chocolate">Con Chocolate & Especiales</option>
                  <option value="linea_yogurt">Línea Yogurt</option>
                  <option value="yogurt_combinado">Yogurt Combinado</option>
                  <option value="combinadas">Combinadas</option>
                  <option value="clasicas">Clásicas</option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 2 }}>
                    Costo ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={nuevoCosto}
                    onChange={(e) => setNuevoCosto(e.target.value)}
                    style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text)", fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 2 }}>
                    Precio ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={nuevoPrecio}
                    onChange={(e) => setNuevoPrecio(e.target.value)}
                    style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text)", fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 2 }}>
                    Stock Inicial
                  </label>
                  <input
                    type="number"
                    value={nuevoStock}
                    onChange={(e) => setNuevoStock(e.target.value)}
                    style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text)", fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setModalNuevoSabor(false)}
                  style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontWeight: 700, cursor: "pointer" }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  style={{ flex: 1, padding: 8, borderRadius: 8, border: "none", background: "var(--primary)", color: "#ffffff", fontWeight: 800, cursor: "pointer" }}
                >
                  {isPending ? "Guardando..." : "Crear Sabor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HISTORIAL RECIENTE DE DESPACHOS */}
      <div style={{ marginTop: 40 }}>
        <h2 style={{ fontSize: 13, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
          Últimos Despachos de Tetas ({ventas.length} registros)
        </h2>
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            overflow: "hidden",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          {ventas.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
              Aún no se han registrado despachos de tetas en esta instancia.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--border)", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase" }}>
                    <th style={{ padding: "10px 16px" }}>Fecha y Hora</th>
                    <th style={{ padding: "10px 16px" }}>Sabor</th>
                    <th style={{ padding: "10px 16px", textAlign: "center" }}>Cantidad</th>
                    <th style={{ padding: "10px 16px", textAlign: "right" }}>Total ($ USD)</th>
                    <th style={{ padding: "10px 16px", textAlign: "right" }}>Total (Bs)</th>
                    <th style={{ padding: "10px 16px" }}>Método de Pago</th>
                    <th style={{ padding: "10px 16px" }}>Despachado Por</th>
                  </tr>
                </thead>
                <tbody>
                  {ventas.map((v) => (
                    <tr key={v.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                        {new Date(v.fecha).toLocaleString("es-VE", {
                          timeZone: "America/Caracas",
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td style={{ padding: "10px 16px", fontWeight: 800, color: "var(--text)" }}>
                        {v.sabor_nombre}
                        {v.notas && (
                          <span style={{ display: "block", fontSize: 11, fontWeight: 400, color: "var(--text-muted)" }}>
                            {v.notas}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "10px 16px", textAlign: "center", fontWeight: 900, color: "var(--primary-dark)" }}>
                        {v.cantidad}
                      </td>
                      <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 900, color: "var(--text)" }}>
                        ${Number(v.total_usd).toFixed(2)}
                      </td>
                      <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: "monospace", color: "var(--text-muted)" }}>
                        {Number(v.total_bs).toLocaleString("es-VE", { minimumFractionDigits: 2 })} Bs
                      </td>
                      <td style={{ padding: "10px 16px" }}>
                        <span style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "var(--bg-subtle)", color: "var(--text-muted)" }}>
                          {v.metodo_pago.replace("_", " ")}
                        </span>
                      </td>
                      <td style={{ padding: "10px 16px", color: "var(--text-muted)" }}>
                        {v.registrado_por || "Admin"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
