import "server-only";

import { cookies } from "next/headers";

import { REFRESH_COOKIE, SESSION_COOKIE } from "@/lib/constants";

const isProduction = process.env.NODE_ENV === "production";

const baseCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: isProduction,
  path: "/",
};

/** Access token lifetime mirrors the backend's short-lived JWT. */
const ACCESS_MAX_AGE = 60 * 15;
const REFRESH_MAX_AGE = 60 * 60 * 24 * 14;

export async function readAccessToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value ?? null;
}

export async function readRefreshToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(REFRESH_COOKIE)?.value ?? null;
}

export async function writeSessionCookies(tokens: {
  accessToken: string;
  refreshToken?: string | null;
}): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, tokens.accessToken, {
    ...baseCookie,
    maxAge: ACCESS_MAX_AGE,
  });
  if (tokens.refreshToken) {
    jar.set(REFRESH_COOKIE, tokens.refreshToken, {
      ...baseCookie,
      maxAge: REFRESH_MAX_AGE,
    });
  }
}

export async function clearSessionCookies(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { ...baseCookie, maxAge: 0 });
  jar.set(REFRESH_COOKIE, "", { ...baseCookie, maxAge: 0 });
}
