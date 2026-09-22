-- ==============================================================================
-- CORRECCIÓN DE CUADRE DE CAJA: TURNO DOMINGO 20 SEPTIEMBRE 2026 (~06:58 PM)
-- ==============================================================================
-- Causa: Al cerrar caja, el método predeterminado en POS era 'efectivo_usd', por lo
-- que la Comanda #106 ($13 USD) se totalizó inicialmente en efectivo. Luego se cambió
-- a crédito, pero el registro histórico del cierre de caja quedó con $13 ficticios.
--
-- Realidad del Turno (7 Comandas: #100 a #106):
-- 1. Efectivo Real en Ventas: $0.00 USD (0 efectivo).
-- 2. Pago Móvil Real (Comandas 100, 101, 102, 103):
--    - #100: $6.00 USD  ->  Bs. 5,091.27
--    - #101: $7.00 USD  ->  Bs. 5,939.82
--    - #102: $9.00 USD  ->  Bs. 7,636.91
--    - #103: $7.00 USD  ->  Bs. 5,939.82
--    Total Pago Móvil: $29.00 USD -> Bs. 24,607.82 (Tasa BCV 848.5458)
-- 3. Créditos / Por Cobrar (Comandas 104, 105, 106):
--    - #104: $7.00 USD  ->  Bs. 5,939.82
--    - #105: $7.00 USD  ->  Bs. 5,939.82
--    - #106: $13.00 USD ->  Bs. 11,031.10
--    Total Créditos: $27.00 USD (No entra a gaveta ni a banco hasta abonarse).
-- ==============================================================================

BEGIN;

-- 1. Vista previa antes de la actualización
SELECT
    id,
    estado,
    monto_inicial_usd,
    monto_inicial_bs,
    total_ventas_efectivo_usd AS efectivo_actual_ficticio,
    total_ventas_pago_movil_bs AS pm_actual_bs,
    arqueo_fisico_efectivo_usd,
    diferencia_usd,
    fecha_apertura AT TIME ZONE 'America/Caracas' AS apertura_ve,
    fecha_cierre AT TIME ZONE 'America/Caracas' AS cierre_ve,
    notas_cierre
FROM public.sesiones_caja
WHERE fecha_apertura >= '2026-09-20 18:30:00-04'
  AND fecha_apertura <= '2026-09-20 19:30:00-04';

-- 2. Actualización de la sesión con los valores reales auditados
UPDATE public.sesiones_caja
SET
    total_ventas_efectivo_usd = 0.00,
    total_ventas_pago_movil_bs = 24607.82,
    total_ventas_transferencia_bs = 0.00,
    total_ventas_binance_usd = 0.00,
    total_ventas_punto_bs = 0.00,
    total_gastos_usd = 0.00,
    total_gastos_bs = 0.00,
    -- El dinero físico en gaveta al cerrar es exactamente el fondo inicial (0 ventas efectivo)
    arqueo_fisico_efectivo_usd = monto_inicial_usd,
    arqueo_fisico_efectivo_bs = monto_inicial_bs,
    diferencia_usd = 0.00,
    diferencia_bs = 0.00,
    notas_cierre = 'Cierre corregido: Comanda #106 fue crédito ($13 USD). Efectivo real ventas: $0.00. Ingresos reales: Pago Móvil Bs. 24,607.82 ($29 USD) y 3 Créditos ($27 USD: #104, #105, #106).'
WHERE fecha_apertura >= '2026-09-20 18:30:00-04'
  AND fecha_apertura <= '2026-09-20 19:30:00-04';

-- 3. Confirmar que las 7 ventas del turno tengan el método y estado exacto
UPDATE public.ventas
SET metodo_pago = 'pago_movil', estado = 'completada'
WHERE numero_comanda IN (100, 101, 102, 103);

UPDATE public.ventas
SET metodo_pago = 'credito', estado = 'credito'
WHERE numero_comanda IN (104, 105, 106);

COMMIT;

-- 4. Verificación final de integridad de la sesión corregida
SELECT
    id,
    estado,
    monto_inicial_usd,
    total_ventas_efectivo_usd AS ventas_efectivo_usd_real,
    total_ventas_pago_movil_bs AS ventas_pago_movil_bs_real,
    arqueo_fisico_efectivo_usd,
    diferencia_usd,
    fecha_apertura AT TIME ZONE 'America/Caracas' AS apertura_ve,
    fecha_cierre AT TIME ZONE 'America/Caracas' AS cierre_ve,
    notas_cierre
FROM public.sesiones_caja
WHERE fecha_apertura >= '2026-09-20 18:30:00-04'
  AND fecha_apertura <= '2026-09-20 19:30:00-04';
