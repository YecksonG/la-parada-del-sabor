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
    <div className="min-h-screen pb-24 text-slate-800 dark:text-slate-100">
      {/* CABECERA PRINCIPAL */}
      <div className="border-b border-border bg-card/60 backdrop-blur px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold tracking-widest text-primary uppercase bg-primary/10 px-2.5 py-1 rounded">
                Módulo Especializado
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                Regla Oficial: 1x$0.80 • 2x$1.50
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-foreground mt-1">
              Tetas Cream • Inventario y Despacho
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Helados artesanales rellenos en freezer • Tasa BCV Oficial:{" "}
              <strong className="text-foreground">{tasaBcv.toFixed(2)} Bs/$</strong>
            </p>
          </div>

          {/* BOTONES DE ACCIÓN */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setModalAbastecer(true)}
              className="px-3.5 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-bold hover:bg-secondary/80 transition flex items-center gap-1.5 border border-border"
            >
              Abastecer Freezer
            </button>
            <button
              onClick={() => setModalNuevoSabor(true)}
              className="px-3.5 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-bold hover:bg-secondary/80 transition flex items-center gap-1.5 border border-border"
            >
              Nuevo Sabor
            </button>
            <button
              onClick={() => setModalVenta(true)}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-black hover:bg-primary/90 transition flex items-center gap-2 shadow-sm"
            >
              <span>Despachar Venta</span>
              {totalUnidades > 0 && (
                <span className="bg-primary-foreground text-primary text-[11px] font-black px-1.5 py-0.5 rounded-full">
                  {totalUnidades}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ALERTAS TEMPORALES */}
      {errorMsg && (
        <div className="max-w-7xl mx-auto px-6 mt-4">
          <div className="p-3 text-sm bg-destructive/15 text-destructive border border-destructive/30 rounded-lg font-medium">
            {errorMsg}
          </div>
        </div>
      )}
      {successMsg && (
        <div className="max-w-7xl mx-auto px-6 mt-4">
          <div className="p-3 text-sm bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 rounded-lg font-medium">
            {successMsg}
          </div>
        </div>
      )}

      {/* METRICAS DE RESUMEN DEL MES */}
      <div className="max-w-7xl mx-auto px-6 mt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-border bg-card">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Tetas Despachadas (Mes)</span>
            <div className="text-2xl font-black text-foreground mt-1">{metricas.unidadesMes}</div>
            <span className="text-[11px] text-muted-foreground">Unidades físicas salidas</span>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Ventas Brutas</span>
            <div className="text-2xl font-black text-foreground mt-1">${metricas.ventasMesUsd.toFixed(2)}</div>
            <span className="text-[11px] text-muted-foreground">~{(metricas.ventasMesUsd * tasaBcv).toLocaleString("es-VE", { maximumFractionDigits: 2 })} Bs</span>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Costo de Materia Prima</span>
            <div className="text-2xl font-black text-foreground mt-1">${metricas.costoMesUsd.toFixed(2)}</div>
            <span className="text-[11px] text-muted-foreground">Leche, frutas y rellenos</span>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Utilidad Estimada</span>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">${metricas.utilidadMesUsd.toFixed(2)}</div>
            <span className="text-[11px] text-muted-foreground">Margen neto del congelador</span>
          </div>
        </div>
      </div>

      {/* FILTROS Y BUSCADOR */}
      <div className="max-w-7xl mx-auto px-6 mt-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Tabs de Categorías */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
            {CATEGORIAS_TETAS.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategoriaFiltro(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                  categoriaFiltro === cat.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Buscador */}
          <div className="w-full md:w-64">
            <input
              type="text"
              placeholder="Buscar sabor..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>
      </div>

      {/* GRID DE SABORES Y FREEZER */}
      <div className="max-w-7xl mx-auto px-6 mt-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
          {saboresFiltrados.map((s) => {
            const stock = Number(s.stock_unidades) || 0;
            const agotado = stock <= 0;
            const enBandeja = bandeja.find((b) => b.saborId === s.id);

            return (
              <div
                key={s.id}
                className={`relative rounded-xl border p-3 flex flex-col justify-between transition-all bg-card ${
                  enBandeja
                    ? "border-primary ring-2 ring-primary/20 shadow-md"
                    : agotado
                    ? "border-border/50 opacity-60"
                    : "border-border hover:border-border/80 hover:shadow-sm"
                }`}
              >
                {/* Visual SVG de la bolsita artesanal */}
                <div className="flex justify-center py-2">
                  <TetaVisual sabor={s.sabor} categoria={s.categoria} size={56} />
                </div>

                {/* Info del Sabor */}
                <div className="text-center mt-1">
                  <h3 className="font-bold text-xs text-foreground leading-snug line-clamp-2 min-h-[32px]">
                    {s.sabor}
                  </h3>
                  <div className="flex items-center justify-center gap-1.5 mt-1.5">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        agotado
                          ? "bg-destructive/15 text-destructive"
                          : stock <= 3
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                          : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      }`}
                    >
                      {agotado ? "Agotado" : `${stock} en freezer`}
                    </span>
                  </div>
                </div>

                {/* Acciones de Bandeja */}
                <div className="mt-3 pt-2.5 border-t border-border/60">
                  {enBandeja ? (
                    <div className="flex items-center justify-between bg-muted rounded-lg p-1">
                      <button
                        onClick={() => cambiarCantidad(s.id, -1)}
                        className="w-6 h-6 rounded flex items-center justify-center font-black text-xs hover:bg-background transition"
                      >
                        -
                      </button>
                      <span className="text-xs font-black text-primary">{enBandeja.cantidad}</span>
                      <button
                        onClick={() => cambiarCantidad(s.id, 1)}
                        disabled={enBandeja.cantidad >= stock}
                        className="w-6 h-6 rounded flex items-center justify-center font-black text-xs hover:bg-background transition disabled:opacity-30"
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => agregarSabor(s.id, 1)}
                      disabled={agotado}
                      className="w-full py-1.5 text-xs font-bold rounded-lg bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {agotado ? "Sin stock" : "Agregar"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* BARRA FLOTANTE DE DESPACHO INMEDIATO (CUANDO HAY ITEMS) */}
      {bandeja.length > 0 && !modalVenta && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-foreground text-background dark:bg-card dark:text-foreground border border-border px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom-3 duration-200">
          <div>
            <div className="text-xs font-bold text-muted-foreground uppercase">
              Orden activa: {totalUnidades} {totalUnidades === 1 ? "teta" : "tetas"}
            </div>
            <div className="text-base font-black">
              ${totalUsd.toFixed(2)} USD{" "}
              <span className="text-xs text-muted-foreground font-normal">
                (~{totalBs.toLocaleString("es-VE", { minimumFractionDigits: 2 })} Bs)
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={limpiarBandeja}
              className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground transition"
            >
              Vaciar
            </button>
            <button
              onClick={() => setModalVenta(true)}
              className="text-xs font-black px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-sm"
            >
              Cobrar Ahora
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE DESPACHO Y COBRO */}
      {modalVenta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h2 className="text-lg font-black text-foreground">Despachar Tetas Cream</h2>
              <button
                onClick={() => setModalVenta(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={handleRegistrarVenta} className="mt-4 space-y-4">
              {/* LISTA DE ITEMS EN BANDEJA */}
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase block mb-2">
                  Sabores en la orden ({totalUnidades} unidades):
                </label>
                {bandeja.length === 0 ? (
                  <div className="p-4 text-center border border-dashed border-border rounded-xl text-xs text-muted-foreground">
                    No has agregado ningún sabor a la orden.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {bandeja.map((it) => {
                      const s = saboresMap.get(it.saborId);
                      const stock = Number(s?.stock_unidades) || 0;
                      return (
                        <div
                          key={it.saborId}
                          className="flex items-center justify-between p-2 rounded-lg border border-border bg-muted/40"
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <TetaVisual sabor={s?.sabor || ""} categoria={s?.categoria || ""} size={28} />
                            <div className="truncate">
                              <span className="text-xs font-bold text-foreground block truncate">{s?.sabor}</span>
                              <span className="text-[10px] text-muted-foreground">{stock} disp.</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => cambiarCantidad(it.saborId, -1)}
                              className="w-6 h-6 rounded bg-card border border-border flex items-center justify-center text-xs font-black"
                            >
                              -
                            </button>
                            <span className="text-xs font-black text-primary px-1">{it.cantidad}</span>
                            <button
                              type="button"
                              onClick={() => cambiarCantidad(it.saborId, 1)}
                              disabled={it.cantidad >= stock}
                              className="w-6 h-6 rounded bg-card border border-border flex items-center justify-center text-xs font-black disabled:opacity-30"
                            >
                              +
                            </button>
                            <button
                              type="button"
                              onClick={() => removerSabor(it.saborId)}
                              className="text-[11px] text-destructive hover:underline ml-1"
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

              {/* TOTAL CON DESGLOSE DE PROMO */}
              <div className="p-3.5 rounded-xl border border-border bg-muted/20 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-muted-foreground uppercase block">
                    Total Calculado ({totalUnidades} tetas)
                  </span>
                  <span className="text-[11px] text-primary font-medium">
                    {paresPromo > 0 ? `${paresPromo} par(es) combo ($1.50 c/u) ` : ""}
                    {sueltasPromo > 0 ? `+ ${sueltasPromo} suelta ($0.80)` : ""}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-xl font-black text-foreground">${totalUsd.toFixed(2)} USD</div>
                  <div className="text-xs font-bold text-muted-foreground">
                    ~{totalBs.toLocaleString("es-VE", { minimumFractionDigits: 2 })} Bs
                  </div>
                </div>
              </div>

              {/* MÉTODO DE PAGO */}
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1.5">Método de Pago</label>
                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-lg border border-border bg-background font-semibold"
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
                <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                        Método Divisas:
                      </label>
                      <select
                        value={mixtoUsdMetodo}
                        onChange={(e) => setMixtoUsdMetodo(e.target.value as MetodoPagoFraccion)}
                        className="w-full p-2 text-xs rounded-lg border border-border bg-background"
                      >
                        <option value="efectivo_usd">Efectivo USD</option>
                        <option value="zelle">Zelle USD</option>
                        <option value="binance">Binance USDT</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                        Monto USD:
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Ej. 1.00"
                        value={mixtoUsdMonto}
                        onChange={(e) => setMixtoUsdMonto(e.target.value)}
                        className="w-full p-2 text-xs rounded-lg border border-border bg-background"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                      Método para el Restante en Bs:
                    </label>
                    <select
                      value={mixtoBsMetodo}
                      onChange={(e) => setMixtoBsMetodo(e.target.value as MetodoPagoFraccion)}
                      className="w-full p-2 text-xs rounded-lg border border-border bg-background"
                    >
                      <option value="pago_movil">Pago Móvil (Bs)</option>
                      <option value="efectivo_bs">Efectivo (Bs)</option>
                      <option value="punto">Punto de Venta (Bs)</option>
                    </select>
                  </div>

                  {parseFloat(mixtoUsdMonto) > 0 && parseFloat(mixtoUsdMonto) < totalUsd && (
                    <p className="text-[11px] text-muted-foreground font-medium pt-1">
                      Restante en Bs: ~$
                      {(totalUsd - parseFloat(mixtoUsdMonto)).toFixed(2)} USD (
                      {((totalUsd - parseFloat(mixtoUsdMonto)) * tasaBcv).toFixed(2)} Bs)
                    </p>
                  )}
                </div>
              )}

              {/* CRÉDITO */}
              {metodoPago === "credito" && (
                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">Nombre del Deudor / Cliente</label>
                  <input
                    type="text"
                    placeholder="Ej. Vecino Carlos / Familia González"
                    value={clienteCredito}
                    onChange={(e) => setClienteCredito(e.target.value)}
                    className="w-full p-2 text-xs rounded-lg border border-border bg-background"
                  />
                </div>
              )}

              {/* NOTAS */}
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">Notas opcionales</label>
                <input
                  type="text"
                  placeholder="Ej. Pago con billete de $5, vuelto entregado"
                  value={notasVenta}
                  onChange={(e) => setNotasVenta(e.target.value)}
                  className="w-full p-2 text-xs rounded-lg border border-border bg-background"
                />
              </div>

              {/* BOTÓN CONFIRMAR */}
              <button
                type="submit"
                disabled={isPending || totalUnidades === 0}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-black text-sm hover:bg-primary/90 transition shadow-md disabled:opacity-40"
              >
                {isPending ? "Asentando venta..." : `Confirmar Cobro ($${totalUsd.toFixed(2)} USD)`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ABASTECER FREEZER */}
      {modalAbastecer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h2 className="text-lg font-black text-foreground mb-4">Abastecer Stock en Freezer</h2>
            <form onSubmit={handleAbastecer} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">Sabor a Recargar</label>
                <select
                  value={abastecerSaborId}
                  onChange={(e) => setAbastecerSaborId(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-lg border border-border bg-background font-semibold"
                >
                  {inventario.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.sabor} (Stock actual: {s.stock_unidades})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">Cantidad Producida (Unidades)</label>
                <input
                  type="number"
                  min="1"
                  value={abastecerCantidad}
                  onChange={(e) => setAbastecerCantidad(e.target.value)}
                  className="w-full p-2 text-xs rounded-lg border border-border bg-background"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">Costo Unitario de Producción ($ USD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={abastecerCosto}
                  onChange={(e) => setAbastecerCosto(e.target.value)}
                  className="w-full p-2 text-xs rounded-lg border border-border bg-background"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="chkGasto"
                  checked={abastecerRegistrarGasto}
                  onChange={(e) => setAbastecerRegistrarGasto(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <label htmlFor="chkGasto" className="text-xs text-muted-foreground font-medium">
                  Registrar costo total en gastos del negocio
                </label>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalAbastecer(false)}
                  className="flex-1 py-2 text-xs font-bold rounded-lg border border-border text-muted-foreground hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 py-2 text-xs font-black rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h2 className="text-lg font-black text-foreground mb-4">Incorporar Nuevo Sabor</h2>
            <form onSubmit={handleNuevoSabor} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">Nombre del Sabor</label>
                <input
                  type="text"
                  placeholder="Ej. Parchita con Chocolate"
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  className="w-full p-2 text-xs rounded-lg border border-border bg-background"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">Categoría</label>
                <select
                  value={nuevoCategoria}
                  onChange={(e) => setNuevoCategoria(e.target.value as TetasCategoria)}
                  className="w-full p-2 text-xs rounded-lg border border-border bg-background"
                >
                  <option value="con_chocolate">Con Chocolate & Especiales</option>
                  <option value="linea_yogurt">Línea Yogurt</option>
                  <option value="yogurt_combinado">Yogurt Combinado</option>
                  <option value="combinadas">Combinadas</option>
                  <option value="clasicas">Clásicas</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">Costo ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={nuevoCosto}
                    onChange={(e) => setNuevoCosto(e.target.value)}
                    className="w-full p-2 text-xs rounded-lg border border-border bg-background"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">Precio ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={nuevoPrecio}
                    onChange={(e) => setNuevoPrecio(e.target.value)}
                    className="w-full p-2 text-xs rounded-lg border border-border bg-background"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">Stock Inicial</label>
                  <input
                    type="number"
                    value={nuevoStock}
                    onChange={(e) => setNuevoStock(e.target.value)}
                    className="w-full p-2 text-xs rounded-lg border border-border bg-background"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalNuevoSabor(false)}
                  className="flex-1 py-2 text-xs font-bold rounded-lg border border-border text-muted-foreground hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 py-2 text-xs font-black rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isPending ? "Guardando..." : "Crear Sabor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HISTORIAL RECIENTE DE DESPACHOS */}
      <div className="max-w-7xl mx-auto px-6 mt-12">
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
          Últimos Despachos de Tetas ({ventas.length} registros)
        </h2>
        <div className="border border-border rounded-xl overflow-hidden bg-card">
          {ventas.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Aún no se han registrado despachos de tetas en esta instancia.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-4">Fecha y Hora</th>
                    <th className="py-2.5 px-4">Sabor</th>
                    <th className="py-2.5 px-4 text-center">Cantidad</th>
                    <th className="py-2.5 px-4 text-right">Total ($ USD)</th>
                    <th className="py-2.5 px-4 text-right">Total (Bs)</th>
                    <th className="py-2.5 px-4">Método de Pago</th>
                    <th className="py-2.5 px-4">Despachado Por</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {ventas.map((v) => (
                    <tr key={v.id} className="hover:bg-muted/20 transition">
                      <td className="py-2.5 px-4 font-mono text-muted-foreground whitespace-nowrap">
                        {new Date(v.fecha).toLocaleString("es-VE", {
                          timeZone: "America/Caracas",
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-foreground">
                        {v.sabor_nombre}
                        {v.notas && (
                          <span className="block text-[10px] text-muted-foreground font-normal truncate max-w-xs">
                            {v.notas}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-center font-bold text-primary">
                        {v.cantidad}
                      </td>
                      <td className="py-2.5 px-4 text-right font-black text-foreground">
                        ${Number(v.total_usd).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-muted-foreground font-mono">
                        {Number(v.total_bs).toLocaleString("es-VE", { minimumFractionDigits: 2 })} Bs
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-muted text-muted-foreground">
                          {v.metodo_pago.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-muted-foreground">
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
