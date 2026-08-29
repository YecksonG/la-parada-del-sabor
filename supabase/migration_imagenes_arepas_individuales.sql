-- ==============================================================================
-- ASIGNACIÓN DE IMÁGENES OFICIALES PARA AREPAS INDIVIDUALES
-- La Parada del Sabor — 28 de Agosto de 2026
-- ==============================================================================

UPDATE public.productos 
SET imagen_url = '/images/arepas/arepa-catira.jpg' 
WHERE nombre ILIKE '%catira%';

UPDATE public.productos 
SET imagen_url = '/images/arepas/arepa-especial-pollo.jpg' 
WHERE nombre ILIKE '%especial%pollo%';

UPDATE public.productos 
SET imagen_url = '/images/arepas/arepa-reina-pepiada.jpg' 
WHERE nombre ILIKE '%reina%pepiada%';

UPDATE public.productos 
SET imagen_url = '/images/arepas/arepa-jamon-queso.jpg' 
WHERE nombre ILIKE '%jamon%queso%' OR nombre ILIKE '%jamón%queso%';

UPDATE public.productos 
SET imagen_url = '/images/arepas/arepa-especial-carne.jpg' 
WHERE nombre ILIKE '%especial%carne%';

UPDATE public.productos 
SET imagen_url = '/images/arepas/arepa-pelua.jpg' 
WHERE nombre ILIKE '%pelua%' OR nombre ILIKE '%pelúa%';
