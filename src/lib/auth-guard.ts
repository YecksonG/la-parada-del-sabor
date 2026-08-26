import { SupabaseClient } from "@supabase/supabase-js";

export async function requireAuth(supabase: SupabaseClient) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      ok: false as const,
      error: "Acceso no autorizado. Inicia sesión en el sistema administrativo.",
      user: null,
    };
  }

  return {
    ok: true as const,
    user,
  };
}
