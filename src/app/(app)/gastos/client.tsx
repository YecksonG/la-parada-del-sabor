"use client";

import { useState, useMemo } from "react";
import { Gasto, Proveedor, CategoriaGasto, CuentaOrigenGasto } from "@/types/database";
import { crearGasto, eliminarGasto } from "./actions";
import { createClient } from "@/lib/supabase/client";

interface GastosClientProps {
  gastosIniciales: Gasto[];
  proveedores: Proveedor[];
  tasaBcv: number;
}

const CATEGORIAS_CONFIG: Record<CategoriaGasto, { label: string; icon: string; color: string }> = {
  servicios: { label: "Servicios Operativos", icon: "⚡", color: "#3b82f6" },
  nomina: { label: "Nómina & Personal", icon: "👥", color: "#8b5cf6" },
  proveedores: { label: "Proveedores / Compras", icon: "🚚", color: "#10b981" },
  alquiler: { label: "Alquiler / Local", icon: "🏢", color: "#f59e0b" },
  mantenimiento: { label: "Mantenimiento & Reparación", icon: "🛠️", color: "#64748b" },
  marketing: { label: "Publicidad & Marketing", icon: "📣", color: "#ec4899" },
  impuestos: { label: "Impuestos & Tasas", icon: "🧾", color: "#0ea5e9" },
  otros: { label: "Otros Gastos", icon: "📦", color: "#6b7280" },
};

const CUENTAS_ORIGEN_CONFIG: Record<CuentaOrigenGasto, { label: string; icon: string }> = {
  efectivo_usd: { label: "Efectivo USD (Gaveta)", icon: "💵" },
  efectivo_bs: { label: "Efectivo Bs (Gaveta)", icon: "🇻🇪" },
  pago_movil_bfc: { label: "Pago Móvil BFC", icon: "📱" },
  transferencia_bfc: { label: "Transferencia BFC", icon: "🏦" },
  binance: { label: "Binance USDT", icon: "🟡" },
  zelle: { label: "Zelle USD", icon: "🟣" },
  punto_venta: { label: "Punto de Venta", icon: "💳" },
  caja_chica: { label: "Caja Chica", icon: "💼" },
  otra: { label: "Otra Cuenta", icon: "🌐" },
};

const SUBCATEGORIAS_SUGERIDAS: Record<CategoriaGasto, string[]> = {
  servicios: ["Gas Comercial / Cilindros", "Agua (Cisterna / Tubería)", "Electricidad (Corpoelec)", "Internet / WiFi", "Aseo Urbano"],
  nomina: ["Sueldo Semanal", "Adelanto de Sueldo", "Jornal Diario", "Propinas / Incentivo", "Liquidación"],
  proveedores: ["Harina de Maíz / Quesos", "Carnes / Pollo", "Vegetales / Verduras", "Salsas / Condimentos", "Empaques / Descartables"],
  alquiler: ["Alquiler Local Mensual", "Depósito / Adelanto", "Condominio"],
  mantenimiento: ["Reparación Plancha / Cocina", "Bombillos / Electricidad", "Plomería", "Artículos de Limpieza", "Fumigación"],
  marketing: ["Redes Sociales / Ads", "Diseño Gráfico / Impresiones", "Fotografía", "Volantes"],
  impuestos: ["Patente Municipal", "Seniat", "Permisos Sanitarios", "Timbres Fiscales"],
  otros: ["Transporte / Taxis", "Papelería", "Hielo", "Gastos Menores"],
};

