-- Migration: Ajuste de precio del combo El Resuelve Familiar a $15.00
-- Motivo: Optimización del margen neto (flujo de caja en límite).

UPDATE public.productos
SET precio_usd = 15.00
WHERE nombre = 'El Resuelve Familiar';
