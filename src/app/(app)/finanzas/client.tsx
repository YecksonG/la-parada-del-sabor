"use client";

import { useState, useMemo, useTransition, useEffect } from "react";
import {
  FinanzasEntidad,
  TetasInventario,
  TetasVenta,
  FinanzasMovimiento,
  FinanzasPrestamo,
  FinanzasEntidadId,
} from "@/types/database";
import {
  registrarVentaTetaAction,
  abastecerStockTetasAction,
  crearSaborTetaAction,
  registrarMovimientoFinanzasAction,
  registrarPrestamoAction,
  abonarPrestamoAction,
} from "./actions";
import { sounds } from "@/lib/sound-effects";

// =============================================================================
// ICONOS SVG MINIMALISTAS (CERO EMOJIS EN INTERFAZ — REGLA 5 AGENTS.MD)
// =============================================================================

function IconPlus() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function IconTrendingUp() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function IconTrendingDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
      <polyline points="17 18 23 18 23 12" />
    </svg>
  );
}

function IconLayers() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function IconPackage() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconCoins() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="8" r="6" />
      <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
      <path d="M7 6h1v4" />
      <path d="M16 12h1v3" />
    </svg>
  );
}

function IconCreditCard() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

// =============================================================================
// PROPS & TIPOS DEL CLIENTE
// =============================================================================

interface FinanzasClientProps {
  entidades: FinanzasEntidad[];
  tetasInventario: TetasInventario[];
  tetasVentas: TetasVenta[];
  movimientos: FinanzasMovimiento[];
  prestamos: FinanzasPrestamo[];
  paradaMetrics: {
    ventasMesUsd: number;
    gastosMesUsd: number;
    margenNetoUsd: number;
  };
  mesMetrics: {
    ventasTetasMesUsd: number;
    costoTetasMesUsd: number;
    gananciaTetasMesUsd: number;
    ingresosPersonalesMesUsd: number;
    gastosPersonalesMesUsd: number;
  };
  tasaBcv: number;
  tablasListas: boolean;
}

type TabFinanzas = "consolidado" | "tetas" | "personales" | "prestamos";

