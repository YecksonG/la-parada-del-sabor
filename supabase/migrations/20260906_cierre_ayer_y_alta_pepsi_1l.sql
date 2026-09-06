-- ==============================================================================
-- 🚨 ACCIÓN REQUERIDA EN SUPABASE (SQL EDITOR) — PRIORIDAD 10/10
-- CIERRE DE CAJA DE ANOCHE (#33, #35, #36 + Refresco $1) & ALTA DE PEPSI 1L AL MENÚ
-- ==============================================================================

BEGIN;

-- 1. AGREGAR "Refresco Pepsi 1 Litro" AL MENÚ DE PRODUCTOS (Categoría Bebidas & Jugos)
INSERT INTO public.productos (id, nombre, categoria_id, descripcion, precio_usd, icono, activo, popular)
SELECT 
    'd1111111-1111-1111-1111-111111111111'::uuid,
    'Refresco Pepsi 1 Litro',
    c.id,
    'Botella de refresco Pepsi de 1 Litro bien fría.',
    1.00,
    '🥤',
    true,
    false
FROM public.categorias c
WHERE c.nombre ILIKE '%Bebidas%'
LIMIT 1
ON CONFLICT (id) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    precio_usd = EXCLUDED.precio_usd,
    activo = true;

-- 2. ASOCIAR EL ESCANDALLO / RECETA: 1 Refresco Pepsi 1L descuenta 1 unidad del insumo
INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad, es_opcional)
SELECT 
    'd1111111-1111-1111-1111-111111111111'::uuid,
    i.id,
    1.0,
    false
FROM public.insumos i
WHERE i.nombre ILIKE '%Refresco Pepsi 1L%'
LIMIT 1
ON CONFLICT DO NOTHING;

-- 3. ASENTAR LA SESIÓN DE CAJA DE ANOCHE CERRADA FORMALMENTE (Corte Z)
-- Abarca: Comanda #33 ($4 efectivo), #35 ($13 pago móvil), #36 ($8 pago móvil) + $1 venta del refresco.
-- Total USD Efectivo en Gaveta al cerrar: $6.00 ($1 fondo/refresco + $5 neto ventas).
INSERT INTO public.sesiones_caja (
    fecha_apertura,
    fecha_cierre,
    estado,
    monto_inicial_usd,
    monto_inicial_bs,
    total_ventas_efectivo_usd,
    total_ventas_pago_movil_bs,
    total_ventas_transferencia_bs,
    total_ventas_binance_usd,
    total_ventas_punto_bs,
    total_gastos_usd,
    total_gastos_bs,
    arqueo_fisico_efectivo_usd,
    arqueo_fisico_efectivo_bs,
    diferencia_usd,
    diferencia_bs,
    notas_cierre,
    usuario_apertura,
    usuario_cierre
) VALUES (
    '2026-09-06 01:00:00+00',  -- 9:00 PM Caracas de anoche (antes de la comanda #33)
    '2026-09-06 03:30:00+00',  -- 11:30 PM Caracas (fin del turno)
    'cerrada',
    1.00,                      -- Fondo inicial base
    0.00,
    5.00,                      -- Ventas en efectivo ($4 comanda #33 + $1 venta refresco)
    16955.11,                  -- Pago Móvil totalizado (#35: Bs. 10.496,02 + #36: Bs. 6.459,09)
    0.00,
    0.00,
    0.00,
    0.00,
    0.00,
    6.00,                      -- Arqueo físico real contado en billetes USD ($6)
    0.00,
    0.00,                      -- Diferencia cuadrada exacta ($6 - $6 = $0.00)
    0.00,
    'Turno de anoche. Comandas #33, #35 y #36 incluidas. Se incluyó $1 en efectivo por venta de Refresco Pepsi 1L. Arqueo físico cuadrado en $6 USD.',
    'admin',
    'admin'
);

-- 4. DESCONTAR LA UNIDAD DE PEPSI 1L VENDIDA DEL INVENTARIO
UPDATE public.insumos
SET stock_actual = GREATEST(0, stock_actual - 1)
WHERE nombre ILIKE '%Refresco Pepsi 1L%';

COMMIT;

-- VERIFICACIÓN:
SELECT id, fecha_apertura, fecha_cierre, estado, total_ventas_efectivo_usd, total_ventas_pago_movil_bs, arqueo_fisico_efectivo_usd, diferencia_usd, notas_cierre
FROM public.sesiones_caja
ORDER BY creado_el DESC
LIMIT 1;

SELECT nombre, precio_usd, activo
FROM public.productos
WHERE nombre ILIKE '%Pepsi%';
