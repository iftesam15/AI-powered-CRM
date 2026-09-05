import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { routes } from "@/config/routes";
import { getSession, refresh } from "@/server/auth-service";
import { readAccessToken, readRefreshToken } from "@/server/session";

export const dynamic = "force-dynamic";

/**
 * Second half of the auth gate. `middleware.ts` rejects requests with no cookie
 * at the edge; this layout verifies the token is still valid with the API
 * before rendering anything, because a present cookie is not proof of a live
 * session.
 *
 * Cookies cannot be written from a layout, so a token renewed here is not
 * persisted. The `/api/auth/session` route refreshes and rewrites the cookie on
 * the next client call.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const accessToken = await readAccessToken();
  let session = accessToken ? await getSession(accessToken) : null;

  if (!session) {
    const refreshToken = await readRefreshToken();
    const renewed = refreshToken ? await refresh(refreshToken) : null;
    session = renewed?.session ?? null;
  }

  if (!session) {
    redirect(`${routes.login}?expired=1`);
  }

  return <AppShell session={session}>{children}</AppShell>;
}
