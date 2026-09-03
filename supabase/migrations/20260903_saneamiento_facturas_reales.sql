-- ==============================================================================
-- 🚨 ACCIÓN REQUERIDA EN SUPABASE (SQL EDITOR) — PRIORIDAD 10/10
-- MIGRACIÓN MAESTRA: SANEAMIENTO FORENSE DE FACTURAS, DESPENSA Y PROVEEDORES
-- ==============================================================================

BEGIN;

-- 1. ASEGURAR POLÍTICAS RLS PARA LECTURA ANÓNIMA / PÚBLICA DE PROVEEDORES E INSUMOS
DROP POLICY IF EXISTS "public_read_proveedores" ON public.proveedores;
CREATE POLICY "public_read_proveedores" ON public.proveedores FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_read_insumos" ON public.insumos;
CREATE POLICY "public_read_insumos" ON public.insumos FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_read_proveedor_insumos" ON public.proveedor_insumos;
CREATE POLICY "public_read_proveedor_insumos" ON public.proveedor_insumos FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_read_compras" ON public.compras;
CREATE POLICY "public_read_compras" ON public.compras FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_read_compras_items" ON public.compras_items;
CREATE POLICY "public_read_compras_items" ON public.compras_items FOR SELECT TO anon, authenticated USING (true);

-- 2. LIMPIEZA TOTAL DE INVENTARIO Y FACTURAS HISTÓRICAS FICTICIAS/DUPLICADAS
DELETE FROM public.compras_items;
DELETE FROM public.compras;
DELETE FROM public.proveedor_insumos;

-- 3. CREAR / ACTUALIZAR PROVEEDORES REALES (Datos auditados de las facturas físicas)
-- Super 900
INSERT INTO public.proveedores (id, nombre, rif, direccion, telefono, contacto, activo)
VALUES (
    'a0000001-0000-0000-0000-000000000001',
    'Super 900 (Inversiones El Sol de Falcón, C.A.)',
    'J-504442402',
    'Av. Coro con Av. Doña Emilia Local Nro 01, Sector Doña Emilia, Punto Fijo',
    '04126608761',
    'Aury Diaz / Hadly Escobar',
    true
)
ON CONFLICT (id) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    rif = EXCLUDED.rif,
    direccion = EXCLUDED.direccion,
    telefono = EXCLUDED.telefono,
    contacto = EXCLUDED.contacto;

-- Hortalizas El Páramo
INSERT INTO public.proveedores (id, nombre, rif, direccion, telefono, contacto, activo)
VALUES (
    'a0000002-0000-0000-0000-000000000002',
    'Hortalizas El Páramo C.A.',
    'J-412555464',
    'Calle Girardot, Edif. Cardón, Piso B Local 2 URE Santa Irene, Punto Fijo',
    '04127018104',
    'Caja Ventas Crédito',
    true
)
ON CONFLICT (id) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    rif = EXCLUDED.rif,
    direccion = EXCLUDED.direccion,
    telefono = EXCLUDED.telefono;

-- Multitienda Kariosca
INSERT INTO public.proveedores (id, nombre, rif, direccion, telefono, contacto, activo)
VALUES (
    'a0000003-0000-0000-0000-000000000003',
    'Multitienda Kariosca, C.A.',
    'J-309848909',
    'Calle Ollarvides, Edif. Fernandez Piso 3 Local 03, Puerta Maraven, Punto Fijo',
    NULL,
    'Master Desktop',
    true
)
ON CONFLICT (id) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    rif = EXCLUDED.rif,
    direccion = EXCLUDED.direccion;

-- Todo en Desechables C.A.
INSERT INTO public.proveedores (id, nombre, rif, direccion, telefono, contacto, activo)
VALUES (
    'a0000004-0000-0000-0000-000000000004',
    'Todo en Desechables C.A.',
    'J-300000000',
    'Punto Fijo, Falcón',
    NULL,
    'Ventas Mostrador',
    true
)
ON CONFLICT (id) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    rif = EXCLUDED.rif,
    direccion = EXCLUDED.direccion;

-- Comercializadora de Hortalizas La 04
INSERT INTO public.proveedores (id, nombre, rif, direccion, telefono, contacto, activo)
VALUES (
    'a0000005-0000-0000-0000-000000000005',
    'Comercializadora de Hortalizas La 04',
    'J-299492728',
    'Av. Ollarvides con C/Maraca C.C. Veracruz Local 04, Punto Fijo',
    NULL,
    'Caja 2 Contado',
    true
)
ON CONFLICT (id) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    rif = EXCLUDED.rif,
    direccion = EXCLUDED.direccion;

