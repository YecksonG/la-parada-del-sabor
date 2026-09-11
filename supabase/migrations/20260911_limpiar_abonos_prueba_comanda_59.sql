-- ==============================================================================
-- 🚨 ACCIÓN EN SUPABASE (SQL EDITOR) — LIMPIEZA DE ABONOS DE PRUEBA (COMANDA #59)
-- Restaura la comanda #59 a su deuda original de $26.00 USD
-- ==============================================================================

UPDATE public.ventas
SET 
    notas_comanda = NULL,
    estado = 'credito',
    metodo_pago = 'credito'
WHERE numero_comanda = 59;

-- Verificación de la comanda #59:
SELECT id, numero_comanda, total_usd, estado, metodo_pago, notas_comanda
FROM public.ventas
WHERE numero_comanda = 59;
