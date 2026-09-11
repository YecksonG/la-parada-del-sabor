"use client";

import { useState, useEffect, useMemo } from "react";
import { Cliente, Venta, MetodoPago, EstadoVenta } from "@/types/database";
import { guardarCliente, eliminarCliente, registrarPagoComandaCredito } from "./actions";
import { sounds } from "@/lib/sound-effects";
import { calcularSaldoPendienteComanda } from "@/lib/pago-mixto";

interface ClientesClientProps {
  clientes: Cliente[];
  ventas?: Venta[];
  tasaBcv?: number;
}

function getEstadoBadge(estado: EstadoVenta) {
  switch (estado) {
    case "credito":
      return { label: "A Crédito / Debe", icon: "⏳", bg: "rgba(239, 68, 68, 0.15)", color: "#dc2626" };
    case "completada":
      return { label: "Entregada", icon: "✅", bg: "rgba(34, 197, 94, 0.15)", color: "#16a34a" };
    case "lista":
      return { label: "Lista / En Camino", icon: "🛵", bg: "rgba(59, 130, 246, 0.15)", color: "#2563eb" };
    case "preparando":
      return { label: "En Cocina", icon: "🍳", bg: "rgba(245, 158, 11, 0.15)", color: "#d97706" };
    case "pendiente":
      return { label: "Pendiente", icon: "🟡", bg: "rgba(234, 179, 8, 0.15)", color: "#ca8a04" };
    case "cancelada":
      return { label: "Cancelada", icon: "❌", bg: "rgba(239, 68, 68, 0.15)", color: "#dc2626" };
    default:
      return { label: estado, icon: "📋", bg: "var(--bg-subtle)", color: "var(--text)" };
  }
}

function getMetodoBadge(metodo?: MetodoPago | string | null) {
  switch (metodo) {
    case "credito":
      return { label: "Crédito / Por Cobrar", icon: "⏳" };
    case "efectivo_usd":
    case "efectivo":
      return { label: "Efectivo USD", icon: "💵" };
    case "efectivo_bs":
      return { label: "Efectivo Bs", icon: "🇻🇪" };
    case "pago_movil":
    case "pago_movil_bs":
      return { label: "Pago Móvil", icon: "📱" };
    case "transferencia":
    case "transferencia_bs":
      return { label: "Transferencia", icon: "🏦" };
    case "binance":
    case "binance_usdt":
      return { label: "Binance", icon: "🟡" };
    case "zelle":
      return { label: "Zelle", icon: "🟣" };
    case "pago_mixto":
      return { label: "Pago Mixto", icon: "🔀" };
    default:
      return { label: metodo || "No especificado", icon: "💳" };
  }
}