-- 4. INSERTAR / ACTUALIZAR CATÁLOGO CANÓNICO DE INSUMOS
INSERT INTO public.insumos (id, nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario_usd, categoria_insumo, activo)
VALUES
-- Proteínas / Carnes
('b0000001-0000-0000-0000-000000000001', 'Carne para Desmechar Halal', 'g', 0, 500, 0.009900, 'Carnes', true),
('b0000002-0000-0000-0000-000000000002', 'Pechuga de Pollo con Hueso / Filete', 'g', 0, 500, 0.005800, 'Carnes', true),
('b0000003-0000-0000-0000-000000000003', 'Pechuga Cocida de Pavo Magros / Punta de Monte', 'g', 0, 300, 0.007500, 'Carnes', true),

-- Quesos
('b0000004-0000-0000-0000-000000000004', 'Queso Amarillo (Oriany / Edam Porven)', 'g', 0, 400, 0.010500, 'Quesos', true),
('b0000005-0000-0000-0000-000000000005', 'Queso Blanco de Res (Charle / Semiduro)', 'g', 0, 400, 0.007400, 'Quesos', true),

-- Masas / Harina
('b0000006-0000-0000-0000-000000000006', 'Harina PAN Maíz Blanco', 'g', 0, 1000, 0.001130, 'Masas', true),

-- Grasas y Condimentos
('b0000007-0000-0000-0000-000000000007', 'Margarina Mavesa', 'g', 0, 200, 0.005510, 'Grasas', true),
('b0000008-0000-0000-0000-000000000008', 'Mayonesa Mavesa 910g', 'g', 0, 200, 0.008800, 'Salsas', true),
('b0000009-0000-0000-0000-000000000009', 'Mostaza Eureka 480g', 'g', 0, 100, 0.006900, 'Salsas', true),
('b0000010-0000-0000-0000-000000000010', 'Pampero Ketchup 397g', 'g', 0, 100, 0.004800, 'Salsas', true),
('b0000011-0000-0000-0000-000000000011', 'Aceite Amacorp 900ml', 'ml', 0, 200, 0.002980, 'Grasas', true),
('b0000012-0000-0000-0000-000000000012', 'Vinagre Fritz 1L', 'ml', 0, 200, 0.001250, 'Condimentos', true),
('b0000013-0000-0000-0000-000000000013', 'Salsa de Soya La China 300ml', 'ml', 0, 100, 0.008770, 'Condimentos', true),
('b0000014-0000-0000-0000-000000000014', 'Pepinillos Agridulces Nerano 500g', 'g', 0, 100, 0.007800, 'Vegetales', true),
('b0000015-0000-0000-0000-000000000015', 'Sal Corona Refinada', 'g', 0, 500, 0.000510, 'Condimentos', true),
('b0000016-0000-0000-0000-000000000016', 'Adobo La Comadre 200g', 'g', 0, 50, 0.008450, 'Condimentos', true),
('b0000017-0000-0000-0000-000000000017', 'Caldo de Pollo Maggi (8 und)', 'und', 0, 2, 1.095000, 'Condimentos', true),
('b0000018-0000-0000-0000-000000000018', 'Caldo de Costilla Criolla Maggi (8 und)', 'und', 0, 2, 1.095000, 'Condimentos', true),
('b0000019-0000-0000-0000-000000000019', 'Especias Sachet (Pimienta, Orégano, Laurel, Onoto, Comino)', 'und', 0, 5, 0.900000, 'Condimentos', true),

