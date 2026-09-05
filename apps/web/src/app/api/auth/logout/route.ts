import { NextResponse } from "next/server";

import { logout } from "@/server/auth-service";
import { clearSessionCookies, readAccessToken, readRefreshToken } from "@/server/session";

export const dynamic = "force-dynamic";

export async function POST() {
  const accessToken = await readAccessToken();
  const refreshToken = await readRefreshToken();

  await logout(accessToken, refreshToken);
  await clearSessionCookies();

  return new NextResponse(null, { status: 204 });
}
