import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  // 0. Si no es GET ni HEAD (ej. POST de Server Actions), no interferir con redirects
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

  // 1. Detección rápida de cookies de autenticación de Supabase (sb-*-auth-token)
  const allCookies = request.cookies.getAll();
  const hasAuthCookie = allCookies.some(
    (c) => c.name.startsWith("sb-") && c.name.includes("-auth-token")
  );

  // 2. Si es ruta pública y no es login, bypass inmediato en 0ms
  if (isPublicRoute && !isLoginPage) {
    return NextResponse.next({ request });
  }

  // 3. Si no hay cookies de auth y la ruta es privada, redirigir a /login en 0ms (sin llamadas de red)
  if (!hasAuthCookie && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 4. Si está en /login y no tiene cookies de auth, servir /login de inmediato en 0ms
  if (isLoginPage && !hasAuthCookie) {
    return NextResponse.next({ request });
  }

  // 5. Inicializar cliente SSR para refrescar tokens
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

  // 6. Validación de usuario con Timeout estricto de 2000ms para evitar MIDDLEWARE_INVOCATION_TIMEOUT
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

    let user;
    try {
      const result = await Promise.race([getUserPromise, timeoutPromise]);
      user = result.data.user;
    } finally {
      // Limpiar el timer para evitar timers colgados cuando getUser() gana la carrera
      clearTimeout(timeoutId);
    }

    if (!user && !isPublicRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    if (user && isLoginPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  } catch {
    // Si la llamada de auth falla o hace timeout en Edge, redirigir a /login en rutas protegidas
    if (!isPublicRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
