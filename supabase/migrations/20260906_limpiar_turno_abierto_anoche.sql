-- ==============================================================================
-- 🚨 CERRAR / LIMPIAR EL TURNO ABIERTO HUÉRFANO DE LAS 10:46 PM
-- ==============================================================================

UPDATE public.sesiones_caja
SET estado = 'cerrada',
    fecha_cierre = NOW(),
    notas_cierre = 'Turno cerrado para unificar con el corte definitivo de anoche.'
WHERE estado = 'abierta';
