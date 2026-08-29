"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

export type LoginState = {
  error: string | null;
  exito?: boolean;
};

const MAX_INTENTOS = 5;
const VENTANA_MINUTOS = 15;
const BLOQUEO_MINUTOS = 15;

async function verificarRateLimitLogin(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  identificador: string
): Promise<{ permitido: boolean; minutosRestantes?: number }> {
  try {
    const { data, error } = await supabase.rpc("fn_check_login_rate_limit", {
      p_identifier: identificador,
      p_max_intentos: MAX_INTENTOS,
      p_ventana_minutos: VENTANA_MINUTOS,
      p_bloqueo_minutos: BLOQUEO_MINUTOS,
    });

    if (error) {
      console.error("Error en rate limit DB:", error);
      return { permitido: true };
    }

    return {
      permitido: data?.permitido ?? true,
      minutosRestantes: data?.minutos_bloqueo ?? 0,
    };
  } catch {
    return { permitido: true };
  }
}

async function limpiarLoginExitoso(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  identificador: string
) {
  try {
    await supabase.rpc("fn_clear_login_attempts", {
      p_identifier: identificador,
    });
  } catch {
    // Silently ignore cleanup errors
  }
}

export async function login(
  prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Por favor ingresa tu correo y contraseña." };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email) || email.length > 100) {
    return { error: "Formato de correo electrónico no válido." };
  }

  if (password.length > 128) {
    return { error: "Contraseña inválida." };
  }

  const reqHeaders = await headers();
  const ip = reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rateLimitKey = `${ip}_${email}`;

  const supabase = await createClient();

  const rateCheck = await verificarRateLimitLogin(supabase, rateLimitKey);
  if (!rateCheck.permitido) {
    return {
      error: `Demasiados intentos fallidos. Por seguridad tu acceso ha sido bloqueado por ${rateCheck.minutosRestantes} minutos.`,
    };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return {
      error: "Credenciales incorrectas. Verifica tu correo y contraseña.",
    };
  }

  await limpiarLoginExitoso(supabase, rateLimitKey);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function loginWithRateLimit(emailRaw: string, passwordRaw: string) {
  const email = emailRaw?.trim().toLowerCase();
  const password = passwordRaw;

  if (!email || !password) {
    return { error: "Por favor ingresa tu correo y contraseña." };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email) || email.length > 100) {
    return { error: "Formato de correo electrónico no válido." };
  }

  const reqHeaders = await headers();
  const ip = reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rateLimitKey = `${ip}_${email}`;

  const supabase = await createClient();

  const rateCheck = await verificarRateLimitLogin(supabase, rateLimitKey);
  if (!rateCheck.permitido) {
    return {
      error: `Demasiados intentos fallidos. Por seguridad tu acceso ha sido bloqueado por ${rateCheck.minutosRestantes} minutos.`,
    };
  }

  // NO hacemos signInWithPassword aquí para evitar el bug de Server Actions
  // Solamente validamos el rate limit. El login real se hará en el cliente.
  return { ok: true, rateLimitKey };
}

export async function registrarLoginExitoso(rateLimitKey: string) {
  const supabase = await createClient();
  await limpiarLoginExitoso(supabase, rateLimitKey);
}

export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
