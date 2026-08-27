-- ==============================================================================
-- VINCULACIÓN OFICIAL DE PROVEEDORES E INSUMOS CON GASTOS Y CATEGORÍAS
-- La Parada del Sabor — 27 de Agosto de 2026
-- ==============================================================================

DO $$
DECLARE
    v_prov_super900_id UUID;
    v_prov_paramo_id UUID;
    v_prov_kariosca_id UUID;
    v_prov_desechables_id UUID;
    v_prov_pradera_id UUID;
BEGIN
    -- 1. Super 900
    SELECT id INTO v_prov_super900_id FROM public.proveedores WHERE nombre ILIKE '%Super 900%' LIMIT 1;
    IF v_prov_super900_id IS NULL THEN
        INSERT INTO public.proveedores (nombre, rif, contacto, telefono, direccion, notas)
        VALUES (
            'Super 900',
            'J-504442402',
            'Inversiones El Sol de Falcón, C.A.',
            '0412-6608761',
            'Av. Coro con Av. Doña Emilia, Local Nro 01, Doña Emilia, Punto Fijo',
            'Distribuidor y supermercado de víveres, charcutería, salsas y materia prima.'
        ) RETURNING id INTO v_prov_super900_id;
    ELSE
        UPDATE public.proveedores SET
            nombre = 'Super 900',
            rif = 'J-504442402',
            contacto = 'Inversiones El Sol de Falcón, C.A.',
            direccion = 'Av. Coro con Av. Doña Emilia, Local Nro 01, Doña Emilia, Punto Fijo'
        WHERE id = v_prov_super900_id;
    END IF;

    -- 2. Hortalizas El Páramo
    SELECT id INTO v_prov_paramo_id FROM public.proveedores WHERE nombre ILIKE '%El P_ramo%' OR nombre ILIKE '%Paramo%' LIMIT 1;
    IF v_prov_paramo_id IS NULL THEN
        INSERT INTO public.proveedores (nombre, rif, contacto, telefono, direccion, notas)
        VALUES (
            'Hortalizas El Páramo',
            'J-412566464',
            'Hortalizas El Páramo C.A.',
            '0412-7018104',
            'Calle Girardot, Edif. Cardón, Piso B, Local 2, Urb. Santa Irene, Punto Fijo',
            'Distribuidor de verduras, hortalizas frescas, aguacate y pechuga de pollo.'
        ) RETURNING id INTO v_prov_paramo_id;
    ELSE
        UPDATE public.proveedores SET
            nombre = 'Hortalizas El Páramo',
            rif = 'J-412566464',
            telefono = '0412-7018104',
            direccion = 'Calle Girardot, Edif. Cardón, Piso B, Local 2, Urb. Santa Irene, Punto Fijo'
        WHERE id = v_prov_paramo_id;
    END IF;

    -- 3. Multitienda Kariosca
    SELECT id INTO v_prov_kariosca_id FROM public.proveedores WHERE nombre ILIKE '%Kariosca%' LIMIT 1;
    IF v_prov_kariosca_id IS NULL THEN
        INSERT INTO public.proveedores (nombre, rif, contacto, telefono, direccion, notas)
        VALUES (
            'Multitienda Kariosca',
            'J-309848909',
            'Multitienda Kariosca, C.A.',
            '0412-0000000',
            'Calle Ollarvides, Edif. Fernández, Piso 3, Local 03, Puerta Maraven, Punto Fijo',
            'Distribuidor de envases salseros, papel antigraso y bolsas plásticas con asa.'
        ) RETURNING id INTO v_prov_kariosca_id;
    ELSE
        UPDATE public.proveedores SET
            nombre = 'Multitienda Kariosca',
            rif = 'J-309848909',
            direccion = 'Calle Ollarvides, Edif. Fernández, Piso 3, Local 03, Puerta Maraven, Punto Fijo'
        WHERE id = v_prov_kariosca_id;
    END IF;

    -- 4. Todo en Desechables
    SELECT id INTO v_prov_desechables_id FROM public.proveedores WHERE nombre ILIKE '%Todo en Desechables%' OR nombre ILIKE '%Desechables%' LIMIT 1;
    IF v_prov_desechables_id IS NULL THEN
        INSERT INTO public.proveedores (nombre, rif, contacto, telefono, direccion, notas)
        VALUES (
            'Todo en Desechables',
            'J-000000000',
            'Ventas Mayoristas',
            '0412-0000000',
            'Punto Fijo, Falcón',
            'Distribuidor de cajas de empaque, guantes desechables, vasos y tapas.'
        ) RETURNING id INTO v_prov_desechables_id;
    ELSE
        UPDATE public.proveedores SET
            nombre = 'Todo en Desechables'
        WHERE id = v_prov_desechables_id;
    END IF;

    -- 5. La Pradera
    SELECT id INTO v_prov_pradera_id FROM public.proveedores WHERE nombre ILIKE '%La Pradera%' OR nombre ILIKE '%Pradera%' LIMIT 1;
    IF v_prov_pradera_id IS NULL THEN
        INSERT INTO public.proveedores (nombre, rif, contacto, telefono, direccion, notas)
        VALUES (
            'La Pradera',
            'J-502717960',
            'La Pradera, C.A.',
            '0412-0000000',
            'Av. Ollarvides entre Calle Ceuta y Esqueque, CC Santorini Nivel 1, Puerta Maraven',
            'Establecimiento comercial / Gastos varios y consumo.'
        ) RETURNING id INTO v_prov_pradera_id;
    ELSE
        UPDATE public.proveedores SET
            nombre = 'La Pradera',
            rif = 'J-502717960',
            direccion = 'Av. Ollarvides entre Calle Ceuta y Esqueque, CC Santorini Nivel 1, Puerta Maraven'
        WHERE id = v_prov_pradera_id;
    END IF;

    -- 6. Actualizar las categorías de gastos y vincular proveedor_id
    
    -- Super 900 (Proveedores / Insumos)
    UPDATE public.gastos SET
        proveedor_id = v_prov_super900_id,
        categoria = 'proveedores',
        subcategoria = 'Insumos / Alimentos'
    WHERE numero_factura = '00044240' OR beneficiario ILIKE '%Super 900%';

    -- Hortalizas El Páramo (Proveedores / Insumos)
    UPDATE public.gastos SET
        proveedor_id = v_prov_paramo_id,
        categoria = 'proveedores',
        subcategoria = 'Vegetales / Verduras'
    WHERE numero_factura = '00157206' OR beneficiario ILIKE '%P_ramo%';

    -- Multitienda Kariosca (Proveedores / Insumos)
    UPDATE public.gastos SET
        proveedor_id = v_prov_kariosca_id,
        categoria = 'proveedores',
        subcategoria = 'Empaques / Descartables'
    WHERE numero_factura = '00002781' OR beneficiario ILIKE '%Kariosca%';

    -- Todo en Desechables (Proveedores / Insumos)
    UPDATE public.gastos SET
        proveedor_id = v_prov_desechables_id,
        categoria = 'proveedores',
        subcategoria = 'Empaques / Descartables'
    WHERE numero_factura = 'MANUAL-DESECHABLES' OR beneficiario ILIKE '%Todo en Desechables%';

    -- Hielo (Proveedores / Insumos)
    UPDATE public.gastos SET
        categoria = 'proveedores',
        subcategoria = 'Insumos / Alimentos'
    WHERE numero_factura = 'TICKET-HIELO' OR descripcion ILIKE '%Hielo%';

    -- La Pradera (Otros Gastos)
    UPDATE public.gastos SET
        proveedor_id = v_prov_pradera_id,
        categoria = 'otros',
        subcategoria = 'Otros Gastos / Consumo La Pradera'
    WHERE numero_factura = '0005727' OR beneficiario ILIKE '%La Pradera%';

    -- Limpieza del Local (Servicios Operativos)
    UPDATE public.gastos SET
        categoria = 'servicios',
        subcategoria = 'Servicios Operativos / Limpieza'
    WHERE numero_factura = 'RECIBO-LIMPIEZA' OR beneficiario ILIKE '%Limpieza%';

END $$;