-- Vegetales Frescos
('b0000020-0000-0000-0000-000000000020', 'Aguacate Polo / Colonia Tovar', 'g', 0, 300, 0.003500, 'Vegetales', true),
('b0000021-0000-0000-0000-000000000021', 'Tomate Fresco', 'g', 0, 300, 0.002990, 'Vegetales', true),
('b0000022-0000-0000-0000-000000000022', 'Cebolla Blanca', 'g', 0, 300, 0.001500, 'Vegetales', true),
('b0000023-0000-0000-0000-000000000023', 'Cebolla Morada', 'g', 0, 200, 0.002250, 'Vegetales', true),
('b0000024-0000-0000-0000-000000000024', 'Pimentón Redondo', 'g', 0, 200, 0.001290, 'Vegetales', true),
('b0000025-0000-0000-0000-000000000025', 'Ají Dulce', 'g', 0, 100, 0.001880, 'Vegetales', true),
('b0000026-0000-0000-0000-000000000026', 'Lechuga Americana', 'g', 0, 200, 0.000990, 'Vegetales', true),
('b0000027-0000-0000-0000-000000000027', 'Cilantro', 'g', 0, 50, 0.002100, 'Vegetales', true),
('b0000028-0000-0000-0000-000000000028', 'Perejil Liso', 'g', 0, 100, 0.002450, 'Vegetales', true),
('b0000029-0000-0000-0000-000000000029', 'Cebollín', 'g', 0, 200, 0.001650, 'Vegetales', true),
('b0000030-0000-0000-0000-000000000030', 'Ajo Porro', 'g', 0, 200, 0.001950, 'Vegetales', true),
('b0000031-0000-0000-0000-000000000031', 'Céleri', 'g', 0, 150, 0.001550, 'Vegetales', true),
('b0000032-0000-0000-0000-000000000032', 'Ajo Blanco', 'g', 0, 100, 0.005490, 'Vegetales', true),
('b0000033-0000-0000-0000-000000000033', 'Limón', 'g', 0, 200, 0.001950, 'Vegetales', true),
('b0000034-0000-0000-0000-000000000034', 'Papa Pro', 'g', 0, 300, 0.001990, 'Vegetales', true),

-- Desechables y Empaques
('b0000035-0000-0000-0000-000000000035', 'Servilletas Europapel 160 und', 'und', 0, 50, 0.006000, 'Desechables', true),
('b0000036-0000-0000-0000-000000000036', 'Papel Antigraso Breakfast 50 und', 'und', 0, 20, 0.074000, 'Desechables', true),
('b0000037-0000-0000-0000-000000000037', 'Caja Dulce Kraft 6 (Familiar)', 'und', 0, 10, 0.400000, 'Desechables', true),
('b0000038-0000-0000-0000-000000000038', 'Caja Dulce Kraft 3 (Mediana/Personal)', 'und', 0, 10, 0.350000, 'Desechables', true),
('b0000039-0000-0000-0000-000000000039', 'Guantes de Nitrilo Negro L (100 und)', 'und', 0, 20, 0.065000, 'Desechables', true),
('b0000040-0000-0000-0000-000000000040', 'Vasos Desechables y Tapas', 'und', 0, 20, 0.065000, 'Desechables', true),
('b0000041-0000-0000-0000-000000000041', 'Bolsas Plásticas 10kg / 20kg', 'und', 0, 20, 0.022000, 'Desechables', true),
('b0000042-0000-0000-0000-000000000042', 'Envoplast y Papel Aluminio', 'und', 0, 1, 1.660000, 'Desechables', true),
('b0000043-0000-0000-0000-000000000043', 'Pote Salsero 360ml', 'und', 0, 1, 1.510000, 'Desechables', true),

-- Bebidas
('b0000044-0000-0000-0000-000000000044', 'Pepsi Cola 1.5L', 'und', 0, 6, 0.980000, 'Bebidas', true),

-- Pre-elaborados (Producción de Cocina)
('b0000045-0000-0000-0000-000000000045', 'Guiso de Carne Mechada', 'g', 0, 500, 0.010500, 'Pre-elaborados', true),
('b0000046-0000-0000-0000-000000000046', 'Guiso de Pollo Mechado', 'g', 0, 500, 0.005000, 'Pre-elaborados', true),
('b0000047-0000-0000-0000-000000000047', 'Relleno Reina Pepiada', 'g', 0, 300, 0.005300, 'Pre-elaborados', true),
('b0000048-0000-0000-0000-000000000048', 'Salsa Ajo Casera', 'ml', 0, 200, 0.007000, 'Pre-elaborados', true),
('b0000049-0000-0000-0000-000000000049', 'Salsa Big Mac Casera', 'ml', 0, 200, 0.006500, 'Pre-elaborados', true),
('b0000050-0000-0000-0000-000000000050', 'Salsa Perejil Casera', 'ml', 0, 200, 0.007500, 'Pre-elaborados', true)
ON CONFLICT (id) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    unidad_medida = EXCLUDED.unidad_medida,
    stock_minimo = EXCLUDED.stock_minimo,
    categoria_insumo = EXCLUDED.categoria_insumo;

