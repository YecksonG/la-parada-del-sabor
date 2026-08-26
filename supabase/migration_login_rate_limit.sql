-- ==============================================================================
-- MIGRACIÓN: Rate Limiting a nivel de Base de Datos para Login
-- Protege contra ataques de fuerza bruta persistiendo los intentos en Supabase,
-- sobreviviendo a cold starts de Vercel serverless.
-- ==============================================================================

-- 1. Tabla de intentos de login
CREATE TABLE IF NOT EXISTS public.login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL,       -- "IP_email" combo
    intentos INT NOT NULL DEFAULT 1,
    primer_intento TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ultimo_intento TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    bloqueado_hasta TIMESTAMPTZ,
    creado_el TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier ON public.login_attempts(identifier);

-- Habilitar RLS (solo el servicio puede escribir, no usuarios anónimos)
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Bloquear acceso anónimo completo
REVOKE ALL ON public.login_attempts FROM anon;
REVOKE ALL ON public.login_attempts FROM authenticated;

-- Solo service_role puede acceder (usado por server actions via Supabase client)
-- Nota: Las server actions usan el anon key + cookies, pero esta tabla solo se accede vía RPC SECURITY DEFINER

-- 2. Función RPC: Verificar y registrar intento de login (atómica)
-- Retorna: {permitido: boolean, intentos_restantes: int, minutos_bloqueo: int}
CREATE OR REPLACE FUNCTION public.fn_check_login_rate_limit(
    p_identifier TEXT,
    p_max_intentos INT DEFAULT 5,
    p_ventana_minutos INT DEFAULT 15,
    p_bloqueo_minutos INT DEFAULT 15
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ahora TIMESTAMPTZ := NOW();
    v_registro RECORD;
    v_ventana INTERVAL := (p_ventana_minutos || ' minutes')::INTERVAL;
    v_bloqueo INTERVAL := (p_bloqueo_minutos || ' minutes')::INTERVAL;
    v_resultado JSONB;
BEGIN
    -- Buscar registro existente
    SELECT * INTO v_registro
    FROM public.login_attempts
    WHERE identifier = p_identifier
    ORDER BY ultimo_intento DESC
    LIMIT 1;

    -- Si no existe, crear registro y permitir
    IF NOT FOUND THEN
        INSERT INTO public.login_attempts (identifier, intentos, primer_intento, ultimo_intento)
        VALUES (p_identifier, 1, v_ahora, v_ahora);

        RETURN jsonb_build_object(
            'permitido', true,
            'intentos_restantes', p_max_intentos - 1,
            'minutos_bloqueo', 0
        );
    END IF;

    -- Si está bloqueado actualmente
    IF v_registro.bloqueado_hasta IS NOT NULL AND v_ahora < v_registro.bloqueado_hasta THEN
        v_resultado := jsonb_build_object(
            'permitido', false,
            'intentos_restantes', 0,
            'minutos_bloqueo', EXTRACT(EPOCH FROM (v_registro.bloqueado_hasta - v_ahora)) / 60
        );
        RETURN v_resultado;
    END IF;

    -- Si pasó la ventana de tiempo, resetear contador
    IF (v_ahora - v_registro.primer_intento) > v_ventana THEN
        UPDATE public.login_attempts
        SET intentos = 1,
            primer_intento = v_ahora,
            ultimo_intento = v_ahora,
            bloqueado_hasta = NULL
        WHERE id = v_registro.id;

        RETURN jsonb_build_object(
            'permitido', true,
            'intentos_restantes', p_max_intentos - 1,
            'minutos_bloqueo', 0
        );
    END IF;

    -- Incrementar contador
    UPDATE public.login_attempts
    SET intentos = intentos + 1,
        ultimo_intento = v_ahora
    WHERE id = v_registro.id;

    -- Si excedió el máximo, bloquear
    IF (v_registro.intentos + 1) >= p_max_intentos THEN
        UPDATE public.login_attempts
        SET bloqueado_hasta = v_ahora + v_bloqueo
        WHERE id = v_registro.id;

        v_resultado := jsonb_build_object(
            'permitido', false,
            'intentos_restantes', 0,
            'minutos_bloqueo', p_bloqueo_minutos
        );
    ELSE
        v_resultado := jsonb_build_object(
            'permitido', true,
            'intentos_restantes', p_max_intentos - (v_registro.intentos + 1),
            'minutos_bloqueo', 0
        );
    END IF;

    RETURN v_resultado;
END;
$$;

-- 3. Función RPC: Limpiar intentos después de login exitoso
CREATE OR REPLACE FUNCTION public.fn_clear_login_attempts(
    p_identifier TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.login_attempts WHERE identifier = p_identifier;
END;
$$;

-- 4. Limpieza automática de registros antiguos (>24 horas)
CREATE OR REPLACE FUNCTION public.fn_cleanup_login_attempts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.login_attempts
    WHERE ultimo_intento < NOW() - INTERVAL '24 hours';
END;
$$;
