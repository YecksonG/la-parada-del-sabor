import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  // 0. Si no es GET ni HEAD (ej. POST de Server Actions / APIs), bypass inmediato
  if (request.method !== "GET" && request.method !== "HEAD") {
    return NextResponse.next({ request });
  }

  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname.startsWith("/login");
  const isPublicRoute =
    isLoginPage ||
    pathname.startsWith("/recibo") ||
    pathname.startsWith("/pedir") ||
    pathname.startsWith("/api/public") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/icon.png");

  // 1. Todas las rutas públicas (incluyendo /login) pasan de inmediato en 0ms sin llamadas de red ni redirects
  if (isPublicRoute) {
    return NextResponse.next({ request });
  }

  // 2. Detección rápida de cookies de autenticación de Supabase (sb-*-auth-token)
  const allCookies = request.cookies.getAll();
  const hasAuthCookie = allCookies.some(
    (c) => c.name.startsWith("sb-") && c.name.includes("-auth-token")
  );

  // 3. Si no hay cookies de auth y la ruta es privada, redirigir a /login en 0ms
  if (!hasAuthCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 4. Si hay cookies de auth, inicializar cliente SSR para refrescar tokens de forma pasiva
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 5. Refrescar sesión con timeout de seguridad (sin redirigir en caso de timeout, layout.tsx lo maneja)
  try {
    const getUserPromise = supabase.auth.getUser();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<{ data: { user: null }; error: Error }>(
      (_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("Timeout en auth")),
          2000
        );
      }
    );

    try {
      await Promise.race([getUserPromise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId);
    }
  } catch {
    // Si hay timeout o error en Edge, continuar hacia Server Components sin romper la navegación
    return supabaseResponse;
  }

  return supabaseResponse;
}
