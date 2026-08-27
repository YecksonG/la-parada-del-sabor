export type UnidadMedida = "g" | "ml" | "und";

export type Insumo = {
  id: string;
  nombre: string;
  unidad_medida: UnidadMedida;
  stock_actual: number;
  stock_minimo: number;
  costo_unitario_usd: number;
  categoria_insumo: string;
  activo: boolean;
  actualizado_el: string;
  creado_el: string;
};

export type Categoria = {
  id: string;
  nombre: string;
  icono: string;
  orden: number;
  activo: boolean;
  creado_el: string;
};

export type Producto = {
  id: string;
  nombre: string;
  categoria_id: string | null;
  descripcion: string | null;
  precio_usd: number;
  icono: string;
  imagen_url: string | null;
  popular: boolean;
  activo: boolean;
  creado_el: string;
  categoria?: Categoria;
  ingredientes?: RecetaIngrediente[];
};

export type RecetaIngrediente = {
  id: string;
  producto_id: string;
  insumo_id: string;
  cantidad: number; // en gramos, ml o unidades
  es_opcional: boolean;
  notas: string | null;
  insumo?: Insumo;
};

export type ExtraModificador = {
  id: string;
  nombre: string;
  insumo_id: string | null;
  cantidad_descuento: number;
  precio_extra_usd: number;
  activo: boolean;
  insumo?: Insumo;
};

export type Cliente = {
  id: string;
  nombre: string;
  telefono: string | null;
  direccion_delivery: string | null;
  notas_preferencias: string | null;
  total_pedidos: number;
  creado_el: string;
  actualizado_el?: string | null;
};

export type Proveedor = {
  id: string;
  nombre: string;
  telefono: string | null;
  contacto: string | null;
  direccion: string | null;
  rif: string | null;
  notas: string | null;
  activo: boolean;
  creado_el: string;
  insumos?: Insumo[];
};

export type ProveedorInsumo = {
  id: string;
  proveedor_id: string;
  insumo_id: string;
  precio_referencial_usd: number;
  notas: string | null;
  creado_el: string;
  proveedor?: Proveedor;
  insumo?: Insumo;
};

export type TasaActivaTipo = "bcv" | "usdt" | "eur" | "promedio" | "personalizada";

export type TasaCambio = {
  id: string;
  fecha: string;
  bcv_usd_bs: number;
  usdt_bs: number | null;
  promedio_bs: number | null;
  eur_bs: number | null;
  tasa_usd_bs: number | null;
  tasa_activa_tipo?: TasaActivaTipo | null;
  tasa_personalizada_bs?: number | null;
  cop_usd: number | null;
  creado_el: string;
};

export type TipoEntrega = "puerta_cerrada" | "mesa" | "pickup" | "delivery";
export type MetodoPago = "efectivo_usd" | "efectivo_bs" | "pago_movil" | "pago_movil_bs" | "transferencia" | "punto" | "punto_bs" | "binance" | "zelle" | "pesos_cop";
export type EstadoVenta = "pendiente" | "preparando" | "lista" | "completada" | "cancelada";
export type OrigenPedido = "instagram" | "whatsapp" | "tiktok" | "facebook" | "qr" | "directo" | "web" | "pos" | string;

export type ZonaDelivery = {
  id: string;
  nombre: string;
  descripcion?: string | null;
  precio_usd: number;
  tiempo_estimado_min?: number | null;
  orden: number;
  activo: boolean;
  creado_el: string;
};

export type Venta = {
  id: string;
  numero_comanda: number;
  cliente_id: string | null;
  fecha: string;
  total_usd: number;
  total_bs: number;
  tasa_bcv: number;
  metodo_pago: MetodoPago;
  tipo_entrega: TipoEntrega;
  delivery_zona_id?: string | null;
  delivery_zona_nombre?: string | null;
  delivery_monto_usd?: number | null;
  delivery_monto_bs?: number | null;
  direccion_delivery?: string | null;
  estado: EstadoVenta;
  notas_comanda: string | null;
  creado_por?: string | null;
  origen_pedido?: OrigenPedido | null;
  creado_el: string;
  cliente?: Cliente;
  items?: VentaItem[];
};

