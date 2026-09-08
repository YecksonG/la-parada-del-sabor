DELETE FROM public.sesiones_caja sc
WHERE sc.fecha_apertura >= '2026-09-06 00:00:00-04'
  AND sc.fecha_apertura <= '2026-09-06 23:59:59-04'
  AND NOT EXISTS (
    SELECT 1
    FROM public.ventas v
    WHERE v.estado != 'cancelada'
      AND v.fecha >= sc.fecha_apertura
      AND (sc.fecha_cierre IS NULL OR v.fecha <= sc.fecha_cierre)
  );

SELECT
  id,
  fecha_apertura AT TIME ZONE 'America/Caracas' AS apertura_hora_venezuela,
  fecha_cierre AT TIME ZONE 'America/Caracas' AS cierre_hora_venezuela,
  total_ventas_pago_movil_bs,
  total_ventas_efectivo_usd,
  notas_cierre
FROM public.sesiones_caja
ORDER BY fecha_apertura DESC
LIMIT 5;
