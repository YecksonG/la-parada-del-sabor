-- ==============================================================================
-- MIGRACIÓN: MENÚ SECCIONADO (COMBOS, AREPAS INDIVIDUALES, BEBIDAS)
-- DESACTIVACIÓN DE AREPAS CÓCTEL & ALTA OFICIAL DE VASO DE REFRESCO
-- ==============================================================================

-- 1. Desactivar Arepas Cóctel del Menú (Fin de Promoción)
UPDATE public.productos
SET activo = false
WHERE nombre ILIKE '%coctel%';

-- 2. Reestructurar y Reordenar Categorías Oficiales (Orden: 1. Combos, 2. Arepas Individuales, 3. Bebidas)
-- Categoría 1: Combos & Promociones
UPDATE public.categorias
SET nombre = 'Combos',
    icono = '🍱',
    orden = 1,
    activo = true
WHERE id = '05c7b9bf-60d4-408c-af73-68d3525df268';

-- Categoría 2: Arepas Individuales
UPDATE public.categorias
SET nombre = 'Arepas Individuales',
    icono = '🫓',
    orden = 2,
    activo = true
WHERE id = 'e3a10495-3db0-442c-8111-c8b3760e0cf8';

-- Categoría 3: Bebidas
UPDATE public.categorias
SET nombre = 'Bebidas',
    icono = '🥤',
    orden = 3,
    activo = true
WHERE id = '0f58df05-a63a-44bf-94fd-ddf70abe004a';

-- Desactivar categorías obsoletas o no ofertadas en carta principal
UPDATE public.categorias
SET activo = false
WHERE id IN (
  '57c14044-533c-42e4-ae71-f49d253fa5e8', -- Empanadas
  'e8fb3e7e-7d6b-4518-9b26-6f68e106f166'  -- Raciones & Extras
);

-- 3. Crear Producto Oficial: Vaso de Refresco (Para venta individual y combos)
INSERT INTO public.productos (
  id,
  nombre,
  categoria_id,
  precio_usd,
  icono,
  popular,
  activo,
  descripcion
)
VALUES (
  'b1000001-0000-0000-0000-000000000001',
  'Vaso de Refresco',
  '0f58df05-a63a-44bf-94fd-ddf70abe004a',
  0.50,
  '🥤',
  true,
  true,
  'Vaso de refresco Pepsi servido bien frío con vaso desechable y tapa.'
)
ON CONFLICT (id) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  categoria_id = EXCLUDED.categoria_id,
  precio_usd = EXCLUDED.precio_usd,
  icono = EXCLUDED.icono,
  popular = EXCLUDED.popular,
  activo = EXCLUDED.activo,
  descripcion = EXCLUDED.descripcion;

-- 4. Escandallo / Ficha Técnica del Vaso de Refresco en recetas_ingredientes
-- Descuenta: 1 Vaso con Tapa ($0.065) + 0.20 Botella Pepsi 1.5L (~300ml = $0.197) = Costo Total $0.26 USD
DELETE FROM public.recetas_ingredientes
WHERE producto_id = 'b1000001-0000-0000-0000-000000000001';

INSERT INTO public.recetas_ingredientes (
  producto_id,
  insumo_id,
  cantidad,
  es_opcional,
  notas
)
VALUES
  (
    'b1000001-0000-0000-0000-000000000001',
    'b0000040-0000-0000-0000-000000000040', -- Vasos Desechables y Tapas
    1.00,
    false,
    'Vaso térmico/descartable con tapa plástica'
  ),
  (
    'b1000001-0000-0000-0000-000000000001',
    'b0000044-0000-0000-0000-000000000044', -- Pepsi Cola 1.5L
    0.20,
    false,
    'Porción de refresco servido frío (aprox 300 ml)'
  )
ON CONFLICT DO NOTHING;

-- 5. Actualizar descripción del Combo "El Antojo Rápido"
UPDATE public.productos
SET descripcion = '2 arepitas rellenas a tu elección con tus sabores favoritos + 1 vaso de refresco bien frío.'
WHERE nombre ILIKE '%antojo%';

-- 6. Verificación de Productos Activos y Categorías
SELECT 
  c.orden,
  c.nombre AS categoria,
  p.nombre AS producto,
  p.precio_usd,
  p.activo
FROM public.productos p
JOIN public.categorias c ON c.id = p.categoria_id
WHERE p.activo = true
ORDER BY c.orden ASC, p.nombre ASC;
