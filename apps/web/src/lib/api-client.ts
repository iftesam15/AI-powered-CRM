import type { ApiErrorBody } from "@/types/api";

/**
 * Browser-side HTTP wrapper.
 *
 * Because the access token lives in an httpOnly cookie, the browser cannot call
 * FastAPI directly. Every feature request goes to the Next proxy at `/api/crm`,
 * which attaches the bearer token server side and forwards to
 * `${NEXT_PUBLIC_API_URL}/api/v1`. Feature modules therefore pass backend-shaped
 * paths such as `/contacts?limit=25`.
 */
export const PROXY_BASE = "/api/crm";

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(status: number, body: ApiErrorBody) {
    super(body.detail);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.fieldErrors = body.fieldErrors;
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isForbidden() {
    return this.status === 403;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Set to false for calls that already point at a full Next route. */
  proxy?: boolean;
}

export async function apiRequest<T>(
  path: string,
  { body, proxy = true, headers, ...init }: RequestOptions = {},
): Promise<T> {
  const url = proxy ? `${PROXY_BASE}${path}` : path;

  const response = await fetch(url, {
    ...init,
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    const fallback: ApiErrorBody = {
      detail:
        response.status >= 500
          ? "Something went wrong on our side. Try again in a moment."
          : "The request could not be completed.",
    };
    const errorBody =
      parsed && typeof parsed === "object" && "detail" in parsed
        ? (parsed as ApiErrorBody)
        : fallback;
    throw new ApiError(response.status, errorBody);
  }

  return parsed as T;
}

export const api = {
  get: <T>(path: string, init?: RequestOptions) =>
    apiRequest<T>(path, { ...init, method: "GET" }),
  post: <T>(path: string, body?: unknown, init?: RequestOptions) =>
    apiRequest<T>(path, { ...init, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, init?: RequestOptions) =>
    apiRequest<T>(path, { ...init, method: "PATCH", body }),
  put: <T>(path: string, body?: unknown, init?: RequestOptions) =>
    apiRequest<T>(path, { ...init, method: "PUT", body }),
  delete: <T>(path: string, init?: RequestOptions) =>
    apiRequest<T>(path, { ...init, method: "DELETE" }),
};
