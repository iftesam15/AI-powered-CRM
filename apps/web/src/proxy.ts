import { NextResponse, type NextRequest } from "next/server";

import { REDIRECT_PARAM, SESSION_COOKIE } from "@/lib/constants";
import { PUBLIC_ROUTES, routes } from "@/config/routes";

/**
 * Edge auth gate.
 *
 * Next 16 replaced the `middleware.ts` convention with `proxy.ts`; this file is
 * the same gate CRM_FRONTEND_STRUCTURE.md calls for, under the current name.
 *
 * It only checks that a session cookie is present. It cannot verify the token,
 * because that needs a call to the API. Validation happens in the dashboard
 * layout; this exists so unauthenticated requests never reach a protected
 * render at all, and so signed-in users skip the login page.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const isPublic = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (isPublic) {
    if (hasSession && pathname === routes.login) {
      return NextResponse.redirect(new URL(routes.dashboard, request.url));
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    const loginUrl = new URL(routes.login, request.url);
    if (pathname !== routes.home) {
      loginUrl.searchParams.set(REDIRECT_PARAM, `${pathname}${search}`);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  /**
   * Everything except Next internals, static assets and the API routes. The BFF
   * routes under /api/auth handle their own auth and must stay reachable while
   * signed out.
   */
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