-- Eliminar insumos residuales antiguos que no tengan este formato canónico
DELETE FROM public.recetas_ingredientes WHERE insumo_id NOT LIKE 'b00000%';
DELETE FROM public.insumos WHERE id NOT LIKE 'b00000%';

-- 5. POBLAR TABLA PUENTE PROVEEDOR_INSUMOS CON PRECIOS REFERENCIALES POR DISTRIBUIDORA
INSERT INTO public.proveedor_insumos (proveedor_id, insumo_id, precio_referencial_usd)
VALUES
-- Super 900
('a0000001-0000-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000001', 9.90),
('a0000001-0000-0000-0000-000000000001', 'b0000002-0000-0000-0000-000000000002', 7.00),
('a0000001-0000-0000-0000-000000000001', 'b0000003-0000-0000-0000-000000000003', 7.50),
('a0000001-0000-0000-0000-000000000001', 'b0000004-0000-0000-0000-000000000004', 10.50),
('a0000001-0000-0000-0000-000000000001', 'b0000005-0000-0000-0000-000000000005', 7.41),
('a0000001-0000-0000-0000-000000000001', 'b0000006-0000-0000-0000-000000000006', 1.13),
('a0000001-0000-0000-0000-000000000001', 'b0000007-0000-0000-0000-000000000007', 5.51),
('a0000001-0000-0000-0000-000000000001', 'b0000008-0000-0000-0000-000000000008', 8.00),
('a0000001-0000-0000-0000-000000000001', 'b0000009-0000-0000-0000-000000000009', 3.34),
('a0000001-0000-0000-0000-000000000001', 'b00000010-0000-0000-0000-000000000010', 1.91),
('a0000001-0000-0000-0000-000000000001', 'b00000011-0000-0000-0000-000000000011', 2.69),
('a0000001-0000-0000-0000-000000000001', 'b00000012-0000-0000-0000-000000000012', 1.25),
('a0000001-0000-0000-0000-000000000001', 'b00000013-0000-0000-0000-000000000013', 2.63),
('a0000001-0000-0000-0000-000000000001', 'b00000014-0000-0000-0000-000000000014', 3.90),
('a0000001-0000-0000-0000-000000000001', 'b00000015-0000-0000-0000-000000000015', 0.51),
('a0000001-0000-0000-0000-000000000001', 'b00000035-0000-0000-0000-000000000035', 0.97),
('a0000001-0000-0000-0000-000000000001', 'b00000041-0000-0000-0000-000000000041', 0.05),
('a0000001-0000-0000-0000-000000000001', 'b00000044-0000-0000-0000-000000000044', 5.86),

-- Hortalizas El Páramo
('a0000002-0000-0000-0000-000000000002', 'b0000002-0000-0000-0000-000000000002', 4.50),
('a0000002-0000-0000-0000-000000000002', 'b00000020-0000-0000-0000-000000000020', 3.50),

-- Multitienda Kariosca
('a0000003-0000-0000-0000-000000000003', 'b00000036-0000-0000-0000-000000000036', 3.71),
('a0000003-0000-0000-0000-000000000003', 'b00000041-0000-0000-0000-000000000041', 2.16),
('a0000003-0000-0000-0000-000000000003', 'b00000043-0000-0000-0000-000000000043', 1.51),

-- Todo en Desechables C.A.
('a0000004-0000-0000-0000-000000000004', 'b00000037-0000-0000-0000-000000000037', 0.40),
('a0000004-0000-0000-0000-000000000004', 'b00000038-0000-0000-0000-000000000038', 0.35),
('a0000004-0000-0000-0000-000000000004', 'b00000039-0000-0000-0000-000000000039', 6.50),
('a0000004-0000-0000-0000-000000000004', 'b00000040-0000-0000-0000-000000000040', 3.25),

-- Comercializadora de Hortalizas La 04
('a0000005-0000-0000-0000-000000000005', 'b0000004-0000-0000-0000-000000000004', 16.25),
('a0000005-0000-0000-0000-000000000005', 'b0000005-0000-0000-0000-000000000005', 8.18)
ON CONFLICT (proveedor_id, insumo_id) DO UPDATE SET
    precio_referencial_usd = EXCLUDED.precio_referencial_usd;

