-- ==============================================================================
-- 🥤 MIGRACIÓN: IMAGEN OFICIAL PEPSI 1.5L
-- La Parada del Sabor — 29 Ago 2026
-- ==============================================================================

UPDATE public.productos
SET imagen_url = '/images/bebidas/pepsi-1-5l.jpg'
WHERE nombre ILIKE '%pepsi%';