export default function ClientesClient({ clientes, ventas = [], tasaBcv = 832 }: ClientesClientProps) {
  const [listaClientes, setListaClientes] = useState<Cliente[]>(clientes);
  const [listaVentas, setListaVentas] = useState<Venta[]>(ventas);
  const [pestañaPrincipal, setPestañaPrincipal] = useState<"directorio" | "credito">("directorio");
  const [modoVista, setModoVista] = useState<"grid" | "filas">("grid");
  const [busqueda, setBusqueda] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);

  // Estados para modal de abono a crédito
  const [comandaAbono, setComandaAbono] = useState<Venta | null>(null);
  const [montoAbonoUsd, setMontoAbonoUsd] = useState<number | "">("");
  const [metodoPagoAbono, setMetodoPagoAbono] = useState<MetodoPago>("pago_movil");
  const [notasAbono, setNotasAbono] = useState("");
  const [procesandoAbono, setProcesandoAbono] = useState(false);

  // Desglose de pago mixto en abono
  const [abonoMixtoEfUsd, setAbonoMixtoEfUsd] = useState<number | "">("");
  const [abonoMixtoPmBs, setAbonoMixtoPmBs] = useState<number | "">("");
  const [abonoMixtoEfBs, setAbonoMixtoEfBs] = useState<number | "">("");
  const [abonoMixtoTransfBs, setAbonoMixtoTransfBs] = useState<number | "">("");
  const [abonoMixtoBinance, setAbonoMixtoBinance] = useState<number | "">("");
  const [abonoMixtoZelle, setAbonoMixtoZelle] = useState<number | "">("");

  // Estado para modal de confirmación de eliminación
  const [clienteAEliminar, setClienteAEliminar] = useState<Cliente | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

  // Sincronizar clientes y ventas cuando cambian las props
  useEffect(() => {
    setListaClientes(clientes);
  }, [clientes]);

  useEffect(() => {
    setListaVentas(ventas);
  }, [ventas]);

  // Cargar preferencia guardada al montar
  useEffect(() => {
    const saved = localStorage.getItem("vista_clientes");
    if (saved === "grid" || saved === "filas") {
      setModoVista(saved);
    }
  }, []);

  const cambiarModoVista = (modo: "grid" | "filas") => {
    sounds.playPop();
    setModoVista(modo);
    if (typeof window !== "undefined") {
      localStorage.setItem("vista_clientes", modo);
    }
  };

  // ----------------------------------------------------
  // Cuentas por Cobrar / Crédito Logic
  // ----------------------------------------------------
  const comandasCredito = useMemo(() => {
    return listaVentas.filter(
      (v) => v.estado === "credito" || v.metodo_pago === "credito"
    );
  }, [listaVentas]);

  const deudoresMap = useMemo(() => {
    const map = new Map<string, { cliente: Cliente; totalDeudaUsd: number; comandas: Venta[] }>();

    for (const comanda of comandasCredito) {
      if (!comanda.cliente_id) continue;
      const cliente = listaClientes.find((c) => c.id === comanda.cliente_id) || comanda.cliente;
      if (!cliente) continue;

      const { saldoPendienteUsd } = calcularSaldoPendienteComanda(comanda, tasaBcv);
      // Si el saldo pendiente es 0 o menor, ya fue saldada
      if (saldoPendienteUsd <= 0.005) continue;

      const existente = map.get(cliente.id) || {
        cliente,
        totalDeudaUsd: 0,
        comandas: [],
      };

      existente.totalDeudaUsd = Number((existente.totalDeudaUsd + saldoPendienteUsd).toFixed(2));
      existente.comandas.push(comanda);
      map.set(cliente.id, existente);
    }

    return map;
  }, [comandasCredito, listaClientes, tasaBcv]);

  const totalDeudaGlobalUsd = useMemo(() => {
    return Array.from(deudoresMap.values()).reduce((acc, curr) => acc + curr.totalDeudaUsd, 0);
  }, [deudoresMap]);

  const totalDeudaGlobalBs = totalDeudaGlobalUsd * tasaBcv;

  const abrirModalAbono = (comanda: Venta) => {
    sounds.playPop();
    setComandaAbono(comanda);
    const { saldoPendienteUsd } = calcularSaldoPendienteComanda(comanda, tasaBcv);
    setMontoAbonoUsd(saldoPendienteUsd);
    setMetodoPagoAbono("pago_movil");
    setNotasAbono("");
    setAbonoMixtoEfUsd("");
    setAbonoMixtoPmBs("");
    setAbonoMixtoEfBs("");
    setAbonoMixtoTransfBs("");
    setAbonoMixtoBinance("");
    setAbonoMixtoZelle("");
  };

  const cerrarModalAbono = () => {
    setComandaAbono(null);
    setMontoAbonoUsd("");
    setNotasAbono("");
    setProcesandoAbono(false);
  };

  // Cálculo de total desglose para pago mixto en abono
  const abonoMixtoTotalUsd = useMemo(() => {
    if (metodoPagoAbono !== "pago_mixto") return 0;
    const efUsd = Number(abonoMixtoEfUsd) || 0;
    const pmBs = Number(abonoMixtoPmBs) || 0;
    const efBs = Number(abonoMixtoEfBs) || 0;
    const transfBs = Number(abonoMixtoTransfBs) || 0;
    const binance = Number(abonoMixtoBinance) || 0;
    const zelle = Number(abonoMixtoZelle) || 0;

    const bsTotal = pmBs + efBs + transfBs;
    const bsEnUsd = tasaBcv > 0 ? bsTotal / tasaBcv : 0;
    return efUsd + binance + zelle + bsEnUsd;
  }, [metodoPagoAbono, abonoMixtoEfUsd, abonoMixtoPmBs, abonoMixtoEfBs, abonoMixtoTransfBs, abonoMixtoBinance, abonoMixtoZelle, tasaBcv]);

  const abonoMixtoPendienteUsd = useMemo(() => {
    const target = Number(montoAbonoUsd) || 0;
    return Number((target - abonoMixtoTotalUsd).toFixed(2));
  }, [montoAbonoUsd, abonoMixtoTotalUsd]);

  const handleConfirmarAbono = async () => {
    if (!comandaAbono || procesandoAbono) return;
    const abonoNum = Number(montoAbonoUsd);
    const { saldoPendienteUsd } = calcularSaldoPendienteComanda(comandaAbono, tasaBcv);

    if (!abonoNum || abonoNum <= 0) {
      alert("Por favor ingrese un monto válido a abonar o saldar.");
      return;
    }

    if (abonoNum > saldoPendienteUsd + 0.01) {
      alert(`El monto a abonar ($${abonoNum.toFixed(2)}) no puede exceder el saldo pendiente de la comanda ($${saldoPendienteUsd.toFixed(2)}).`);
      return;
    }

    if (metodoPagoAbono === "pago_mixto") {
      if (Math.abs(abonoMixtoPendienteUsd) > 0.05) {
        alert(`El desglose de pago mixto debe coincidir exactamente con el monto a abonar ($${abonoNum.toFixed(2)}). Diferencia: $${abonoMixtoPendienteUsd.toFixed(2)}.`);
        return;
      }
    }

    setProcesandoAbono(true);

    const esPagoTotal = abonoNum >= saldoPendienteUsd - 0.01;
    const restante = Math.max(0, Number((saldoPendienteUsd - abonoNum).toFixed(2)));

    let tag = `[ABONO CRÉDITO: $${abonoNum.toFixed(2)} USD vía ${metodoPagoAbono.toUpperCase()}${
      esPagoTotal ? " - SALDADA TOTALMENTE" : ` - RESTA: $${restante.toFixed(2)} USD`
    }`;
    if (metodoPagoAbono === "pago_mixto") {
      const parts: string[] = [];
      if (Number(abonoMixtoEfUsd) > 0) parts.push(`EfUSD: $${Number(abonoMixtoEfUsd).toFixed(2)}`);
      if (Number(abonoMixtoPmBs) > 0) parts.push(`PMBs: Bs.${Number(abonoMixtoPmBs).toFixed(2)}`);
      if (Number(abonoMixtoEfBs) > 0) parts.push(`EfBs: Bs.${Number(abonoMixtoEfBs).toFixed(2)}`);
      if (Number(abonoMixtoTransfBs) > 0) parts.push(`TransfBs: Bs.${Number(abonoMixtoTransfBs).toFixed(2)}`);
      if (Number(abonoMixtoBinance) > 0) parts.push(`Binance: $${Number(abonoMixtoBinance).toFixed(2)}`);
      if (Number(abonoMixtoZelle) > 0) parts.push(`Zelle: $${Number(abonoMixtoZelle).toFixed(2)}`);
      tag += ` (${parts.join(", ")})`;
    }
    if (notasAbono.trim()) {
      tag += ` | Ref/Notas: ${notasAbono.trim()}`;
    }
    tag += ` - ${new Date().toLocaleDateString("es-VE")} ${new Date().toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })}]`;

    const res = await registrarPagoComandaCredito({
      venta_id: comandaAbono.id,
      monto_abonado_usd: abonoNum,
      metodo_pago_abono: metodoPagoAbono,
      es_pago_total: esPagoTotal,
      monto_restante_usd: restante,
      tag_abono: tag,
    });

    setProcesandoAbono(false);

    if (res.ok) {
      sounds.playKitchenBell();
      // Actualizar estado local
      setListaVentas((prev) =>
        prev.map((v) => {
          if (v.id === comandaAbono.id) {
            const nuevasNotas = v.notas_comanda ? `${v.notas_comanda} • ${tag}` : tag;
            return {
              ...v,
              estado: esPagoTotal ? "completada" : "credito",
              metodo_pago: esPagoTotal ? metodoPagoAbono : v.metodo_pago,
              notas_comanda: nuevasNotas,
            };
          }
          return v;
        })
      );
      cerrarModalAbono();
    } else {
      alert(res.error || "Error al registrar pago de crédito.");
    }
  };

  // Form states
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [notas, setNotas] = useState("");

  const abrirCrear = () => {
    sounds.playPop();
    setClienteSeleccionado(null);
    setNombre("");
    setTelefono("");
    setDireccion("");
    setNotas("");
    setModalAbierto(true);
  };

  const [modalHistorial, setModalHistorial] = useState(false);
  const [clienteHistorial, setClienteHistorial] = useState<Cliente | null>(null);
  const [tabModalCliente, setTabModalCliente] = useState<"ventas" | "perfil">("ventas");

  const abrirHistorial = (c: Cliente, tabInicial: "ventas" | "perfil" = "perfil") => {
    sounds.playPop();
    setClienteHistorial(c);
    setTabModalCliente(tabInicial);
    setModalHistorial(true);
  };

  const abrirEditar = (c: Cliente) => {
    sounds.playPop();
    setClienteSeleccionado(c);
    setNombre(c.nombre);
    setTelefono(c.telefono || "");
    setDireccion(c.direccion_delivery || "");
    setNotas(c.notas_preferencias || "");
    setModalAbierto(true);
  };

  const pedirConfirmacionEliminar = (c: Cliente) => {
    sounds.playPop();
    setErrorEliminar(null);
    setClienteAEliminar(c);
  };

  const ejecutarEliminar = async () => {
    if (!clienteAEliminar || eliminando) return;

    setEliminando(true);
    setErrorEliminar(null);
    const targetId = clienteAEliminar.id;
    const res = await eliminarCliente(targetId);
    setEliminando(false);

    if (res.ok) {
      sounds.playDelete();
      setListaClientes((prev) => prev.filter((c) => c.id !== targetId));
      setClienteAEliminar(null);
      setModalAbierto(false);
      setModalHistorial(false);
    } else {
      setErrorEliminar(res.error || "No se pudo eliminar el cliente.");
    }
  };

  const clientesFiltrados = useMemo(() => {
    return listaClientes.filter(
      (c) =>
        c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        c.telefono?.includes(busqueda) ||
        c.direccion_delivery?.toLowerCase().includes(busqueda.toLowerCase())
    );
  }, [listaClientes, busqueda]);

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || guardando) return;

    setGuardando(true);
    const res = await guardarCliente({
      id: clienteSeleccionado?.id,
      nombre,
      telefono,
      direccion_delivery: direccion,
      notas_preferencias: notas,
    });
    setGuardando(false);

    if (res.ok) {
      sounds.playKitchenBell();
      setModalAbierto(false);
    } else {
      alert(res.error || "Error al guardar cliente.");
    }
  };

  return (
    <main className="recetas-container">
      <div className="recetas-header">
        <div>
          <h1 className="recetas-title">
            {pestañaPrincipal === "directorio" ? "👥 Directorio de Clientes & Delivery" : "⏳ Cuentas por Cobrar / Crédito"}
          </h1>
          <p className="recetas-subtitle">
            {pestañaPrincipal === "directorio"
              ? "Gestión de clientes habituales, direcciones para reparto y preferencias culinarias."
              : "Control de clientes con comandas a crédito/debe, montos adeudados y registro de pagos fraccionados."}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {pestañaPrincipal === "directorio" && (
            <div className="view-mode-toggle">
              <button
                type="button"
                onClick={() => cambiarModoVista("grid")}
                className={`view-mode-btn ${modoVista === "grid" ? "active" : ""}`}
                title="Vista en Tarjetas / Cuadros"
              >
                ⊞ Cuadros
              </button>
              <button
                type="button"
                onClick={() => cambiarModoVista("filas")}
                className={`view-mode-btn ${modoVista === "filas" ? "active" : ""}`}
                title="Vista en Filas / Lista Detallada"
              >
                ☰ Filas
              </button>
            </div>
          )}

          <button type="button" onClick={abrirCrear} className="btn-primary-action">
            <span>+</span> Nuevo Cliente
          </button>
        </div>
      </div>

      {/* Selector de Pestañas Superiores */}
      <div style={{ display: "flex", gap: 10, borderBottom: "1px solid var(--border)", paddingBottom: 10, marginBottom: 12 }}>
        <button
          type="button"
          onClick={() => {
            sounds.playPop();
            setPestañaPrincipal("directorio");
          }}
          className={`cat-pill ${pestañaPrincipal === "directorio" ? "cat-pill-active" : ""}`}
          style={{
            fontSize: 13,
            fontWeight: 800,
            padding: "8px 18px",
            borderRadius: 9999,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>👥 Directorio Completo</span>
          <span style={{ fontSize: 11, opacity: 0.8 }}>({listaClientes.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            sounds.playPop();
            setPestañaPrincipal("credito");
          }}
          className={`cat-pill ${pestañaPrincipal === "credito" ? "cat-pill-active" : ""}`}
          style={{
            fontSize: 13,
            fontWeight: 800,
            padding: "8px 18px",
            borderRadius: 9999,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: pestañaPrincipal === "credito" ? "rgba(239, 68, 68, 0.15)" : undefined,
            color: pestañaPrincipal === "credito" ? "#dc2626" : undefined,
            borderColor: pestañaPrincipal === "credito" ? "#dc2626" : undefined,
          }}
        >
          <span>⏳ Cuentas por Cobrar / Debe</span>
          {comandasCredito.length > 0 && (
            <span
              style={{
                background: "#dc2626",
                color: "#ffffff",
                padding: "1px 7px",
                borderRadius: 9999,
                fontSize: 11,
                fontWeight: 900,
              }}
            >
              {comandasCredito.length}
            </span>
          )}
        </button>
      </div>

      {/* PESTAÑA 2: CUENTAS POR COBRAR / CRÉDITO */}
      {pestañaPrincipal === "credito" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 20 }}>
          {/* Métricas KPI de Deuda */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <div
              style={{
                background: "rgba(239, 68, 68, 0.08)",
                border: "1.5px solid rgba(239, 68, 68, 0.3)",
                borderRadius: 14,
                padding: "12px 16px",
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#dc2626", display: "block" }}>
                Total Pendiente por Cobrar
              </span>
              <strong style={{ fontSize: 24, color: "#dc2626", fontWeight: 900 }}>
                ${totalDeudaGlobalUsd.toFixed(2)} USD
              </strong>
              <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginTop: 2 }}>
                ~Bs. {totalDeudaGlobalBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Tasa: {tasaBcv.toFixed(2)})
              </span>
            </div>

            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: "12px 16px",
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "var(--text-muted)", display: "block" }}>
                Clientes con Deuda
              </span>
              <strong style={{ fontSize: 24, color: "var(--text)", fontWeight: 900 }}>
                {deudoresMap.size} Clientes
              </strong>
              <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginTop: 2 }}>
                Familia y clientes de confianza
              </span>
            </div>

            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: "12px 16px",
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "var(--text-muted)", display: "block" }}>
                Comandas a Crédito Activas
              </span>
              <strong style={{ fontSize: 24, color: "var(--text)", fontWeight: 900 }}>
                {comandasCredito.length} Comandas
              </strong>
              <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginTop: 2 }}>
                Pendientes de liquidar o abonar
              </span>
            </div>
          </div>

          {/* Listado de Deudores */}
          {deudoresMap.size === 0 ? (
            <div className="recetas-empty-box" style={{ background: "rgba(34, 197, 94, 0.05)", border: "1px dashed #16a34a" }}>
              <span style={{ fontSize: 44 }}>🎉</span>
              <h3 style={{ color: "#16a34a" }}>¡Al día! No hay cuentas por cobrar</h3>
              <p>Todas las comandas a crédito han sido saldadas o no existen deudas pendientes.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {Array.from(deudoresMap.values()).map(({ cliente, totalDeudaUsd, comandas }) => (
                <div
                  key={cliente.id}
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: 16,
                    padding: 16,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  }}
                >
                  {/* Cabecera del Deudor */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 10,
                      borderBottom: "1px solid var(--border)",
                      paddingBottom: 12,
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 22 }}>👤</span>
                        <h3 style={{ margin: 0, fontSize: 17, color: "var(--text)" }}>{cliente.nombre}</h3>
                        {cliente.telefono && (
                          <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
                            📞 {cliente.telefono}
                          </span>
                        )}
                      </div>
                      {cliente.direccion_delivery && (
                        <p style={{ margin: "4px 0 0", fontSize: 11.5, color: "var(--text-muted)" }}>
                          🛵 {cliente.direccion_delivery}
                        </p>
                      )}
                    </div>

                    <div style={{ textAlign: "right", display: "flex", alignItems: "center", gap: 12 }}>
                      <div>
                        <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", color: "#dc2626", display: "block" }}>
                          Deuda Total Acumulada:
                        </span>
                        <strong style={{ fontSize: 20, color: "#dc2626", fontWeight: 900 }}>
                          ${totalDeudaUsd.toFixed(2)} USD
                        </strong>
                        <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>
                          ~Bs. {(totalDeudaUsd * tasaBcv).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      {cliente.telefono && (() => {
                        const rawDigits = cliente.telefono.replace(/\D/g, "");
                        const cleanPhone = rawDigits.startsWith("58") ? rawDigits.slice(2) : rawDigits.replace(/^0/, "");
                        return (
                          <a
                            href={`https://wa.me/58${cleanPhone}?text=${encodeURIComponent(
                              `¡Hola ${cliente.nombre}! 👋 Te saludamos de La Parada del Sabor. Te recordamos tu saldo pendiente de $${totalDeudaUsd.toFixed(2)} USD (~Bs. ${(totalDeudaUsd * tasaBcv).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}). ¿Deseas abonar hoy? ¡Muchas gracias!`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-insumo-adjust"
                            style={{
                              background: "rgba(37, 211, 102, 0.15)",
                              color: "#16a34a",
                              borderColor: "#25D366",
                              fontWeight: 800,
                              padding: "6px 12px",
                              fontSize: 12,
                              textDecoration: "none",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <span>💬 Cobrar por WhatsApp</span>
                          </a>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Listado de Comandas Adeudadas del Cliente */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>
                      Comandas por Cobrar ({comandas.length}):
                    </span>

                    {comandas.map((v) => {
                      const fechaObj = new Date(v.fecha);
                      const fechaFormateada = fechaObj.toLocaleDateString("es-VE", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      });
                      const horaFormateada = fechaObj.toLocaleTimeString("es-VE", {
                        hour: "2-digit",
                        minute: "2-digit",
                      });

                      return (
                        <div
                          key={v.id}
                          style={{
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            borderRadius: 12,
                            padding: "10px 14px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: 10,
                          }}
                        >
                          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 240 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontWeight: 900, color: "var(--primary-dark)", fontSize: 13.5 }}>
                                #{v.numero_comanda?.toString().padStart(4, "0") || v.id.slice(0, 6)}
                              </span>
                              <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                                🗓️ {fechaFormateada} • {horaFormateada}
                              </span>
                              <span
                                style={{
                                  background: "rgba(239, 68, 68, 0.15)",
                                  color: "#dc2626",
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  fontSize: 10.5,
                                  fontWeight: 800,
                                }}
                              >
                                ⏳ Debe
                              </span>
                            </div>

                            {/* Desglose de Items / Qué debe */}
                            {v.items && v.items.length > 0 ? (
                              <div style={{ fontSize: 11.5, color: "var(--text)" }}>
                                <strong>Consumo:</strong>{" "}
                                {v.items.map((it: any) => `${it.cantidad}x ${it.producto?.nombre || "Plato"}`).join(", ")}
                              </div>
                            ) : null}

                            {v.notas_comanda && (
                              <div style={{ fontSize: 11, color: "var(--primary-dark)", fontStyle: "italic" }}>
                                📝 {v.notas_comanda}
                              </div>
                            )}
                          </div>

                          {(() => {
                            const { totalOriginalUsd, totalAbonadoUsd, saldoPendienteUsd } = calcularSaldoPendienteComanda(v, tasaBcv);
                            return (
                              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                                <div style={{ textAlign: "right" }}>
                                  <span style={{ fontSize: 10, fontWeight: 800, color: "#dc2626", textTransform: "uppercase", display: "block" }}>
                                    Debe / Saldo:
                                  </span>
                                  <strong style={{ fontSize: 17, color: "#dc2626", fontWeight: 900, display: "block" }}>
                                    ${saldoPendienteUsd.toFixed(2)} USD
                                  </strong>
                                  <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>
                                    Bs. {(saldoPendienteUsd * (Number(v.tasa_bcv) || tasaBcv)).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                  {totalAbonadoUsd > 0 && (
                                    <span style={{ fontSize: 10, color: "#16a34a", fontWeight: 700, display: "block", marginTop: 2 }}>
                                      ✅ Abonado: ${totalAbonadoUsd.toFixed(2)} / Total: ${totalOriginalUsd.toFixed(2)}
                                    </span>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  onClick={() => abrirModalAbono(v)}
                                  className="btn-primary-action"
                                  style={{
                                    padding: "8px 14px",
                                    fontSize: 12,
                                    fontWeight: 800,
                                    background: "#16a34a",
                                    color: "#ffffff",
                                    borderColor: "#16a34a",
                                    borderRadius: 10,
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 6,
                                  }}
                                >
                                  <span>💰</span>
                                  <span>Abonar / Saldar</span>
                                </button>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA 1: DIRECTORIO DE CLIENTES */}
      {pestañaPrincipal === "directorio" && (
        <>
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Buscar por nombre, teléfono o dirección..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pos-search-input"
            />
            {busqueda && (
              <button type="button" onClick={() => setBusqueda("")} className="btn-clear-search">
                ✕
              </button>
            )}
          </div>

      {clientesFiltrados.length === 0 ? (
        <div className="recetas-empty-box">
          <span style={{ fontSize: 48 }}>👥</span>
          <h3>No se encontraron clientes</h3>
          <p>Registra tus clientes de confianza para agilizar comandas y deliveries.</p>
        </div>
      ) : modoVista === "grid" ? (
        /* VISTA 1: CUADROS / GRID */
        <div className="insumos-grid">
          {clientesFiltrados.map((c) => (
            <div key={c.id} className="insumo-card">
              <div className="insumo-card-header">
                <h3 className="insumo-name">👤 {c.nombre}</h3>
                <span className="badge-ticket">{c.total_pedidos} Pedidos</span>
              </div>

              {c.telefono && (
                <p style={{ fontSize: 13, color: "var(--text)" }}>📞 {c.telefono}</p>
              )}

              {c.direccion_delivery && (
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  🛵 {c.direccion_delivery}
                </p>
              )}

              {c.notas_preferencias && (
                <div className="comanda-notes-box">
                  <span>⭐ {c.notas_preferencias}</span>
                </div>
              )}

              <div className="insumo-card-footer" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => abrirHistorial(c, "ventas")}
                  className="btn-insumo-adjust"
                  style={{ background: "rgba(248, 197, 66, 0.15)", borderColor: "var(--primary)", color: "var(--primary-dark)", fontWeight: 700 }}
                  title="Ver historial de ventas de este cliente"
                >
                  🛍️ Ventas
                </button>
                <button
                  type="button"
                  onClick={() => abrirHistorial(c, "perfil")}
                  className="btn-insumo-adjust"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                  title="Ver perfil completo del cliente"
                >
                  👤 Perfil
                </button>
                <button
                  type="button"
                  onClick={() => abrirEditar(c)}
                  className="btn-insumo-adjust"
                >
                  ✏️ Editar
                </button>
                <button
                  type="button"
                  onClick={() => pedirConfirmacionEliminar(c)}
                  className="btn-insumo-adjust"
                  style={{ color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.3)" }}
                  title="Eliminar cliente"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* VISTA 2: FILAS / LISTA DETALLADA (TODO COMPLETO) */
        <div className="table-responsive-wrapper">
          <table className="custom-detailed-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Teléfono / WhatsApp</th>
                <th>Dirección Delivery</th>
                <th>Pedidos Totales</th>
                <th>Preferencias Culinarias / Notas</th>
                <th style={{ textAlign: "right" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clientesFiltrados.map((c) => (
                <tr key={c.id} className="detailed-table-row">
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 20 }}>👤</span>
                      <strong style={{ fontSize: 14, color: "var(--text)" }}>{c.nombre}</strong>
                    </div>
                  </td>
                  <td>
                    {c.telefono ? (
                      <span style={{ fontSize: 13, fontWeight: 700 }}>
                        📞 {c.telefono}
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>
                    )}
                  </td>
                  <td style={{ maxWidth: 220, fontSize: 12 }}>
                    {c.direccion_delivery ? (
                      <span>🛵 {c.direccion_delivery}</span>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>—</span>
                    )}
                  </td>
                  <td>
                    <span className="badge-ticket" style={{ fontSize: 12 }}>
                      {c.total_pedidos} Pedidos
                    </span>
                  </td>
                  <td style={{ maxWidth: 250, fontSize: 12 }}>
                    {c.notas_preferencias ? (
                      <span style={{ color: "var(--primary-dark)", fontWeight: 600 }}>
                        ⭐ {c.notas_preferencias}
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>Sin notas especiales</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => abrirHistorial(c, "ventas")}
                        className="btn-insumo-adjust"
                        style={{ padding: "5px 10px", fontSize: 12, background: "rgba(248, 197, 66, 0.15)", borderColor: "var(--primary)", color: "var(--primary-dark)", fontWeight: 700 }}
                        title="Ver registro y detalle de ventas de este cliente"
                      >
                        🛍️ Ventas
                      </button>
                      <button
                        type="button"
                        onClick={() => abrirHistorial(c, "perfil")}
                        className="btn-insumo-adjust"
                        style={{ padding: "5px 10px", fontSize: 12, background: "var(--surface)", border: "1px solid var(--border)" }}
                        title="Ver perfil completo del cliente"
                      >
                        👤 Perfil
                      </button>
                      <button
                        type="button"
                        onClick={() => abrirEditar(c)}
                        className="btn-insumo-adjust"
                        style={{ padding: "5px 12px", fontSize: 12 }}
                      >
                        ✏️ Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => pedirConfirmacionEliminar(c)}
                        className="btn-insumo-adjust"
                        style={{ padding: "5px 10px", fontSize: 12, color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.3)" }}
                        title="Eliminar cliente"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </>
      )}

      {modalAbierto && (
        <div className="modal-overlay">
          <div className="modal-recipe-card" style={{ maxWidth: 460 }}>
            <div className="modal-recipe-header">
              <h2>{clienteSeleccionado ? "Editar Cliente" : "Nuevo Cliente"}</h2>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="btn-modal-close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGuardar} className="recipe-form">
              <div className="form-field">
                <label>Nombre y Apellido</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Carlos Mendoza"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-field">
                <label>Teléfono / WhatsApp</label>
                <input
                  type="text"
                  placeholder="0414-1234567"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-field">
                <label>Dirección de Entrega / Delivery</label>
                <input
                  type="text"
                  placeholder="Calle principal, casa #12, frente a la plaza"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-field">
                <label>Preferencias y Notas</label>
                <input
                  type="text"
                  placeholder="Ej. Le gusta la arepa bien tostada y sin mayonesa"
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="modal-recipe-actions" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {clienteSeleccionado ? (
                  <button
                    type="button"
                    onClick={() => {
                      setModalAbierto(false);
                      pedirConfirmacionEliminar(clienteSeleccionado);
                    }}
                    className="btn-cancel"
                    style={{ color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.4)" }}
                  >
                    🗑️ Eliminar
                  </button>
                ) : (
                  <div></div>
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setModalAbierto(false)}
                    className="btn-cancel"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={guardando}
                    className="btn-submit-recipe"
                  >
                    {guardando ? "Guardando..." : "💾 Guardar Cliente"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Perfil & Historial de Ventas del Cliente */}
      {modalHistorial && clienteHistorial && (() => {
        const ventasCliente = ventas.filter((v) => v.cliente_id === clienteHistorial.id);
        const totalGastadoUsd = ventasCliente
          .filter((v) => v.estado !== "cancelada")
          .reduce((acc, v) => acc + (Number(v.total_usd) || 0), 0);

        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Perfil y Registro de Ventas del Cliente"
            className="modal-overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget) setModalHistorial(false);
            }}
          >
            <div className="modal-recipe-card" style={{ maxWidth: 640, width: "95%", maxHeight: "90vh", overflowY: "auto", borderRadius: 20 }}>
              <div className="modal-recipe-header" style={{ paddingBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 28 }}>👤</span>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 18, color: "var(--text)" }}>{clienteHistorial.nombre}</h2>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
                      {clienteHistorial.telefono || "Sin teléfono"} • {ventasCliente.length} Comandas registradas
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModalHistorial(false)}
                  className="btn-modal-close"
                  aria-label="Cerrar modal"
                >
                  ✕
                </button>
              </div>

              {/* Selector de Pestañas: Registro de Ventas vs Perfil */}
              <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border)", padding: "4px 0 10px", marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setTabModalCliente("ventas")}
                  className={`cat-pill ${tabModalCliente === "ventas" ? "cat-pill-active" : ""}`}
                  style={{
                    fontSize: 12.5,
                    padding: "6px 14px",
                    fontWeight: 800,
                    borderRadius: 9999,
                    cursor: "pointer",
                  }}
                >
                  🛍️ Registro de Ventas ({ventasCliente.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTabModalCliente("perfil")}
                  className={`cat-pill ${tabModalCliente === "perfil" ? "cat-pill-active" : ""}`}
                  style={{
                    fontSize: 12.5,
                    padding: "6px 14px",
                    fontWeight: 800,
                    borderRadius: 9999,
                    cursor: "pointer",
                  }}
                >
                  👤 Datos de Perfil & Delivery
                </button>
              </div>

              {tabModalCliente === "ventas" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "14px 0" }}>
                  {/* Tarjetas de Resumen Financiero del Cliente */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                    <div style={{ background: "rgba(248, 197, 66, 0.08)", border: "1px solid rgba(248, 197, 66, 0.3)", padding: "10px 14px", borderRadius: 12 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "var(--text-muted)", display: "block" }}>
                        Total Consumido
                      </span>
                      <strong style={{ fontSize: 20, color: "var(--primary-dark)" }}>
                        ${totalGastadoUsd.toFixed(2)} USD
                      </strong>
                    </div>

                    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "10px 14px", borderRadius: 12 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "var(--text-muted)", display: "block" }}>
                        Pedidos Totales
                      </span>
                      <strong style={{ fontSize: 20, color: "var(--text)" }}>
                        {clienteHistorial.total_pedidos} Pedidos
                      </strong>
                    </div>

                    <div style={{ background: "rgba(34, 197, 94, 0.08)", border: "1px solid rgba(34, 197, 94, 0.3)", padding: "10px 14px", borderRadius: 12 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "var(--text-muted)", display: "block" }}>
                        Ticket Promedio
                      </span>
                      <strong style={{ fontSize: 20, color: "#16a34a" }}>
                        ${ventasCliente.length > 0 ? (totalGastadoUsd / (ventasCliente.filter(v => v.estado !== "cancelada").length || 1)).toFixed(2) : "0.00"} USD
                      </strong>
                    </div>
                  </div>

                  {/* Listado de Ventas del Cliente */}
                  <div style={{ marginTop: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 8 }}>
                      📋 Historial Cronológico de Comandas ({ventasCliente.length}):
                    </span>

                    {ventasCliente.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "28px 16px", background: "var(--bg-subtle)", borderRadius: 12, color: "var(--text-muted)" }}>
                        <span style={{ fontSize: 32, display: "block", marginBottom: 6 }}>🧾</span>
                        <strong style={{ fontSize: 14, color: "var(--text)" }}>Sin ventas registradas aún</strong>
                        <p style={{ margin: "4px 0 0", fontSize: 12 }}>
                          Cuando este cliente realice pedidos por POS o web, aparecerán aquí con su fecha y detalle.
                        </p>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {ventasCliente.map((v) => {
                          const est = getEstadoBadge(v.estado);
                          const met = getMetodoBadge(v.metodo_pago);
                          const fechaObj = new Date(v.fecha);
                          const fechaFormateada = fechaObj.toLocaleDateString("es-VE", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          });
                          const horaFormateada = fechaObj.toLocaleTimeString("es-VE", {
                            hour: "2-digit",
                            minute: "2-digit",
                          });

                          return (
                            <div
                              key={v.id}
                              style={{
                                background: "var(--bg-card)",
                                border: "1px solid var(--border)",
                                borderRadius: 12,
                                padding: "12px 14px",
                                display: "flex",
                                flexDirection: "column",
                                gap: 8,
                                boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
                              }}
                            >
                              {/* Fila Cabecera: Comanda, Fecha, Estado y Monto */}
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span style={{ fontWeight: 900, color: "var(--primary-dark)", fontSize: 14 }}>
                                    #{v.numero_comanda?.toString().padStart(4, "0") || v.id.slice(0, 6)}
                                  </span>
                                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                    🗓️ {fechaFormateada} • {horaFormateada}
                                  </span>
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span
                                    style={{
                                      background: est.bg,
                                      color: est.color,
                                      padding: "3px 8px",
                                      borderRadius: 6,
                                      fontSize: 11,
                                      fontWeight: 800,
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 4,
                                    }}
                                  >
                                    <span>{est.icon}</span>
                                    <span>{est.label}</span>
                                  </span>

                                  <div style={{ textAlign: "right" }}>
                                    <strong style={{ fontSize: 16, color: "var(--primary-dark)", display: "block" }}>
                                      ${Number(v.total_usd).toFixed(2)} USD
                                    </strong>
                                    {Number(v.total_bs) > 0 && (
                                      <span style={{ fontSize: 10.5, color: "var(--text-muted)", display: "block" }}>
                                        Bs. {Number(v.total_bs).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Fila Detalles: Tipo de entrega y Método de Pago */}
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 11.5 }}>
                                <span style={{ background: "var(--bg-subtle)", padding: "2px 6px", borderRadius: 4, fontWeight: 700, color: "var(--text-muted)" }}>
                                  {v.tipo_entrega === "delivery" ? `🛵 Delivery (${v.delivery_zona_nombre || "Tarifa Nivel"})` : `🛍️ ${v.tipo_entrega?.toUpperCase() || "RETIRO"}`}
                                </span>
                                <span style={{ background: "var(--bg-subtle)", padding: "2px 6px", borderRadius: 4, fontWeight: 700, color: "var(--text-muted)" }}>
                                  {met.icon} {met.label}
                                </span>
                                {v.direccion_delivery && (
                                  <span style={{ color: "var(--text-muted)", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={v.direccion_delivery}>
                                    📍 {v.direccion_delivery}
                                  </span>
                                )}
                              </div>

                              {/* Desglose de Items Comprados */}
                              {v.items && v.items.length > 0 ? (
                                <div style={{ background: "var(--bg-subtle)", padding: "8px 10px", borderRadius: 8, marginTop: 2 }}>
                                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: "var(--text)" }}>
                                    {v.items.map((it: any) => (
                                      <li key={it.id} style={{ marginBottom: 2 }}>
                                        <strong>{it.cantidad}x {it.producto?.nombre || "Plato / Combo"}</strong>
                                        <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>
                                          (${Number(it.subtotal_usd || (it.precio_unitario_usd * it.cantidad)).toFixed(2)})
                                        </span>
                                        {it.notas_item && (
                                          <div style={{ fontSize: 11, color: "var(--primary-dark)", fontStyle: "italic" }}>
                                            ↳ {it.notas_item}
                                          </div>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : v.notas_comanda ? (
                                <div style={{ fontSize: 12, color: "var(--text)", background: "var(--bg-subtle)", padding: "6px 10px", borderRadius: 6 }}>
                                  📝 {v.notas_comanda}
                                </div>
                              ) : null}

                              {/* Acción rápida si la comanda está a crédito */}
                              {(v.estado === "credito" || v.metodo_pago === "credito") && (
                                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                                  <button
                                    type="button"
                                    onClick={() => abrirModalAbono(v)}
                                    className="btn-primary-action"
                                    style={{
                                      padding: "6px 12px",
                                      fontSize: 11.5,
                                      fontWeight: 800,
                                      background: "#16a34a",
                                      color: "#ffffff",
                                      borderColor: "#16a34a",
                                      borderRadius: 8,
                                      cursor: "pointer",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 6,
                                    }}
                                  >
                                    <span>💰 Abonar / Saldar Deuda</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Pestaña de Datos de Perfil & Delivery */
                <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "16px 0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 36 }}>👑</span>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 18, color: "var(--text)" }}>{clienteHistorial.nombre}</h3>
                      <span className="badge-ticket" style={{ fontSize: 12 }}>
                        ⭐ {clienteHistorial.total_pedidos} Pedidos Realizados
                      </span>
                    </div>
                  </div>

                  <div style={{ background: "var(--surface)", padding: 14, borderRadius: 12, border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block", textTransform: "uppercase", fontWeight: 700 }}>Teléfono / WhatsApp</span>
                      <strong style={{ fontSize: 14 }}>{clienteHistorial.telefono || "No registrado"}</strong>
                    </div>

                    <div>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block", textTransform: "uppercase", fontWeight: 700 }}>Dirección de Delivery</span>
                      <p style={{ margin: 0, fontSize: 13 }}>{clienteHistorial.direccion_delivery || "Sin dirección fija registrada"}</p>
                    </div>

                    <div>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block", textTransform: "uppercase", fontWeight: 700 }}>Preferencias & Notas</span>
                      <p style={{ margin: 0, fontSize: 13, color: "var(--primary-dark)", fontWeight: 600 }}>
                        {clienteHistorial.notas_preferencias || "Sin notas especiales registradas"}
                      </p>
                    </div>
                  </div>

                  {clienteHistorial.telefono && (() => {
                    const rawDigits = clienteHistorial.telefono.replace(/\D/g, "");
                    const cleanPhone = rawDigits.startsWith("58") ? rawDigits.slice(2) : rawDigits.replace(/^0/, "");
                    return (
                      <a
                        href={`https://wa.me/58${cleanPhone}?text=${encodeURIComponent(
                          `¡Hola ${clienteHistorial.nombre}! 👋 Te escribimos de La Parada del Sabor 🫓`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-submit-recipe"
                        style={{
                          textAlign: "center",
                          textDecoration: "none",
                          background: "#25D366",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                        }}
                      >
                        <span>💬 Abrir Chat de WhatsApp</span>
                      </a>
                    );
                  })()}
                </div>
              )}

              {/* Acciones del Footer */}
              <div className="modal-recipe-actions" style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                <button
                  type="button"
                  onClick={() => {
                    setModalHistorial(false);
                    pedirConfirmacionEliminar(clienteHistorial);
                  }}
                  className="btn-cancel"
                  style={{ color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.4)" }}
                >
                  🗑️ Eliminar
                </button>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setModalHistorial(false);
                      abrirEditar(clienteHistorial);
                    }}
                    className="btn-insumo-adjust"
                  >
                    ✏️ Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalHistorial(false)}
                    className="btn-cancel"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal de Confirmación de Eliminación */}
      {clienteAEliminar && (
        <div className="modal-overlay" onClick={() => setClienteAEliminar(null)}>
          <div className="modal-recipe-card" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-recipe-header">
              <h2 style={{ color: "#ef4444" }}>⚠️ Eliminar Cliente</h2>
              <button
                type="button"
                onClick={() => setClienteAEliminar(null)}
                className="btn-modal-close"
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "16px 0" }}>
              <p style={{ margin: 0, fontSize: 14, color: "var(--text)" }}>
                ¿Estás seguro de que deseas eliminar permanentemente a <strong>{clienteAEliminar.nombre}</strong> del directorio?
              </p>
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                Esta acción no se puede deshacer. Sus ventas históricas no se borrarán pero quedarán desvinculadas.
              </p>

              {errorEliminar && (
                <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(239, 68, 68, 0.12)", color: "#ef4444", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
                  ⚠️ {errorEliminar}
                </div>
              )}
            </div>

            <div className="modal-recipe-actions">
              <button
                type="button"
                onClick={() => setClienteAEliminar(null)}
                className="btn-cancel"
                disabled={eliminando}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={ejecutarEliminar}
                disabled={eliminando}
                className="btn-submit-recipe"
                style={{ background: "#ef4444", color: "#ffffff" }}
              >
                {eliminando ? "Eliminando..." : "🗑️ Sí, Eliminar Cliente"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Abono / Pago de Comanda a Crédito */}
      {comandaAbono && (() => {
        const { totalOriginalUsd, totalAbonadoUsd, saldoPendienteUsd } = calcularSaldoPendienteComanda(comandaAbono, tasaBcv);
        const comandaTotal = saldoPendienteUsd;
        const abonoVal = typeof montoAbonoUsd === "number" ? montoAbonoUsd : 0;
        const restanteUsd = Math.max(0, Number((comandaTotal - abonoVal).toFixed(2)));
        const esTotal = abonoVal >= comandaTotal - 0.01;

        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Registrar Pago o Abono a Crédito"
            className="modal-overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget && !procesandoAbono) cerrarModalAbono();
            }}
          >
            <div
              className="modal-recipe-card"
              style={{
                maxWidth: 480,
                width: "95%",
                maxHeight: "90vh",
                overflowY: "auto",
                borderRadius: 20,
              }}
            >
              <div className="modal-recipe-header" style={{ paddingBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 28 }}>💰</span>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 18, color: "var(--text)" }}>
                      Abonar / Saldar Deuda
                    </h2>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
                      Comanda #{comandaAbono.numero_comanda?.toString().padStart(4, "0") || comandaAbono.id.slice(0, 6)} • Saldo Pendiente: ${comandaTotal.toFixed(2)} USD {totalAbonadoUsd > 0 ? `(Abonado: $${totalAbonadoUsd.toFixed(2)} / Original: $${totalOriginalUsd.toFixed(2)})` : ""}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={cerrarModalAbono}
                  disabled={procesandoAbono}
                  className="btn-modal-close"
                >
                  ✕
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "12px 0" }}>
                {/* Selector rápido: Pago Total vs Parcial */}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playPop();
                      setMontoAbonoUsd(comandaTotal);
                    }}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: esTotal ? "2px solid #16a34a" : "1px solid var(--border)",
                      background: esTotal ? "rgba(34, 197, 94, 0.12)" : "var(--surface)",
                      color: esTotal ? "#16a34a" : "var(--text)",
                      fontWeight: 800,
                      fontSize: 12.5,
                      cursor: "pointer",
                    }}
                  >
                    ✅ Saldar Deuda (${comandaTotal.toFixed(2)})
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      sounds.playPop();
                      if (esTotal) setMontoAbonoUsd(Number((comandaTotal / 2).toFixed(2)));
                    }}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: !esTotal ? "2px solid var(--primary)" : "1px solid var(--border)",
                      background: !esTotal ? "var(--primary-light)" : "var(--surface)",
                      color: !esTotal ? "var(--primary-dark)" : "var(--text)",
                      fontWeight: 800,
                      fontSize: 12.5,
                      cursor: "pointer",
                    }}
                  >
                    🔀 Abono Parcial
                  </button>
                </div>

                {/* Monto a Abonar Input */}
                <div className="form-field">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text)" }}>
                      Monto a Abonar ($ USD):
                    </label>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      ~Bs. {(abonoVal * tasaBcv).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    max={comandaTotal}
                    value={montoAbonoUsd}
                    onChange={(e) => {
                      const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                      setMontoAbonoUsd(val);
                    }}
                    placeholder={`0.00 (Máx $${comandaTotal.toFixed(2)})`}
                    className="form-input"
                    style={{ fontSize: 16, fontWeight: 900, color: "var(--primary-dark)" }}
                  />
                  {!esTotal && abonoVal > 0 && (
                    <span style={{ fontSize: 11, color: "#dc2626", fontWeight: 700, marginTop: 4, display: "block" }}>
                      ⚠️ Quedará pendiente una deuda de: ${restanteUsd.toFixed(2)} USD (~Bs. {(restanteUsd * tasaBcv).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                    </span>
                  )}
                </div>

                {/* Método de Pago del Abono */}
                <div className="form-field">
                  <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text)", marginBottom: 4 }}>
                    Método de Pago Recibido:
                  </label>
                  <select
                    value={metodoPagoAbono}
                    onChange={(e) => setMetodoPagoAbono(e.target.value as MetodoPago)}
                    className="payment-select"
                    style={{ fontSize: 13, fontWeight: 700 }}
                  >
                    <option value="pago_movil">📱 Pago Móvil (Bs)</option>
                    <option value="efectivo_usd">💵 Efectivo USD</option>
                    <option value="efectivo_bs">🇻🇪 Efectivo Bs</option>
                    <option value="transferencia">🏦 Transferencia Bancaria (Bs)</option>
                    <option value="binance">🟡 Binance Pay (USDT)</option>
                    <option value="zelle">🟣 Zelle (USD)</option>
                    <option value="pago_mixto">🔀 Pago Mixto / Fraccionado</option>
                  </select>
                </div>

                {/* Subpanel si el método de abono es mixto */}
                {metodoPagoAbono === "pago_mixto" && (
                  <div
                    style={{
                      background: "rgba(245, 158, 11, 0.08)",
                      border: "1.5px solid #f59e0b",
                      borderRadius: 12,
                      padding: "10px 12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      maxHeight: "220px",
                      overflowY: "auto",
                      scrollbarWidth: "thin",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span style={{ fontSize: 10.5, color: "var(--text-muted)", display: "block" }}>Meta a Abonar:</span>
                        <strong style={{ fontSize: 13, color: "#d97706", fontWeight: 900 }}>
                          ${abonoVal.toFixed(2)} USD
                        </strong>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: 10, color: "var(--text-muted)", display: "block" }}>Estado Desglose:</span>
                        {Math.abs(abonoMixtoPendienteUsd) < 0.01 ? (
                          <span style={{ fontSize: 10.5, fontWeight: 900, color: "#16a34a", background: "rgba(34, 197, 94, 0.15)", padding: "2px 6px", borderRadius: 4 }}>
                            ✅ Cuadrado
                          </span>
                        ) : abonoMixtoPendienteUsd > 0 ? (
                          <span style={{ fontSize: 10.5, fontWeight: 900, color: "#dc2626", background: "rgba(239, 68, 68, 0.15)", padding: "2px 6px", borderRadius: 4 }}>
                            ⚠️ Faltan ${abonoMixtoPendienteUsd.toFixed(2)}
                          </span>
                        ) : (
                          <span style={{ fontSize: 10.5, fontWeight: 900, color: "#dc2626", background: "rgba(239, 68, 68, 0.15)", padding: "2px 6px", borderRadius: 4 }}>
                            ⚠️ Exceso ${Math.abs(abonoMixtoPendienteUsd).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Desglose: Efectivo USD */}
                    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px" }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", display: "block", marginBottom: 2 }}>💵 Efectivo USD:</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="0.00"
                        value={abonoMixtoEfUsd}
                        onChange={(e) => setAbonoMixtoEfUsd(e.target.value === "" ? "" : parseFloat(e.target.value))}
                        className="cart-notes-input"
                        style={{ fontSize: 12, fontWeight: 800 }}
                      />
                    </div>

                    {/* Desglose: Pago Móvil Bs */}
                    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px" }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", display: "block", marginBottom: 2 }}>📱 Pago Móvil (Bs):</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="0.00"
                        value={abonoMixtoPmBs}
                        onChange={(e) => setAbonoMixtoPmBs(e.target.value === "" ? "" : parseFloat(e.target.value))}
                        className="cart-notes-input"
                        style={{ fontSize: 12, fontWeight: 800 }}
                      />
                    </div>

                    {/* Desglose: Efectivo Bs */}
                    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px" }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", display: "block", marginBottom: 2 }}>🇻🇪 Efectivo Bs:</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="0.00"
                        value={abonoMixtoEfBs}
                        onChange={(e) => setAbonoMixtoEfBs(e.target.value === "" ? "" : parseFloat(e.target.value))}
                        className="cart-notes-input"
                        style={{ fontSize: 12, fontWeight: 800 }}
                      />
                    </div>

                    {/* Desglose: Transferencia Bs */}
                    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px" }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", display: "block", marginBottom: 2 }}>🏦 Transferencia (Bs):</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="0.00"
                        value={abonoMixtoTransfBs}
                        onChange={(e) => setAbonoMixtoTransfBs(e.target.value === "" ? "" : parseFloat(e.target.value))}
                        className="cart-notes-input"
                        style={{ fontSize: 12, fontWeight: 800 }}
                      />
                    </div>

                    {/* Desglose: Binance USDT */}
                    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px" }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", display: "block", marginBottom: 2 }}>🟡 Binance Pay (USDT):</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="0.00"
                        value={abonoMixtoBinance}
                        onChange={(e) => setAbonoMixtoBinance(e.target.value === "" ? "" : parseFloat(e.target.value))}
                        className="cart-notes-input"
                        style={{ fontSize: 12, fontWeight: 800 }}
                      />
                    </div>

                    {/* Desglose: Zelle USD */}
                    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px" }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", display: "block", marginBottom: 2 }}>🟣 Zelle (USD):</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="0.00"
                        value={abonoMixtoZelle}
                        onChange={(e) => setAbonoMixtoZelle(e.target.value === "" ? "" : parseFloat(e.target.value))}
                        className="cart-notes-input"
                        style={{ fontSize: 12, fontWeight: 800 }}
                      />
                    </div>
                  </div>
                )}

                {/* Notas / Referencia de Pago */}
                <div className="form-field">
                  <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text)", marginBottom: 4 }}>
                    Referencia / Nota del Pago:
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Ref #4589 o 'Entregó $10 en efectivo a tía María'"
                    value={notasAbono}
                    onChange={(e) => setNotasAbono(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              {/* Botones de acción del Modal Abono */}
              <div className="modal-recipe-actions" style={{ marginTop: 8 }}>
                <button
                  type="button"
                  onClick={cerrarModalAbono}
                  disabled={procesandoAbono}
                  className="btn-cancel"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarAbono}
                  disabled={procesandoAbono || !abonoVal || abonoVal <= 0}
                  className="btn-submit-recipe"
                  style={{
                    background: esTotal ? "#16a34a" : "var(--primary-dark)",
                    color: "#ffffff",
                    fontWeight: 800,
                  }}
                >
                  {procesandoAbono
                    ? "Procesando..."
                    : esTotal
                    ? "✅ Confirmar Pago Total"
                    : `💾 Registrar Abono ($${abonoVal.toFixed(2)})`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </main>
  );
}