export type VentaItem = {
  id: string;
  venta_id: string;
  producto_id: string;
  cantidad: number;
  precio_unitario_usd: number;
  subtotal_usd: number;
  notas: string | null;
  producto?: Producto;
  extras?: VentaItemExtra[];
};

export type VentaItemExtra = {
  id: string;
  venta_item_id: string;
  extra_id: string;
  cantidad: number;
  precio_unitario_usd: number;
  subtotal_usd: number;
  extra?: ExtraModificador;
};

export type PedidoPendienteItem = {
  id: string;
  producto_id: string;
  cantidad: number;
  precio_unitario_usd: number;
  subtotal_usd: number;
  notas_item?: string | null;
  producto?: Producto;
  extras?: VentaItemExtra[];
};

export type PedidoPendiente = {
  id: string;
  numero_comanda: number;
  fecha: string;
  total_usd: number;
  total_bs: number;
  tipo_entrega: TipoEntrega;
  notas_comanda?: string | null;
  estado: EstadoVenta;
  cliente?: Cliente | null;
  items?: PedidoPendienteItem[];
};

export type SesionCaja = {
  id: string;
  fecha_apertura: string;
  fecha_cierre: string | null;
  estado: "abierta" | "cerrada";
  monto_inicial_usd: number;
  monto_inicial_bs: number;
  total_ventas_efectivo_usd: number;
  total_ventas_pago_movil_bs: number;
  total_ventas_transferencia_bs: number;
  total_ventas_binance_usd: number;
  total_ventas_punto_bs: number;
  total_gastos_usd: number;
  total_gastos_bs: number;
  arqueo_fisico_efectivo_usd: number | null;
  arqueo_fisico_efectivo_bs: number | null;
  diferencia_usd: number | null;
  diferencia_bs: number | null;
  notas_cierre: string | null;
  usuario_apertura: string | null;
  usuario_cierre: string | null;
  creado_el: string;
};

export type CategoriaGasto = 
  | "servicios" 
  | "nomina" 
  | "proveedores" 
  | "alquiler" 
  | "mantenimiento" 
  | "marketing" 
  | "impuestos" 
  | "otros";

export type CuentaOrigenGasto = 
  | "efectivo_usd" 
  | "efectivo_bs" 
  | "pago_movil_bfc" 
  | "transferencia_bfc" 
  | "bdv_ves"
  | "bancamiga"
  | "banesco"
  | "binance" 
  | "zelle" 
  | "punto_venta" 
  | "caja_chica" 
  | "otra"
  | string;

export type CuentaNegocio = {
  id: string;
  nombre: string;
  codigo: string;
  tipo: "efectivo_usd" | "efectivo_bs" | "banco_nacional" | "billetera_digital" | "cripto" | "caja_chica" | "otra";
  moneda: "USD" | "VES" | "USDT" | "COP";
  banco_plataforma?: string | null;
  titular?: string | null;
  numero_cuenta_telefono?: string | null;
  saldo_inicial?: number;
  icono?: string;
  color?: string;
  activo: boolean;
  notas?: string | null;
  creado_el: string;
  actualizado_el?: string;
};

export type Gasto = {
  id: string;
  fecha: string;
  categoria: CategoriaGasto;
  subcategoria?: string | null;
  descripcion: string;
  beneficiario?: string | null;
  proveedor_id?: string | null;
  monto_usd: number;
  monto_bs: number;
  tasa_bcv: number;
  cuenta_origen: CuentaOrigenGasto;
  cuenta_id?: string | null;
  numero_factura?: string | null;
  comprobante_url?: string | null;
  estado: "pagado" | "pendiente" | "anulado";
  sesion_caja_id?: string | null;
  notas?: string | null;
  creado_por?: string | null;
  creado_el: string;
  actualizado_el?: string;
  proveedor?: Proveedor;
  cuenta?: CuentaNegocio;
};

