-- ==============================================================================
-- MIGRACIÓN: ACTUALIZACIÓN DE NOMBRES OFICIALES DE COMBOS GOURMET
-- Proyecto: La Parada del Sabor
-- 1. Combo personal (2 arepas) -> "El Antojo Rápido"
-- 2. Combo para dos (4 arepas)  -> "El Dúo Dinámico"
-- 3. Combo familiar (10 arepas) -> "El Resuelve Familiar"
-- ==============================================================================

-- 1. Actualizar Combo de 2 Arepas -> "El Antojo Rápido"
UPDATE public.productos
SET 
    nombre = 'El Antojo Rápido',
    descripcion = '2 arepitas rellenas a tu elección con tus sabores favoritos + 1 refresco bien frío.',
    imagen_url = '/images/combos/combo-2-arepas.jpg'
WHERE (nombre ILIKE '%combo%2%' OR nombre ILIKE '%combo personal%' OR nombre ILIKE '%antojo%' OR nombre ILIKE 'Combo 2 Arepas%');

-- 2. Actualizar Combo de 4 Arepas -> "El Dúo Dinámico"
UPDATE public.productos
SET 
    nombre = 'El Dúo Dinámico',
    descripcion = '4 arepitas rellenas a tu gusto para compartir en pareja + Refresco 1L',
    imagen_url = '/images/combos/combo-4-arepas.jpg'
WHERE (nombre ILIKE '%combo%4%' OR nombre ILIKE '%compartir%' OR nombre ILIKE '%para dos%' OR nombre ILIKE '%duo%' OR nombre ILIKE 'Combo 4 Arepas%');

-- 3. Actualizar Combo de 10 Arepas -> "El Resuelve Familiar"
UPDATE public.productos
SET 
    nombre = 'El Resuelve Familiar',
    descripcion = '10 arepitas de fiesta con rellenos mixtos a elegir + 1 refresco familiar de 1.5 Litros.',
    imagen_url = '/images/combos/combo-10-arepas.jpg'
WHERE (nombre ILIKE '%combo%10%' OR nombre ILIKE '%familiar%' OR nombre ILIKE '%resuelve%' OR nombre ILIKE 'Combo Familiar%');

-- 4. Verificar resultados
SELECT id, nombre, descripcion, precio_usd, imagen_url, activo
FROM public.productos
WHERE nombre IN ('El Antojo Rápido', 'El Dúo Dinámico', 'El Resuelve Familiar')
   OR nombre ILIKE '%antojo%' OR nombre ILIKE '%duo%' OR nombre ILIKE '%resuelve%' OR nombre ILIKE '%combo%';
