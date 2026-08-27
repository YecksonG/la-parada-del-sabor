"use client";

import { useState, useMemo } from "react";
import {
  Gasto,
  Proveedor,
  CuentaNegocio,
  Insumo,
  CategoriaGasto,
  TransferenciaCuenta,
} from "@/types/database";
import {
  crearGasto,
  actualizarGasto,
  eliminarGasto,
  registrarIngresoInsumo,
  crearCuentaNegocio,
  actualizarCuentaNegocio,
  eliminarCuentaNegocio,
  crearTransferenciaCuenta,
  eliminarTransferenciaCuenta,
} from "./actions";
import { createClient } from "@/lib/supabase/client";

interface GastosClientProps {
  gastosIniciales: Gasto[];
  comprasIniciales: any[];
  insumos: Insumo[];
  cuentasIniciales: CuentaNegocio[];
  transferenciasIniciales: TransferenciaCuenta[];
  proveedores: Proveedor[];
  tasaBcv: number;
}

export const BANCOS_VENEZUELA_LISTA = [
  // Bancos del Estado (BioPago afiliados)
  { codigo: "0102", nombre: "Banco de Venezuela (BDV)", biopago: true, icono: "🏛️" },
  { codigo: "0175", nombre: "Banco Bicentenario del Pueblo", biopago: true, icono: "🏦" },
  { codigo: "0163", nombre: "Banco del Tesoro", biopago: true, icono: "🏦" },
  { codigo: "0177", nombre: "BANFANB", biopago: true, icono: "🛡️" },
  { codigo: "0166", nombre: "Banco Agrícola de Venezuela", biopago: true, icono: "🌾" },

  // Bancos Privados y Microfinancieros afiliados a BioPago
  { codigo: "0134", nombre: "Banesco Banco Universal", biopago: true, icono: "🏦" },
  { codigo: "0172", nombre: "Bancamiga Banco Universal", biopago: true, icono: "💳" },
  { codigo: "0114", nombre: "Bancaribe", biopago: true, icono: "🏦" },
  { codigo: "0171", nombre: "Banco Activo", biopago: true, icono: "🏦" },
  { codigo: "0115", nombre: "Banco Exterior", biopago: true, icono: "🏦" },
  { codigo: "0128", nombre: "Banco Caroní", biopago: true, icono: "🏦" },
  { codigo: "0138", nombre: "Banco Plaza", biopago: true, icono: "🏦" },
  { codigo: "0104", nombre: "Banco Venezolano de Crédito", biopago: true, icono: "🏦" },
  { codigo: "0156", nombre: "100% Banco", biopago: true, icono: "🏦" },
  { codigo: "0174", nombre: "Bancrecer", biopago: true, icono: "🏦" },
  { codigo: "0169", nombre: "Mi Banco (Banco Microfinanciero)", biopago: true, icono: "🏦" },

  // Otros Bancos Nacionales
  { codigo: "0151", nombre: "Banco Fondo Común (BFC)", biopago: false, icono: "📱" },
  { codigo: "0105", nombre: "Banco Mercantil", biopago: false, icono: "🏦" },
  { codigo: "0108", nombre: "BBVA Banco Provincial", biopago: false, icono: "🏦" },
  { codigo: "0191", nombre: "Banco Nacional de Crédito (BNC)", biopago: false, icono: "🏦" },
  { codigo: "0137", nombre: "Banco Sofitasa", biopago: false, icono: "🏦" },
  { codigo: "0157", nombre: "Banco Del Sur", biopago: false, icono: "🏦" },
  { codigo: "0173", nombre: "Banplus", biopago: false, icono: "🏦" },
];

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

const UNIDADES_COMPRA = [
  { id: "bulto_20kg", label: "Bulto 20 kg (20.000 g)", factor: 20000, unidadBase: "g" },
  { id: "bulto_24kg", label: "Bulto Harina PAN (24 kg / 24.000 g)", factor: 24000, unidadBase: "g" },
  { id: "saco_50kg", label: "Saco 50 kg (50.000 g)", factor: 50000, unidadBase: "g" },
  { id: "kilo", label: "Kilo (1.000 g)", factor: 1000, unidadBase: "g" },
  { id: "paquete_500g", label: "Paquete 500 g", factor: 500, unidadBase: "g" },
  { id: "litro", label: "Litro (1.000 ml)", factor: 1000, unidadBase: "ml" },
  { id: "galon_3_78l", label: "Galón (3.785 ml)", factor: 3785, unidadBase: "ml" },
  { id: "paquete_100u", label: "Paquete 100 Unidades", factor: 100, unidadBase: "und" },
  { id: "paquete_50u", label: "Paquete 50 Unidades", factor: 50, unidadBase: "und" },
  { id: "caja_1000u", label: "Caja 1.000 Unidades", factor: 1000, unidadBase: "und" },
  { id: "unidad", label: "Unidad Simple (1 und)", factor: 1, unidadBase: "und" },
];