-- 6. VINCULAR RECETAS Y EXTRAS A LOS INSUMOS CANÓNICOS
DELETE FROM public.recetas_ingredientes;
INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad, es_opcional)
SELECT p.id, 'b0000006-0000-0000-0000-000000000006', 100, false
FROM public.productos p
WHERE p.categoria_id = 'e3a10495-3db0-442c-8111-c8b3760e0cf8';

INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad, es_opcional)
SELECT p.id, 'b0000036-0000-0000-0000-000000000036', 1, false
FROM public.productos p
WHERE p.categoria_id = 'e3a10495-3db0-442c-8111-c8b3760e0cf8';

INSERT INTO public.recetas_ingredientes (producto_id, insumo_id, cantidad, es_opcional)
SELECT p.id, 'b0000035-0000-0000-0000-000000000035', 1, false
FROM public.productos p
WHERE p.categoria_id = 'e3a10495-3db0-442c-8111-c8b3760e0cf8';

-- Extras modificadores / Sabores de arepas
UPDATE public.extras_modificadores SET insumo_id = 'b0000001-0000-0000-0000-000000000001', cantidad_descuento = 50 WHERE nombre LIKE '%Pelúa%' OR nombre LIKE '%Carne Esmechada%';
UPDATE public.extras_modificadores SET insumo_id = 'b0000002-0000-0000-0000-000000000002', cantidad_descuento = 50 WHERE nombre LIKE '%Catira%' OR nombre LIKE '%Pollo Esmechado%';
UPDATE public.extras_modificadores SET insumo_id = 'b0000020-0000-0000-0000-000000000020', cantidad_descuento = 50 WHERE nombre LIKE '%Reina Pepiada%';
UPDATE public.extras_modificadores SET insumo_id = 'b0000004-0000-0000-0000-000000000004', cantidad_descuento = 30 WHERE nombre LIKE '%Queso Amarillo%';

