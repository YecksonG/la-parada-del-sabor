import { getCachedUser } from "@/lib/supabase/server";

export async function requireAuth() {
  const user = await getCachedUser();

  if (!user) {
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
