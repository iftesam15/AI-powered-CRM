import "server-only";

import { env } from "@/config/env";
import { permissionsForRole } from "@/lib/permissions";
import {
  mockLogin,
  mockLogout,
  mockRefresh,
  mockRequestPasswordReset,
  mockResetPassword,
  mockSession,
} from "@/server/mock/store";
import { upstream } from "@/server/upstream";
import type { Session, SessionTenant, SessionUser } from "@/types/session";

/**
 * The single place that knows whether auth is served by FastAPI or by the local
 * mock. Route handlers call these functions and never branch on the flag
 * themselves, so removing the mock later is a one-file change.
 *
 * Contract expected from the Sprint 1 backend (CRM_ARCHITECTURE.md section 7):
 *   POST   /api/v1/auth/login            { email, password }  -> TokenPair
 *   POST   /api/v1/auth/refresh          { refresh_token }    -> TokenPair
 *   POST   /api/v1/auth/logout                                -> 204
 *   GET    /api/v1/auth/me                                    -> MeResponse
 *   POST   /api/v1/auth/forgot-password  { email }            -> 202
 *   POST   /api/v1/auth/reset-password   { token, password }  -> 204
 */

interface TokenPair {
  access_token: string;
  refresh_token?: string | null;
}

interface MeResponse {
  user: {
    id: string;
    email: string;
    full_name: string;
    role: SessionUser["role"];
    is_active: boolean;
  };
  tenant: {
    id: string;
    name: string;
    default_currency: string;
    locale?: string | null;
  };
  permissions?: string[] | null;
}

function normaliseMe(payload: MeResponse): Session {
  const user: SessionUser = {
    id: payload.user.id,
    email: payload.user.email,
    fullName: payload.user.full_name,
    role: payload.user.role,
    isActive: payload.user.is_active,
  };
  const tenant: SessionTenant = {
    id: payload.tenant.id,
    name: payload.tenant.name,
    defaultCurrency: payload.tenant.default_currency,
    locale: payload.tenant.locale ?? "en-US",
  };
  return {
    user,
    tenant,
    permissions:
      payload.permissions && payload.permissions.length > 0
        ? payload.permissions
        : permissionsForRole(user.role),
  };
}

export type LoginOutcome =
  | { ok: true; accessToken: string; refreshToken: string | null; session: Session }
  | { ok: false; status: number; detail: string };

export async function login(email: string, password: string): Promise<LoginOutcome> {
  if (env.NEXT_PUBLIC_USE_MOCK_API) {
    const result = mockLogin(email, password);
    switch (result.kind) {
      case "ok":
        return {
          ok: true,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          session: result.session,
        };
      case "locked":
        return {
          ok: false,
          status: 429,
          detail: `Too many failed attempts. Try again in ${Math.ceil(
            result.retryAfterSeconds / 60,
          )} minutes.`,
        };
      case "inactive":
        return {
          ok: false,
          status: 403,
          detail: "This account has been deactivated. Contact your administrator.",
        };
      default:
        return { ok: false, status: 401, detail: "Email or password is incorrect." };
    }
  }

  const tokens = await upstream<TokenPair>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (!tokens.ok || !tokens.data) {
    return {
      ok: false,
      status: tokens.status,
      detail:
        tokens.status === 401
          ? "Email or password is incorrect."
          : (tokens.detail ?? "Sign in failed."),
    };
  }

  const session = await getSession(tokens.data.access_token);
  if (!session) {
    return { ok: false, status: 502, detail: "Signed in, but the session could not be loaded." };
  }

  return {
    ok: true,
    accessToken: tokens.data.access_token,
    refreshToken: tokens.data.refresh_token ?? null,
    session,
  };
}

export async function getSession(accessToken: string): Promise<Session | null> {
  if (env.NEXT_PUBLIC_USE_MOCK_API) {
    return mockSession(accessToken);
  }
  const result = await upstream<MeResponse>("/auth/me", { accessToken });
  if (!result.ok || !result.data) return null;
  return normaliseMe(result.data);
}

export async function refresh(
  refreshToken: string,
): Promise<{ accessToken: string; session: Session } | null> {
  if (env.NEXT_PUBLIC_USE_MOCK_API) {
    return mockRefresh(refreshToken);
  }
  const tokens = await upstream<TokenPair>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!tokens.ok || !tokens.data) return null;
  const session = await getSession(tokens.data.access_token);
  if (!session) return null;
  return { accessToken: tokens.data.access_token, session };
}

export async function logout(
  accessToken: string | null,
  refreshToken: string | null,
): Promise<void> {
  if (env.NEXT_PUBLIC_USE_MOCK_API) {
    mockLogout(accessToken, refreshToken);
    return;
  }
  if (!accessToken) return;
  await upstream("/auth/logout", { method: "POST", accessToken });
}

/**
 * Returns a dev-only reset link in mock mode so the flow can be walked without
 * a mail catcher. Against the real API the link is delivered by SMTP and this
 * is always null.
 */
export async function requestPasswordReset(
  email: string,
): Promise<{ devToken: string | null }> {
  if (env.NEXT_PUBLIC_USE_MOCK_API) {
    const { token } = mockRequestPasswordReset(email);
    if (token) {
      console.info(`[mock mail] password reset token for ${email}: ${token}`);
    }
    return { devToken: token };
  }
  await upstream("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  return { devToken: null };
}

export type ResetOutcome = { ok: true } | { ok: false; status: number; detail: string };

export async function resetPassword(
  token: string,
  password: string,
): Promise<ResetOutcome> {
  if (env.NEXT_PUBLIC_USE_MOCK_API) {
    const result = mockResetPassword(token, password);
    switch (result.kind) {
      case "ok":
        return { ok: true };
      case "used":
        return {
          ok: false,
          status: 410,
          detail: "This reset link has already been used. Request a new one.",
        };
      case "expired":
        return {
          ok: false,
          status: 410,
          detail: "This reset link has expired. Request a new one.",
        };
      default:
        return { ok: false, status: 400, detail: "This reset link is not valid." };
    }
  }

  const result = await upstream("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
  if (!result.ok) {
    return {
      ok: false,
      status: result.status,
      detail: result.detail ?? "The password could not be reset.",
    };
  }
  return { ok: true };
}
