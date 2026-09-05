
import { NextResponse } from "next/server";

import { env } from "@/config/env";
import { API_PREFIX } from "@/lib/constants";
import { refresh } from "@/server/auth-service";
import { handleMockApiRequest } from "@/server/mock/handlers";
import {
  clearSessionCookies,
  readAccessToken,
  readRefreshToken,
  writeSessionCookies,
} from "@/server/session";

export const dynamic = "force-dynamic";

/**
 * Authenticated proxy to FastAPI.
 *
 * The browser cannot read the httpOnly access token, so every feature request
 * is forwarded here, given a bearer header server side, and passed through to
 * `${NEXT_PUBLIC_API_URL}/api/v1/...`. A single 401 triggers one refresh and
 * one replay; anything beyond that clears the cookies and surfaces the 401 so
 * the client can send the user back to the login page.
 *
 * This proxy deliberately does not accept a tenant id from the caller. Tenant
 * scoping is derived from the token by the backend.
 */

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

function forwardHeaders(request: Request, accessToken: string): Headers {
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return;
    if (key.toLowerCase() === "cookie") return;
    headers.set(key, value);
  });
  headers.set("authorization", `Bearer ${accessToken}`);
  return headers;
}

async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  let accessToken = await readAccessToken();
  if (!accessToken) {
    return NextResponse.json({ detail: "Not authenticated." }, { status: 401 });
  }

  const { path } = await context.params;

  if (env.NEXT_PUBLIC_USE_MOCK_API) {
    // The mock answers the routes it implements and returns null for the rest,
    // so an unbuilt module fails loudly instead of looking empty.
    const mocked = await handleMockApiRequest(request, path, accessToken);
    return (
      mocked ??
      NextResponse.json(
        {
          detail:
            "Mock mode does not cover this endpoint yet. Set NEXT_PUBLIC_USE_MOCK_API=false and start the CRM API to load these records.",
          code: "mock_mode_not_implemented",
        },
        { status: 501 },
      )
    );
  }

  const search = new URL(request.url).search;
  const target = `${env.NEXT_PUBLIC_API_URL.replace(/\/$/, "")}${API_PREFIX}/${path.join("/")}${search}`;

  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();

  const send = (token: string) =>
    fetch(target, {
      method: request.method,
      headers: forwardHeaders(request, token),
      body,
      cache: "no-store",
    });

  let response: Response;
  try {
    response = await send(accessToken);
  } catch {
    return NextResponse.json(
      { detail: "The CRM API is unreachable. Check that the backend is running." },
      { status: 503 },
    );
  }

  if (response.status === 401) {
    const refreshToken = await readRefreshToken();
    const renewed = refreshToken ? await refresh(refreshToken) : null;

    if (!renewed) {
      await clearSessionCookies();
      return NextResponse.json({ detail: "Your session has expired." }, { status: 401 });
    }

    accessToken = renewed.accessToken;
    await writeSessionCookies({ accessToken });

    try {
      response = await send(accessToken);
    } catch {
      return NextResponse.json(
        { detail: "The CRM API is unreachable. Check that the backend is running." },
        { status: 503 },
      );
    }
  }

  const responseHeaders = new Headers();
  const contentType = response.headers.get("content-type");
  if (contentType) responseHeaders.set("content-type", contentType);

  return new NextResponse(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
