-- ==============================================================================
-- MIGRACIÓN: ACTUALIZACIÓN DE IMÁGENES OFICIALES DE COMBOS
-- La Parada del Sabor — 29 Ago 2026
-- ==============================================================================

-- 1. Actualizar imagen de Combo Personal (2 Arepas)
UPDATE public.productos
SET imagen_url = '/images/combos/combo-2-arepas.jpg'
WHERE (nombre ILIKE '%combo%2%' OR nombre ILIKE '%combo personal%' OR nombre ILIKE 'Combo 2 Arepas%');

-- 2. Actualizar imagen de Combo para Compartir (4 Arepas)
UPDATE public.productos
SET imagen_url = '/images/combos/combo-4-arepas.jpg'
WHERE (nombre ILIKE '%combo%4%' OR nombre ILIKE '%combo%compartir%' OR nombre ILIKE '%combo para compartir%');

-- 3. Actualizar imagen de Combo Familiar (10 Arepas)
UPDATE public.productos
SET imagen_url = '/images/combos/combo-10-arepas.jpg'
WHERE (nombre ILIKE '%combo%10%' OR nombre ILIKE '%combo familiar%' OR nombre ILIKE 'Combo Familiar%');
