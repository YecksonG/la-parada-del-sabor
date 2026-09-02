-- ==============================================================================
-- MIGRACIÓN: LIMPIEZA TOTAL DE COMANDAS/VENTAS DE PRUEBA (APERTURA 2026-09-01)
-- Proyecto: La Parada del Sabor
-- Elimina TODAS las ventas (POS + pedidos web) previas a la apertura real.
-- - ventas_items y ventas_items_extras se eliminan por CASCADE.
-- - NO restaura stock de insumos (decisión del dueño: sin restaurar).
-- - Reinicia la numeración de comandas a #1 y el contador de pedidos de clientes.
-- ==============================================================================

BEGIN;

-- 1. VERIFICAR: qué se va a eliminar (revisa la salida antes de continuar)
SELECT numero_comanda, fecha, origen_pedido, estado, total_usd, notas_comanda
FROM public.ventas
ORDER BY fecha;

-- 2. ELIMINAR TODAS LAS COMANDAS/VENTAS (items y extras van por CASCADE)
DELETE FROM public.ventas;

-- 3. Reiniciar numeración de comandas para que la apertura empiece en #1
SELECT setval(pg_get_serial_sequence('public.ventas', 'numero_comanda'), 1, false);

-- 4. Resetear contador de pedidos de los clientes creados en pruebas
UPDATE public.clientes SET total_pedidos = 0;

-- 5. VERIFICAR: resultado final (debe dar 0)
SELECT count(*) AS ventas_restantes
FROM public.ventas;

COMMIT;