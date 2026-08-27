"use client";

import { useState, useMemo } from "react";
import { Gasto, Proveedor, CuentaNegocio, CategoriaGasto } from "@/types/database";
import { crearGasto, actualizarGasto, eliminarGasto, crearCuentaNegocio, actualizarCuentaNegocio } from "./actions";
import { createClient } from "@/lib/supabase/client";

interface GastosClientProps {
  gastosIniciales: Gasto[];
  cuentasIniciales: CuentaNegocio[];
  proveedores: Proveedor[];
  tasaBcv: number;
}

const CATEGORIAS_CONFIG: Record<CategoriaGasto, { label: string; icon: string; color: string }> = {
  servicios: { label: "Servicios Operativos", icon: "⚡", color: "#3b82f6" },
  nomina: { label: "Nómina & Personal", icon: "👥", color: "#8b5cf6" },
  proveedores: { label: "Proveedores / Insumos", icon: "🚚", color: "#10b981" },
  alquiler: { label: "Alquiler / Local", icon: "🏢", color: "#f59e0b" },
  mantenimiento: { label: "Mantenimiento & Reparación", icon: "🛠️", color: "#64748b" },
  marketing: { label: "Publicidad & Redes", icon: "📣", color: "#ec4899" },
  impuestos: { label: "Impuestos & Tasas", icon: "🧾", color: "#0ea5e9" },
  otros: { label: "Otros Gastos", icon: "📦", color: "#6b7280" },
};

const SUBCATEGORIAS_SUGERIDAS: Record<CategoriaGasto, string[]> = {
  servicios: ["Gas Comercial / Cilindros", "Agua (Cisterna / Tubería)", "Electricidad (Corpoelec)", "Internet / WiFi", "Aseo Urbano"],
  nomina: ["Sueldo Semanal", "Adelanto de Sueldo", "Jornal Diario", "Propinas / Incentivo", "Liquidación"],
  proveedores: ["Insumos / Alimentos", "Carnes / Pollo", "Quesos / Lácteos", "Vegetales / Verduras", "Empaques / Descartables"],
  alquiler: ["Alquiler Local Mensual", "Depósito / Adelanto", "Condominio"],
  mantenimiento: ["Reparación Plancha / Cocina", "Bombillos / Electricidad", "Plomería", "Artículos de Limpieza", "Fumigación"],
  marketing: ["Redes Sociales / Ads", "Diseño Gráfico / Impresiones", "Fotografía", "Volantes"],
  impuestos: ["Patente Municipal", "Seniat", "Permisos Sanitarios", "Timbres Fiscales"],
  otros: ["Transporte / Taxis", "Papelería", "Hielo", "Misceláneos"],
};