export default function FinanzasClient({
  entidades,
  tetasInventario,
  tetasVentas,
  movimientos,
  prestamos,
  paradaMetrics,
  mesMetrics,
  tasaBcv,
  tablasListas,
}: FinanzasClientProps) {
  const [tabActiva, setTabActiva] = useState<TabFinanzas>("consolidado");
  const [isPending, startTransition] = useTransition();

  // Estados de Modales
  const [modalQuickLogger, setModalQuickLogger] = useState(false);
  const [modalVentaTeta, setModalVentaTeta] = useState(false);
  const [modalAbastecerTeta, setModalAbastecerTeta] = useState(false);
  const [modalNuevoSabor, setModalNuevoSabor] = useState(false);
  const [modalMovimiento, setModalMovimiento] = useState(false);
  const [modalPrestamo, setModalPrestamo] = useState(false);
  const [modalAbono, setModalAbono] = useState<FinanzasPrestamo | null>(null);

  // Estados para Venta de Tetas
  const [saborSeleccionadoId, setSaborSeleccionadoId] = useState<string>(
    tetasInventario[0]?.id || ""
  );
  const [cantidadVentaTeta, setCantidadVentaTeta] = useState<number>(1);
  const [metodoPagoTeta, setMetodoPagoTeta] = useState<string>("efectivo_usd");
  const [notasVentaTeta, setNotasVentaTeta] = useState<string>("");

  // Estados para Abastecimiento con precarga del sabor actual
  const [abastecerSaborId, setAbastecerSaborId] = useState<string>(
    tetasInventario[0]?.id || ""
  );
  const [abastecerCantidad, setAbastecerCantidad] = useState<string>("10");
  const [abastecerCosto, setAbastecerCosto] = useState<string>(
    tetasInventario[0]?.costo_compra_unitario_usd
      ? Number(tetasInventario[0].costo_compra_unitario_usd).toFixed(2)
      : "0.50"
  );
  const [abastecerPrecio, setAbastecerPrecio] = useState<string>(
    tetasInventario[0]?.precio_venta_unitario_usd
      ? Number(tetasInventario[0].precio_venta_unitario_usd).toFixed(2)
      : "1.00"
  );

  // Estados para Nuevo Sabor
  const [nuevoSaborNombre, setNuevoSaborNombre] = useState<string>("");
  const [nuevoSaborCosto, setNuevoSaborCosto] = useState<string>("0.50");
  const [nuevoSaborPrecio, setNuevoSaborPrecio] = useState<string>("1.00");
  const [nuevoSaborStock, setNuevoSaborStock] = useState<string>("0");

  // Estados para Movimiento Personal / Side Hustle
  const [movEntidadId, setMovEntidadId] = useState<FinanzasEntidadId>("esposa");
  const [movTipo, setMovTipo] = useState<"ingreso" | "gasto">("ingreso");
  const [movCategoria, setMovCategoria] = useState<string>("side_hustle");
  const [movDescripcion, setMovDescripcion] = useState<string>("");
  const [movMontoUsd, setMovMontoUsd] = useState<string>("");
  const [movMontoBs, setMovMontoBs] = useState<string>("");
  const [movRecurrente, setMovRecurrente] = useState<boolean>(false);
  const [movFrecuencia, setMovFrecuencia] = useState<"quincenal" | "mensual" | "semanal">("mensual");
  const [movMetodoPago, setMovMetodoPago] = useState<string>("pago_movil");

  // Estados para Préstamo
  const [prestamoOrigenTipo, setPrestamoOrigenTipo] = useState<"entidad_interna" | "tercero_familiar">("entidad_interna");
  const [prestamoOrigenEntidadId, setPrestamoOrigenEntidadId] = useState<string>("tetas");
  const [prestamoOrigenNombre, setPrestamoOrigenNombre] = useState<string>("Tetas Rellenas");
  const [prestamoDestinoTipo, setPrestamoDestinoTipo] = useState<"entidad_interna" | "tercero_familiar">("entidad_interna");
  const [prestamoDestinoEntidadId, setPrestamoDestinoEntidadId] = useState<string>("parada");
  const [prestamoDestinoNombre, setPrestamoDestinoNombre] = useState<string>("La Parada del Sabor");
  const [prestamoMontoUsd, setPrestamoMontoUsd] = useState<string>("");
  const [prestamoConcepto, setPrestamoConcepto] = useState<string>("");
  const [prestamoNotas, setPrestamoNotas] = useState<string>("");

  // Estados para Abono
  const [abonoMontoUsd, setAbonoMontoUsd] = useState<string>("");
  const [abonoMetodoPago, setAbonoMetodoPago] = useState<string>("efectivo_usd");
  const [abonoNotas, setAbonoNotas] = useState<string>("");

  // Filtro de Espacios Personales
  const [subfiltroPersonal, setSubfiltroPersonal] = useState<"todos" | "esposa" | "yg" | "hogar">("todos");

  // Mensaje de Notificación o Error
  const [feedback, setFeedback] = useState<{ tipo: "ok" | "err"; msg: string } | null>(null);

  // Escuchar tecla Escape para cerrar modales y no atrapar el foco
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModalQuickLogger(false);
        setModalVentaTeta(false);
        setModalAbastecerTeta(false);
        setModalNuevoSabor(false);
        setModalMovimiento(false);
        setModalPrestamo(false);
        setModalAbono(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const mostrarMensaje = (tipo: "ok" | "err", msg: string) => {
    setFeedback({ tipo, msg });
    if (tipo === "ok") {
      sounds.playSuccess();
    } else {
      sounds.playDelete();
    }
    const timer = setTimeout(() => setFeedback(null), 5000);
    return () => clearTimeout(timer);
  };

  // Precargar costo y precio al seleccionar un sabor para reabastecimiento
  const cambiarSaborAbastecer = (saborId: string) => {
    setAbastecerSaborId(saborId);
    const sabor = tetasInventario.find((s) => s.id === saborId);
    if (sabor) {
      setAbastecerCosto(Number(sabor.costo_compra_unitario_usd).toFixed(2));
      setAbastecerPrecio(Number(sabor.precio_venta_unitario_usd).toFixed(2));
    }
  };

  // Sincronización dual USD <-> Bs
  const handleCambioMovUsd = (val: string) => {
    setMovMontoUsd(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0 && tasaBcv > 0) {
      setMovMontoBs((num * tasaBcv).toFixed(2));
    } else {
      setMovMontoBs("");
    }
  };

  const handleCambioMovBs = (val: string) => {
    setMovMontoBs(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0 && tasaBcv > 0) {
      setMovMontoUsd((num / tasaBcv).toFixed(2));
    } else {
      setMovMontoUsd("");
    }
  };

  // =============================================================================
  // CÁLCULOS Y MÉTRICAS DERIVADAS
  // =============================================================================

  // 1. Métricas de Tetas Rellenas (Totales Históricos)
  const totalTetasVendidas = useMemo(
    () => tetasVentas.reduce((acc, v) => acc + (Number(v.cantidad) || 0), 0),
    [tetasVentas]
  );
  const ventasTetasHistoricasUsd = useMemo(
    () => tetasVentas.reduce((acc, v) => acc + (Number(v.total_usd) || 0), 0),
    [tetasVentas]
  );
  const stockTotalTetas = useMemo(
    () => tetasInventario.reduce((acc, t) => acc + (Number(t.stock_unidades) || 0), 0),
    [tetasInventario]
  );

  // 2. Préstamos Activos
  const prestamosActivos = useMemo(
    () => prestamos.filter((p) => p.estado === "activo"),
    [prestamos]
  );
  const totalDeudasPendientesUsd = useMemo(
    () =>
      prestamosActivos.reduce(
        (acc, p) => acc + (Number(p.saldo_pendiente_usd) || 0),
        0
      ),
    [prestamosActivos]
  );

  // 3. Consolidado del Período Mensual Exacto (Sin truncamiento ni mezclas)
  const ingresosConsolidadosMesUsd =
    paradaMetrics.ventasMesUsd +
    mesMetrics.ventasTetasMesUsd +
    mesMetrics.ingresosPersonalesMesUsd;

  const gastosConsolidadosMesUsd =
    paradaMetrics.gastosMesUsd +
    mesMetrics.costoTetasMesUsd +
    mesMetrics.gastosPersonalesMesUsd;

  const flujoNetoConsolidadoMesUsd =
    ingresosConsolidadosMesUsd - gastosConsolidadosMesUsd;

  // =============================================================================
  // HANDLERS DE ACCIONES DEL USUARIO
  // =============================================================================

  const handleVentaTeta = () => {
    if (!saborSeleccionadoId) {
      mostrarMensaje("err", "Selecciona un sabor de teta.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await registrarVentaTetaAction({
          sabor_id: saborSeleccionadoId,
          cantidad: cantidadVentaTeta,
          metodo_pago: metodoPagoTeta,
          tasa_bcv: tasaBcv,
          notas: notasVentaTeta,
        });

        if (res.ok) {
          mostrarMensaje("ok", `Venta registrada: $${res.totalUsd?.toFixed(2)} (${res.totalBs?.toFixed(2)} Bs)`);
          setModalVentaTeta(false);
          setModalQuickLogger(false);
          setNotasVentaTeta("");
          setCantidadVentaTeta(1);
        } else {
          mostrarMensaje("err", res.error || "Error al registrar la venta.");
        }
      } catch (err: any) {
        mostrarMensaje("err", err?.message || "Error al procesar la venta.");
      }
    });
  };

  const handleVentaTetaDirecta = (saborId: string, cantidad: number) => {
    sounds.playPop();
    startTransition(async () => {
      try {
        const res = await registrarVentaTetaAction({
          sabor_id: saborId,
          cantidad,
          metodo_pago: "efectivo_usd",
          tasa_bcv: tasaBcv,
        });

        if (res.ok) {
          mostrarMensaje("ok", `+${cantidad} teta vendida ($${res.totalUsd?.toFixed(2)})`);
        } else {
          mostrarMensaje("err", res.error || "No se pudo registrar.");
        }
      } catch (err: any) {
        mostrarMensaje("err", err?.message || "Error al registrar.");
      }
    });
  };

  const handleAbastecerTeta = () => {
    const cant = parseInt(abastecerCantidad);
    if (isNaN(cant) || cant <= 0) {
      mostrarMensaje("err", "Ingresa una cantidad válida mayor a 0.");
      return;
    }
    const c = parseFloat(abastecerCosto);
    const p = parseFloat(abastecerPrecio);

    startTransition(async () => {
      try {
        const res = await abastecerStockTetasAction({
          sabor_id: abastecerSaborId,
          cantidad_ingresada: cant,
          costo_compra_unitario_usd: !isNaN(c) && c > 0 ? c : undefined,
          precio_venta_unitario_usd: !isNaN(p) && p > 0 ? p : undefined,
        });

        if (res.ok) {
          mostrarMensaje("ok", `Freezer actualizado: nuevo stock de ${res.nuevoStock} unidades.`);
          setModalAbastecerTeta(false);
        } else {
          mostrarMensaje("err", res.error || "Error al abastecer.");
        }
      } catch (err: any) {
        mostrarMensaje("err", err?.message || "Error al abastecer.");
      }
    });
  };

  const handleCrearNuevoSabor = () => {
    if (!nuevoSaborNombre.trim()) {
      mostrarMensaje("err", "El nombre del sabor no puede estar en blanco.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await crearSaborTetaAction(
          nuevoSaborNombre.trim(),
          parseFloat(nuevoSaborCosto) || 0.5,
          parseFloat(nuevoSaborPrecio) || 1.0,
          parseInt(nuevoSaborStock) || 0
        );

        if (res.ok) {
          mostrarMensaje("ok", `Sabor "${nuevoSaborNombre.trim()}" agregado al catálogo.`);
          setModalNuevoSabor(false);
          setNuevoSaborNombre("");
        } else {
          mostrarMensaje("err", res.error || "Error al crear sabor.");
        }
      } catch (err: any) {
        mostrarMensaje("err", err?.message || "Error al crear sabor.");
      }
    });
  };

  const handleGuardarMovimiento = () => {
    const usd = parseFloat(movMontoUsd);
    if (isNaN(usd) || usd <= 0) {
      mostrarMensaje("err", "Ingresa un monto válido mayor a 0.");
      return;
    }
    if (!movDescripcion.trim()) {
      mostrarMensaje("err", "Ingresa una descripción del movimiento.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await registrarMovimientoFinanzasAction({
          entidad_id: movEntidadId,
          tipo: movTipo,
          categoria: movCategoria,
          descripcion: movDescripcion.trim(),
          monto_usd: usd,
          tasa_bcv: tasaBcv,
          metodo_pago: movMetodoPago,
          recurrente: movRecurrente,
          frecuencia: movRecurrente ? movFrecuencia : undefined,
        });

        if (res.ok) {
          mostrarMensaje("ok", "Movimiento guardado exitosamente.");
          setModalMovimiento(false);
          setModalQuickLogger(false);
          setMovDescripcion("");
          setMovMontoUsd("");
          setMovMontoBs("");
        } else {
          mostrarMensaje("err", res.error || "Error al registrar movimiento.");
        }
      } catch (err: any) {
        mostrarMensaje("err", err?.message || "Error al registrar.");
      }
    });
  };

  const handleGuardarPrestamo = () => {
    const usd = parseFloat(prestamoMontoUsd);
    if (isNaN(usd) || usd <= 0) {
      mostrarMensaje("err", "Ingresa un monto de préstamo mayor a 0.");
      return;
    }
    if (!prestamoConcepto.trim()) {
      mostrarMensaje("err", "Ingresa el concepto o motivo del préstamo.");
      return;
    }
    if (
      prestamoOrigenTipo === "entidad_interna" &&
      prestamoDestinoTipo === "entidad_interna" &&
      prestamoOrigenEntidadId === prestamoDestinoEntidadId
    ) {
      mostrarMensaje("err", "El origen y el destino no pueden ser la misma entidad.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await registrarPrestamoAction({
          origen_tipo: prestamoOrigenTipo,
          origen_entidad_id: prestamoOrigenTipo === "entidad_interna" ? prestamoOrigenEntidadId : undefined,
          origen_nombre: prestamoOrigenNombre.trim(),
          destino_tipo: prestamoDestinoTipo,
          destino_entidad_id: prestamoDestinoTipo === "entidad_interna" ? prestamoDestinoEntidadId : undefined,
          destino_nombre: prestamoDestinoNombre.trim(),
          monto_usd: usd,
          tasa_bcv: tasaBcv,
          concepto: prestamoConcepto.trim(),
          notas: prestamoNotas.trim() || undefined,
        });

        if (res.ok) {
          mostrarMensaje("ok", "Préstamo registrado en matriz.");
          setModalPrestamo(false);
          setModalQuickLogger(false);
          setPrestamoMontoUsd("");
          setPrestamoConcepto("");
          setPrestamoNotas("");
        } else {
          mostrarMensaje("err", res.error || "Error al registrar préstamo.");
        }
      } catch (err: any) {
        mostrarMensaje("err", err?.message || "Error al registrar préstamo.");
      }
    });
  };

  const handleGuardarAbono = () => {
    if (!modalAbono) return;
    const usd = parseFloat(abonoMontoUsd);
    if (isNaN(usd) || usd <= 0) {
      mostrarMensaje("err", "Ingresa un monto de abono mayor a 0.");
      return;
    }
    if (usd > Number(modalAbono.saldo_pendiente_usd)) {
      mostrarMensaje("err", `El abono no puede superar el saldo pendiente ($${Number(modalAbono.saldo_pendiente_usd).toFixed(2)}).`);
      return;
    }

    startTransition(async () => {
      try {
        const res = await abonarPrestamoAction({
          prestamo_id: modalAbono.id,
          monto_usd: usd,
          tasa_bcv: tasaBcv,
          metodo_pago: abonoMetodoPago,
          notas: abonoNotas.trim() || undefined,
        });

        if (res.ok) {
          mostrarMensaje("ok", `Abono de $${usd.toFixed(2)} aplicado exitosamente.`);
          setModalAbono(null);
          setAbonoMontoUsd("");
          setAbonoNotas("");
        } else {
          mostrarMensaje("err", res.error || "Error al abonar.");
        }
      } catch (err: any) {
        mostrarMensaje("err", err?.message || "Error al procesar abono.");
      }
    });
  };

  // Movimientos filtrados para la pestaña personal
  const movimientosFiltrados = useMemo(() => {
    if (subfiltroPersonal === "todos") {
      return movimientos.filter((m) => m.entidad_id !== "parada" && m.entidad_id !== "tetas");
    }
    return movimientos.filter((m) => m.entidad_id === subfiltroPersonal);
  }, [movimientos, subfiltroPersonal]);

  return (
    <main className="recetas-container" style={{ maxWidth: 1360, margin: "0 auto", padding: "20px 24px" }}>
      {/* Mensaje flotante de feedback */}
      {feedback && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 9999,
            padding: "12px 20px",
            borderRadius: 14,
            background: feedback.tipo === "ok" ? "#10b981" : "#ef4444",
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          {feedback.tipo === "ok" ? <IconCheck /> : <IconX />}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* Alerta si las tablas de Supabase aún no se han creado en la BD */}
      {!tablasListas && (
        <div
          style={{
            padding: "16px 20px",
            marginBottom: 20,
            borderRadius: 16,
            background: "rgba(245, 158, 11, 0.12)",
            border: "1px solid #f59e0b",
            color: "var(--text)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800, fontSize: 15, color: "#d97706" }}>
            <span>Aviso de Inicialización</span>
          </div>
          <p style={{ marginTop: 6, fontSize: 13, color: "var(--text-muted)", margin: "4px 0 0 0" }}>
            Las tablas de finanzas familiares en Supabase están pendientes de ejecución en el SQL Editor. La interfaz se encuentra en modo interactivo previo a la migración.
          </p>
        </div>
      )}

      {/* HEADER PRINCIPAL */}
      <div className="recetas-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="recetas-title" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ color: "var(--primary)" }}><IconCoins /></span>
            <span>Hub Financiero Familiar & Negocios</span>
          </h1>
          <p className="recetas-subtitle">
            Comando ejecutivo unificado: La Parada del Sabor, Tetas Rellenas, finanzas personales y préstamos cruzados.
          </p>

          {/* SELECTOR DE PESTAÑAS PRINCIPALES */}
          <div className="view-mode-toggle" style={{ marginTop: 16 }}>
            <button
              type="button"
              onClick={() => {
                sounds.playPop();
                setTabActiva("consolidado");
              }}
              className={`view-mode-btn ${tabActiva === "consolidado" ? "active" : ""}`}
            >
              <IconLayers /> Consolidado General
            </button>
            <button
              type="button"
              onClick={() => {
                sounds.playPop();
                setTabActiva("tetas");
              }}
              className={`view-mode-btn ${tabActiva === "tetas" ? "active" : ""}`}
            >
              <IconPackage /> Tetas Rellenas ({stockTotalTetas} en freezer)
            </button>
            <button
              type="button"
              onClick={() => {
                sounds.playPop();
                setTabActiva("personales");
              }}
              className={`view-mode-btn ${tabActiva === "personales" ? "active" : ""}`}
            >
              <IconUser /> Espacios Personales & Side Hustles
            </button>
            <button
              type="button"
              onClick={() => {
                sounds.playPop();
                setTabActiva("prestamos");
              }}
              className={`view-mode-btn ${tabActiva === "prestamos" ? "active" : ""}`}
            >
              <IconCreditCard /> Préstamos & Deudas ({prestamosActivos.length})
            </button>
          </div>
        </div>

        {/* BOTONES DE ACCIÓN RÁPIDA SUPERIOR */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              sounds.playPop();
              setModalQuickLogger(true);
            }}
            className="btn-primary-action"
            style={{
              padding: "10px 18px",
              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
              border: "none",
              color: "#fff",
              fontWeight: 800,
              boxShadow: "0 4px 14px rgba(37,99,235,0.35)",
            }}
          >
            <IconPlus /> Registro Rápido Móvil
          </button>

          {tabActiva === "tetas" && (
            <>
              <button
                type="button"
                onClick={() => {
                  sounds.playPop();
                  setModalAbastecerTeta(true);
                }}
                className="btn-refresh-action"
              >
                Reabastecer Freezer
              </button>
              <button
                type="button"
                onClick={() => {
                  sounds.playPop();
                  setModalNuevoSabor(true);
                }}
                className="btn-refresh-action"
              >
                + Nuevo Sabor
              </button>
            </>
          )}

          {tabActiva === "personales" && (
            <button
              type="button"
              onClick={() => {
                sounds.playPop();
                setModalMovimiento(true);
              }}
              className="btn-refresh-action"
            >
              + Registrar Movimiento / Trabajo
            </button>
          )}

          {tabActiva === "prestamos" && (
            <button
              type="button"
              onClick={() => {
                sounds.playPop();
                setModalPrestamo(true);
              }}
              className="btn-refresh-action"
            >
              + Nuevo Préstamo
            </button>
          )}
        </div>
      </div>

      {/* =======================================================================
          TAB 1: CONSOLIDADO GENERAL (FAMILIAR & NEGOCIOS)
          ======================================================================= */}
      {tabActiva === "consolidado" && (
        <section>
          {/* Tarjetas KPI de Primer Nivel */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 24 }}>
            <div className="product-kpi-card" style={{ padding: "18px 20px", borderRadius: 20, border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span className="product-kpi-label" style={{ color: "#10b981", display: "flex", alignItems: "center", gap: 6 }}>
                  <IconTrendingUp /> Ingresos Totales del Mes
                </span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "var(--text)" }}>
                ${ingresosConsolidadosMesUsd.toFixed(2)} <span style={{ fontSize: 13, fontWeight: 600 }}>USD</span>
              </div>
              <div className="product-kpi-sub" style={{ marginTop: 4 }}>
                Bs. {(ingresosConsolidadosMesUsd * tasaBcv).toFixed(2)} (Tasa: {tasaBcv.toFixed(2)})
              </div>
            </div>

            <div className="product-kpi-card" style={{ padding: "18px 20px", borderRadius: 20, border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span className="product-kpi-label" style={{ color: "#ef4444", display: "flex", alignItems: "center", gap: 6 }}>
                  <IconTrendingDown /> Gastos y Costos Totales
                </span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "var(--text)" }}>
                ${gastosConsolidadosMesUsd.toFixed(2)} <span style={{ fontSize: 13, fontWeight: 600 }}>USD</span>
              </div>
              <div className="product-kpi-sub" style={{ marginTop: 4 }}>
                Bs. {(gastosConsolidadosMesUsd * tasaBcv).toFixed(2)}
              </div>
            </div>

            <div className="product-kpi-card" style={{ padding: "18px 20px", borderRadius: 20, border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span className="product-kpi-label" style={{ color: flujoNetoConsolidadoMesUsd >= 0 ? "#10b981" : "#ef4444" }}>
                  Flujo Neto Familiar
                </span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: flujoNetoConsolidadoMesUsd >= 0 ? "#10b981" : "#ef4444" }}>
                ${flujoNetoConsolidadoMesUsd.toFixed(2)} <span style={{ fontSize: 13, fontWeight: 600 }}>USD</span>
              </div>
              <div className="product-kpi-sub" style={{ marginTop: 4 }}>
                {flujoNetoConsolidadoMesUsd >= 0 ? "Superávit neto del período mensual" : "Déficit del período mensual"}
              </div>
            </div>

            <div className="product-kpi-card" style={{ padding: "18px 20px", borderRadius: 20, border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span className="product-kpi-label" style={{ color: "#8b5cf6" }}>
                  Deudas Pendientes
                </span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "var(--text)" }}>
                ${totalDeudasPendientesUsd.toFixed(2)} <span style={{ fontSize: 13, fontWeight: 600 }}>USD</span>
              </div>
              <div className="product-kpi-sub" style={{ marginTop: 4 }}>
                {prestamosActivos.length} préstamos activos
              </div>
            </div>
          </div>

          {/* Desglose de los 4 Motores Financieros */}
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 14, color: "var(--text)" }}>
            Desglose por Motores Financieros (Mes en Curso)
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {/* Motor 1: La Parada del Sabor */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, padding: 22, boxShadow: "var(--shadow-sm)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: "#f59e0b" }}>
                    La Parada del Sabor
                  </h3>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Negocio Gastronómico Principal</span>
                </div>
                <span style={{ padding: "4px 10px", borderRadius: 12, background: "rgba(245,158,11,0.12)", color: "#f59e0b", fontSize: 11, fontWeight: 700 }}>
                  Activo
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Ventas del mes:</span>
                  <strong>${paradaMetrics.ventasMesUsd.toFixed(2)} USD</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Gastos operativos:</span>
                  <span style={{ color: "#ef4444" }}>-${paradaMetrics.gastosMesUsd.toFixed(2)} USD</span>
                </div>
                <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }}></div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15 }}>
                  <span style={{ fontWeight: 700 }}>Margen Neto:</span>
                  <strong style={{ color: paradaMetrics.margenNetoUsd >= 0 ? "#10b981" : "#ef4444" }}>
                    ${paradaMetrics.margenNetoUsd.toFixed(2)} USD
                  </strong>
                </div>
              </div>
            </div>

            {/* Motor 2: Tetas Rellenas */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, padding: 22, boxShadow: "var(--shadow-sm)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: "#ec4899" }}>
                    Tetas Rellenas (Helados)
                  </h3>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Micro-unidad de Venta Rápida</span>
                </div>
                <span style={{ padding: "4px 10px", borderRadius: 12, background: "rgba(236,72,153,0.12)", color: "#ec4899", fontSize: 11, fontWeight: 700 }}>
                  {stockTotalTetas} en freezer
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Ventas del mes:</span>
                  <strong>${mesMetrics.ventasTetasMesUsd.toFixed(2)} USD</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Costo de lotes:</span>
                  <span style={{ color: "#ef4444" }}>-${mesMetrics.costoTetasMesUsd.toFixed(2)} USD</span>
                </div>
                <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }}></div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15 }}>
                  <span style={{ fontWeight: 700 }}>Ganancia Neta Mes:</span>
                  <strong style={{ color: "#10b981" }}>
                    ${mesMetrics.gananciaTetasMesUsd.toFixed(2)} USD
                  </strong>
                </div>
              </div>
            </div>

            {/* Motor 3: Esposa (Personal / Side Hustles) */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, padding: 22, boxShadow: "var(--shadow-sm)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: "#8b5cf6" }}>
                    Espacio Esposa
                  </h3>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Sueldos, Emprendimiento & Gastos</span>
                </div>
                <span style={{ padding: "4px 10px", borderRadius: 12, background: "rgba(139,92,246,0.12)", color: "#8b5cf6", fontSize: 11, fontWeight: 700 }}>
                  Personal
                </span>
              </div>
              {(() => {
                const movsEsposa = movimientos.filter((m) => m.entidad_id === "esposa");
                const ingEsposa = movsEsposa.filter((m) => m.tipo === "ingreso").reduce((a, m) => a + Number(m.monto_usd), 0);
                const gastEsposa = movsEsposa.filter((m) => m.tipo === "gasto").reduce((a, m) => a + Number(m.monto_usd), 0);
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-muted)" }}>Ingresos / Trabajos:</span>
                      <strong>${ingEsposa.toFixed(2)} USD</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-muted)" }}>Gastos registrados:</span>
                      <span style={{ color: "#ef4444" }}>-${gastEsposa.toFixed(2)} USD</span>
                    </div>
                    <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }}></div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15 }}>
                      <span style={{ fontWeight: 700 }}>Balance Neto:</span>
                      <strong style={{ color: ingEsposa >= gastEsposa ? "#10b981" : "#ef4444" }}>
                        ${(ingEsposa - gastEsposa).toFixed(2)} USD
                      </strong>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Motor 4: YG (Personal / Proyectos) */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, padding: 22, boxShadow: "var(--shadow-sm)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: "#3b82f6" }}>
                    Espacio YG
                  </h3>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Freelance, Proyectos & Gastos</span>
                </div>
                <span style={{ padding: "4px 10px", borderRadius: 12, background: "rgba(59,130,246,0.12)", color: "#3b82f6", fontSize: 11, fontWeight: 700 }}>
                  Personal
                </span>
              </div>
              {(() => {
                const movsYg = movimientos.filter((m) => m.entidad_id === "yg");
                const ingYg = movsYg.filter((m) => m.tipo === "ingreso").reduce((a, m) => a + Number(m.monto_usd), 0);
                const gastYg = movsYg.filter((m) => m.tipo === "gasto").reduce((a, m) => a + Number(m.monto_usd), 0);
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-muted)" }}>Ingresos / Proyectos:</span>
                      <strong>${ingYg.toFixed(2)} USD</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-muted)" }}>Gastos registrados:</span>
                      <span style={{ color: "#ef4444" }}>-${gastYg.toFixed(2)} USD</span>
                    </div>
                    <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }}></div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15 }}>
                      <span style={{ fontWeight: 700 }}>Balance Neto:</span>
                      <strong style={{ color: ingYg >= gastYg ? "#10b981" : "#ef4444" }}>
                        ${(ingYg - gastYg).toFixed(2)} USD
                      </strong>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </section>
      )}

      {/* =======================================================================
          TAB 2: TETAS RELLENAS (FREEZER, STOCK Y VENTAS)
          ======================================================================= */}
      {tabActiva === "tetas" && (
        <section>
          {/* Tarjetas KPI de Tetas */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 24 }}>
            <div className="product-kpi-card" style={{ padding: "16px 18px", borderRadius: 18, border: "1px solid var(--border)" }}>
              <span className="product-kpi-label">Stock en Freezer</span>
              <div style={{ fontSize: 26, fontWeight: 900, color: "var(--primary)" }}>
                {stockTotalTetas} <span style={{ fontSize: 13, fontWeight: 600 }}>unidades</span>
              </div>
              <div className="product-kpi-sub">{tetasInventario.length} sabores activos</div>
            </div>

            <div className="product-kpi-card" style={{ padding: "16px 18px", borderRadius: 18, border: "1px solid var(--border)" }}>
              <span className="product-kpi-label">Unidades Vendidas</span>
              <div style={{ fontSize: 26, fontWeight: 900, color: "#10b981" }}>
                {totalTetasVendidas} <span style={{ fontSize: 13, fontWeight: 600 }}>und</span>
              </div>
              <div className="product-kpi-sub">${ventasTetasHistoricasUsd.toFixed(2)} USD generados</div>
            </div>

            <div className="product-kpi-card" style={{ padding: "16px 18px", borderRadius: 18, border: "1px solid var(--border)" }}>
              <span className="product-kpi-label">Ganancia del Mes</span>
              <div style={{ fontSize: 26, fontWeight: 900, color: "#10b981" }}>
                ${mesMetrics.gananciaTetasMesUsd.toFixed(2)} <span style={{ fontSize: 13, fontWeight: 600 }}>USD</span>
              </div>
              <div className="product-kpi-sub">Bs. {(mesMetrics.gananciaTetasMesUsd * tasaBcv).toFixed(2)}</div>
            </div>
          </div>

          {/* Inventario por Sabor (Control de Freezer con Venta Rápida) */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                Control de Freezer por Sabor
              </h2>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Toca los botones para registrar ventas directas de 1 o 2 unidades
              </span>
            </div>

            {tetasInventario.length === 0 ? (
              <div className="recetas-empty-box">
                <strong>No hay sabores registrados en el inventario</strong>
                <p className="recetas-subtitle">
                  Haz clic en &quot;+ Nuevo Sabor&quot; para agregar Oreo, Nutella, Coco, etc.
                </p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                {tetasInventario.map((sabor) => {
                  const stockNum = Number(sabor.stock_unidades) || 0;
                  const bajoStock = stockNum <= 3;
                  const costoNum = Number(sabor.costo_compra_unitario_usd) || 0.5;
                  const precioNum = Number(sabor.precio_venta_unitario_usd) || 1.0;
                  const gananciaUnitaria = precioNum - costoNum;

                  return (
                    <div
                      key={sabor.id}
                      style={{
                        background: "var(--bg-card)",
                        border: bajoStock ? "1px solid #f59e0b" : "1px solid var(--border)",
                        borderRadius: 18,
                        padding: 16,
                        boxShadow: "var(--shadow-sm)",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                          <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: "var(--text)" }}>
                            {sabor.sabor}
                          </h3>
                          <span
                            style={{
                              padding: "3px 8px",
                              borderRadius: 10,
                              fontSize: 12,
                              fontWeight: 800,
                              background: bajoStock ? "rgba(245,158,11,0.15)" : "rgba(16,185,129,0.12)",
                              color: bajoStock ? "#d97706" : "#10b981",
                            }}
                          >
                            {stockNum} disponibles
                          </span>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>
                          <div>
                            Costo: <strong style={{ color: "var(--text)" }}>${costoNum.toFixed(2)}</strong>
                          </div>
                          <div>
                            Precio: <strong style={{ color: "var(--text)" }}>${precioNum.toFixed(2)}</strong>
                          </div>
                          <div style={{ gridColumn: "span 2", fontSize: 12, color: "#10b981", fontWeight: 700 }}>
                            Margen: +${gananciaUnitaria.toFixed(2)} por unidad
                          </div>
                        </div>
                      </div>

                      {/* Botonera de Venta Rápida Táctil */}
                      <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                        <button
                          type="button"
                          disabled={stockNum < 1 || isPending}
                          onClick={() => handleVentaTetaDirecta(sabor.id, 1)}
                          style={{
                            flex: 1,
                            padding: "8px 0",
                            borderRadius: 12,
                            border: "1px solid var(--border)",
                            background: "var(--bg-subtle, #f3f4f6)",
                            color: "var(--text)",
                            fontWeight: 800,
                            fontSize: 13,
                            cursor: stockNum < 1 ? "not-allowed" : "pointer",
                            opacity: stockNum < 1 ? 0.4 : 1,
                          }}
                        >
                          +1 Venta
                        </button>
                        <button
                          type="button"
                          disabled={stockNum < 2 || isPending}
                          onClick={() => handleVentaTetaDirecta(sabor.id, 2)}
                          style={{
                            flex: 1,
                            padding: "8px 0",
                            borderRadius: 12,
                            border: "1px solid var(--border)",
                            background: "var(--bg-subtle, #f3f4f6)",
                            color: "var(--text)",
                            fontWeight: 800,
                            fontSize: 13,
                            cursor: stockNum < 2 ? "not-allowed" : "pointer",
                            opacity: stockNum < 2 ? 0.4 : 1,
                          }}
                        >
                          +2 Ventas
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            sounds.playPop();
                            setSaborSeleccionadoId(sabor.id);
                            setModalVentaTeta(true);
                          }}
                          style={{
                            padding: "8px 12px",
                            borderRadius: 12,
                            border: "none",
                            background: "var(--primary)",
                            color: "#fff",
                            fontWeight: 800,
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                          title="Detalles y cantidad personalizada"
                        >
                          Más
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Historial de Ventas Recientes de Tetas */}
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 14 }}>
              Historial de Ventas de Tetas
            </h2>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
              {tetasVentas.length === 0 ? (
                <div className="recetas-empty-box" style={{ border: "none" }}>
                  <strong>No hay ventas registradas aún</strong>
                  <p className="recetas-subtitle">Las ventas registradas aparecerán aquí con su detalle.</p>
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)", background: "rgba(0,0,0,0.02)" }}>
                      <th style={{ padding: "12px 16px", fontWeight: 700 }}>Fecha & Hora</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700 }}>Sabor</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700 }}>Cantidad</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700 }}>Total USD</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700 }}>Total Bs</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700 }}>Método</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700 }}>Operador</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tetasVentas.map((v) => (
                      <tr key={v.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "12px 16px", color: "var(--text-muted)", fontSize: 13 }}>
                          {new Date(v.fecha).toLocaleString("es-VE", { dateStyle: "short", timeStyle: "short" })}
                        </td>
                        <td style={{ padding: "12px 16px", fontWeight: 700 }}>{v.sabor_nombre}</td>
                        <td style={{ padding: "12px 16px" }}>{v.cantidad} und</td>
                        <td style={{ padding: "12px 16px", fontWeight: 800, color: "#10b981" }}>
                          ${Number(v.total_usd).toFixed(2)}
                        </td>
                        <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>
                          Bs. {Number(v.total_bs).toFixed(2)}
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 12, textTransform: "capitalize" }}>
                          {v.metodo_pago.replace(/_/g, " ")}
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text-muted)" }}>
                          {v.registrado_por || "Operador"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </section>
      )}

      {/* =======================================================================
          TAB 3: ESPACIOS PERSONALES & SIDE HUSTLES (ESPOSA & YG)
          ======================================================================= */}
      {tabActiva === "personales" && (
        <section>
          {/* Subfiltro por persona / entidad */}
          <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-muted)" }}>Filtrar espacio:</span>
            <div className="view-mode-toggle">
              <button
                type="button"
                onClick={() => setSubfiltroPersonal("todos")}
                className={`view-mode-btn ${subfiltroPersonal === "todos" ? "active" : ""}`}
              >
                Todos los Registros
              </button>
              <button
                type="button"
                onClick={() => setSubfiltroPersonal("esposa")}
                className={`view-mode-btn ${subfiltroPersonal === "esposa" ? "active" : ""}`}
              >
                Esposa (Personal)
              </button>
              <button
                type="button"
                onClick={() => setSubfiltroPersonal("yg")}
                className={`view-mode-btn ${subfiltroPersonal === "yg" ? "active" : ""}`}
              >
                YG (Personal)
              </button>
              <button
                type="button"
                onClick={() => setSubfiltroPersonal("hogar")}
                className={`view-mode-btn ${subfiltroPersonal === "hogar" ? "active" : ""}`}
              >
                Fondo Hogar
              </button>
            </div>
          </div>

          {/* Tabla de Movimientos Personales */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
            {movimientosFiltrados.length === 0 ? (
              <div className="recetas-empty-box" style={{ border: "none" }}>
                <strong>No hay movimientos registrados para este espacio</strong>
                <p className="recetas-subtitle">
                  Usa el botón &quot;+ Registrar Movimiento / Trabajo&quot; para asentar ingresos, trabajos o gastos.
                </p>
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", background: "rgba(0,0,0,0.02)" }}>
                    <th style={{ padding: "12px 16px", fontWeight: 700 }}>Fecha</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700 }}>Espacio / Entidad</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700 }}>Tipo</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700 }}>Descripción / Concepto</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700 }}>Categoría</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700 }}>Frecuencia</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700 }}>Monto USD</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700 }}>Monto Bs</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientosFiltrados.map((m) => {
                    const nombreEntidad =
                      m.entidad?.nombre ||
                      (m.entidad_id === "esposa"
                        ? "Esposa"
                        : m.entidad_id === "yg"
                        ? "YG"
                        : m.entidad_id === "hogar"
                        ? "Fondo Hogar"
                        : m.entidad_id === "parada"
                        ? "La Parada"
                        : m.entidad_id === "tetas"
                        ? "Tetas Rellenas"
                        : m.entidad_id);

                    return (
                      <tr key={m.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "12px 16px", color: "var(--text-muted)", fontSize: 13 }}>
                          {new Date(m.fecha).toLocaleDateString("es-VE")}
                        </td>
                        <td style={{ padding: "12px 16px", fontWeight: 700 }}>
                          {nombreEntidad}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span
                            style={{
                              padding: "3px 8px",
                              borderRadius: 8,
                              fontSize: 12,
                              fontWeight: 800,
                              background: m.tipo === "ingreso" ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                              color: m.tipo === "ingreso" ? "#10b981" : "#ef4444",
                            }}
                          >
                            {m.tipo === "ingreso" ? "Ingreso" : "Gasto"}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", fontWeight: 600 }}>{m.descripcion}</td>
                        <td style={{ padding: "12px 16px", fontSize: 13, textTransform: "capitalize", color: "var(--text-muted)" }}>
                          {m.categoria.replace(/_/g, " ")}
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 12 }}>
                          {m.recurrente ? (
                            <span style={{ padding: "2px 6px", borderRadius: 6, background: "rgba(59,130,246,0.1)", color: "#3b82f6", fontWeight: 700 }}>
                              {m.frecuencia || "Recurrente"}
                            </span>
                          ) : (
                            <span style={{ color: "var(--text-muted)" }}>Puntual</span>
                          )}
                        </td>
                        <td
                          style={{
                            padding: "12px 16px",
                            fontWeight: 800,
                            color: m.tipo === "ingreso" ? "#10b981" : "#ef4444",
                          }}
                        >
                          {m.tipo === "ingreso" ? "+" : "-"}${Number(m.monto_usd).toFixed(2)}
                        </td>
                        <td style={{ padding: "12px 16px", color: "var(--text-muted)", fontSize: 13 }}>
                          Bs. {Number(m.monto_bs).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      {/* =======================================================================
          TAB 4: MATRIZ DE PRÉSTAMOS & DEUDAS (CRUZADAS & FAMILIARES)
          ======================================================================= */}
      {tabActiva === "prestamos" && (
        <section>
          {/* Tarjetas KPI de Préstamos */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 24 }}>
            <div className="product-kpi-card" style={{ padding: "18px 20px", borderRadius: 20, border: "1px solid var(--border)" }}>
              <span className="product-kpi-label">Saldo Pendiente Total</span>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#ef4444" }}>
                ${totalDeudasPendientesUsd.toFixed(2)} <span style={{ fontSize: 13, fontWeight: 600 }}>USD</span>
              </div>
              <div className="product-kpi-sub">{prestamosActivos.length} préstamos activos por amortizar</div>
            </div>

            <div className="product-kpi-card" style={{ padding: "18px 20px", borderRadius: 20, border: "1px solid var(--border)" }}>
              <span className="product-kpi-label">Total Préstamos Históricos</span>
              <div style={{ fontSize: 28, fontWeight: 900, color: "var(--text)" }}>
                {prestamos.length}
              </div>
              <div className="product-kpi-sub">
                {prestamos.filter((p) => p.estado === "pagado").length} liquidados / saldados
              </div>
            </div>
          </div>

          {/* Lista de Préstamos */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {prestamos.length === 0 ? (
              <div className="recetas-empty-box">
                <strong>No hay préstamos ni deudas registradas</strong>
                <p className="recetas-subtitle">
                  Haz clic en &quot;+ Nuevo Préstamo&quot; para asentar préstamos entre Tetas, La Parada o familiares.
                </p>
              </div>
            ) : (
              prestamos.map((p) => {
                const pagado = p.estado === "pagado";
                const totalAbonado =
                  p.abonos?.reduce((a, b) => a + Number(b.monto_usd), 0) || 0;
                const porcentajePagado =
                  p.monto_original_usd > 0
                    ? Math.min(100, Math.round((totalAbonado / p.monto_original_usd) * 100))
                    : 100;

                return (
                  <div
                    key={p.id}
                    style={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--border)",
                      borderRadius: 20,
                      padding: 20,
                      boxShadow: "var(--shadow-sm)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: "var(--primary)" }}>
                            {p.origen_nombre}
                          </span>
                          <span style={{ color: "var(--text-muted)" }}>
                            <IconArrowRight />
                          </span>
                          <span style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>
                            {p.destino_nombre}
                          </span>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: 8,
                              fontSize: 11,
                              fontWeight: 800,
                              background: pagado ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                              color: pagado ? "#10b981" : "#ef4444",
                            }}
                          >
                            {pagado ? "Saldado / Pagado" : "Activo"}
                          </span>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
                          {p.concepto}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                          Registrado el {new Date(p.fecha).toLocaleDateString("es-VE")} por {p.creado_por || "Operador"}
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 20, fontWeight: 900, color: pagado ? "#10b981" : "#ef4444" }}>
                          ${Number(p.saldo_pendiente_usd).toFixed(2)} <span style={{ fontSize: 12, fontWeight: 600 }}>pendiente</span>
                        </div>
                        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                          Original: ${Number(p.monto_original_usd).toFixed(2)} USD
                        </div>
                        {!pagado && (
                          <button
                            type="button"
                            onClick={() => {
                              sounds.playPop();
                              setModalAbono(p);
                              setAbonoMontoUsd("");
                            }}
                            className="btn-primary-action"
                            style={{
                              marginTop: 8,
                              padding: "6px 14px",
                              fontSize: 13,
                              background: "#10b981",
                            }}
                          >
                            Abonar al Préstamo
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Barra de Progreso de Amortización */}
                    <div style={{ background: "var(--border)", height: 6, borderRadius: 3, overflow: "hidden", margin: "10px 0" }}>
                      <div
                        style={{
                          background: "#10b981",
                          height: "100%",
                          width: `${porcentajePagado}%`,
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>

                    {/* Historial de Abonos si existen */}
                    {p.abonos && p.abonos.length > 0 && (
                      <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(0,0,0,0.02)", borderRadius: 12 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                          Historial de amortizaciones / abonos ({p.abonos.length}):
                        </span>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {p.abonos.map((ab) => (
                            <div key={ab.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                              <span style={{ color: "var(--text-muted)" }}>
                                {new Date(ab.fecha).toLocaleDateString("es-VE")} ({ab.metodo_pago.replace(/_/g, " ")}):
                              </span>
                              <strong style={{ color: "#10b981" }}>+${Number(ab.monto_usd).toFixed(2)} USD</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      {/* =======================================================================
          MODAL 1: REGISTRO RÁPIDO MÓVIL (SPEED ENTRY DRAWER / MODAL)
          ======================================================================= */}
      {modalQuickLogger && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Registro rápido móvil"
          onClick={() => setModalQuickLogger(false)}
        >
          <div
            className="modal-ticket-card"
            style={{ maxWidth: 480, textAlign: "left" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                Registro Rápido Móvil
              </h2>
              <button
                type="button"
                onClick={() => setModalQuickLogger(false)}
                className="btn-modal-close"
                style={{ padding: 6, borderRadius: 8, border: "none", cursor: "pointer", background: "transparent" }}
                aria-label="Cerrar modal"
              >
                <IconX />
              </button>
            </div>

            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 16px 0" }}>
              Selecciona qué deseas asentar de forma inmediata:
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  sounds.playPop();
                  setModalQuickLogger(false);
                  setModalVentaTeta(true);
                }}
                style={{
                  padding: "14px 16px",
                  borderRadius: 14,
                  border: "1px solid var(--border)",
                  background: "var(--bg-card)",
                  textAlign: "left",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: "#ec4899" }}>
                    Venta de Tetas Rellenas
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    Registrar 1 o más unidades de helado vendidas
                  </div>
                </div>
                <IconArrowRight />
              </button>

              <button
                type="button"
                onClick={() => {
                  sounds.playPop();
                  setModalQuickLogger(false);
                  setModalMovimiento(true);
                }}
                style={{
                  padding: "14px 16px",
                  borderRadius: 14,
                  border: "1px solid var(--border)",
                  background: "var(--bg-card)",
                  textAlign: "left",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: "#8b5cf6" }}>
                    Ingreso o Gasto Personal / Side Hustle
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    Asentar pago de trabajo, sueldo o gasto del hogar
                  </div>
                </div>
                <IconArrowRight />
              </button>

              <button
                type="button"
                onClick={() => {
                  sounds.playPop();
                  setModalQuickLogger(false);
                  setModalPrestamo(true);
                }}
                style={{
                  padding: "14px 16px",
                  borderRadius: 14,
                  border: "1px solid var(--border)",
                  background: "var(--bg-card)",
                  textAlign: "left",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: "#3b82f6" }}>
                    Préstamo entre Negocios o Familiar
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    Inyección de capital o préstamo cruzado
                  </div>
                </div>
                <IconArrowRight />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          MODAL 2: VENTA DETALLADA DE TETAS RELLENAS
          ======================================================================= */}
      {modalVentaTeta && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Registrar venta de tetas"
          onClick={() => setModalVentaTeta(false)}
        >
          <div
            className="modal-ticket-card"
            style={{ maxWidth: 440, textAlign: "left" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                Registrar Venta de Tetas
              </h2>
              <button
                type="button"
                onClick={() => setModalVentaTeta(false)}
                className="btn-modal-close"
                style={{ padding: 6, borderRadius: 8, border: "none", cursor: "pointer", background: "transparent" }}
                aria-label="Cerrar modal"
              >
                <IconX />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label htmlFor="saborVentaSelect" style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Sabor de Teta
                </label>
                <select
                  id="saborVentaSelect"
                  value={saborSeleccionadoId}
                  onChange={(e) => setSaborSeleccionadoId(e.target.value)}
                  className="form-input"
                  style={{ width: "100%", fontWeight: 700 }}
                >
                  {tetasInventario.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.sabor} — Stock: {s.stock_unidades} (${Number(s.precio_venta_unitario_usd).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="cantidadVentaInput" style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Cantidad a Vender
                </label>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={() => setCantidadVentaTeta(Math.max(1, cantidadVentaTeta - 1))}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: "var(--bg-card)",
                      fontSize: 20,
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                    aria-label="Disminuir cantidad"
                  >
                    -
                  </button>
                  <input
                    id="cantidadVentaInput"
                    type="number"
                    min={1}
                    value={cantidadVentaTeta}
                    onChange={(e) => setCantidadVentaTeta(Math.max(1, parseInt(e.target.value) || 1))}
                    className="form-input"
                    style={{ textAlign: "center", fontSize: 18, fontWeight: 800, flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => setCantidadVentaTeta(cantidadVentaTeta + 1)}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: "var(--bg-card)",
                      fontSize: 20,
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                    aria-label="Aumentar cantidad"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="metodoPagoVentaSelect" style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Método de Pago
                </label>
                <select
                  id="metodoPagoVentaSelect"
                  value={metodoPagoTeta}
                  onChange={(e) => setMetodoPagoTeta(e.target.value)}
                  className="form-input"
                  style={{ width: "100%" }}
                >
                  <option value="efectivo_usd">Efectivo Divisa ($ USD)</option>
                  <option value="pago_movil">Pago Móvil (Bs)</option>
                  <option value="efectivo_bs">Efectivo Bolívares (Bs)</option>
                  <option value="punto">Punto de Venta (Bs)</option>
                  <option value="transferencia">Transferencia Bancaria</option>
                </select>
              </div>

              <div>
                <label htmlFor="notasVentaInput" style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Notas (Opcional)
                </label>
                <input
                  id="notasVentaInput"
                  type="text"
                  placeholder="Ej: Vecina de enfrente..."
                  value={notasVentaTeta}
                  onChange={(e) => setNotasVentaTeta(e.target.value)}
                  className="form-input"
                  style={{ width: "100%" }}
                />
              </div>

              {/* Resumen del Monto a Cobrar */}
              {(() => {
                const s = tetasInventario.find((i) => i.id === saborSeleccionadoId);
                const precio = s?.precio_venta_unitario_usd || 1.0;
                const totUsd = precio * cantidadVentaTeta;
                const totBs = totUsd * tasaBcv;

                return (
                  <div style={{ padding: 14, borderRadius: 14, background: "rgba(16,185,129,0.08)", border: "1px solid #10b981", textAlign: "center" }}>
                    <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Total a cobrar:</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "#10b981" }}>
                      ${totUsd.toFixed(2)} USD
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)" }}>
                      Bs. {totBs.toFixed(2)} (Tasa: {tasaBcv.toFixed(2)})
                    </div>
                  </div>
                );
              })()}

              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setModalVentaTeta(false)}
                  className="btn-refresh-action"
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleVentaTeta}
                  className="btn-primary-action"
                  style={{ flex: 2, background: "#10b981" }}
                >
                  {isPending ? "Registrando..." : "Confirmar Venta"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          MODAL 3: REABASTECER FREEZER DE TETAS
          ======================================================================= */}
      {modalAbastecerTeta && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Reabastecer freezer"
          onClick={() => setModalAbastecerTeta(false)}
        >
          <div
            className="modal-ticket-card"
            style={{ maxWidth: 440, textAlign: "left" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                Reabastecer Freezer (Lote de Distribuidor)
              </h2>
              <button
                type="button"
                onClick={() => setModalAbastecerTeta(false)}
                className="btn-modal-close"
                style={{ padding: 6, borderRadius: 8, border: "none", cursor: "pointer", background: "transparent" }}
                aria-label="Cerrar modal"
              >
                <IconX />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label htmlFor="abastecerSaborSelect" style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Sabor a Reabastecer
                </label>
                <select
                  id="abastecerSaborSelect"
                  value={abastecerSaborId}
                  onChange={(e) => cambiarSaborAbastecer(e.target.value)}
                  className="form-input"
                  style={{ width: "100%", fontWeight: 700 }}
                >
                  {tetasInventario.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.sabor} (Stock actual: {s.stock_unidades})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="abastecerCantidadInput" style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Cantidad Ingresada (Unidades)
                </label>
                <input
                  id="abastecerCantidadInput"
                  type="number"
                  min={1}
                  value={abastecerCantidad}
                  onChange={(e) => setAbastecerCantidad(e.target.value)}
                  className="form-input"
                  style={{ width: "100%", fontSize: 16, fontWeight: 800 }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label htmlFor="abastecerCostoInput" style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>
                    Costo Compra ($ USD)
                  </label>
                  <input
                    id="abastecerCostoInput"
                    type="number"
                    step="0.05"
                    value={abastecerCosto}
                    onChange={(e) => setAbastecerCosto(e.target.value)}
                    className="form-input"
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label htmlFor="abastecerPrecioInput" style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>
                    Precio Venta ($ USD)
                  </label>
                  <input
                    id="abastecerPrecioInput"
                    type="number"
                    step="0.05"
                    value={abastecerPrecio}
                    onChange={(e) => setAbastecerPrecio(e.target.value)}
                    className="form-input"
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setModalAbastecerTeta(false)}
                  className="btn-refresh-action"
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleAbastecerTeta}
                  className="btn-primary-action"
                  style={{ flex: 2 }}
                >
                  {isPending ? "Guardando..." : "Ingresar al Freezer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          MODAL 4: NUEVO SABOR DE TETA
          ======================================================================= */}
      {modalNuevoSabor && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Crear nuevo sabor de teta"
          onClick={() => setModalNuevoSabor(false)}
        >
          <div
            className="modal-ticket-card"
            style={{ maxWidth: 420, textAlign: "left" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                Nuevo Sabor de Teta
              </h2>
              <button
                type="button"
                onClick={() => setModalNuevoSabor(false)}
                className="btn-modal-close"
                style={{ padding: 6, borderRadius: 8, border: "none", cursor: "pointer", background: "transparent" }}
                aria-label="Cerrar modal"
              >
                <IconX />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label htmlFor="nuevoSaborNombreInput" style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Nombre del Sabor
                </label>
                <input
                  id="nuevoSaborNombreInput"
                  type="text"
                  placeholder="Ej: Oreo, Nutella, Coco, Parchita..."
                  value={nuevoSaborNombre}
                  onChange={(e) => setNuevoSaborNombre(e.target.value)}
                  className="form-input"
                  style={{ width: "100%", fontWeight: 700 }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label htmlFor="nuevoSaborCostoInput" style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>
                    Costo Compra ($ USD)
                  </label>
                  <input
                    id="nuevoSaborCostoInput"
                    type="number"
                    step="0.05"
                    value={nuevoSaborCosto}
                    onChange={(e) => setNuevoSaborCosto(e.target.value)}
                    className="form-input"
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label htmlFor="nuevoSaborPrecioInput" style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>
                    Precio Venta ($ USD)
                  </label>
                  <input
                    id="nuevoSaborPrecioInput"
                    type="number"
                    step="0.05"
                    value={nuevoSaborPrecio}
                    onChange={(e) => setNuevoSaborPrecio(e.target.value)}
                    className="form-input"
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="nuevoSaborStockInput" style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Stock Inicial en Freezer
                </label>
                <input
                  id="nuevoSaborStockInput"
                  type="number"
                  min={0}
                  value={nuevoSaborStock}
                  onChange={(e) => setNuevoSaborStock(e.target.value)}
                  className="form-input"
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setModalNuevoSabor(false)}
                  className="btn-refresh-action"
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleCrearNuevoSabor}
                  className="btn-primary-action"
                  style={{ flex: 2 }}
                >
                  {isPending ? "Guardando..." : "Crear Sabor"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          MODAL 5: REGISTRAR MOVIMIENTO PERSONAL / SIDE HUSTLE
          ======================================================================= */}
      {modalMovimiento && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Registrar movimiento o trabajo"
          onClick={() => setModalMovimiento(false)}
        >
          <div
            className="modal-ticket-card"
            style={{ maxWidth: 480, textAlign: "left" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                Registrar Movimiento / Trabajo
              </h2>
              <button
                type="button"
                onClick={() => setModalMovimiento(false)}
                className="btn-modal-close"
                style={{ padding: 6, borderRadius: 8, border: "none", cursor: "pointer", background: "transparent" }}
                aria-label="Cerrar modal"
              >
                <IconX />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Espacio / Entidad */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Espacio Financiero
                </label>
                <div className="view-mode-toggle" style={{ width: "100%" }}>
                  <button
                    type="button"
                    onClick={() => setMovEntidadId("esposa")}
                    className={`view-mode-btn ${movEntidadId === "esposa" ? "active" : ""}`}
                    style={{ flex: 1 }}
                  >
                    Esposa
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovEntidadId("yg")}
                    className={`view-mode-btn ${movEntidadId === "yg" ? "active" : ""}`}
                    style={{ flex: 1 }}
                  >
                    YG
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovEntidadId("hogar")}
                    className={`view-mode-btn ${movEntidadId === "hogar" ? "active" : ""}`}
                    style={{ flex: 1 }}
                  >
                    Fondo Hogar
                  </button>
                </div>
              </div>

              {/* Tipo: Ingreso o Gasto */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Tipo de Movimiento
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setMovTipo("ingreso")}
                    style={{
                      padding: "10px 0",
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: movTipo === "ingreso" ? "rgba(16,185,129,0.15)" : "var(--bg-card)",
                      color: movTipo === "ingreso" ? "#10b981" : "var(--text)",
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    Ingreso / Cobro
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovTipo("gasto")}
                    style={{
                      padding: "10px 0",
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: movTipo === "gasto" ? "rgba(239,68,68,0.15)" : "var(--bg-card)",
                      color: movTipo === "gasto" ? "#ef4444" : "var(--text)",
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    Gasto / Egreso
                  </button>
                </div>
              </div>

              {/* Categoría */}
              <div>
                <label htmlFor="movCategoriaSelect" style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Categoría
                </label>
                <select
                  id="movCategoriaSelect"
                  value={movCategoria}
                  onChange={(e) => setMovCategoria(e.target.value)}
                  className="form-input"
                  style={{ width: "100%" }}
                >
                  {movTipo === "ingreso" ? (
                    <>
                      <option value="side_hustle">Side Hustle / Emprendimiento</option>
                      <option value="sueldo">Sueldo / Salario Fijo</option>
                      <option value="freelance">Trabajo Freelance / Proyecto</option>
                      <option value="otro">Otro Ingreso</option>
                    </>
                  ) : (
                    <>
                      <option value="comida_hogar">Comida y Despensa Hogar</option>
                      <option value="servicios_hogar">Servicios (Luz, Agua, Internet)</option>
                      <option value="salud">Salud y Medicinas</option>
                      <option value="transporte">Transporte y Combustible</option>
                      <option value="costo_side_hustle">Costo de Producción Side Hustle</option>
                      <option value="otro">Otro Gasto</option>
                    </>
                  )}
                </select>
              </div>

              {/* Descripción */}
              <div>
                <label htmlFor="movDescripcionInput" style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Concepto o Descripción
                </label>
                <input
                  id="movDescripcionInput"
                  type="text"
                  placeholder="Ej: Cobro de quincena, venta de torta, etc."
                  value={movDescripcion}
                  onChange={(e) => setMovDescripcion(e.target.value)}
                  className="form-input"
                  style={{ width: "100%", fontWeight: 600 }}
                />
              </div>

              {/* Método de pago */}
              <div>
                <label htmlFor="movMetodoPagoSelect" style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Método de Pago
                </label>
                <select
                  id="movMetodoPagoSelect"
                  value={movMetodoPago}
                  onChange={(e) => setMovMetodoPago(e.target.value)}
                  className="form-input"
                  style={{ width: "100%" }}
                >
                  <option value="pago_movil">Pago Móvil (Bs)</option>
                  <option value="efectivo_usd">Efectivo ($ USD)</option>
                  <option value="efectivo_bs">Efectivo Bolívares (Bs)</option>
                  <option value="transferencia">Transferencia Bancaria</option>
                  <option value="punto">Punto de Venta (Bs)</option>
                </select>
              </div>

              {/* Montos Duales USD y Bs */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label htmlFor="movMontoUsdInput" style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>
                    Monto ($ USD)
                  </label>
                  <input
                    id="movMontoUsdInput"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={movMontoUsd}
                    onChange={(e) => handleCambioMovUsd(e.target.value)}
                    className="form-input"
                    style={{ width: "100%", fontWeight: 800, fontSize: 16 }}
                  />
                </div>
                <div>
                  <label htmlFor="movMontoBsInput" style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>
                    Monto (Bs)
                  </label>
                  <input
                    id="movMontoBsInput"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={movMontoBs}
                    onChange={(e) => handleCambioMovBs(e.target.value)}
                    className="form-input"
                    style={{ width: "100%", fontWeight: 800, fontSize: 16 }}
                  />
                </div>
              </div>

              {/* Recurrente (Fijo mensual / quincenal) */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                <input
                  type="checkbox"
                  id="movRecurrente"
                  checked={movRecurrente}
                  onChange={(e) => setMovRecurrente(e.target.checked)}
                  style={{ width: 18, height: 18, cursor: "pointer" }}
                />
                <label htmlFor="movRecurrente" style={{ fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Ingreso o gasto recurrente (fijo mensual o quincenal)
                </label>
              </div>

              {movRecurrente && (
                <div>
                  <label htmlFor="movFrecuenciaSelect" style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>
                    Frecuencia
                  </label>
                  <select
                    id="movFrecuenciaSelect"
                    value={movFrecuencia}
                    onChange={(e) => setMovFrecuencia(e.target.value as any)}
                    className="form-input"
                    style={{ width: "100%" }}
                  >
                    <option value="mensual">Mensual</option>
                    <option value="quincenal">Quincenal</option>
                    <option value="semanal">Semanal</option>
                  </select>
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setModalMovimiento(false)}
                  className="btn-refresh-action"
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleGuardarMovimiento}
                  className="btn-primary-action"
                  style={{ flex: 2 }}
                >
                  {isPending ? "Guardando..." : "Registrar Movimiento"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          MODAL 6: REGISTRAR PRÉSTAMO CRUZADO O FAMILIAR
          ======================================================================= */}
      {modalPrestamo && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Nuevo préstamo o inyección de capital"
          onClick={() => setModalPrestamo(false)}
        >
          <div
            className="modal-ticket-card"
            style={{ maxWidth: 480, textAlign: "left" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                Nuevo Préstamo o Inyección de Capital
              </h2>
              <button
                type="button"
                onClick={() => setModalPrestamo(false)}
                className="btn-modal-close"
                style={{ padding: 6, borderRadius: 8, border: "none", cursor: "pointer", background: "transparent" }}
                aria-label="Cerrar modal"
              >
                <IconX />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Origen (Quién presta) */}
              <div>
                <label htmlFor="prestamoOrigenSelect" style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Origen (¿Quién presta el dinero?)
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setPrestamoOrigenTipo("entidad_interna");
                      setPrestamoOrigenNombre("Tetas Rellenas");
                      setPrestamoOrigenEntidadId("tetas");
                    }}
                    style={{
                      padding: "8px 0",
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                      background: prestamoOrigenTipo === "entidad_interna" ? "rgba(37,99,235,0.12)" : "var(--bg-card)",
                      color: prestamoOrigenTipo === "entidad_interna" ? "var(--primary)" : "var(--text)",
                      fontWeight: 700,
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    Entidad Interna
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPrestamoOrigenTipo("tercero_familiar");
                      setPrestamoOrigenNombre("");
                      setPrestamoOrigenEntidadId("");
                    }}
                    style={{
                      padding: "8px 0",
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                      background: prestamoOrigenTipo === "tercero_familiar" ? "rgba(37,99,235,0.12)" : "var(--bg-card)",
                      color: prestamoOrigenTipo === "tercero_familiar" ? "var(--primary)" : "var(--text)",
                      fontWeight: 700,
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    Familiar o Tercero
                  </button>
                </div>

                {prestamoOrigenTipo === "entidad_interna" ? (
                  <select
                    id="prestamoOrigenSelect"
                    value={prestamoOrigenEntidadId}
                    onChange={(e) => {
                      setPrestamoOrigenEntidadId(e.target.value);
                      const ent = entidades.find((item) => item.id === e.target.value);
                      if (ent) setPrestamoOrigenNombre(ent.nombre);
                    }}
                    className="form-input"
                    style={{ width: "100%", fontWeight: 700 }}
                  >
                    {entidades.map((ent) => (
                      <option key={ent.id} value={ent.id}>
                        {ent.nombre}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Nombre del familiar o prestamista (ej: Tío Carlos, Hermano...)"
                    value={prestamoOrigenNombre}
                    onChange={(e) => setPrestamoOrigenNombre(e.target.value)}
                    className="form-input"
                    style={{ width: "100%" }}
                  />
                )}
              </div>

              {/* Destino (Quién recibe) */}
              <div>
                <label htmlFor="prestamoDestinoSelect" style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Destino (¿Quién recibe el dinero?)
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setPrestamoDestinoTipo("entidad_interna");
                      setPrestamoDestinoNombre("La Parada del Sabor");
                      setPrestamoDestinoEntidadId("parada");
                    }}
                    style={{
                      padding: "8px 0",
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                      background: prestamoDestinoTipo === "entidad_interna" ? "rgba(37,99,235,0.12)" : "var(--bg-card)",
                      color: prestamoDestinoTipo === "entidad_interna" ? "var(--primary)" : "var(--text)",
                      fontWeight: 700,
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    Entidad Interna
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPrestamoDestinoTipo("tercero_familiar");
                      setPrestamoDestinoNombre("");
                      setPrestamoDestinoEntidadId("");
                    }}
                    style={{
                      padding: "8px 0",
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                      background: prestamoDestinoTipo === "tercero_familiar" ? "rgba(37,99,235,0.12)" : "var(--bg-card)",
                      color: prestamoDestinoTipo === "tercero_familiar" ? "var(--primary)" : "var(--text)",
                      fontWeight: 700,
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    Familiar o Tercero
                  </button>
                </div>

                {prestamoDestinoTipo === "entidad_interna" ? (
                  <select
                    id="prestamoDestinoSelect"
                    value={prestamoDestinoEntidadId}
                    onChange={(e) => {
                      setPrestamoDestinoEntidadId(e.target.value);
                      const ent = entidades.find((item) => item.id === e.target.value);
                      if (ent) setPrestamoDestinoNombre(ent.nombre);
                    }}
                    className="form-input"
                    style={{ width: "100%", fontWeight: 700 }}
                  >
                    {entidades.map((ent) => (
                      <option key={ent.id} value={ent.id}>
                        {ent.nombre}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Nombre de quien recibe (ej: Hermano, Amigo...)"
                    value={prestamoDestinoNombre}
                    onChange={(e) => setPrestamoDestinoNombre(e.target.value)}
                    className="form-input"
                    style={{ width: "100%" }}
                  />
                )}
              </div>

              {/* Monto USD */}
              <div>
                <label htmlFor="prestamoMontoInput" style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Monto del Préstamo ($ USD)
                </label>
                <input
                  id="prestamoMontoInput"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={prestamoMontoUsd}
                  onChange={(e) => setPrestamoMontoUsd(e.target.value)}
                  className="form-input"
                  style={{ width: "100%", fontSize: 18, fontWeight: 800 }}
                />
              </div>

              {/* Concepto */}
              <div>
                <label htmlFor="prestamoConceptoInput" style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Concepto / Motivo
                </label>
                <input
                  id="prestamoConceptoInput"
                  type="text"
                  placeholder="Ej: Compra de insumos para fin de semana, arreglo freezer..."
                  value={prestamoConcepto}
                  onChange={(e) => setPrestamoConcepto(e.target.value)}
                  className="form-input"
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label htmlFor="prestamoNotasInput" style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Notas Adicionales (Opcional)
                </label>
                <input
                  id="prestamoNotasInput"
                  type="text"
                  placeholder="Acuerdos de devolución o plazo..."
                  value={prestamoNotas}
                  onChange={(e) => setPrestamoNotas(e.target.value)}
                  className="form-input"
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setModalPrestamo(false)}
                  className="btn-refresh-action"
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleGuardarPrestamo}
                  className="btn-primary-action"
                  style={{ flex: 2 }}
                >
                  {isPending ? "Guardando..." : "Asentar Préstamo"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          MODAL 7: ABONAR A PRÉSTAMO
          ======================================================================= */}
      {modalAbono && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Abonar a préstamo"
          onClick={() => setModalAbono(null)}
        >
          <div
            className="modal-ticket-card"
            style={{ maxWidth: 440, textAlign: "left" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                Abonar a Préstamo
              </h2>
              <button
                type="button"
                onClick={() => setModalAbono(null)}
                className="btn-modal-close"
                style={{ padding: 6, borderRadius: 8, border: "none", cursor: "pointer", background: "transparent" }}
                aria-label="Cerrar modal"
              >
                <IconX />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ padding: 12, borderRadius: 12, background: "rgba(0,0,0,0.03)", fontSize: 13 }}>
                <div><strong>Préstamo:</strong> {modalAbono.concepto}</div>
                <div><strong>Deudor:</strong> {modalAbono.destino_nombre}</div>
                <div><strong>Acreedor:</strong> {modalAbono.origen_nombre}</div>
                <div style={{ marginTop: 4, color: "#ef4444", fontWeight: 800 }}>
                  Saldo pendiente: ${Number(modalAbono.saldo_pendiente_usd).toFixed(2)} USD
                </div>
              </div>

              <div>
                <label htmlFor="abonoMontoInput" style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Monto a Abonar ($ USD)
                </label>
                <input
                  id="abonoMontoInput"
                  type="number"
                  step="0.01"
                  max={Number(modalAbono.saldo_pendiente_usd)}
                  placeholder={`Máximo $${Number(modalAbono.saldo_pendiente_usd).toFixed(2)}`}
                  value={abonoMontoUsd}
                  onChange={(e) => setAbonoMontoUsd(e.target.value)}
                  className="form-input"
                  style={{ width: "100%", fontSize: 18, fontWeight: 800 }}
                />
              </div>

              <div>
                <label htmlFor="abonoMetodoPagoSelect" style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Método de Pago
                </label>
                <select
                  id="abonoMetodoPagoSelect"
                  value={abonoMetodoPago}
                  onChange={(e) => setAbonoMetodoPago(e.target.value)}
                  className="form-input"
                  style={{ width: "100%" }}
                >
                  <option value="efectivo_usd">Efectivo ($ USD)</option>
                  <option value="pago_movil">Pago Móvil (Bs)</option>
                  <option value="transferencia">Transferencia Bancaria</option>
                  <option value="efectivo_bs">Efectivo Bolívares (Bs)</option>
                </select>
              </div>

              <div>
                <label htmlFor="abonoNotasInput" style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Notas (Opcional)
                </label>
                <input
                  id="abonoNotasInput"
                  type="text"
                  placeholder="Ej: Pago parcial semanal..."
                  value={abonoNotas}
                  onChange={(e) => setAbonoNotas(e.target.value)}
                  className="form-input"
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setModalAbono(null)}
                  className="btn-refresh-action"
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleGuardarAbono}
                  className="btn-primary-action"
                  style={{ flex: 2, background: "#10b981" }}
                >
                  {isPending ? "Procesando..." : "Confirmar Abono"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
