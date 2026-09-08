-- ==============================================================================
-- 🥤 MIGRACIÓN: IMAGEN OFICIAL PEPSI 1L
-- La Parada del Sabor — 08 Sept 2026
-- ==============================================================================

UPDATE public.productos
SET imagen_url = '/images/bebidas/pepsi-1l.jpg'
WHERE (nombre ILIKE '%pepsi%1%l%' OR nombre ILIKE '%pepsi%litro%' OR id = 'd1111111-1111-1111-1111-111111111111')
  AND NOT (nombre ILIKE '%1.5%' OR nombre ILIKE '%1,5%');
