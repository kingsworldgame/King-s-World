import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const DEV_AUTH_COOKIE = "kw_dev_auth";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

function isProtectedPath(pathname: string): boolean {
  return (
    pathname.startsWith("/lobby") ||
    pathname.startsWith("/premium") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/world") ||
    pathname.startsWith("/api/worlds")
  );
}

function isAuthPath(pathname: string): boolean {
  return pathname.startsWith("/login") || pathname.startsWith("/register") || pathname.startsWith("/forgot-password");
}

export async function middleware(request: NextRequest) {
  const devAuthEnabled = process.env.NODE_ENV !== "production" || process.env.KW_SMOKE === "1";
  const smokeHeader = devAuthEnabled && request.headers.get("x-kw-smoke") === "1";
  const devUser = devAuthEnabled && (request.cookies.get(DEV_AUTH_COOKIE)?.value === "1" || smokeHeader);
  const pathname = request.nextUrl.pathname;

  if (devUser && isAuthPath(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/lobby";
    redirectUrl.searchParams.delete("next");
    return NextResponse.redirect(redirectUrl);
  }

  if (devUser) {
    return NextResponse.next();
  }

  if (!SUPABASE_URL || !SUPABASE_PUBLIC_KEY) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          request.cookies.set(cookie.name, cookie.value);
        }
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        for (const cookie of cookiesToSet) {
          response.cookies.set(cookie.name, cookie.value, cookie.options);
        }
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (isProtectedPath(pathname) && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (isAuthPath(pathname) && user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/lobby";
    redirectUrl.searchParams.delete("next");
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\..*).*)"],
};
