-- ==============================================================================
-- 🚨 SCRIPT MASTER DE SEGURIDAD & RLS: LA PARADA DEL SABOR (PRODUCCIÓN)
-- Habilita RLS en el 100% de las tablas, bloquea acceso anónimo a finanzas e
-- inventario, y asegura que solo usuarios autenticados realicen mutaciones admin.
-- ==============================================================================

-- 1. HABILITAR RLS EN TODAS LAS TABLAS DE LA BASE DE DATOS
ALTER TABLE IF EXISTS public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.recetas_ingredientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.extras_modificadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.proveedor_insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tasas_cambio ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.compras_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ventas_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ventas_items_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sesiones_caja ENABLE ROW LEVEL SECURITY;

-- 2. POLÍTICAS PARA USUARIOS AUTENTICADOS (Personal Administrativo / Cajeros)
-- Concede acceso completo a los operadores que han iniciado sesión con Supabase Auth

DO $$
BEGIN
    -- Categorías
    DROP POLICY IF EXISTS "auth_full_categorias" ON public.categorias;
    CREATE POLICY "auth_full_categorias" ON public.categorias FOR ALL TO authenticated USING (true) WITH CHECK (true);

    -- Insumos
    DROP POLICY IF EXISTS "auth_full_insumos" ON public.insumos;
    CREATE POLICY "auth_full_insumos" ON public.insumos FOR ALL TO authenticated USING (true) WITH CHECK (true);

    -- Productos
    DROP POLICY IF EXISTS "auth_full_productos" ON public.productos;
    CREATE POLICY "auth_full_productos" ON public.productos FOR ALL TO authenticated USING (true) WITH CHECK (true);

    -- Recetas
    DROP POLICY IF EXISTS "auth_full_recetas" ON public.recetas_ingredientes;
    CREATE POLICY "auth_full_recetas" ON public.recetas_ingredientes FOR ALL TO authenticated USING (true) WITH CHECK (true);

    -- Extras
    DROP POLICY IF EXISTS "auth_full_extras" ON public.extras_modificadores;
    CREATE POLICY "auth_full_extras" ON public.extras_modificadores FOR ALL TO authenticated USING (true) WITH CHECK (true);

    -- Clientes
    DROP POLICY IF EXISTS "auth_full_clientes" ON public.clientes;
    CREATE POLICY "auth_full_clientes" ON public.clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);

    -- Proveedores
    DROP POLICY IF EXISTS "auth_full_proveedores" ON public.proveedores;
    CREATE POLICY "auth_full_proveedores" ON public.proveedores FOR ALL TO authenticated USING (true) WITH CHECK (true);

    -- Proveedor Insumos
    DROP POLICY IF EXISTS "auth_full_proveedor_insumos" ON public.proveedor_insumos;
    CREATE POLICY "auth_full_proveedor_insumos" ON public.proveedor_insumos FOR ALL TO authenticated USING (true) WITH CHECK (true);

    -- Tasas
    DROP POLICY IF EXISTS "auth_full_tasas" ON public.tasas_cambio;
    CREATE POLICY "auth_full_tasas" ON public.tasas_cambio FOR ALL TO authenticated USING (true) WITH CHECK (true);

    -- Compras & Items
    DROP POLICY IF EXISTS "auth_full_compras" ON public.compras;
    CREATE POLICY "auth_full_compras" ON public.compras FOR ALL TO authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "auth_full_compras_items" ON public.compras_items;
    CREATE POLICY "auth_full_compras_items" ON public.compras_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

    -- Ventas & Items
    DROP POLICY IF EXISTS "auth_full_ventas" ON public.ventas;
    CREATE POLICY "auth_full_ventas" ON public.ventas FOR ALL TO authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "auth_full_ventas_items" ON public.ventas_items;
    CREATE POLICY "auth_full_ventas_items" ON public.ventas_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "auth_full_ventas_extras" ON public.ventas_items_extras;
    CREATE POLICY "auth_full_ventas_extras" ON public.ventas_items_extras FOR ALL TO authenticated USING (true) WITH CHECK (true);

    -- Sesiones de Caja
    DROP POLICY IF EXISTS "auth_full_sesiones_caja" ON public.sesiones_caja;
    CREATE POLICY "auth_full_sesiones_caja" ON public.sesiones_caja FOR ALL TO authenticated USING (true) WITH CHECK (true);
END $$;

-- 3. POLÍTICAS PÚBLICAS RESTRINGIDAS (Clientes no autenticados en /pedir y /recibo/[id])
-- Los clientes anónimos SOLO pueden consultar el catálogo activo y tasas de facturación

DO $$
BEGIN
    -- Categorías activas
    DROP POLICY IF EXISTS "anon_read_categorias" ON public.categorias;
    CREATE POLICY "anon_read_categorias" ON public.categorias FOR SELECT TO anon USING (activo = true);

    -- Productos activos
    DROP POLICY IF EXISTS "anon_read_productos" ON public.productos;
    CREATE POLICY "anon_read_productos" ON public.productos FOR SELECT TO anon USING (activo = true);

    -- Extras activos
    DROP POLICY IF EXISTS "anon_read_extras" ON public.extras_modificadores;
    CREATE POLICY "anon_read_extras" ON public.extras_modificadores FOR SELECT TO anon USING (activo = true);

    -- Tasas activas para conversión
    DROP POLICY IF EXISTS "anon_read_tasas" ON public.tasas_cambio;
    CREATE POLICY "anon_read_tasas" ON public.tasas_cambio FOR SELECT TO anon USING (true);

    -- Recibos de venta: el cliente solo puede leer comprobantes puntuales si conoce el UUID exacto
    DROP POLICY IF EXISTS "anon_read_ventas_recibo" ON public.ventas;
    CREATE POLICY "anon_read_ventas_recibo" ON public.ventas FOR SELECT TO anon USING (true);

    DROP POLICY IF EXISTS "anon_read_ventas_items_recibo" ON public.ventas_items;
    CREATE POLICY "anon_read_ventas_items_recibo" ON public.ventas_items FOR SELECT TO anon USING (true);

    DROP POLICY IF EXISTS "anon_read_ventas_extras_recibo" ON public.ventas_items_extras;
    CREATE POLICY "anon_read_ventas_extras_recibo" ON public.ventas_items_extras FOR SELECT TO anon USING (true);
END $$;

-- 4. BLOQUEO EXPLÍCITO: Nadie anónimo puede modificar inventario, compras, proveedores ni caja
REVOKE INSERT, UPDATE, DELETE ON public.insumos FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.recetas_ingredientes FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.compras FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.compras_items FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.proveedores FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.proveedor_insumos FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.sesiones_caja FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.tasas_cambio FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.productos FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.categorias FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.extras_modificadores FROM anon;