export default function GastosClient({
  gastosIniciales,
  comprasIniciales,
  insumos,
  cuentasIniciales,
  transferenciasIniciales,
  proveedores,
  tasaBcv,
}: GastosClientProps) {
  const [tabActiva, setTabActiva] = useState<"gastos" | "compras" | "cuentas" | "transferencias">("gastos");
  const [gastos, setGastos] = useState<Gasto[]>(gastosIniciales);
  const [compras, setCompras] = useState<any[]>(comprasIniciales);
  const [cuentas, setCuentas] = useState<CuentaNegocio[]>(cuentasIniciales);
  const [transferencias, setTransferencias] = useState<TransferenciaCuenta[]>(transferenciasIniciales);

  // Modales
  const [modalGasto, setModalGasto] = useState(false);
  const [gastoEditando, setGastoEditando] = useState<Gasto | null>(null);
  const [modalCompra, setModalCompra] = useState(false);
  const [modalCuenta, setModalCuenta] = useState(false);
  const [cuentaEditando, setCuentaEditando] = useState<CuentaNegocio | null>(null);
  const [modalTransferencia, setModalTransferencia] = useState(false);
  const [modalFacturaUrl, setModalFacturaUrl] = useState<string | null>(null);

  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);

  // Filtros
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [filtroCuenta, setFiltroCuenta] = useState<string>("todas");
  const [filtroRango, setFiltroRango] = useState<"hoy" | "semana" | "mes" | "todos">("mes");
  const [busqueda, setBusqueda] = useState("");

  // Estado Formulario Gasto General
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
  const [metodoPagoGasto, setMetodoPagoGasto] = useState<string>("pago_movil");
  const [numeroFactura, setNumeroFactura] = useState("");
  const [comprobanteUrl, setComprobanteUrl] = useState("");
  const [notas, setNotas] = useState("");

  // Estado Formulario Entrada de Insumos (Compra con Stock)
  const [compraInsumoId, setCompraInsumoId] = useState(insumos[0]?.id || "");
  const [compraProveedorId, setCompraProveedorId] = useState("");
  const [compraCantidad, setCompraCantidad] = useState("1");
  const [compraUnidadId, setCompraUnidadId] = useState("kilo");
  const [compraTotalUsd, setCompraTotalUsd] = useState("");
  const [compraTotalBs, setCompraTotalBs] = useState("");
  const [compraCuentaId, setCompraCuentaId] = useState("");
  const [compraFactura, setCompraFactura] = useState("");
  const [compraNotas, setCompraNotas] = useState("");

  // Estado Formulario Cuenta
  const [ctaNombre, setCtaNombre] = useState("");
  const [ctaTipo, setCtaTipo] = useState<CuentaNegocio["tipo"]>("banco_nacional");
  const [ctaMoneda, setCtaMoneda] = useState<CuentaNegocio["moneda"]>("VES");
  const [ctaBanco, setCtaBanco] = useState(BANCOS_VENEZUELA_LISTA[0].nombre);
  const [ctaTitular, setCtaTitular] = useState("");
  const [ctaEmail, setCtaEmail] = useState("");
  const [ctaPayId, setCtaPayId] = useState("");
  const [ctaCedula, setCtaCedula] = useState("");
  const [ctaTelefonoPm, setCtaTelefonoPm] = useState("");
  const [ctaAdmiteBiopago, setCtaAdmiteBiopago] = useState(true);
  const [ctaNumero20, setCtaNumero20] = useState("");
  const [ctaIcono, setCtaIcono] = useState("🏛️");
  const [ctaColor, setCtaColor] = useState("#ef4444");
  const [ctaNotas, setCtaNotas] = useState("");

  // Estado Formulario Transferencia entre Cuentas
  const [trFecha, setTrFecha] = useState(new Date().toISOString().split("T")[0]);
  const [trCuentaOrigenId, setTrCuentaOrigenId] = useState(cuentasIniciales[0]?.id || "");
  const [trCuentaDestinoId, setTrCuentaDestinoId] = useState(cuentasIniciales[1]?.id || "");
  const [trMontoOrigen, setTrMontoOrigen] = useState("");
  const [trMontoDestino, setTrMontoDestino] = useState("");
  const [trTasaCambio, setTrTasaCambio] = useState(tasaBcv.toString());
  const [trMetodo, setTrMetodo] = useState("pago_movil");
  const [trReferencia, setTrReferencia] = useState("");
  const [trConcepto, setTrConcepto] = useState("");
  const [trNotas, setTrNotas] = useState("");

  // Abrir Modal para Crear Gasto General
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
    setMetodoPagoGasto(cuentas[0]?.tipo === "banco_nacional" ? "pago_movil" : cuentas[0]?.tipo === "billetera_digital" ? "zelle" : cuentas[0]?.tipo === "cripto" ? "binance" : "efectivo");
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
    setMetodoPagoGasto(g.metodo_pago || "pago_movil");
    setNumeroFactura(g.numero_factura || "");
    setComprobanteUrl(g.comprobante_url || "");
    setNotas(g.notas || "");
    setModalGasto(true);
  };

  // Abrir Modal Ingreso de Insumos (Stock 2 en 1)
  const abrirModalIngresoInsumo = () => {
    setErrorMsg("");
    setCompraInsumoId(insumos[0]?.id || "");
    setCompraProveedorId("");
    setCompraCantidad("1");
    setCompraUnidadId("kilo");
    setCompraTotalUsd("");
    setCompraTotalBs("");
    setCompraCuentaId(cuentas[0]?.id || "");
    setCompraFactura("");
    setCompraNotas("");
    setModalCompra(true);
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

  // Cálculo automático dual USD <-> Bs en Gasto
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

  // Cálculo dual en Entrada de Insumos
  const handleCambioCompraUsd = (val: string) => {
    setCompraTotalUsd(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0 && tasaBcv > 0) {
      setCompraTotalBs((num * tasaBcv).toFixed(2));
    } else {
      setCompraTotalBs("");
    }
  };

  const handleCambioCompraBs = (val: string) => {
    setCompraTotalBs(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0 && tasaBcv > 0) {
      setCompraTotalUsd((num / tasaBcv).toFixed(2));
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

  // Guardar Gasto General (Crear o Actualizar)
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
      metodo_pago: metodoPagoGasto,
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

  // Guardar Entrada de Insumos (Compra con Stock en Despensa + Gasto)
  const handleGuardarIngresoInsumo = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const cant = parseFloat(compraCantidad);
    const usd = parseFloat(compraTotalUsd);
    if (isNaN(cant) || cant <= 0) {
      setErrorMsg("La cantidad debe ser mayor a 0.");
      return;
    }
    if (isNaN(usd) || usd <= 0) {
      setErrorMsg("El monto total en dólares debe ser mayor a 0.");
      return;
    }

    const insumoSel = insumos.find((i) => i.id === compraInsumoId);
    if (!insumoSel) {
      setErrorMsg("Selecciona un insumo válido.");
      return;
    }

    const unidadSel = UNIDADES_COMPRA.find((u) => u.id === compraUnidadId) || UNIDADES_COMPRA[3];
    const ctaSel = cuentas.find((c) => c.id === compraCuentaId) || cuentas[0];

    setGuardando(true);

    const res = await registrarIngresoInsumo({
      insumo_id: insumoSel.id,
      insumo_nombre: insumoSel.nombre,
      proveedor_id: compraProveedorId || null,
      cantidad_comprada: cant,
      unidad_compra: unidadSel.label,
      factor_conversion: unidadSel.factor,
      total_usd: usd,
      total_bs: parseFloat(compraTotalBs) || Number((usd * tasaBcv).toFixed(2)),
      tasa_bcv: tasaBcv,
      cuenta_id: ctaSel?.id,
      cuenta_origen: ctaSel?.codigo || "efectivo_usd",
      numero_factura: compraFactura,
      notas: compraNotas,
    });

    setGuardando(false);

    if (res.ok) {
      setModalCompra(false);
      // Recargar página o actualizar estados
      window.location.reload();
    } else {
      setErrorMsg(res.error || "Error al registrar el ingreso de insumos.");
    }
  };

  // Abrir Modal Transferencia entre Cuentas
  const abrirModalTransferencia = () => {
    setErrorMsg("");
    setTrFecha(new Date().toISOString().split("T")[0]);
    const orig = cuentas[0]?.id || "";
    const dest = cuentas[1]?.id || cuentas[0]?.id || "";
    setTrCuentaOrigenId(orig);
    setTrCuentaDestinoId(dest);
    setTrMontoOrigen("");
    setTrMontoDestino("");
    setTrTasaCambio(tasaBcv.toString());
    setTrMetodo("pago_movil");
    setTrReferencia("");
    setTrConcepto("");
    setTrNotas("");
    setModalTransferencia(true);
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
    setCtaBanco(BANCOS_VENEZUELA_LISTA[0].nombre);
    setCtaTitular("");
    setCtaEmail("");
    setCtaPayId("");
    setCtaCedula("");
    setCtaTelefonoPm("");
    setCtaAdmiteBiopago(true);
    setCtaNumero20("");
    setCtaIcono("🏛️");
    setCtaColor("#ef4444");
    setCtaNotas("");
    setModalCuenta(true);
  };

  const abrirModalEditarCuenta = (cta: CuentaNegocio) => {
    setCuentaEditando(cta);
    setCtaNombre(cta.nombre);
    setCtaTipo(cta.tipo);
    setCtaMoneda(cta.moneda);
    setCtaBanco(cta.banco_plataforma || BANCOS_VENEZUELA_LISTA[0].nombre);
    setCtaTitular(cta.titular || "");
    setCtaEmail(cta.numero_cuenta_telefono?.includes("@") ? cta.numero_cuenta_telefono : "");
    setCtaPayId(!cta.numero_cuenta_telefono?.includes("@") && cta.tipo === "cripto" ? cta.numero_cuenta_telefono || "" : "");
    setCtaCedula(cta.cedula_rif || "");
    setCtaTelefonoPm(cta.telefono_pago_movil || "");
    setCtaAdmiteBiopago(cta.admite_biopago ?? false);
    setCtaNumero20(cta.numero_cuenta_20digitos || "");
    setCtaIcono(cta.icono || "🏦");
    setCtaColor(cta.color || "#3b82f6");
    setCtaNotas(cta.notas || "");
    setModalCuenta(true);
  };

  const handleSeleccionarBancoNacional = (nombreBanco: string) => {
    setCtaBanco(nombreBanco);
    const bInfo = BANCOS_VENEZUELA_LISTA.find((b) => b.nombre === nombreBanco);
    if (bInfo) {
      setCtaAdmiteBiopago(bInfo.biopago);
      setCtaIcono(bInfo.icono);
      if (nombreBanco.includes("Venezuela")) {
        setCtaColor("#ef4444");
      } else if (nombreBanco.includes("Bancamiga")) {
        setCtaColor("#0284c7");
      } else if (nombreBanco.includes("Banesco")) {
        setCtaColor("#16a34a");
      } else if (nombreBanco.includes("Fondo Común") || nombreBanco.includes("BFC")) {
        setCtaColor("#3b82f6");
      }
    }
  };

  const handleGuardarCuenta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ctaNombre.trim()) {
      alert("El nombre de la cuenta es obligatorio.");
      return;
    }

    setGuardando(true);
    let numRef = "";
    if (ctaTipo === "banco_nacional") {
      numRef = ctaTelefonoPm || ctaNumero20;
    } else if (ctaTipo === "billetera_digital") {
      numRef = ctaEmail;
    } else if (ctaTipo === "cripto") {
      numRef = ctaPayId || ctaEmail;
    } else if (ctaTipo === "efectivo_usd" || ctaTipo === "efectivo_bs" || ctaTipo === "caja_chica") {
      numRef = "Gaveta Principal";
    }

    const payload = {
      nombre: ctaNombre.trim(),
      tipo: ctaTipo,
      moneda: ctaMoneda,
      banco_plataforma: ctaBanco,
      titular: ctaTipo.startsWith("efectivo") || ctaTipo === "caja_chica" ? "La Parada del Sabor" : ctaTitular,
      cedula_rif: ctaTipo === "banco_nacional" ? ctaCedula : null,
      telefono_pago_movil: ctaTipo === "banco_nacional" ? ctaTelefonoPm : null,
      admite_biopago: ctaTipo === "banco_nacional" ? ctaAdmiteBiopago : false,
      numero_cuenta_20digitos: ctaTipo === "banco_nacional" ? ctaNumero20 : null,
      numero_cuenta_telefono: numRef,
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

  const handleEliminarCuenta = async (id: string, nombre: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar o archivar la cuenta "${nombre}"?`)) return;
    setGuardando(true);
    const res = await eliminarCuentaNegocio(id);
    setGuardando(false);
    if (res.ok) {
      if (res.desactivada) {
        alert(res.mensaje || "La cuenta tenía movimientos históricos y ha sido archivada para proteger los registros contables.");
        setCuentas((prev) => prev.map((c) => (c.id === id ? { ...c, activo: false } : c)));
      } else {
        setCuentas((prev) => prev.filter((c) => c.id !== id));
      }
    } else {
      alert(res.error || "No se pudo eliminar la cuenta.");
    }
  };

  // Cálculo reactivo multidivisa de transferencias
  const recalcularTransferencia = (
    val: string,
    campoCambiado: "origen" | "destino",
    origId = trCuentaOrigenId,
    destId = trCuentaDestinoId,
    tasaStr = trTasaCambio
  ) => {
    const num = parseFloat(val);
    const tasa = parseFloat(tasaStr) || 1.0;
    const orig = cuentas.find((c) => c.id === origId);
    const dest = cuentas.find((c) => c.id === destId);
    const monOrig = orig?.moneda || "VES";
    const monDest = dest?.moneda || "VES";

    if (isNaN(num) || num <= 0 || tasa <= 0) {
      if (campoCambiado === "origen") {
        setTrMontoOrigen(val);
        setTrMontoDestino("");
      } else {
        setTrMontoDestino(val);
        setTrMontoOrigen("");
      }
      return;
    }

    if (campoCambiado === "origen") {
      setTrMontoOrigen(val);
      if (monOrig === monDest) {
        setTrMontoDestino(val);
      } else if (monOrig === "VES" && (monDest === "USD" || monDest === "USDT")) {
        // VES -> USD/USDT (Compra de USDT / Efectivo)
        setTrMontoDestino((num / tasa).toFixed(2));
      } else if ((monOrig === "USD" || monOrig === "USDT") && monDest === "VES") {
        // USD/USDT -> VES (Venta de USDT / Venta Efectivo)
        setTrMontoDestino((num * tasa).toFixed(2));
      } else {
        setTrMontoDestino(val);
      }
    } else {
      setTrMontoDestino(val);
      if (monOrig === monDest) {
        setTrMontoOrigen(val);
      } else if (monOrig === "VES" && (monDest === "USD" || monDest === "USDT")) {
        // Ingresó USD destino -> calcular VES origen
        setTrMontoOrigen((num * tasa).toFixed(2));
      } else if ((monOrig === "USD" || monOrig === "USDT") && monDest === "VES") {
        // Ingresó VES destino -> calcular USD origen
        setTrMontoOrigen((num / tasa).toFixed(2));
      } else {
        setTrMontoOrigen(val);
      }
    }
  };

  const handleCambioTrTasa = (nuevaTasa: string) => {
    setTrTasaCambio(nuevaTasa);
    if (trMontoOrigen) {
      recalcularTransferencia(trMontoOrigen, "origen", trCuentaOrigenId, trCuentaDestinoId, nuevaTasa);
    }
  };

  // Guardar Transferencia entre Cuentas
  const handleGuardarTransferencia = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const mOrigen = parseFloat(trMontoOrigen);
    const mDestino = parseFloat(trMontoDestino) || mOrigen;
    if (isNaN(mOrigen) || mOrigen <= 0) {
      setErrorMsg("Ingresa un monto de origen válido mayor a 0.");
      return;
    }
    if (trCuentaOrigenId === trCuentaDestinoId) {
      setErrorMsg("La cuenta de origen y de destino no pueden ser la misma.");
      return;
    }

    const ctaOrig = cuentas.find((c) => c.id === trCuentaOrigenId);
    const ctaDest = cuentas.find((c) => c.id === trCuentaDestinoId);

    setGuardando(true);
    const res = await crearTransferenciaCuenta({
      fecha: trFecha,
      cuenta_origen_id: trCuentaOrigenId,
      cuenta_destino_id: trCuentaDestinoId,
      monto_origen: mOrigen,
      moneda_origen: ctaOrig?.moneda || "VES",
      monto_destino: mDestino,
      moneda_destino: ctaDest?.moneda || "VES",
      tasa_cambio: parseFloat(trTasaCambio) || 1.0,
      metodo_transferencia: trMetodo,
      referencia: trReferencia,
      concepto: trConcepto,
      notas: trNotas,
    });
    setGuardando(false);

    if (res.ok && res.transferencia) {
      setTransferencias((prev) => [res.transferencia!, ...prev]);
      setModalTransferencia(false);
    } else {
      setErrorMsg(res.error || "Error al registrar la transferencia.");
    }
  };

  const handleEliminarTransferencia = async (id: string) => {
    if (!confirm("¿Deseas eliminar este registro de transferencia?")) return;
    const res = await eliminarTransferenciaCuenta(id);
    if (res.ok) {
      setTransferencias((prev) => prev.filter((t) => t.id !== id));
    } else {
      alert(res.error || "Error al eliminar transferencia.");
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

  // Cuenta seleccionada en filtro
  const cuentaFiltradaObj = useMemo(() => {
    if (filtroCuenta === "todas") return null;
    return cuentas.find((c) => c.id === filtroCuenta || c.codigo === filtroCuenta);
  }, [cuentas, filtroCuenta]);

  // Cuenta seleccionada en modal de gasto
  const cuentaSeleccionadaGastoObj = useMemo(() => {
    return cuentas.find((c) => c.id === cuentaId || c.codigo === cuentaOrigen) || cuentas[0];
  }, [cuentas, cuentaId, cuentaOrigen]);

  // Cálculo de resumen para el insumo en el modal de compra
  const insumoSeleccionadoObj = useMemo(() => {
    return insumos.find((i) => i.id === compraInsumoId) || insumos[0];
  }, [insumos, compraInsumoId]);

  const unidadSeleccionadaObj = useMemo(() => {
    return UNIDADES_COMPRA.find((u) => u.id === compraUnidadId) || UNIDADES_COMPRA[3];
  }, [compraUnidadId]);

  const cantidadTotalBaseCalculada = useMemo(() => {
    const cant = parseFloat(compraCantidad) || 0;
    return cant * unidadSeleccionadaObj.factor;
  }, [compraCantidad, unidadSeleccionadaObj]);

  const costoUnitarioBaseCalculado = useMemo(() => {
    const total = parseFloat(compraTotalUsd) || 0;
    if (cantidadTotalBaseCalculada <= 0 || total <= 0) return 0;
    return total / cantidadTotalBaseCalculada;
  }, [compraTotalUsd, cantidadTotalBaseCalculada]);

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
            <span>💼 Compras, Gastos & Cuentas</span>
          </h1>
          <p className="recetas-subtitle">
            Centro administrativo 360°: entrada de mercancía a la despensa, pago de servicios, nómina y cuentas bancarias.
          </p>

          {/* Selector de 4 Pestañas Rápidas */}
          <div className="view-mode-toggle" style={{ marginTop: 14 }}>
            <button
              type="button"
              onClick={() => setTabActiva("gastos")}
              className={`view-mode-btn ${tabActiva === "gastos" ? "active" : ""}`}
            >
              📋 Todos los Gastos ({gastos.length})
            </button>
            <button
              type="button"
              onClick={() => setTabActiva("compras")}
              className={`view-mode-btn ${tabActiva === "compras" ? "active" : ""}`}
            >
              📦 Entrada de Insumos ({compras.length})
            </button>
            <button
              type="button"
              onClick={() => setTabActiva("cuentas")}
              className={`view-mode-btn ${tabActiva === "cuentas" ? "active" : ""}`}
            >
              💳 Cuentas & Bancos ({cuentas.length})
            </button>
            <button
              type="button"
              onClick={() => setTabActiva("transferencias")}
              className={`view-mode-btn ${tabActiva === "transferencias" ? "active" : ""}`}
            >
              🔄 Transferencias entre Cuentas ({transferencias.length})
            </button>
          </div>
        </div>

        {/* Botones de Acción Contextuales */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {tabActiva === "gastos" && (
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
                <span>+</span> Registrar Gasto General
              </button>
            </>
          )}

          {tabActiva === "compras" && (
            <button
              type="button"
              onClick={abrirModalIngresoInsumo}
              className="btn-primary-action"
            >
              <span>🚚</span> Registrar Ingreso de Insumos
            </button>
          )}

          {tabActiva === "cuentas" && (
            <button
              type="button"
              onClick={abrirModalCrearCuenta}
              className="btn-primary-action"
            >
              <span>+</span> Nueva Cuenta Financiera
            </button>
          )}

          {tabActiva === "transferencias" && (
            <button
              type="button"
              onClick={abrirModalTransferencia}
              className="btn-primary-action"
            >
              <span>🔄</span> Mover Fondos entre Cuentas
            </button>
          )}
        </div>
      </div>

      {/* PESTAÑA 1: TODOS LOS GASTOS */}
      {tabActiva === "gastos" && (
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
                <span className="product-kpi-label" style={{ color: "#10b981" }}>🚚 Proveedores & Insumos</span>
                <span style={{ fontSize: 22 }}>📦</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "var(--text)" }}>
                ${totalProveedoresUsd.toFixed(2)} <span style={{ fontSize: 13, fontWeight: 600 }}>USD</span>
              </div>
              <div className="product-kpi-sub" style={{ marginTop: 2 }}>
                Materia Prima & Despensa
              </div>
            </div>
          </div>

          {/* Banner de Navegación Rápida si se está filtrando por una Cuenta */}
          {cuentaFiltradaObj && (
            <div style={{ background: "rgba(239, 68, 68, 0.08)", border: "1.5px solid var(--primary)", borderRadius: 16, padding: "14px 18px", marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, boxShadow: "var(--shadow-sm)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 28 }}>{cuentaFiltradaObj.icono || "💳"}</span>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 900, color: "var(--text)" }}>
                    Historial de Pagos: <strong style={{ color: "var(--primary)" }}>{cuentaFiltradaObj.nombre}</strong>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
                    {cuentaFiltradaObj.titular ? `Titular: ${cuentaFiltradaObj.titular}` : ""} {cuentaFiltradaObj.admite_biopago ? "• 🟢 BioPago Habilitado" : ""}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setTabActiva("cuentas")}
                  className="btn-primary-action"
                  style={{ fontSize: 12.5, padding: "8px 16px" }}
                >
                  ⬅️ Volver a Cuentas
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroCuenta("todas")}
                  className="btn-refresh-action"
                  style={{ fontSize: 12.5, padding: "8px 16px" }}
                >
                  ✕ Ver Todos los Gastos
                </button>
              </div>
            </div>
          )}

          {/* Barra de Filtros & Búsqueda */}
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
                <p className="recetas-subtitle">Usa el botón "+ Registrar Gasto General" para asentar pagos.</p>
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
      )}

      {/* PESTAÑA 2: ENTRADA DE INSUMOS (STOCK EN DESPENSA + PPMC) */}
      {tabActiva === "compras" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, padding: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14, boxShadow: "var(--shadow-sm)" }}>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 900, color: "var(--text)" }}>🚚 Historial de Entradas a la Despensa</h2>
              <p className="recetas-subtitle">Cada compra ingresada aquí suma stock automáticamente y recalcula el costo ponderado por gramo/ml.</p>
            </div>
            <button
              type="button"
              onClick={abrirModalIngresoInsumo}
              className="btn-primary-action"
            >
              <span>+</span> Registrar Nuevo Ingreso
            </button>
          </div>

          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, overflow: "hidden", boxShadow: "var(--shadow-md)" }}>
            {compras.length === 0 ? (
              <div className="recetas-empty-box" style={{ border: "none" }}>
                <span style={{ fontSize: 48 }}>📦</span>
                <strong style={{ fontSize: 17, color: "var(--text)" }}>No hay registros de compras directas</strong>
                <p className="recetas-subtitle">Usa el botón "+ Registrar Nuevo Ingreso" para recibir bultos o kilos de insumos.</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                      <th style={{ padding: "14px 16px", fontWeight: 800, color: "var(--text)" }}>Fecha</th>
                      <th style={{ padding: "14px 16px", fontWeight: 800, color: "var(--text)" }}>Proveedor</th>
                      <th style={{ padding: "14px 16px", fontWeight: 800, color: "var(--text)" }}>Insumos Recibidos</th>
                      <th style={{ padding: "14px 16px", fontWeight: 800, color: "var(--text)", textAlign: "right" }}>Total Compra</th>
                      <th style={{ padding: "14px 16px", fontWeight: 800, color: "var(--text)", textAlign: "center" }}>Factura / Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compras.map((c) => (
                      <tr key={c.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <td style={{ padding: "14px 16px", fontWeight: 700, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                          {c.fecha}
                        </td>
                        <td style={{ padding: "14px 16px", fontWeight: 800, color: "var(--text)" }}>
                          {c.proveedor?.nombre || "Compra Local / Directa"}
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          {c.items && c.items.length > 0 ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              {c.items.map((it: any) => (
                                <div key={it.id} style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)" }}>
                                  📦 {it.insumo?.nombre}: <strong>{it.cantidad_comprada} {it.unidad_compra}</strong> ({it.cantidad_base_total} {it.insumo?.unidad_medida})
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{c.notas || "Sin detalle"}</span>
                          )}
                        </td>
                        <td style={{ padding: "14px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                          <div style={{ fontSize: 15, fontWeight: 900, color: "var(--primary)" }}>
                            ${Number(c.total_usd).toFixed(2)} <span style={{ fontSize: 11 }}>USD</span>
                          </div>
                          <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                            Bs. {Number(c.total_bs).toFixed(2)}
                          </div>
                        </td>
                        <td style={{ padding: "14px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                          {c.comprobante || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PESTAÑA 3: GESTIÓN DE CUENTAS & HISTORIAL BANCARIO */}
      {tabActiva === "cuentas" && (
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
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <h3 style={{ fontSize: 17, fontWeight: 900, color: "var(--text)" }}>{cta.nombre}</h3>
                          {cta.admite_biopago && (
                            <span style={{ fontSize: 10.5, fontWeight: 800, background: "rgba(16, 185, 129, 0.15)", color: "var(--green)", padding: "2px 8px", borderRadius: 6, border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                              🟢 BioPago
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700 }}>
                          {cta.banco_plataforma || cta.tipo} • Moneda: <strong>{cta.moneda}</strong>
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 6 }}>
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
                        title="Editar cuenta"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEliminarCuenta(cta.id, cta.nombre)}
                        style={{
                          background: "rgba(239, 68, 68, 0.1)",
                          border: "1px solid rgba(239, 68, 68, 0.3)",
                          borderRadius: 8,
                          padding: "5px 8px",
                          fontSize: 12,
                          cursor: "pointer",
                          color: "#ef4444",
                        }}
                        title="Eliminar o archivar cuenta"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  <div style={{ fontSize: 12.5, color: "var(--text)", marginTop: 12, background: "var(--bg-subtle)", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: 4 }}>
                    {cta.tipo === "banco_nacional" ? (
                      <>
                        {cta.titular && <div>👤 Titular: <strong>{cta.titular}</strong></div>}
                        {cta.cedula_rif && <div>🪪 Cédula / RIF: <strong>{cta.cedula_rif}</strong></div>}
                        {cta.telefono_pago_movil && <div>📱 Pago Móvil: <strong>{cta.telefono_pago_movil}</strong></div>}
                        {cta.numero_cuenta_20digitos && (
                          <div style={{ color: "var(--text-muted)", fontSize: 11.5 }}>
                            🔢 Nro. Cuenta: <code>{cta.numero_cuenta_20digitos}</code>
                          </div>
                        )}
                      </>
                    ) : cta.tipo === "billetera_digital" || cta.tipo === "cripto" ? (
                      <>
                        {cta.titular && <div>👤 Titular: <strong>{cta.titular}</strong></div>}
                        {cta.numero_cuenta_telefono && (
                          <div>📧 Correo / ID: <strong>{cta.numero_cuenta_telefono}</strong></div>
                        )}
                      </>
                    ) : (
                      <div style={{ color: "var(--text-muted)", fontWeight: 700 }}>
                        💵 Fondo Físico de La Parada del Sabor (Gaveta / Caja Chica)
                      </div>
                    )}
                  </div>
                </div>

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

      {/* PESTAÑA 4: TRANSFERENCIAS Y MOVIMIENTOS ENTRE CUENTAS */}
      {tabActiva === "transferencias" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, padding: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14, boxShadow: "var(--shadow-sm)" }}>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 900, color: "var(--text)" }}>🔄 Transferencias & Movimientos entre Cuentas</h2>
              <p className="recetas-subtitle">Registro de fondeos y traspasos de saldo (ej: BFC a BDV de Grecia Márquez para pagar con BioPago).</p>
            </div>
            <button
              type="button"
              onClick={abrirModalTransferencia}
              className="btn-primary-action"
            >
              <span>+</span> Nueva Transferencia / Traspaso
            </button>
          </div>

          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, overflow: "hidden", boxShadow: "var(--shadow-md)" }}>
            {transferencias.length === 0 ? (
              <div className="recetas-empty-box" style={{ border: "none" }}>
                <span style={{ fontSize: 48 }}>🔄</span>
                <strong style={{ fontSize: 17, color: "var(--text)" }}>No hay transferencias registradas entre cuentas</strong>
                <p className="recetas-subtitle">Usa el botón "+ Nueva Transferencia / Traspaso" para mover fondos de un banco a otro.</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                      <th style={{ padding: "14px 16px", fontWeight: 800, color: "var(--text)" }}>Fecha</th>
                      <th style={{ padding: "14px 16px", fontWeight: 800, color: "var(--text)" }}>Cuenta Origen</th>
                      <th style={{ padding: "14px 16px", fontWeight: 800, color: "var(--text)", textAlign: "center" }}>Traspaso</th>
                      <th style={{ padding: "14px 16px", fontWeight: 800, color: "var(--text)" }}>Cuenta Destino</th>
                      <th style={{ padding: "14px 16px", fontWeight: 800, color: "var(--text)", textAlign: "right" }}>Monto Transferido</th>
                      <th style={{ padding: "14px 16px", fontWeight: 800, color: "var(--text)" }}>Método / Ref</th>
                      <th style={{ padding: "14px 16px", fontWeight: 800, color: "var(--text)", textAlign: "center" }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transferencias.map((tr) => {
                      const orig = tr.cuenta_origen || cuentas.find((c) => c.id === tr.cuenta_origen_id);
                      const dest = tr.cuenta_destino || cuentas.find((c) => c.id === tr.cuenta_destino_id);

                      return (
                        <tr key={tr.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                          <td style={{ padding: "14px 16px", fontWeight: 700, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                            {tr.fecha}
                          </td>

                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ fontWeight: 800, color: "var(--text)" }}>
                              {orig?.icono || "🏦"} {orig?.nombre || "Cuenta Origen"}
                            </div>
                            {orig?.titular && (
                              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{orig.titular}</div>
                            )}
                          </td>

                          <td style={{ padding: "14px 16px", textAlign: "center", fontSize: 18, color: "var(--primary)" }}>
                            ➡️
                          </td>

                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ fontWeight: 800, color: "var(--text)" }}>
                              {dest?.icono || "🏦"} {dest?.nombre || "Cuenta Destino"}
                            </div>
                            {dest?.titular && (
                              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{dest.titular}</div>
                            )}
                          </td>

                          <td style={{ padding: "14px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                            <div style={{ fontSize: 15, fontWeight: 900, color: "var(--text)" }}>
                              {tr.moneda_origen === "USD" ? "$" : "Bs. "} {Number(tr.monto_origen).toFixed(2)} {tr.moneda_origen}
                            </div>
                            {tr.moneda_origen !== tr.moneda_destino && (
                              <div style={{ fontSize: 11.5, color: "var(--primary)", fontWeight: 700 }}>
                                ↳ {tr.moneda_destino === "USD" ? "$" : "Bs. "} {Number(tr.monto_destino).toFixed(2)} {tr.moneda_destino}
                              </div>
                            )}
                          </td>

                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ fontWeight: 800, color: "var(--text)", textTransform: "capitalize" }}>
                              {tr.metodo_transferencia.replaceAll("_", " ")}
                            </div>
                            {tr.referencia && (
                              <div style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: "monospace" }}>
                                Ref: {tr.referencia}
                              </div>
                            )}
                            {tr.concepto && (
                              <div style={{ fontSize: 11.5, color: "var(--primary)", marginTop: 2 }}>
                                💡 {tr.concepto}
                              </div>
                            )}
                          </td>

                          <td style={{ padding: "14px 16px", textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => handleEliminarTransferencia(tr.id)}
                              style={{
                                background: "rgba(239, 68, 68, 0.1)",
                                border: "1px solid rgba(239, 68, 68, 0.3)",
                                color: "#ef4444",
                                padding: "6px 10px",
                                borderRadius: 8,
                                fontSize: 12,
                                cursor: "pointer",
                              }}
                              title="Eliminar transferencia"
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
        </div>
      )}

      {/* MODAL 1: REGISTRAR / EDITAR GASTO GENERAL */}
      {modalGasto && (
        <div className="modal-overlay" onClick={() => setModalGasto(false)}>
          <div className="modal-recipe-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal-recipe-header">
              <h2>
                <span>{gastoEditando ? "✏️ Modificar Gasto" : "➕ Registrar Gasto General"}</span>
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

              <div className="form-field">
                <label>Descripción Detallada *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Pago de gas, nómina semana 34, reparación de plancha..."
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="form-input"
                />
              </div>

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

              <div className="form-grid-2">
                <div className="form-field">
                  <label>Cuenta / Origen del Pago *</label>
                  <select
                    value={cuentaId || cuentaOrigen}
                    onChange={(e) => {
                      const sel = e.target.value;
                      const c = cuentas.find((item) => item.id === sel || item.codigo === sel);
                      if (c) {
                        setCuentaId(c.id);
                        setCuentaOrigen(c.codigo);
                        if (c.tipo === "banco_nacional") {
                          setMetodoPagoGasto("pago_movil");
                        } else if (c.tipo === "billetera_digital") {
                          setMetodoPagoGasto("zelle");
                        } else if (c.tipo === "cripto") {
                          setMetodoPagoGasto("binance");
                        } else {
                          setMetodoPagoGasto("efectivo");
                        }
                      } else {
                        setCuentaOrigen(sel);
                      }
                    }}
                    className="form-input"
                  >
                    {cuentas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icono} {c.nombre} {c.titular ? `(${c.titular})` : ""} {c.admite_biopago ? "• BioPago" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label>Método de Pago Específico *</label>
                  <select
                    value={metodoPagoGasto}
                    onChange={(e) => setMetodoPagoGasto(e.target.value)}
                    className="form-input"
                  >
                    {cuentaSeleccionadaGastoObj?.tipo === "banco_nacional" ? (
                      <>
                        <option value="pago_movil">📱 Pago Móvil Interbancario</option>
                        <option value="transferencia">🏛️ Transferencia Bancaria</option>
                        <option value="debito">💳 Tarjeta Débito / POS</option>
                        {cuentaSeleccionadaGastoObj.admite_biopago && (
                          <option value="biopago">🟢 BioPago / Huella (BDV)</option>
                        )}
                      </>
                    ) : cuentaSeleccionadaGastoObj?.tipo === "billetera_digital" ? (
                      <option value="zelle">🟣 Zelle / Plataforma Digital</option>
                    ) : cuentaSeleccionadaGastoObj?.tipo === "cripto" ? (
                      <option value="binance">🟡 Binance Pay / Cripto</option>
                    ) : (
                      <option value="efectivo">💵 Efectivo en Gaveta / Caja Chica</option>
                    )}
                  </select>
                </div>
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

      {/* MODAL 2: REGISTRAR ENTRADA DE INSUMOS (STOCK EN DESPENSA 2 EN 1) */}
      {modalCompra && (
        <div className="modal-overlay" onClick={() => setModalCompra(false)}>
          <div className="modal-recipe-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 660 }}>
            <div className="modal-recipe-header">
              <h2>
                <span>🚚 Registrar Ingreso de Insumos (Stock 2 en 1)</span>
              </h2>
              <button
                type="button"
                onClick={() => setModalCompra(false)}
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

            <form onSubmit={handleGuardarIngresoInsumo} className="recipe-form">
              <div className="form-grid-2">
                <div className="form-field">
                  <label>Insumo a Recibir *</label>
                  <select
                    value={compraInsumoId}
                    onChange={(e) => setCompraInsumoId(e.target.value)}
                    className="form-input"
                  >
                    {insumos.map((ins) => (
                      <option key={ins.id} value={ins.id}>
                        {ins.nombre} ({ins.unidad_medida})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label>Proveedor (Opcional)</label>
                  <select
                    value={compraProveedorId}
                    onChange={(e) => setCompraProveedorId(e.target.value)}
                    className="form-input"
                  >
                    <option value="">-- Compra Local / Sin Registro --</option>
                    {proveedores.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-field">
                  <label>Cantidad Comprada *</label>
                  <input
                    type="number"
                    step="any"
                    min="0.1"
                    required
                    value={compraCantidad}
                    onChange={(e) => setCompraCantidad(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-field">
                  <label>Formato / Unidad de Compra *</label>
                  <select
                    value={compraUnidadId}
                    onChange={(e) => setCompraUnidadId(e.target.value)}
                    className="form-input"
                  >
                    {UNIDADES_COMPRA.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, background: "var(--bg-subtle)", padding: "14px", borderRadius: 16, border: "1.5px dashed var(--border)" }}>
                <div className="form-field">
                  <label style={{ color: "var(--primary)", fontWeight: 900 }}>Total Compra ($ USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={compraTotalUsd}
                    onChange={(e) => handleCambioCompraUsd(e.target.value)}
                    className="form-input"
                    style={{ fontSize: 16, fontWeight: 900, borderColor: "var(--primary)" }}
                  />
                </div>

                <div className="form-field">
                  <label>Total en Bolívares (Bs)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={compraTotalBs}
                    onChange={(e) => handleCambioCompraBs(e.target.value)}
                    className="form-input"
                    style={{ fontSize: 15, fontWeight: 800 }}
                  />
                  <span style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, fontWeight: 600 }}>Tasa: {tasaBcv.toFixed(2)} Bs/USD</span>
                </div>
              </div>

              {/* Tarjeta de Cálculo en Vivo de Stock & Costo Base */}
              <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.3)", padding: "12px 14px", borderRadius: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: "var(--green)" }}>SE SUMARÁ AL INVENTARIO:</span>
                    <div style={{ fontSize: 16, fontWeight: 900, color: "var(--text)" }}>
                      +{cantidadTotalBaseCalculada.toLocaleString()} {insumoSeleccionadoObj?.unidad_medida}
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: "var(--text-muted)" }}>NUEVO COSTO BASE:</span>
                    <div style={{ fontSize: 15, fontWeight: 900, color: "var(--text)" }}>
                      ${costoUnitarioBaseCalculado.toFixed(5)} / {insumoSeleccionadoObj?.unidad_medida}
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-field">
                  <label>Cuenta / Origen del Pago *</label>
                  <select
                    value={compraCuentaId}
                    onChange={(e) => setCompraCuentaId(e.target.value)}
                    className="form-input"
                  >
                    {cuentas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icono} {c.nombre} {c.titular ? `(${c.titular})` : ""} {c.admite_biopago ? "• BioPago" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label>Nro. Factura / Comprobante</label>
                  <input
                    type="text"
                    placeholder="Ej: FACT-00912 / Control"
                    value={compraFactura}
                    onChange={(e) => setCompraFactura(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                <button
                  type="button"
                  onClick={() => setModalCompra(false)}
                  className="btn-refresh-action"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="btn-primary-action"
                >
                  {guardando ? "Procesando..." : "🚚 Ingresar Stock & Asentar Gasto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CREAR / EDITAR CUENTA FINANCIERA (CON FORMULARIOS DINÁMICOS SEGÚN TIPO) */}
      {modalCuenta && (
        <div className="modal-overlay" onClick={() => setModalCuenta(false)}>
          <div className="modal-recipe-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 580 }}>
            <div className="modal-recipe-header">
              <h2>
                <span>{cuentaEditando ? "✏️ Modificar Cuenta Financiera" : "➕ Nueva Cuenta Financiera"}</span>
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
              <div className="form-grid-2">
                <div className="form-field">
                  <label>Tipo de Cuenta *</label>
                  <select
                    value={ctaTipo}
                    onChange={(e) => {
                      const t = e.target.value as CuentaNegocio["tipo"];
                      setCtaTipo(t);
                      if (t === "banco_nacional") {
                        setCtaMoneda("VES");
                        setCtaIcono("🏛️");
                        setCtaBanco(BANCOS_VENEZUELA_LISTA[0].nombre);
                        setCtaAdmiteBiopago(true);
                      } else if (t === "billetera_digital") {
                        setCtaMoneda("USD");
                        setCtaIcono("🟣");
                        setCtaBanco("Zelle");
                        setCtaAdmiteBiopago(false);
                      } else if (t === "cripto") {
                        setCtaMoneda("USDT");
                        setCtaIcono("🟡");
                        setCtaBanco("Binance Pay");
                        setCtaAdmiteBiopago(false);
                      } else if (t === "efectivo_usd") {
                        setCtaMoneda("USD");
                        setCtaIcono("💵");
                        setCtaBanco("Gaveta Físico");
                        setCtaAdmiteBiopago(false);
                      } else if (t === "efectivo_bs") {
                        setCtaMoneda("VES");
                        setCtaIcono("🇻🇪");
                        setCtaBanco("Gaveta Bolívares");
                        setCtaAdmiteBiopago(false);
                      } else if (t === "caja_chica") {
                        setCtaMoneda("USD");
                        setCtaIcono("💼");
                        setCtaBanco("Caja Chica");
                        setCtaAdmiteBiopago(false);
                      }
                    }}
                    className="form-input"
                  >
                    <option value="banco_nacional">🏛️ Banca Nacional (Venezuela)</option>
                    <option value="billetera_digital">🟣 Billetera Digital (Zelle, etc.)</option>
                    <option value="cripto">🟡 Cripto (Binance USDT)</option>
                    <option value="efectivo_usd">💵 Efectivo USD (Gaveta Principal)</option>
                    <option value="efectivo_bs">🇻🇪 Efectivo Bs (Gaveta Principal)</option>
                    <option value="caja_chica">💼 Caja Chica Operativa</option>
                    <option value="otra">📦 Otra Cuenta</option>
                  </select>
                </div>

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
                    <option value="COP">COP (Pesos Colombianos)</option>
                  </select>
                </div>
              </div>

              {/* 1. CASO BANCO NACIONAL */}
              {ctaTipo === "banco_nacional" && (
                <>
                  <div className="form-field">
                    <label>Banco Nacional * (Desplegable Oficial)</label>
                    <select
                      value={ctaBanco}
                      onChange={(e) => handleSeleccionarBancoNacional(e.target.value)}
                      className="form-input"
                    >
                      <optgroup label="🏛️ Bancos del Estado (BioPago)">
                        {BANCOS_VENEZUELA_LISTA.filter((b) => b.codigo.startsWith("0102") || b.codigo.startsWith("0175") || b.codigo.startsWith("0163") || b.codigo.startsWith("0177") || b.codigo.startsWith("0166")).map((b) => (
                          <option key={b.codigo} value={b.nombre}>
                            {b.icono} {b.nombre} (0{b.codigo}) {b.biopago ? "✓ BioPago" : ""}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="🏦 Bancos Privados Afiliados a BioPago">
                        {BANCOS_VENEZUELA_LISTA.filter((b) => b.biopago && !b.codigo.startsWith("0102") && !b.codigo.startsWith("0175") && !b.codigo.startsWith("0163") && !b.codigo.startsWith("0177") && !b.codigo.startsWith("0166")).map((b) => (
                          <option key={b.codigo} value={b.nombre}>
                            {b.icono} {b.nombre} (0{b.codigo}) ✓ BioPago
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="📱 Otros Bancos Nacionales">
                        {BANCOS_VENEZUELA_LISTA.filter((b) => !b.biopago).map((b) => (
                          <option key={b.codigo} value={b.nombre}>
                            {b.icono} {b.nombre} (0{b.codigo})
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  <div className="form-field">
                    <label>Nombre Identificador de la Cuenta *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: BDV Grecia Márquez, BFC La Parada..."
                      value={ctaNombre}
                      onChange={(e) => setCtaNombre(e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div className="form-grid-2">
                    <div className="form-field">
                      <label>Titular de la Cuenta</label>
                      <input
                        type="text"
                        placeholder="Ej: Grecia Márquez / La Parada del Sabor"
                        value={ctaTitular}
                        onChange={(e) => setCtaTitular(e.target.value)}
                        className="form-input"
                      />
                    </div>

                    <div className="form-field">
                      <label>Cédula / RIF</label>
                      <input
                        type="text"
                        placeholder="Ej: V-12345678 / J-502717960"
                        value={ctaCedula}
                        onChange={(e) => setCtaCedula(e.target.value)}
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div className="form-grid-2">
                    <div className="form-field">
                      <label>Teléfono para Pago Móvil</label>
                      <input
                        type="text"
                        placeholder="Ej: 0412-2595386"
                        value={ctaTelefonoPm}
                        onChange={(e) => setCtaTelefonoPm(e.target.value)}
                        className="form-input"
                      />
                    </div>

                    <div className="form-field">
                      <label>Nro. Cuenta 20 Dígitos</label>
                      <input
                        type="text"
                        maxLength={20}
                        placeholder="0102-0123-45-6789012345"
                        value={ctaNumero20}
                        onChange={(e) => setCtaNumero20(e.target.value)}
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div style={{ background: "var(--bg-subtle)", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
                    <input
                      type="checkbox"
                      id="chkBiopago"
                      checked={ctaAdmiteBiopago}
                      onChange={(e) => setCtaAdmiteBiopago(e.target.checked)}
                      style={{ width: 18, height: 18, accentColor: "var(--primary)" }}
                    />
                    <label htmlFor="chkBiopago" style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", cursor: "pointer" }}>
                      🟢 Admite pagos por BioPago / Huella Biométrica (Red BDV)
                    </label>
                  </div>
                </>
              )}

              {/* 2. CASO BILLETERA DIGITAL (ZELLE, ZINLI, PAYPAL) */}
              {ctaTipo === "billetera_digital" && (
                <>
                  <div className="form-field">
                    <label>Plataforma o Servicio *</label>
                    <input
                      type="text"
                      placeholder="Ej: Zelle, Zinli, PayPal..."
                      value={ctaBanco}
                      onChange={(e) => setCtaBanco(e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div className="form-field">
                    <label>Nombre Identificador de la Cuenta *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Zelle Grecia Márquez, Zelle Negocio..."
                      value={ctaNombre}
                      onChange={(e) => setCtaNombre(e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div className="form-grid-2">
                    <div className="form-field">
                      <label>Nombre del Titular</label>
                      <input
                        type="text"
                        placeholder="Ej: Grecia Márquez"
                        value={ctaTitular}
                        onChange={(e) => setCtaTitular(e.target.value)}
                        className="form-input"
                      />
                    </div>

                    <div className="form-field">
                      <label>Correo Electrónico (Email asociado)</label>
                      <input
                        type="email"
                        placeholder="ejemplo@gmail.com"
                        value={ctaEmail}
                        onChange={(e) => setCtaEmail(e.target.value)}
                        className="form-input"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* 3. CASO CRIPTO (BINANCE USDT) */}
              {ctaTipo === "cripto" && (
                <>
                  <div className="form-field">
                    <label>Plataforma Cripto *</label>
                    <input
                      type="text"
                      placeholder="Ej: Binance Pay, Bybit..."
                      value={ctaBanco}
                      onChange={(e) => setCtaBanco(e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div className="form-field">
                    <label>Nombre Identificador de la Cuenta *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Binance Pay USDT, Billetera Cripto..."
                      value={ctaNombre}
                      onChange={(e) => setCtaNombre(e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div className="form-grid-2">
                    <div className="form-field">
                      <label>Nombre del Titular</label>
                      <input
                        type="text"
                        placeholder="Ej: Grecia Márquez / La Parada"
                        value={ctaTitular}
                        onChange={(e) => setCtaTitular(e.target.value)}
                        className="form-input"
                      />
                    </div>

                    <div className="form-field">
                      <label>Correo Electrónico de Binance</label>
                      <input
                        type="email"
                        placeholder="correo@binance.com"
                        value={ctaEmail}
                        onChange={(e) => setCtaEmail(e.target.value)}
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div className="form-field">
                    <label>Binance Pay ID / Binance ID / Wallet</label>
                    <input
                      type="text"
                      placeholder="Ej: 198274620 (Pay ID)"
                      value={ctaPayId}
                      onChange={(e) => setCtaPayId(e.target.value)}
                      className="form-input"
                    />
                  </div>
                </>
              )}

              {/* 4. CASO EFECTIVO / CAJA CHICA */}
              {(ctaTipo === "efectivo_usd" || ctaTipo === "efectivo_bs" || ctaTipo === "caja_chica" || ctaTipo === "otra") && (
                <>
                  <div className="form-field">
                    <label>Nombre Identificador del Fondo Físico *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Gaveta Efectivo USD, Gaveta Efectivo Bs, Caja Chica..."
                      value={ctaNombre}
                      onChange={(e) => setCtaNombre(e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div style={{ background: "var(--bg-subtle)", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border)", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
                    💡 <strong>Fondo Físico del Negocio:</strong> Este fondo pertenece a <strong>La Parada del Sabor</strong>. No requiere datos bancarios ni titulares personales; sus movimientos alimentan el arqueo de caja y egresos directos en efectivo.
                  </div>
                </>
              )}

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

      {/* MODAL 4: MOVER FONDOS / TRANSFERENCIA ENTRE CUENTAS CON CALCULADORA MULTIDIVISA */}
      {modalTransferencia && (
        <div className="modal-overlay" onClick={() => setModalTransferencia(false)}>
          <div className="modal-recipe-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal-recipe-header">
              <h2>
                <span>🔄 Mover Fondos entre Cuentas (Fondeo / Traspaso)</span>
              </h2>
              <button
                type="button"
                onClick={() => setModalTransferencia(false)}
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

            <form onSubmit={handleGuardarTransferencia} className="recipe-form">
              <div className="form-field">
                <label>Fecha de la Operación *</label>
                <input
                  type="date"
                  required
                  value={trFecha}
                  onChange={(e) => setTrFecha(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-grid-2">
                <div className="form-field">
                  <label>Cuenta de Salida (Origen) *</label>
                  <select
                    value={trCuentaOrigenId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setTrCuentaOrigenId(id);
                      const orig = cuentas.find((c) => c.id === id);
                      const dest = cuentas.find((c) => c.id === trCuentaDestinoId);
                      if (orig?.tipo === "cripto" && dest?.tipo === "banco_nacional") {
                        setTrMetodo("venta_usdt_p2p");
                      } else if (orig?.tipo === "banco_nacional" && dest?.tipo === "cripto") {
                        setTrMetodo("compra_usdt_p2p");
                      }
                      recalcularTransferencia(trMontoOrigen, "origen", id, trCuentaDestinoId, trTasaCambio);
                    }}
                    className="form-input"
                  >
                    {cuentas.map((c) => (
                      <option key={c.id} value={c.id}>
                        📤 {c.icono} {c.nombre} ({c.moneda})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label>Cuenta Receptora (Destino) *</label>
                  <select
                    value={trCuentaDestinoId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setTrCuentaDestinoId(id);
                      const orig = cuentas.find((c) => c.id === trCuentaOrigenId);
                      const dest = cuentas.find((c) => c.id === id);
                      if (orig?.tipo === "cripto" && dest?.tipo === "banco_nacional") {
                        setTrMetodo("venta_usdt_p2p");
                      } else if (orig?.tipo === "banco_nacional" && dest?.tipo === "cripto") {
                        setTrMetodo("compra_usdt_p2p");
                      }
                      recalcularTransferencia(trMontoOrigen, "origen", trCuentaOrigenId, id, trTasaCambio);
                    }}
                    className="form-input"
                  >
                    {cuentas.map((c) => (
                      <option key={c.id} value={c.id} disabled={c.id === trCuentaOrigenId}>
                        📥 {c.icono} {c.nombre} ({c.moneda})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Panel de Tasa de Cambio con Selector Rápido & Edición Manual */}
              <div style={{ background: "var(--bg-subtle)", padding: "14px", borderRadius: 16, border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 900, color: "var(--text)" }}>
                    💱 Tasa de Conversión Aplicada:
                  </span>

                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => handleCambioTrTasa(tasaBcv.toString())}
                      className="btn-refresh-action"
                      style={{ fontSize: 11, padding: "4px 10px", fontWeight: 800 }}
                    >
                      🏛️ BCV ({tasaBcv.toFixed(2)})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCambioTrTasa((tasaBcv * 1.15).toFixed(2))}
                      className="btn-refresh-action"
                      style={{ fontSize: 11, padding: "4px 10px", fontWeight: 800 }}
                    >
                      🟡 USDT P2P
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCambioTrTasa(tasaBcv.toString())}
                      className="btn-refresh-action"
                      style={{ fontSize: 11, padding: "4px 10px", fontWeight: 800 }}
                    >
                      💵 Efectivo
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                    Tasa (Bs/USD o Bs/USDT):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder={tasaBcv.toString()}
                    value={trTasaCambio}
                    onChange={(e) => handleCambioTrTasa(e.target.value)}
                    className="form-input"
                    style={{ fontSize: 15, fontWeight: 900, maxWidth: 180, color: "var(--primary)" }}
                  />
                  <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                    Editable manual
                  </span>
                </div>
              </div>

              {/* Inputs de Monto Origen y Destino Bidireccionales */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, background: "var(--bg-subtle)", padding: "14px", borderRadius: 16, border: "1.5px dashed var(--border)" }}>
                <div className="form-field">
                  <label style={{ color: "var(--primary)", fontWeight: 900 }}>
                    Monto Enviado ({cuentas.find((c) => c.id === trCuentaOrigenId)?.moneda || "VES"}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={trMontoOrigen}
                    onChange={(e) => recalcularTransferencia(e.target.value, "origen")}
                    className="form-input"
                    style={{ fontSize: 16, fontWeight: 900 }}
                  />
                </div>

                <div className="form-field">
                  <label style={{ color: "var(--green)", fontWeight: 900 }}>
                    Monto Recibido ({cuentas.find((c) => c.id === trCuentaDestinoId)?.moneda || "VES"}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={trMontoDestino}
                    onChange={(e) => recalcularTransferencia(e.target.value, "destino")}
                    className="form-input"
                    style={{ fontSize: 16, fontWeight: 900 }}
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-field">
                  <label>Método de Envío *</label>
                  <select
                    value={trMetodo}
                    onChange={(e) => setTrMetodo(e.target.value)}
                    className="form-input"
                  >
                    <option value="pago_movil">📱 Pago Móvil Interbancario</option>
                    <option value="transferencia">🏛️ Transferencia Bancaria</option>
                    <option value="biopago">🟢 BioPago (Huella)</option>
                    <option value="compra_usdt_p2p">🟡 Compra USDT Binance P2P</option>
                    <option value="venta_usdt_p2p">🟡 Venta USDT Binance P2P</option>
                    <option value="efectivo">💵 Entrega / Retiro de Efectivo</option>
                    <option value="zelle">🟣 Zelle</option>
                    <option value="binance">🟡 Binance Pay</option>
                  </select>
                </div>

                <div className="form-field">
                  <label>Nro. de Referencia / Aprobación</label>
                  <input
                    type="text"
                    placeholder="Ej: 004829 / Ref Pago Móvil"
                    value={trReferencia}
                    onChange={(e) => setTrReferencia(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-field">
                <label>Concepto / Motivo del Traspaso</label>
                <input
                  type="text"
                  placeholder="Ej: Fondeo a BDV Grecia Márquez para pagar insumos en Super 900 con BioPago"
                  value={trConcepto}
                  onChange={(e) => setTrConcepto(e.target.value)}
                  className="form-input"
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                <button
                  type="button"
                  onClick={() => setModalTransferencia(false)}
                  className="btn-refresh-action"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="btn-primary-action"
                >
                  {guardando ? "Procesando..." : "🔄 Registrar Traspaso"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: VISOR DE FACTURA / COMPROBANTE */}
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