export default function GastosClient({
  gastosIniciales,
  cuentasIniciales,
  proveedores,
  tasaBcv,
}: GastosClientProps) {
  const [tabActiva, setTabActiva] = useState<"gastos" | "cuentas">("gastos");
  const [gastos, setGastos] = useState<Gasto[]>(gastosIniciales);
  const [cuentas, setCuentas] = useState<CuentaNegocio[]>(cuentasIniciales);

  // Modales
  const [modalGasto, setModalGasto] = useState(false);
  const [gastoEditando, setGastoEditando] = useState<Gasto | null>(null);
  const [modalCuenta, setModalCuenta] = useState(false);
  const [cuentaEditando, setCuentaEditando] = useState<CuentaNegocio | null>(null);
  const [modalFacturaUrl, setModalFacturaUrl] = useState<string | null>(null);

  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);

  // Filtros
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [filtroCuenta, setFiltroCuenta] = useState<string>("todas");
  const [filtroRango, setFiltroRango] = useState<"hoy" | "semana" | "mes" | "todos">("mes");
  const [busqueda, setBusqueda] = useState("");

  // Estado Formulario Gasto
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [categoria, setCategoria] = useState<CategoriaGasto>("servicios");
  const [subcategoria, setSubcategoria] = useState("Gas Comercial / Cilindros");
  const [descripcion, setDescripcion] = useState("");
  const [beneficiario, setBeneficiario] = useState("");
  const [proveedorId, setProveedorId] = useState("");
  const [montoUsd, setMontoUsd] = useState("");
  const [montoBs, setMontoBs] = useState("");
  const [cuentaId, setCuentaId] = useState("");
  const [cuentaOrigen, setCuentaOrigen] = useState<string>("efectivo_usd");
  const [numeroFactura, setNumeroFactura] = useState("");
  const [comprobanteUrl, setComprobanteUrl] = useState("");
  const [notas, setNotas] = useState("");

  // Estado Formulario Cuenta
  const [ctaNombre, setCtaNombre] = useState("");
  const [ctaTipo, setCtaTipo] = useState<CuentaNegocio["tipo"]>("banco_nacional");
  const [ctaMoneda, setCtaMoneda] = useState<CuentaNegocio["moneda"]>("VES");
  const [ctaBanco, setCtaBanco] = useState("");
  const [ctaTitular, setCtaTitular] = useState("");
  const [ctaNumero, setCtaNumero] = useState("");
  const [ctaIcono, setCtaIcono] = useState("🏦");
  const [ctaColor, setCtaColor] = useState("#3b82f6");
  const [ctaNotas, setCtaNotas] = useState("");

  // Abrir Modal para Crear Gasto
  const abrirModalCrearGasto = () => {
    setGastoEditando(null);
    setErrorMsg("");
    setFecha(new Date().toISOString().split("T")[0]);
    setCategoria("servicios");
    setSubcategoria(SUBCATEGORIAS_SUGERIDAS.servicios[0] || "");
    setDescripcion("");
    setBeneficiario("");
    setProveedorId("");
    setMontoUsd("");
    setMontoBs("");
    setCuentaId(cuentas[0]?.id || "");
    setCuentaOrigen(cuentas[0]?.codigo || "efectivo_usd");
    setNumeroFactura("");
    setComprobanteUrl("");
    setNotas("");
    setModalGasto(true);
  };

  // Abrir Modal para Editar Gasto
  const abrirModalEditarGasto = (g: Gasto) => {
    setGastoEditando(g);
    setErrorMsg("");
    setFecha(g.fecha);
    setCategoria(g.categoria);
    setSubcategoria(g.subcategoria || "");
    setDescripcion(g.descripcion);
    setBeneficiario(g.beneficiario || "");
    setProveedorId(g.proveedor_id || "");
    setMontoUsd(g.monto_usd.toString());
    setMontoBs(g.monto_bs ? g.monto_bs.toString() : (g.monto_usd * (g.tasa_bcv || tasaBcv)).toFixed(2));
    setCuentaId(g.cuenta_id || "");
    setCuentaOrigen(g.cuenta_origen || "efectivo_usd");
    setNumeroFactura(g.numero_factura || "");
    setComprobanteUrl(g.comprobante_url || "");
    setNotas(g.notas || "");
    setModalGasto(true);
  };

  // Manejo de cambio de categoría
  const handleCambioCategoria = (cat: CategoriaGasto) => {
    setCategoria(cat);
    const sugerencias = SUBCATEGORIAS_SUGERIDAS[cat];
    if (sugerencias && sugerencias.length > 0) {
      setSubcategoria(sugerencias[0]);
    } else {
      setSubcategoria("");
    }
  };

  // Cálculo automático dual USD <-> Bs
  const handleCambioMontoUsd = (val: string) => {
    setMontoUsd(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0 && tasaBcv > 0) {
      setMontoBs((num * tasaBcv).toFixed(2));
    } else {
      setMontoBs("");
    }
  };

  const handleCambioMontoBs = (val: string) => {
    setMontoBs(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0 && tasaBcv > 0) {
      setMontoUsd((num / tasaBcv).toFixed(2));
    }
  };

  // Subir comprobante a Storage
  const handleSubirComprobante = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg("El archivo adjunto no debe superar los 10 MB.");
      return;
    }

    const tiposPermitidos = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
    if (!tiposPermitidos.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|webp|heic|pdf)$/i)) {
      setErrorMsg("Solo se permiten imágenes (JPG, PNG, WebP) o documentos PDF.");
      return;
    }

    try {
      setSubiendoArchivo(true);
      setErrorMsg("");
      const supabase = createClient();
      const fileExt = file.name.split(".").pop() || "jpg";
      const fileName = `gasto_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `facturas/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("comprobantes-gastos")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Error subiendo comprobante:", uploadError);
        setErrorMsg("No se pudo subir el archivo. Intenta ingresar una URL o continúa sin adjunto.");
      } else {
        const { data: publicData } = supabase.storage
          .from("comprobantes-gastos")
          .getPublicUrl(filePath);

        if (publicData?.publicUrl) {
          setComprobanteUrl(publicData.publicUrl);
        }
      }
    } catch (err: any) {
      console.error("Excepción subiendo archivo:", err);
    } finally {
      setSubiendoArchivo(false);
    }
  };

  // Guardar Gasto (Crear o Actualizar)
  const handleGuardarGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const usd = parseFloat(montoUsd);
    if (isNaN(usd) || usd <= 0) {
      setErrorMsg("Por favor ingresa un monto válido mayor a 0.");
      return;
    }
    if (!descripcion.trim()) {
      setErrorMsg("Por favor escribe la descripción del gasto.");
      return;
    }

    setGuardando(true);

    const payload = {
      fecha,
      categoria,
      subcategoria,
      descripcion,
      beneficiario,
      proveedor_id: proveedorId || undefined,
      monto_usd: usd,
      monto_bs: parseFloat(montoBs) || Number((usd * tasaBcv).toFixed(2)),
      tasa_bcv: tasaBcv,
      cuenta_id: cuentaId || undefined,
      cuenta_origen: cuentaOrigen,
      numero_factura: numeroFactura,
      comprobante_url: comprobanteUrl,
      estado: gastoEditando?.estado || ("pagado" as const),
      notas,
    };

    if (gastoEditando) {
      const res = await actualizarGasto(gastoEditando.id, payload);
      setGuardando(false);
      if (res.ok && res.gasto) {
        setGastos((prev) => prev.map((item) => (item.id === res.gasto!.id ? res.gasto! : item)));
        setModalGasto(false);
      } else {
        setErrorMsg(res.error || "Error al actualizar el gasto.");
      }
    } else {
      const res = await crearGasto(payload);
      setGuardando(false);
      if (res.ok && res.gasto) {
        setGastos((prev) => [res.gasto!, ...prev]);
        setModalGasto(false);
      } else {
        setErrorMsg(res.error || "Error al registrar el gasto.");
      }
    }
  };

  const handleEliminarGasto = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este registro de gasto?")) return;
    const res = await eliminarGasto(id);
    if (res.ok) {
      setGastos((prev) => prev.filter((g) => g.id !== id));
    } else {
      alert(res.error || "No se pudo eliminar el gasto.");
    }
  };

  // Abrir Modal Cuenta
  const abrirModalCrearCuenta = () => {
    setCuentaEditando(null);
    setCtaNombre("");
    setCtaTipo("banco_nacional");
    setCtaMoneda("VES");
    setCtaBanco("");
    setCtaTitular("");
    setCtaNumero("");
    setCtaIcono("🏦");
    setCtaColor("#3b82f6");
    setCtaNotas("");
    setModalCuenta(true);
  };

  const abrirModalEditarCuenta = (cta: CuentaNegocio) => {
    setCuentaEditando(cta);
    setCtaNombre(cta.nombre);
    setCtaTipo(cta.tipo);
    setCtaMoneda(cta.moneda);
    setCtaBanco(cta.banco_plataforma || "");
    setCtaTitular(cta.titular || "");
    setCtaNumero(cta.numero_cuenta_telefono || "");
    setCtaIcono(cta.icono || "🏦");
    setCtaColor(cta.color || "#3b82f6");
    setCtaNotas(cta.notas || "");
    setModalCuenta(true);
  };

  const handleGuardarCuenta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ctaNombre.trim()) {
      alert("El nombre de la cuenta es obligatorio.");
      return;
    }

    setGuardando(true);
    const payload = {
      nombre: ctaNombre.trim(),
      tipo: ctaTipo,
      moneda: ctaMoneda,
      banco_plataforma: ctaBanco,
      titular: ctaTitular,
      numero_cuenta_telefono: ctaNumero,
      icono: ctaIcono,
      color: ctaColor,
      notas: ctaNotas,
    };

    if (cuentaEditando) {
      const res = await actualizarCuentaNegocio(cuentaEditando.id, payload);
      setGuardando(false);
      if (res.ok && res.cuenta) {
        setCuentas((prev) => prev.map((c) => (c.id === res.cuenta!.id ? res.cuenta! : c)));
        setModalCuenta(false);
      } else {
        alert(res.error || "Error al actualizar la cuenta.");
      }
    } else {
      const res = await crearCuentaNegocio(payload);
      setGuardando(false);
      if (res.ok && res.cuenta) {
        setCuentas((prev) => [...prev, res.cuenta!]);
        setModalCuenta(false);
      } else {
        alert(res.error || "Error al crear la cuenta.");
      }
    }
  };

  // Filtrado de Gastos
  const gastosFiltrados = useMemo(() => {
    const ahora = new Date();
    const hoyStr = ahora.toISOString().split("T")[0];
    const hace7 = new Date();
    hace7.setDate(hace7.getDate() - 7);
    const hace7Str = hace7.toISOString().split("T")[0];
    const mesInicioStr = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString().split("T")[0];

    return gastos.filter((g) => {
      if (filtroRango === "hoy" && g.fecha !== hoyStr) return false;
      if (filtroRango === "semana" && g.fecha < hace7Str) return false;
      if (filtroRango === "mes" && g.fecha < mesInicioStr) return false;

      if (filtroCategoria !== "todas" && g.categoria !== filtroCategoria) return false;

      if (filtroCuenta !== "todas") {
        const ctaMatchId = g.cuenta_id === filtroCuenta;
        const ctaMatchCod = g.cuenta_origen === filtroCuenta;
        if (!ctaMatchId && !ctaMatchCod) return false;
      }

      if (busqueda.trim()) {
        const query = busqueda.toLowerCase();
        const matchDesc = g.descripcion.toLowerCase().includes(query);
        const matchSub = g.subcategoria?.toLowerCase().includes(query);
        const matchBen = g.beneficiario?.toLowerCase().includes(query);
        const matchFact = g.numero_factura?.toLowerCase().includes(query);
        const matchProv = g.proveedor?.nombre.toLowerCase().includes(query);
        if (!matchDesc && !matchSub && !matchBen && !matchFact && !matchProv) return false;
      }

      return true;
    });
  }, [gastos, filtroRango, filtroCategoria, filtroCuenta, busqueda]);

  // Totales KPI
  const totalGastosUsd = useMemo(() => {
    return gastosFiltrados.reduce((acc, g) => acc + Number(g.monto_usd || 0), 0);
  }, [gastosFiltrados]);

  const totalGastosBs = useMemo(() => {
    return gastosFiltrados.reduce((acc, g) => acc + Number(g.monto_bs || 0), 0);
  }, [gastosFiltrados]);

  const totalServiciosUsd = useMemo(() => {
    return gastosFiltrados
      .filter((g) => g.categoria === "servicios")
      .reduce((acc, g) => acc + Number(g.monto_usd || 0), 0);
  }, [gastosFiltrados]);

  const totalNominaUsd = useMemo(() => {
    return gastosFiltrados
      .filter((g) => g.categoria === "nomina")
      .reduce((acc, g) => acc + Number(g.monto_usd || 0), 0);
  }, [gastosFiltrados]);

  const totalProveedoresUsd = useMemo(() => {
    return gastosFiltrados
      .filter((g) => g.categoria === "proveedores")
      .reduce((acc, g) => acc + Number(g.monto_usd || 0), 0);
  }, [gastosFiltrados]);

  // Totales por Cuenta
  const gastoPorCuenta = useMemo(() => {
    const map: Record<string, { usd: number; bs: number; count: number }> = {};
    gastos.forEach((g) => {
      const key = g.cuenta_id || g.cuenta_origen || "otra";
      if (!map[key]) map[key] = { usd: 0, bs: 0, count: 0 };
      map[key].usd += Number(g.monto_usd || 0);
      map[key].bs += Number(g.monto_bs || 0);
      map[key].count += 1;
    });
    return map;
  }, [gastos]);

  // Exportar a CSV
  const handleExportarCsv = () => {
    const encabezados = ["Fecha", "Categoría", "Subcategoría", "Descripción", "Beneficiario", "Cuenta", "Monto USD", "Monto BS", "Nro Factura", "Notas"];
    const filas = gastosFiltrados.map((g) => [
      g.fecha,
      CATEGORIAS_CONFIG[g.categoria]?.label || g.categoria,
      g.subcategoria || "",
      `"${g.descripcion.replace(/"/g, '""')}"`,
      `"${g.beneficiario || ""}"`,
      `"${g.cuenta?.nombre || g.cuenta_origen || ""}"`,
      Number(g.monto_usd).toFixed(2),
      Number(g.monto_bs).toFixed(2),
      g.numero_factura || "",
      `"${(g.notas || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [encabezados.join(","), ...filas.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `gastos_la_parada_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <main className="recetas-container" style={{ maxWidth: 1320, margin: "0 auto", padding: "20px 24px" }}>
      {/* Header Principal con Estilo Nativo */}
      <div className="recetas-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="recetas-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span>💰 Gestión de Gastos & Cuentas</span>
          </h1>
          <p className="recetas-subtitle">
            Control operativo de servicios (gas, agua, luz, internet), nómina, pagos a proveedores, cuentas bancarias y facturas.
          </p>

          {/* Selector de Pestañas con clases nativas */}
          <div className="view-mode-toggle" style={{ marginTop: 14 }}>
            <button
              type="button"
              onClick={() => setTabActiva("gastos")}
              className={`view-mode-btn ${tabActiva === "gastos" ? "active" : ""}`}
            >
              📋 Registro de Gastos ({gastos.length})
            </button>
            <button
              type="button"
              onClick={() => setTabActiva("cuentas")}
              className={`view-mode-btn ${tabActiva === "cuentas" ? "active" : ""}`}
            >
              💳 Cuentas & Métodos de Pago ({cuentas.length})
            </button>
          </div>
        </div>

        {/* Botones de Acción del Sistema */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {tabActiva === "gastos" ? (
            <>
              <button
                type="button"
                onClick={handleExportarCsv}
                className="btn-refresh-action"
                title="Descargar reporte en formato CSV"
              >
                <span>📥</span> Exportar Reporte
              </button>

              <button
                type="button"
                onClick={abrirModalCrearGasto}
                className="btn-primary-action"
              >
                <span>+</span> Registrar Nuevo Gasto
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={abrirModalCrearCuenta}
              className="btn-primary-action"
            >
              <span>+</span> Nueva Cuenta Financiera
            </button>
          )}
        </div>
      </div>

      {tabActiva === "gastos" ? (
        <>
          {/* Tarjetas KPI de Resumen */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 24 }}>
            <div className="product-kpi-card" style={{ padding: "16px 18px", borderRadius: 18, border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span className="product-kpi-label">Total Gastos</span>
                <span style={{ fontSize: 22 }}>💸</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "var(--primary)" }}>
                ${totalGastosUsd.toFixed(2)} <span style={{ fontSize: 13, fontWeight: 600 }}>USD</span>
              </div>
              <div className="product-kpi-sub" style={{ marginTop: 2 }}>
                Bs. {totalGastosBs.toFixed(2)}
              </div>
            </div>

            <div className="product-kpi-card" style={{ padding: "16px 18px", borderRadius: 18, border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span className="product-kpi-label" style={{ color: "#3b82f6" }}>⚡ Servicios</span>
                <span style={{ fontSize: 22 }}>💡</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "var(--text)" }}>
                ${totalServiciosUsd.toFixed(2)} <span style={{ fontSize: 13, fontWeight: 600 }}>USD</span>
              </div>
              <div className="product-kpi-sub" style={{ marginTop: 2 }}>
                Gas, Agua, Luz, Internet
              </div>
            </div>

            <div className="product-kpi-card" style={{ padding: "16px 18px", borderRadius: 18, border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span className="product-kpi-label" style={{ color: "#8b5cf6" }}>👥 Nómina & Personal</span>
                <span style={{ fontSize: 22 }}>👨‍🍳</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "var(--text)" }}>
                ${totalNominaUsd.toFixed(2)} <span style={{ fontSize: 13, fontWeight: 600 }}>USD</span>
              </div>
              <div className="product-kpi-sub" style={{ marginTop: 2 }}>
                Sueldos, Adelantos, Jornales
              </div>
            </div>

            <div className="product-kpi-card" style={{ padding: "16px 18px", borderRadius: 18, border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span className="product-kpi-label" style={{ color: "#10b981" }}>🚚 Proveedores</span>
                <span style={{ fontSize: 22 }}>📦</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "var(--text)" }}>
                ${totalProveedoresUsd.toFixed(2)} <span style={{ fontSize: 13, fontWeight: 600 }}>USD</span>
              </div>
              <div className="product-kpi-sub" style={{ marginTop: 2 }}>
                Insumos & Despensa
              </div>
            </div>
          </div>

          {/* Barra de Filtros & Búsqueda con Clases Nativas */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 18, padding: "14px 18px", marginBottom: 18, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between", boxShadow: "var(--shadow-sm)" }}>
            <div className="view-mode-toggle">
              {(["hoy", "semana", "mes", "todos"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setFiltroRango(r)}
                  className={`view-mode-btn ${filtroRango === r ? "active" : ""}`}
                >
                  {r === "hoy" ? "Hoy" : r === "semana" ? "7 Días" : r === "mes" ? "Este Mes" : "Historial"}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", flex: "1 1 320px", justifyContent: "flex-end" }}>
              <input
                type="text"
                placeholder="🔍 Buscar gasto, factura, beneficiario..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="form-input"
                style={{ minWidth: 200, flex: "1 1 200px" }}
              />

              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="form-input"
                style={{ width: "auto", fontWeight: 700 }}
              >
                <option value="todas">Todas las Categorías</option>
                {Object.entries(CATEGORIAS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.icon} {v.label}
                  </option>
                ))}
              </select>

              <select
                value={filtroCuenta}
                onChange={(e) => setFiltroCuenta(e.target.value)}
                className="form-input"
                style={{ width: "auto", fontWeight: 700 }}
              >
                <option value="todas">Todas las Cuentas</option>
                {cuentas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icono} {c.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tabla de Gastos */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, overflow: "hidden", boxShadow: "var(--shadow-md)" }}>
            {gastosFiltrados.length === 0 ? (
              <div className="recetas-empty-box" style={{ border: "none" }}>
                <span style={{ fontSize: 48 }}>🧾</span>
                <strong style={{ fontSize: 17, color: "var(--text)" }}>No hay gastos registrados en este período</strong>
                <p className="recetas-subtitle">Usa el botón "+ Registrar Nuevo Gasto" para asentar pagos.</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                      <th style={{ padding: "14px 16px", fontWeight: 800, color: "var(--text)" }}>Fecha</th>
                      <th style={{ padding: "14px 16px", fontWeight: 800, color: "var(--text)" }}>Categoría</th>
                      <th style={{ padding: "14px 16px", fontWeight: 800, color: "var(--text)" }}>Descripción / Beneficiario</th>
                      <th style={{ padding: "14px 16px", fontWeight: 800, color: "var(--text)" }}>Cuenta Origen</th>
                      <th style={{ padding: "14px 16px", fontWeight: 800, color: "var(--text)", textAlign: "right" }}>Monto</th>
                      <th style={{ padding: "14px 16px", fontWeight: 800, color: "var(--text)", textAlign: "center" }}>Factura / Adjunto</th>
                      <th style={{ padding: "14px 16px", fontWeight: 800, color: "var(--text)", textAlign: "center" }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gastosFiltrados.map((g) => {
                      const catCfg = CATEGORIAS_CONFIG[g.categoria] || CATEGORIAS_CONFIG.otros;
                      const cuentaMatch = g.cuenta || cuentas.find((c) => c.id === g.cuenta_id || c.codigo === g.cuenta_origen);

                      return (
                        <tr key={g.id} style={{ borderBottom: "1px solid var(--border-subtle)", transition: "background 0.15s ease" }}>
                          <td style={{ padding: "14px 16px", whiteSpace: "nowrap", fontWeight: 700, color: "var(--text-muted)" }}>
                            {g.fecha}
                          </td>

                          <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                padding: "4px 10px",
                                borderRadius: 8,
                                fontSize: 12,
                                fontWeight: 800,
                                background: `${catCfg.color}18`,
                                color: catCfg.color,
                                border: `1px solid ${catCfg.color}35`,
                              }}
                            >
                              <span>{catCfg.icon}</span>
                              <span>{g.subcategoria || catCfg.label}</span>
                            </span>
                          </td>

                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ fontWeight: 800, color: "var(--text)" }}>{g.descripcion}</div>
                            {g.beneficiario && (
                              <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
                                👤 Beneficiario: <strong>{g.beneficiario}</strong>
                              </div>
                            )}
                            {g.proveedor && (
                              <div style={{ fontSize: 11.5, color: "var(--green)", marginTop: 2, fontWeight: 700 }}>
                                🏢 Proveedor: {g.proveedor.nombre}
                              </div>
                            )}
                          </td>

                          <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                            <span style={{ fontSize: 12.5, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text)" }}>
                              <span>{cuentaMatch?.icono || "🏦"}</span>
                              <span>{cuentaMatch?.nombre || g.cuenta_origen}</span>
                            </span>
                          </td>

                          <td style={{ padding: "14px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                            <div style={{ fontSize: 15, fontWeight: 900, color: "var(--text)" }}>
                              ${Number(g.monto_usd).toFixed(2)} <span style={{ fontSize: 11, fontWeight: 700 }}>USD</span>
                            </div>
                            <div style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600 }}>
                              Bs. {Number(g.monto_bs).toFixed(2)}
                            </div>
                          </td>

                          <td style={{ padding: "14px 16px", textAlign: "center", whiteSpace: "nowrap" }}>
                            {g.comprobante_url ? (
                              <button
                                type="button"
                                onClick={() => setModalFacturaUrl(g.comprobante_url!)}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5,
                                  fontSize: 12,
                                  fontWeight: 800,
                                  color: "#3b82f6",
                                  background: "rgba(59, 130, 246, 0.12)",
                                  border: "1px solid rgba(59, 130, 246, 0.3)",
                                  padding: "5px 12px",
                                  borderRadius: 8,
                                  cursor: "pointer",
                                }}
                              >
                                <span>📎 Ver Factura</span>
                              </button>
                            ) : g.numero_factura ? (
                              <span style={{ fontSize: 12, color: "var(--text)", fontWeight: 700 }}>
                                Nro: {g.numero_factura}
                              </span>
                            ) : (
                              <span style={{ color: "var(--text-muted)", fontSize: 12, fontStyle: "italic" }}>Sin Factura</span>
                            )}
                          </td>

                          <td style={{ padding: "14px 16px", textAlign: "center", whiteSpace: "nowrap" }}>
                            <div style={{ display: "inline-flex", gap: 8 }}>
                              <button
                                type="button"
                                onClick={() => abrirModalEditarGasto(g)}
                                title="Modificar gasto"
                                style={{
                                  background: "var(--bg-subtle)",
                                  border: "1px solid var(--border)",
                                  color: "var(--primary)",
                                  padding: "6px 10px",
                                  borderRadius: 8,
                                  fontSize: 12,
                                  fontWeight: 800,
                                  cursor: "pointer",
                                }}
                              >
                                ✏️ Editar
                              </button>

                              <button
                                type="button"
                                onClick={() => handleEliminarGasto(g.id)}
                                title="Eliminar gasto"
                                style={{
                                  background: "rgba(239, 68, 68, 0.1)",
                                  border: "1px solid rgba(239, 68, 68, 0.3)",
                                  color: "#ef4444",
                                  padding: "6px 10px",
                                  borderRadius: 8,
                                  fontSize: 12,
                                  cursor: "pointer",
                                }}
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Pestaña: Gestión de Cuentas & Historial de Movimientos */
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
          {cuentas.map((cta) => {
            const gastoStats = gastoPorCuenta[cta.id] || gastoPorCuenta[cta.codigo] || { usd: 0, bs: 0, count: 0 };

            return (
              <div
                key={cta.id}
                className="product-kpi-card"
                style={{
                  background: "var(--bg-card)",
                  border: `1.5px solid var(--border)`,
                  borderTop: `4px solid ${cta.color || "var(--primary)"}`,
                  borderRadius: 20,
                  padding: "20px 22px",
                  boxShadow: "var(--shadow-md)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: 16,
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 32 }}>{cta.icono || "🏦"}</span>
                      <div>
                        <h3 style={{ fontSize: 17, fontWeight: 900, color: "var(--text)" }}>{cta.nombre}</h3>
                        <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700 }}>
                          {cta.banco_plataforma || cta.tipo} • Moneda: <strong>{cta.moneda}</strong>
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => abrirModalEditarCuenta(cta)}
                      style={{
                        background: "var(--bg-subtle)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        padding: "5px 10px",
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: "pointer",
                        color: "var(--text)",
                      }}
                    >
                      ✏️ Editar
                    </button>
                  </div>

                  {cta.titular && (
                    <div style={{ fontSize: 12.5, color: "var(--text)", marginTop: 12, background: "var(--bg-subtle)", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
                      <div>👤 Titular: <strong>{cta.titular}</strong></div>
                      {cta.numero_cuenta_telefono && (
                        <div style={{ marginTop: 3, color: "var(--text-muted)", fontSize: 12, fontWeight: 600 }}>
                          🔢 Cuenta / Ref: {cta.numero_cuenta_telefono}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Métricas de Gasto desde esta Cuenta */}
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                    <div>
                      <span className="product-kpi-label">
                        Total Pagado / Egresos
                      </span>
                      <div style={{ fontSize: 20, fontWeight: 900, color: "var(--primary)", marginTop: 2 }}>
                        ${gastoStats.usd.toFixed(2)} <span style={{ fontSize: 12 }}>USD</span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
                        Bs. {gastoStats.bs.toFixed(2)} • {gastoStats.count} pagos
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setFiltroCuenta(cta.id);
                        setTabActiva("gastos");
                      }}
                      className="btn-primary-action"
                      style={{ fontSize: 12, padding: "8px 14px" }}
                    >
                      Ver Pagos →
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal 1: Registrar / Modificar Gasto (CLASES NATIVAS DEL SISTEMA) */}
      {modalGasto && (
        <div className="modal-overlay" onClick={() => setModalGasto(false)}>
          <div className="modal-recipe-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal-recipe-header">
              <h2>
                <span>{gastoEditando ? "✏️ Modificar Gasto" : "➕ Registrar Nuevo Gasto"}</span>
              </h2>
              <button
                type="button"
                onClick={() => setModalGasto(false)}
                className="btn-modal-close"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", color: "#f87171", padding: "10px 14px", borderRadius: 10, fontSize: 13 }}>
                ⚠️ {errorMsg}
              </div>
            )}

            <form onSubmit={handleGuardarGasto} className="recipe-form">
              {/* Fecha & Categoría */}
              <div className="form-grid-2">
                <div className="form-field">
                  <label>Fecha del Gasto *</label>
                  <input
                    type="date"
                    required
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-field">
                  <label>Categoría Principal *</label>
                  <select
                    value={categoria}
                    onChange={(e) => handleCambioCategoria(e.target.value as CategoriaGasto)}
                    className="form-input"
                  >
                    {Object.entries(CATEGORIAS_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.icon} {v.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Subcategorías rápidas */}
              <div className="form-field">
                <label>Tipo de Gasto / Sugerencias:</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {SUBCATEGORIAS_SUGERIDAS[categoria]?.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => setSubcategoria(sug)}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 10,
                        fontSize: 11.5,
                        fontWeight: 800,
                        border: "1px solid var(--border)",
                        cursor: "pointer",
                        background: subcategoria === sug ? "var(--primary)" : "var(--bg-subtle)",
                        color: subcategoria === sug ? "#ffffff" : "var(--text)",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>

              {/* Descripción */}
              <div className="form-field">
                <label>Descripción Detallada *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Pago de gas, nómina semana 34, compra de aguacates..."
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="form-input"
                />
              </div>

              {/* Montos Dual USD / Bs */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, background: "var(--bg-subtle)", padding: "14px", borderRadius: 16, border: "1.5px dashed var(--border)" }}>
                <div className="form-field">
                  <label style={{ color: "var(--primary)", fontWeight: 900 }}>Monto en Dólares ($ USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={montoUsd}
                    onChange={(e) => handleCambioMontoUsd(e.target.value)}
                    className="form-input"
                    style={{ fontSize: 16, fontWeight: 900, borderColor: "var(--primary)" }}
                  />
                </div>

                <div className="form-field">
                  <label>Monto en Bolívares (Bs)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={montoBs}
                    onChange={(e) => handleCambioMontoBs(e.target.value)}
                    className="form-input"
                    style={{ fontSize: 15, fontWeight: 800 }}
                  />
                  <span style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, fontWeight: 600 }}>Tasa: {tasaBcv.toFixed(2)} Bs/USD</span>
                </div>
              </div>

              {/* Cuenta Origen & Beneficiario */}
              <div className="form-grid-2">
                <div className="form-field">
                  <label>Cuenta / Método de Pago *</label>
                  <select
                    value={cuentaId || cuentaOrigen}
                    onChange={(e) => {
                      const sel = e.target.value;
                      const c = cuentas.find((item) => item.id === sel || item.codigo === sel);
                      if (c) {
                        setCuentaId(c.id);
                        setCuentaOrigen(c.codigo);
                      } else {
                        setCuentaOrigen(sel);
                      }
                    }}
                    className="form-input"
                  >
                    {cuentas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icono} {c.nombre} ({c.moneda})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label>Beneficiario / Persona Pagada</label>
                  <input
                    type="text"
                    placeholder="Ej: Distribuidor Gas, Juan Pérez..."
                    value={beneficiario}
                    onChange={(e) => setBeneficiario(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              {/* Proveedor Asociado & Nro Factura */}
              <div className="form-grid-2">
                <div className="form-field">
                  <label>Proveedor (Opcional)</label>
                  <select
                    value={proveedorId}
                    onChange={(e) => setProveedorId(e.target.value)}
                    className="form-input"
                  >
                    <option value="">-- Sin proveedor asociado --</option>
                    {proveedores.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label>Nro. Factura / Comprobante</label>
                  <input
                    type="text"
                    placeholder="Ej: 00044240 / Control: 157296"
                    value={numeroFactura}
                    onChange={(e) => setNumeroFactura(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              {/* Adjuntar Foto / Factura */}
              <div className="form-field">
                <label>
                  Foto de Factura / Recibo <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(Opcional)</span>
                </label>
                <div style={{ display: "flex", gap: 10, alignItems: "center", background: "var(--bg-subtle)", padding: "10px 14px", borderRadius: 12, border: "1px solid var(--border)" }}>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleSubirComprobante}
                    disabled={subiendoArchivo}
                    style={{ fontSize: 12, color: "var(--text)" }}
                  />
                  {subiendoArchivo && <span style={{ fontSize: 12, color: "var(--primary)", fontWeight: 700 }}>⏳ Subiendo...</span>}
                  {comprobanteUrl && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 12, color: "var(--green)", fontWeight: 800 }}>✓ Adjunta</span>
                      <button
                        type="button"
                        onClick={() => setModalFacturaUrl(comprobanteUrl)}
                        style={{ fontSize: 11, background: "rgba(59,130,246,0.15)", border: "1px solid #3b82f6", color: "#3b82f6", padding: "2px 8px", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}
                      >
                        Ver
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Botones de Envío */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                <button
                  type="button"
                  onClick={() => setModalGasto(false)}
                  className="btn-refresh-action"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="btn-primary-action"
                >
                  {guardando ? "Guardando..." : gastoEditando ? "💾 Actualizar Gasto" : "💾 Guardar Gasto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Crear / Editar Cuenta Financiera */}
      {modalCuenta && (
        <div className="modal-overlay" onClick={() => setModalCuenta(false)}>
          <div className="modal-recipe-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="modal-recipe-header">
              <h2>
                <span>{cuentaEditando ? "✏️ Modificar Cuenta" : "➕ Nueva Cuenta Financiera"}</span>
              </h2>
              <button
                type="button"
                onClick={() => setModalCuenta(false)}
                className="btn-modal-close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGuardarCuenta} className="recipe-form">
              <div className="form-field">
                <label>Nombre de la Cuenta *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Banco de Venezuela (BDV), Binance Pay, Banesco..."
                  value={ctaNombre}
                  onChange={(e) => setCtaNombre(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-grid-2">
                <div className="form-field">
                  <label>Moneda *</label>
                  <select
                    value={ctaMoneda}
                    onChange={(e) => setCtaMoneda(e.target.value as any)}
                    className="form-input"
                  >
                    <option value="VES">VES (Bolívares)</option>
                    <option value="USD">USD (Dólares)</option>
                    <option value="USDT">USDT (Cripto)</option>
                    <option value="COP">COP (Pesos)</option>
                  </select>
                </div>

                <div className="form-field">
                  <label>Tipo de Cuenta</label>
                  <select
                    value={ctaTipo}
                    onChange={(e) => setCtaTipo(e.target.value as any)}
                    className="form-input"
                  >
                    <option value="banco_nacional">Banco Nacional</option>
                    <option value="billetera_digital">Billetera Digital (Zelle, etc.)</option>
                    <option value="cripto">Cripto (Binance)</option>
                    <option value="efectivo_usd">Efectivo USD (Gaveta)</option>
                    <option value="efectivo_bs">Efectivo Bs (Gaveta)</option>
                    <option value="caja_chica">Caja Chica</option>
                    <option value="otra">Otra Cuenta</option>
                  </select>
                </div>
              </div>

              <div className="form-field">
                <label>Banco o Plataforma</label>
                <input
                  type="text"
                  placeholder="Ej: Banco de Venezuela, Bancamiga, Zelle..."
                  value={ctaBanco}
                  onChange={(e) => setCtaBanco(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-grid-2">
                <div className="form-field">
                  <label>Titular de la Cuenta</label>
                  <input
                    type="text"
                    placeholder="Ej: La Parada del Sabor"
                    value={ctaTitular}
                    onChange={(e) => setCtaTitular(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-field">
                  <label>Nro. Cuenta / Teléfono / Ref</label>
                  <input
                    type="text"
                    placeholder="Ej: 0412-2595386 / 0102-0123..."
                    value={ctaNumero}
                    onChange={(e) => setCtaNumero(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              {/* Botones de Envío */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                <button
                  type="button"
                  onClick={() => setModalCuenta(false)}
                  className="btn-refresh-action"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="btn-primary-action"
                >
                  {guardando ? "Guardando..." : cuentaEditando ? "💾 Actualizar Cuenta" : "💾 Guardar Cuenta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Visor de Factura / Comprobante */}
      {modalFacturaUrl && (
        <div className="modal-overlay" onClick={() => setModalFacturaUrl(null)}>
          <div
            className="modal-recipe-card"
            style={{ maxWidth: 740, padding: 0, overflow: "hidden" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-recipe-header" style={{ padding: "16px 20px" }}>
              <h2>
                <span>📎 Factura / Comprobante de Gasto</span>
              </h2>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <a
                  href={modalFacturaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-refresh-action"
                  style={{ fontSize: 12, padding: "5px 12px" }}
                >
                  ↗️ Abrir Completa
                </a>
                <button
                  type="button"
                  onClick={() => setModalFacturaUrl(null)}
                  className="btn-modal-close"
                >
                  ✕
                </button>
              </div>
            </div>

            <div style={{ padding: 16, display: "flex", justifyContent: "center", alignItems: "center", background: "var(--bg-subtle)", minHeight: 400 }}>
              {/\.pdf(\?.*)?$/i.test(modalFacturaUrl) ? (
                <iframe src={modalFacturaUrl} style={{ width: "100%", height: 550, border: "none", borderRadius: 12 }} />
              ) : (
                <img
                  src={modalFacturaUrl}
                  alt="Factura / Comprobante"
                  style={{ maxWidth: "100%", maxHeight: 580, objectFit: "contain", borderRadius: 12, boxShadow: "var(--shadow-md)" }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
