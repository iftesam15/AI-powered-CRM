import { NextResponse } from "next/server";

import { getSession, refresh } from "@/server/auth-service";
import {
  clearSessionCookies,
  readAccessToken,
  readRefreshToken,
  writeSessionCookies,
} from "@/server/session";

export const dynamic = "force-dynamic";

/**
 * Resolves the current session for the client. When the short-lived access
 * token has expired but a refresh token is still valid, the session is renewed
 * transparently so the user is not bounced to the login page mid-task.
 */
export async function GET() {
  const accessToken = await readAccessToken();

  if (accessToken) {
    const session = await getSession(accessToken);
    if (session) return NextResponse.json(session);
  }

  const refreshToken = await readRefreshToken();
  if (refreshToken) {
    const renewed = await refresh(refreshToken);
    if (renewed) {
      await writeSessionCookies({ accessToken: renewed.accessToken });
      return NextResponse.json(renewed.session);
    }
  }

  await clearSessionCookies();
  return NextResponse.json({ detail: "Not authenticated." }, { status: 401 });
}
