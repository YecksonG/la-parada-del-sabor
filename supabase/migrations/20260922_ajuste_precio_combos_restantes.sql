-- Migration: Ajuste de precio del Antojo Rápido ($5.00) y Dúo Dinámico ($8.00)
-- Motivo: Ajuste por inflación país y mejora del margen neto de operación.

UPDATE public.productos
SET precio_usd = 5.00
WHERE nombre = 'El Antojo Rápido';

UPDATE public.productos
SET precio_usd = 8.00
WHERE nombre = 'El Dúo Dinámico';
