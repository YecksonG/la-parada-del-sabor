-- ==============================================================================
-- MIGRACIÓN DE AUDITORÍA: RENDIMIENTO, ÍNDICES B-TREE Y SEGURIDAD RLS
-- La Parada del Sabor — Optimización de Latencia
-- ==============================================================================

-- 1. ⚡ CREACIÓN DE ÍNDICES PARA ACELERAR CONSULTAS FRECUENTES (Mejora Latencia en POS y Caja)
-- Los índices B-Tree aceleran las búsquedas y JOINs que Vercel hace hacia Supabase.

-- Índice en ventas por estado y fecha (Optimiza carga inicial del POS y Caja)
CREATE INDEX IF NOT EXISTS idx_ventas_estado ON public.ventas (estado);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON public.ventas (fecha DESC);

-- Índice en ventas_items para acelerar los JOINs al cargar pedidos
CREATE INDEX IF NOT EXISTS idx_ventas_items_venta_id ON public.ventas_items (venta_id);
CREATE INDEX IF NOT EXISTS idx_ventas_items_producto_id ON public.ventas_items (producto_id);

-- Índice en ventas_items_extras
CREATE INDEX IF NOT EXISTS idx_ventas_items_extras_item_id ON public.ventas_items_extras (item_id);

-- Índice en recetas_ingredientes para acelerar el cálculo del escandallo
CREATE INDEX IF NOT EXISTS idx_recetas_producto_id ON public.recetas_ingredientes (producto_id);
CREATE INDEX IF NOT EXISTS idx_recetas_insumo_id ON public.recetas_ingredientes (insumo_id);

-- Índice en gastos (usado frecuentemente en /caja)
CREATE INDEX IF NOT EXISTS idx_gastos_fecha ON public.gastos (fecha DESC);

-- Índice en login_attempts (Optimiza el rate limiting)
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_email ON public.login_attempts (ip_address, email);

-- 2. 🛡️ REVISIÓN DE SEGURIDAD EN FUNCIONES (Prevenir Inyecciones / Search Path)
-- Asegurar que fn_check_login_rate_limit y fn_cleanup_login_attempts tengan search_path = public

ALTER FUNCTION public.fn_check_login_rate_limit(text, integer, integer, integer) SET search_path = public;
ALTER FUNCTION public.fn_cleanup_login_attempts() SET search_path = public;
ALTER FUNCTION public.fn_clear_login_attempts(text) SET search_path = public;
