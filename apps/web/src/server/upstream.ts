import "server-only";

import { API_PREFIX } from "@/lib/constants";
import { env } from "@/config/env";

export interface UpstreamResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  detail: string | null;
}

/**
 * Server-side call into FastAPI. Only route handlers under `app/api/**` use
 * this. Browser code never talks to FastAPI directly, so the access token can
 * stay in an httpOnly cookie.
 */
export async function upstream<T>(
  path: string,
  init: RequestInit & { accessToken?: string | null } = {},
): Promise<UpstreamResult<T>> {
  const { accessToken, headers, ...rest } = init;

  const url = `${env.NEXT_PUBLIC_API_URL.replace(/\/$/, "")}${API_PREFIX}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
    });
  } catch {
    return {
      ok: false,
      status: 503,
      data: null,
      detail: "The CRM API is unreachable. Check that the backend is running.",
    };
  }

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    const detail =
      body && typeof body === "object" && "detail" in body
        ? String((body as { detail: unknown }).detail)
        : `Request failed with status ${response.status}.`;
    return { ok: false, status: response.status, data: null, detail };
  }

  return { ok: true, status: response.status, data: body as T, detail: null };
}
