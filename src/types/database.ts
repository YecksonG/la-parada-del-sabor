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
};

export type TasaCambio = {
  id: string;
  fecha: string;
  bcv_usd_bs: number;
  tasa_usd_bs: number | null;
  cop_usd: number | null;
  creado_el: string;
};

export type TipoEntrega = "puerta_cerrada" | "mesa" | "pickup" | "delivery";
export type MetodoPago = "efectivo_usd" | "pago_movil_bs" | "punto_bs" | "binance" | "pesos_cop";
export type EstadoVenta = "preparando" | "completada" | "cancelada";

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
  estado: EstadoVenta;
  notas_comanda: string | null;
  creado_por: string;
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
  notas_item: string | null;
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