-- 7. CARGAR TODAS LAS FACTURAS REALES (TANDA 1 + TANDA 2)
-- Super 900 (27/08/2026 - Factura #00044240)
INSERT INTO public.compras (id, proveedor_id, fecha, total_usd, total_bs, tasa_bcv, metodo_pago, comprobante)
VALUES ('c0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001', '2026-08-27', 97.77, 77374.52, 791.3932, 'biopago', '00044240');

INSERT INTO public.compras_items (compra_id, insumo_id, cantidad_comprada, unidad_compra, factor_conversion, cantidad_base_total, precio_unitario_usd, subtotal_usd)
VALUES
('c0000001-0000-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000001', 1.15, 'kg', 1000, 1150, 0.00990, 11.39),
('c0000001-0000-0000-0000-000000000001', 'b0000004-0000-0000-0000-000000000004', 0.485, 'kg', 1000, 485, 0.01050, 5.09),
('c0000001-0000-0000-0000-000000000001', 'b0000005-0000-0000-0000-000000000005', 0.60, 'kg', 1000, 600, 0.00741, 4.45),
('c0000001-0000-0000-0000-000000000001', 'b0000003-0000-0000-0000-000000000003', 0.31, 'kg', 1000, 310, 0.00776, 2.41),
('c0000001-0000-0000-0000-000000000001', 'b0000006-0000-0000-0000-000000000006', 3.00, 'paq', 1000, 3000, 0.00113, 3.39),
('c0000001-0000-0000-0000-000000000001', 'b0000007-0000-0000-0000-000000000007', 1.00, 'kg', 1000, 1000, 0.00551, 5.51),
('c0000001-0000-0000-0000-000000000001', 'b0000008-0000-0000-0000-000000000008', 1.00, 'und', 910, 910, 0.00880, 8.00),
('c0000001-0000-0000-0000-000000000001', 'b0000009-0000-0000-0000-000000000009', 1.00, 'und', 480, 480, 0.00695, 3.34),
('c0000001-0000-0000-0000-000000000001', 'b00000010-0000-0000-0000-000000000010', 1.00, 'und', 397, 397, 0.00481, 1.91),
('c0000001-0000-0000-0000-000000000001', 'b00000014-0000-0000-0000-000000000014', 1.00, 'und', 500, 500, 0.00780, 3.90),
('c0000001-0000-0000-0000-000000000001', 'b00000013-0000-0000-0000-000000000013', 1.00, 'und', 300, 300, 0.00877, 2.63),
('c0000001-0000-0000-0000-000000000001', 'b00000012-0000-0000-0000-000000000012', 1.00, 'und', 1000, 1000, 0.00125, 1.25),
('c0000001-0000-0000-0000-000000000001', 'b00000011-0000-0000-0000-000000000011', 1.00, 'und', 900, 900, 0.00298, 2.69),
('c0000001-0000-0000-0000-000000000001', 'b00000015-0000-0000-0000-000000000015', 2.00, 'paq', 1000, 2000, 0.00051, 1.02),
('c0000001-0000-0000-0000-000000000001', 'b00000035-0000-0000-0000-000000000035', 2.00, 'paq', 160, 320, 0.00606, 1.94),
('c0000001-0000-0000-0000-000000000001', 'b00000044-0000-0000-0000-000000000044', 1.00, 'bulto', 6, 6, 0.97660, 5.86),
('c0000001-0000-0000-0000-000000000001', 'b00000021-0000-0000-0000-000000000021', 0.69, 'kg', 1000, 690, 0.00299, 2.06),
('c0000001-0000-0000-0000-000000000001', 'b00000022-0000-0000-0000-000000000022', 0.78, 'kg', 1000, 780, 0.00150, 1.17),
('c0000001-0000-0000-0000-000000000001', 'b00000023-0000-0000-0000-000000000023', 0.47, 'kg', 1000, 470, 0.00225, 1.06),
('c0000001-0000-0000-0000-000000000001', 'b00000024-0000-0000-0000-000000000024', 0.68, 'kg', 1000, 680, 0.00129, 0.88),
('c0000001-0000-0000-0000-000000000001', 'b00000025-0000-0000-0000-000000000025', 0.225, 'kg', 1000, 225, 0.00188, 0.42),
('c0000001-0000-0000-0000-000000000001', 'b00000026-0000-0000-0000-000000000026', 0.50, 'kg', 1000, 500, 0.00099, 0.50),
('c0000001-0000-0000-0000-000000000001', 'b00000027-0000-0000-0000-000000000027', 0.175, 'kg', 1000, 175, 0.00210, 0.37),
('c0000001-0000-0000-0000-000000000001', 'b00000028-0000-0000-0000-000000000028', 0.43, 'kg', 1000, 430, 0.00245, 1.05),
('c0000001-0000-0000-0000-000000000001', 'b00000029-0000-0000-0000-000000000029', 0.535, 'kg', 1000, 535, 0.00165, 0.88),
('c0000001-0000-0000-0000-000000000001', 'b00000030-0000-0000-0000-000000000030', 0.495, 'kg', 1000, 495, 0.00195, 0.97),
('c0000001-0000-0000-0000-000000000001', 'b00000031-0000-0000-0000-000000000031', 0.40, 'kg', 1000, 400, 0.00155, 0.62),
('c0000001-0000-0000-0000-000000000001', 'b00000032-0000-0000-0000-000000000032', 0.305, 'kg', 1000, 305, 0.00549, 1.67),
('c0000001-0000-0000-0000-000000000001', 'b00000033-0000-0000-0000-000000000033', 0.485, 'kg', 1000, 485, 0.00195, 0.95),
('c0000001-0000-0000-0000-000000000001', 'b00000034-0000-0000-0000-000000000034', 0.83, 'kg', 1000, 830, 0.00199, 1.65);

-- Hortalizas El Páramo (27/08/2026 - Orden #00157296)
INSERT INTO public.compras (id, proveedor_id, fecha, total_usd, total_bs, tasa_bcv, metodo_pago, comprobante)
VALUES ('c0000002-0000-0000-0000-000000000002', 'a0000002-0000-0000-0000-000000000002', '2026-08-27', 10.35, 8194.12, 791.70, 'efectivo_bs', '00157296');

INSERT INTO public.compras_items (compra_id, insumo_id, cantidad_comprada, unidad_compra, factor_conversion, cantidad_base_total, precio_unitario_usd, subtotal_usd)
VALUES
('c0000002-0000-0000-0000-000000000002', 'b00000020-0000-0000-0000-000000000020', 1.34, 'kg', 1000, 1340, 0.00333, 4.46),
('c0000002-0000-0000-0000-000000000002', 'b0000002-0000-0000-0000-000000000002', 1.31, 'kg', 1000, 1310, 0.00450, 5.89);

-- Multitienda Kariosca (27/08/2026 - Factura #00002781)
INSERT INTO public.compras (id, proveedor_id, fecha, total_usd, total_bs, tasa_bcv, metodo_pago, comprobante)
VALUES ('c0000003-0000-0000-0000-000000000003', 'a0000003-0000-0000-0000-000000000003', '2026-08-27', 12.07, 9549.89, 791.20, 'efectivo_bs', '00002781');

INSERT INTO public.compras_items (compra_id, insumo_id, cantidad_comprada, unidad_compra, factor_conversion, cantidad_base_total, precio_unitario_usd, subtotal_usd)
VALUES
('c0000003-0000-0000-0000-000000000003', 'b00000043-0000-0000-0000-000000000043', 3.00, 'und', 1, 3, 1.51, 4.53),
('c0000003-0000-0000-0000-000000000003', 'b00000036-0000-0000-0000-000000000036', 1.00, 'paq', 50, 50, 0.074, 3.71),
('c0000003-0000-0000-0000-000000000003', 'b00000041-0000-0000-0000-000000000041', 1.00, 'paq', 100, 100, 0.0216, 2.16);

-- Todo en Desechables C.A. (29/08/2026 - Recibo #756)
INSERT INTO public.compras (id, proveedor_id, fecha, total_usd, total_bs, tasa_bcv, metodo_pago, comprobante)
VALUES ('c0000004-0000-0000-0000-000000000004', 'a0000004-0000-0000-0000-000000000004', '2026-08-29', 28.00, 22400.00, 800.00, 'efectivo_usd', 'RECIBO #756');

INSERT INTO public.compras_items (compra_id, insumo_id, cantidad_comprada, unidad_compra, factor_conversion, cantidad_base_total, precio_unitario_usd, subtotal_usd)
VALUES
('c0000004-0000-0000-0000-000000000004', 'b00000037-0000-0000-0000-000000000037', 20.00, 'und', 1, 20, 0.40, 8.00),
('c0000004-0000-0000-0000-000000000004', 'b00000038-0000-0000-0000-000000000038', 20.00, 'und', 1, 20, 0.35, 7.00),
('c0000004-0000-0000-0000-000000000004', 'b00000039-0000-0000-0000-000000000039', 1.00, 'caja', 100, 100, 0.065, 6.50),
('c0000004-0000-0000-0000-000000000004', 'b00000040-0000-0000-0000-000000000040', 1.00, 'paq', 50, 50, 0.065, 3.25),
('c0000004-0000-0000-0000-000000000004', 'b00000040-0000-0000-0000-000000000040', 1.00, 'paq', 50, 50, 0.065, 3.25);

-- Hortalizas La 04 #0286953 (01/09/2026 - Queso Amarillo)
INSERT INTO public.compras (id, proveedor_id, fecha, total_usd, total_bs, tasa_bcv, metodo_pago, comprobante)
VALUES ('c0000005-0000-0000-0000-000000000005', 'a0000005-0000-0000-0000-000000000005', '2026-09-01', 5.93, 4751.97, 801.34, 'biopago', '0286953');

INSERT INTO public.compras_items (compra_id, insumo_id, cantidad_comprada, unidad_compra, factor_conversion, cantidad_base_total, precio_unitario_usd, subtotal_usd)
VALUES ('c0000005-0000-0000-0000-000000000005', 'b0000004-0000-0000-0000-000000000004', 0.365, 'kg', 1000, 365, 0.01625, 5.93);

-- Hortalizas La 04 #0286952 (01/09/2026 - Queso Semiduro Blanco)
INSERT INTO public.compras (id, proveedor_id, fecha, total_usd, total_bs, tasa_bcv, metodo_pago, comprobante)
VALUES ('c0000006-0000-0000-0000-000000000006', 'a0000005-0000-0000-0000-000000000005', '2026-09-01', 2.25, 1806.65, 802.95, 'biopago', '0286952');

INSERT INTO public.compras_items (compra_id, insumo_id, cantidad_comprada, unidad_compra, factor_conversion, cantidad_base_total, precio_unitario_usd, subtotal_usd)
VALUES ('c0000006-0000-0000-0000-000000000006', 'b0000005-0000-0000-0000-000000000005', 0.275, 'kg', 1000, 275, 0.00818, 2.25);

-- Hortalizas La 04 #0286978 (01/09/2026 - Queso Amarillo)
INSERT INTO public.compras (id, proveedor_id, fecha, total_usd, total_bs, tasa_bcv, metodo_pago, comprobante)
VALUES ('c0000007-0000-0000-0000-000000000007', 'a0000005-0000-0000-0000-000000000005', '2026-09-01', 3.25, 2603.82, 801.17, 'biopago', '0286978');

INSERT INTO public.compras_items (compra_id, insumo_id, cantidad_comprada, unidad_compra, factor_conversion, cantidad_base_total, precio_unitario_usd, subtotal_usd)
VALUES ('c0000007-0000-0000-0000-000000000007', 'b0000004-0000-0000-0000-000000000004', 0.200, 'kg', 1000, 200, 0.01625, 3.25);

-- Super 900 #00094818 (02/09/2026)
INSERT INTO public.compras (id, proveedor_id, fecha, total_usd, total_bs, tasa_bcv, metodo_pago, comprobante)
VALUES ('c0000008-0000-0000-0000-000000000008', 'a0000001-0000-0000-0000-000000000001', '2026-09-02', 23.24, 18630.89, 801.67, 'tarjeta_debito', '00094818');

INSERT INTO public.compras_items (compra_id, insumo_id, cantidad_comprada, unidad_compra, factor_conversion, cantidad_base_total, precio_unitario_usd, subtotal_usd)
VALUES
('c0000008-0000-0000-0000-000000000008', 'b0000001-0000-0000-0000-000000000001', 1.035, 'kg', 1000, 1035, 0.00997, 10.32),
('c0000008-0000-0000-0000-000000000008', 'b0000004-0000-0000-0000-000000000004', 0.535, 'kg', 1000, 535, 0.01049, 5.61),
('c0000008-0000-0000-0000-000000000008', 'b0000003-0000-0000-0000-000000000003', 0.410, 'kg', 1000, 410, 0.00725, 2.97),
('c0000008-0000-0000-0000-000000000008', 'b0000002-0000-0000-0000-000000000002', 0.605, 'kg', 1000, 605, 0.00700, 4.24),
('c0000008-0000-0000-0000-000000000008', 'b00000041-0000-0000-0000-000000000041', 2.00, 'und', 1, 2, 0.05, 0.10);

-- El Páramo #00160244 (02/09/2026 - Aguacate Colonia Tovar)
INSERT INTO public.compras (id, proveedor_id, fecha, total_usd, total_bs, tasa_bcv, metodo_pago, comprobante)
VALUES ('c0000009-0000-0000-0000-000000000009', 'a0000002-0000-0000-0000-000000000002', '2026-09-02', 2.29, 1838.71, 802.92, 'efectivo_bs', '00160244');

INSERT INTO public.compras_items (compra_id, insumo_id, cantidad_comprada, unidad_compra, factor_conversion, cantidad_base_total, precio_unitario_usd, subtotal_usd)
VALUES ('c0000009-0000-0000-0000-000000000009', 'b00000020-0000-0000-0000-000000000020', 0.51, 'kg', 1000, 510, 0.00449, 2.29);

-- 8. DESCONTAR AUTOMÁTICAMENTE LAS VENTAS REALES ACUMULADAS
UPDATE public.insumos i
SET stock_actual = i.stock_actual - sub.total_descontar
FROM (
    SELECT r.insumo_id, SUM(r.cantidad * vi.cantidad) AS total_descontar
    FROM public.ventas_items vi
    JOIN public.ventas v ON v.id = vi.venta_id
    JOIN public.recetas_ingredientes r ON r.producto_id = vi.producto_id
    WHERE v.estado != 'cancelada'
    GROUP BY r.insumo_id
) sub
WHERE i.id = sub.insumo_id;

UPDATE public.insumos i
SET stock_actual = i.stock_actual - sub.total_extra
FROM (
    SELECT e.insumo_id, SUM(e.cantidad_descuento * vie.cantidad) AS total_extra
    FROM public.ventas_items vi
    JOIN public.ventas v ON v.id = vi.venta_id
    JOIN public.ventas_items_extras vie ON vie.venta_item_id = vi.id
    JOIN public.extras_modificadores e ON e.id = vie.extra_id
    WHERE v.estado != 'cancelada' AND e.insumo_id IS NOT NULL
    GROUP BY e.insumo_id
) sub
WHERE i.id = sub.insumo_id;

COMMIT;