export default function GastosClient({
  gastosIniciales,
  proveedores,
  tasaBcv,
}: GastosClientProps) {
  const [gastos, setGastos] = useState<Gasto[]>(gastosIniciales);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);

  // Filtros
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [filtroCuenta, setFiltroCuenta] = useState<string>("todas");
  const [filtroRango, setFiltroRango] = useState<"hoy" | "semana" | "mes" | "todos">("mes");
  const [busqueda, setBusqueda] = useState("");

  // Formulario Nuevo Gasto
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [categoria, setCategoria] = useState<CategoriaGasto>("servicios");
  const [subcategoria, setSubcategoria] = useState("Gas Comercial / Cilindros");
  const [descripcion, setDescripcion] = useState("");
  const [beneficiario, setBeneficiario] = useState("");
  const [proveedorId, setProveedorId] = useState("");
  const [montoUsd, setMontoUsd] = useState("");
  const [montoBs, setMontoBs] = useState("");
  const [cuentaOrigen, setCuentaOrigen] = useState<CuentaOrigenGasto>("efectivo_usd");
  const [numeroFactura, setNumeroFactura] = useState("");
  const [comprobanteUrl, setComprobanteUrl] = useState("");
  const [notas, setNotas] = useState("");

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

    // Validación de tamaño (Máximo 10 MB)
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg("El archivo adjunto no debe superar los 10 MB.");
      return;
    }

    // Validación de tipo de archivo permitido
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

  const handleCrearGasto = async (e: React.FormEvent) => {
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

    const res = await crearGasto({
      fecha,
      categoria,
      subcategoria,
      descripcion,
      beneficiario,
      proveedor_id: proveedorId || undefined,
      monto_usd: usd,
      monto_bs: parseFloat(montoBs) || Number((usd * tasaBcv).toFixed(2)),
      tasa_bcv: tasaBcv,
      cuenta_origen: cuentaOrigen,
      numero_factura: numeroFactura,
      comprobante_url: comprobanteUrl,
      estado: "pagado",
      notas,
    });

    setGuardando(false);

    if (res.ok && res.gasto) {
      setGastos((prev) => [res.gasto, ...prev]);
      setModalNuevo(false);
      // Reset form
      setDescripcion("");
      setBeneficiario("");
      setProveedorId("");
      setMontoUsd("");
      setMontoBs("");
      setNumeroFactura("");
      setComprobanteUrl("");
      setNotas("");
    } else {
      setErrorMsg(res.error || "Ocurrió un error al registrar el gasto.");
    }
  };

  const handleEliminar = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este registro de gasto?")) return;
    const res = await eliminarGasto(id);
    if (res.ok) {
      setGastos((prev) => prev.filter((g) => g.id !== id));
    } else {
      alert(res.error || "No se pudo eliminar el gasto.");
    }
  };

  // Filtrado de Gastos
  const gastosFiltrados = useMemo(() => {
    const ahora = new Date();
    const hoyStr = ahora.toISOString().split("T")[0];
    
    // Fecha de hace 7 días
    const hace7 = new Date();
    hace7.setDate(hace7.getDate() - 7);
    const hace7Str = hace7.toISOString().split("T")[0];

    // Primer día del mes actual
    const mesInicioStr = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString().split("T")[0];

    return gastos.filter((g) => {
      // Filtro de rango de fecha
      if (filtroRango === "hoy" && g.fecha !== hoyStr) return false;
      if (filtroRango === "semana" && g.fecha < hace7Str) return false;
      if (filtroRango === "mes" && g.fecha < mesInicioStr) return false;

      // Filtro categoría
      if (filtroCategoria !== "todas" && g.categoria !== filtroCategoria) return false;

      // Filtro cuenta origen
      if (filtroCuenta !== "todas" && g.cuenta_origen !== filtroCuenta) return false;

      // Filtro búsqueda
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

  // Exportar a CSV
  const handleExportarCsv = () => {
    const encabezados = ["Fecha", "Categoría", "Subcategoría", "Descripción", "Beneficiario", "Cuenta Origen", "Monto USD", "Monto BS", "Nro Factura", "Notas"];
    const filas = gastosFiltrados.map((g) => [
      g.fecha,
      CATEGORIAS_CONFIG[g.categoria]?.label || g.categoria,
      g.subcategoria || "",
      `"${g.descripcion.replace(/"/g, '""')}"`,
      `"${g.beneficiario || ""}"`,
      CUENTAS_ORIGEN_CONFIG[g.cuenta_origen]?.label || g.cuenta_origen,
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
    <main className="dashboard-container" style={{ maxWidth: 1280, margin: "0 auto", padding: "16px" }}>
      {/* Cabecera Principal */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: "var(--text)", display: "flex", alignItems: "center", gap: 10 }}>
            <span>💰 Gestión de Gastos & Cuentas</span>
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
            Control operativo de servicios (gas, agua, luz, internet), nómina, pagos a proveedores y facturas.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleExportarCsv}
            className="btn btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13 }}
          >
            <span>📥 Exportar Reporte</span>
          </button>
          <button
            type="button"
            onClick={() => setModalNuevo(true)}
            className="btn btn-primary"
            style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 800, fontSize: 14, boxShadow: "0 4px 14px rgba(245, 158, 11, 0.35)" }}
          >
            <span>➕ Registrar Nuevo Gasto</span>
          </button>
        </div>
      </div>

      {/* Tarjetas KPI de Resumen */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 24 }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "16px 18px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>Total Gastos</span>
            <span style={{ fontSize: 20 }}>💸</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "var(--primary)" }}>
            ${totalGastosUsd.toFixed(2)} <span style={{ fontSize: 13, fontWeight: 600 }}>USD</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            Bs. {totalGastosBs.toFixed(2)}
          </div>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "16px 18px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: "#3b82f6", textTransform: "uppercase" }}>⚡ Servicios</span>
            <span style={{ fontSize: 20 }}>💡</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text)" }}>
            ${totalServiciosUsd.toFixed(2)} <span style={{ fontSize: 12, fontWeight: 600 }}>USD</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
            Gas, Agua, Luz, Internet
          </div>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "16px 18px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: "#8b5cf6", textTransform: "uppercase" }}>👥 Nómina & Personal</span>
            <span style={{ fontSize: 20 }}>👨‍🍳</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text)" }}>
            ${totalNominaUsd.toFixed(2)} <span style={{ fontSize: 12, fontWeight: 600 }}>USD</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
            Sueldos, Adelantos, Jornales
          </div>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "16px 18px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: "#10b981", textTransform: "uppercase" }}>🚚 Proveedores</span>
            <span style={{ fontSize: 20 }}>📦</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text)" }}>
            ${totalProveedoresUsd.toFixed(2)} <span style={{ fontSize: 12, fontWeight: 600 }}>USD</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
            Insumos & Despensa
          </div>
        </div>
      </div>

      {/* Barra de Filtros & Búsqueda */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "14px 16px", marginBottom: 18, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
        {/* Rango de tiempo */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(["hoy", "semana", "mes", "todos"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setFiltroRango(r)}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 800,
                border: "none",
                cursor: "pointer",
                background: filtroRango === r ? "var(--primary)" : "var(--surface-hover, rgba(0,0,0,0.05))",
                color: filtroRango === r ? "#ffffff" : "var(--text)",
                transition: "all 0.2s ease",
              }}
            >
              {r === "hoy" ? "Hoy" : r === "semana" ? "Últimos 7 Días" : r === "mes" ? "Este Mes" : "Historial Completo"}
            </button>
          ))}
        </div>

        {/* Filtros Dropdown & Búsqueda */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", flex: "1 1 320px", justifyContent: "flex-end" }}>
          <input
            type="text"
            placeholder="🔍 Buscar gasto, factura, beneficiario..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{
              padding: "7px 12px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--background)",
              color: "var(--text)",
              fontSize: 12.5,
              minWidth: 200,
              flex: "1 1 200px",
            }}
          />

          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            style={{
              padding: "7px 10px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--background)",
              color: "var(--text)",
              fontSize: 12.5,
              fontWeight: 600,
            }}
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
            style={{
              padding: "7px 10px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--background)",
              color: "var(--text)",
              fontSize: 12.5,
              fontWeight: 600,
            }}
          >
            <option value="todas">Todas las Cuentas</option>
            {Object.entries(CUENTAS_ORIGEN_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>
                {v.icon} {v.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista / Tabla de Gastos */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.03)" }}>
        {gastosFiltrados.length === 0 ? (
          <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-muted)" }}>
            <span style={{ fontSize: 42, display: "block", marginBottom: 10 }}>🧾</span>
            <strong style={{ fontSize: 16, color: "var(--text)" }}>No hay gastos registrados en este período</strong>
            <p style={{ fontSize: 13, marginTop: 4 }}>Usa el botón "+ Registrar Nuevo Gasto" para asentar pagos de servicios, nómina o proveedores.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--surface-hover, rgba(0,0,0,0.03))", borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                  <th style={{ padding: "12px 14px", fontWeight: 800 }}>Fecha</th>
                  <th style={{ padding: "12px 14px", fontWeight: 800 }}>Categoría</th>
                  <th style={{ padding: "12px 14px", fontWeight: 800 }}>Descripción / Beneficiario</th>
                  <th style={{ padding: "12px 14px", fontWeight: 800 }}>Cuenta Origen</th>
                  <th style={{ padding: "12px 14px", fontWeight: 800, textAlign: "right" }}>Monto</th>
                  <th style={{ padding: "12px 14px", fontWeight: 800, textAlign: "center" }}>Factura / Adjunto</th>
                  <th style={{ padding: "12px 14px", fontWeight: 800, textAlign: "center" }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {gastosFiltrados.map((g) => {
                  const catCfg = CATEGORIAS_CONFIG[g.categoria] || CATEGORIAS_CONFIG.otros;
                  const ctaCfg = CUENTAS_ORIGEN_CONFIG[g.cuenta_origen] || CUENTAS_ORIGEN_CONFIG.otra;

                  return (
                    <tr key={g.id} style={{ borderBottom: "1px solid var(--border)", transition: "background 0.15s ease" }}>
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap", fontWeight: 600, color: "var(--text-muted)" }}>
                        {g.fecha}
                      </td>

                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "3px 8px",
                            borderRadius: 6,
                            fontSize: 11.5,
                            fontWeight: 800,
                            background: `${catCfg.color}18`,
                            color: catCfg.color,
                          }}
                        >
                          <span>{catCfg.icon}</span>
                          <span>{g.subcategoria || catCfg.label}</span>
                        </span>
                      </td>

                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ fontWeight: 700, color: "var(--text)" }}>{g.descripcion}</div>
                        {g.beneficiario && (
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                            👤 Pagado a: <strong>{g.beneficiario}</strong>
                          </div>
                        )}
                        {g.proveedor && (
                          <div style={{ fontSize: 11, color: "#10b981", marginTop: 2 }}>
                            🏢 Proveedor: <strong>{g.proveedor.nombre}</strong>
                          </div>
                        )}
                      </td>

                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5 }}>
                          <span>{ctaCfg.icon}</span>
                          <span>{ctaCfg.label}</span>
                        </span>
                      </td>

                      <td style={{ padding: "12px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <strong style={{ fontSize: 14, fontWeight: 900, color: "var(--text)" }}>
                          ${Number(g.monto_usd).toFixed(2)} USD
                        </strong>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          Bs. {Number(g.monto_bs).toFixed(2)}
                        </div>
                      </td>

                      <td style={{ padding: "12px 14px", textAlign: "center", whiteSpace: "nowrap" }}>
                        {g.comprobante_url ? (
                          <a
                            href={g.comprobante_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              fontSize: 11.5,
                              fontWeight: 800,
                              color: "#3b82f6",
                              background: "rgba(59, 130, 246, 0.1)",
                              padding: "3px 8px",
                              borderRadius: 6,
                              textDecoration: "none",
                            }}
                          >
                            <span>📎 Ver Factura</span>
                          </a>
                        ) : g.numero_factura ? (
                          <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600 }}>
                            Nro: {g.numero_factura}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>
                        )}
                      </td>

                      <td style={{ padding: "12px 14px", textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={() => handleEliminar(g.id)}
                          title="Eliminar gasto"
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            fontSize: 14,
                            opacity: 0.6,
                            transition: "opacity 0.2s ease",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.6")}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Registrar Nuevo Gasto */}
      {modalNuevo && (
        <div
          className="modal-overlay"
          onClick={() => setModalNuevo(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 20,
              width: "100%",
              maxWidth: 580,
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "24px",
              boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ fontSize: 19, fontWeight: 900, color: "var(--text)" }}>➕ Registrar Nuevo Gasto</h2>
              <button
                type="button"
                onClick={() => setModalNuevo(false)}
                style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text-muted)" }}
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid #ef4444", color: "#ef4444", padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 16 }}>
                ⚠️ {errorMsg}
              </div>
            )}

            <form onSubmit={handleCrearGasto} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Fecha & Categoría */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 5 }}>Fecha del Gasto *</label>
                  <input
                    type="date"
                    required
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="form-input"
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--background)", color: "var(--text)" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 5 }}>Categoría Principal *</label>
                  <select
                    value={categoria}
                    onChange={(e) => handleCambioCategoria(e.target.value as CategoriaGasto)}
                    className="form-input"
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--background)", color: "var(--text)", fontWeight: 700 }}
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
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 6 }}>Tipo de Gasto / Sugerencias:</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {SUBCATEGORIAS_SUGERIDAS[categoria]?.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => setSubcategoria(sug)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 700,
                        border: "1px solid var(--border)",
                        cursor: "pointer",
                        background: subcategoria === sug ? "var(--primary)" : "var(--background)",
                        color: subcategoria === sug ? "#ffffff" : "var(--text)",
                      }}
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 5 }}>Descripción Detallada *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Pago de 2 bombonas de gas de 43kg para la cocina..."
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--background)", color: "var(--text)" }}
                />
              </div>

              {/* Montos Dual USD / Bs */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, background: "rgba(245, 158, 11, 0.06)", padding: "12px", borderRadius: 12, border: "1px dashed rgba(245, 158, 11, 0.4)" }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 800, color: "var(--primary)", display: "block", marginBottom: 5 }}>Monto en Dólares ($ USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={montoUsd}
                    onChange={(e) => handleCambioMontoUsd(e.target.value)}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1.5px solid var(--primary)", background: "var(--background)", color: "var(--text)", fontWeight: 900, fontSize: 15 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text)", display: "block", marginBottom: 5 }}>Monto en Bolívares (Bs)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={montoBs}
                    onChange={(e) => handleCambioMontoBs(e.target.value)}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--background)", color: "var(--text)", fontWeight: 700, fontSize: 14 }}
                  />
                  <span style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, display: "block" }}>Tasa: {tasaBcv.toFixed(2)} Bs/USD</span>
                </div>
              </div>

              {/* Cuenta Origen & Beneficiario */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 5 }}>Cuenta / Método de Pago *</label>
                  <select
                    value={cuentaOrigen}
                    onChange={(e) => setCuentaOrigen(e.target.value as CuentaOrigenGasto)}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--background)", color: "var(--text)", fontWeight: 700 }}
                  >
                    {Object.entries(CUENTAS_ORIGEN_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.icon} {v.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 5 }}>Beneficiario / Persona Pagada</label>
                  <input
                    type="text"
                    placeholder="Ej: Distribuidor Gas, Juan Pérez..."
                    value={beneficiario}
                    onChange={(e) => setBeneficiario(e.target.value)}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--background)", color: "var(--text)" }}
                  />
                </div>
              </div>

              {/* Proveedor Asociado & Nro Factura */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 5 }}>Proveedor (Opcional)</label>
                  <select
                    value={proveedorId}
                    onChange={(e) => setProveedorId(e.target.value)}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--background)", color: "var(--text)" }}
                  >
                    <option value="">-- Sin proveedor asociado --</option>
                    {proveedores.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 5 }}>Nro. Factura / Comprobante</label>
                  <input
                    type="text"
                    placeholder="Ej: FACT-0492 / Ref: 9812..."
                    value={numeroFactura}
                    onChange={(e) => setNumeroFactura(e.target.value)}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--background)", color: "var(--text)" }}
                  />
                </div>
              </div>

              {/* Adjuntar Foto / Factura */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 5 }}>Foto de Factura / Comprobante (Opcional)</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleSubirComprobante}
                    disabled={subiendoArchivo}
                    style={{ fontSize: 12 }}
                  />
                  {subiendoArchivo && <span style={{ fontSize: 12, color: "var(--primary)" }}>⏳ Subiendo...</span>}
                  {comprobanteUrl && <span style={{ fontSize: 12, color: "#10b981", fontWeight: 700 }}>✓ Adjunto listo</span>}
                </div>
              </div>

              {/* Botón de Enviar */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setModalNuevo(false)}
                  className="btn btn-secondary"
                  style={{ fontWeight: 700 }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="btn btn-primary"
                  style={{ fontWeight: 800, padding: "10px 22px" }}
                >
                  {guardando ? "Guardando..." : "💾 Guardar Gasto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
