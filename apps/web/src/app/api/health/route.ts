import { NextResponse } from "next/server";

import { env } from "@/config/env";

export const dynamic = "force-dynamic";

interface UpstreamHealth {
  status: string;
  service: string;
  version: string;
  environment: string;
}

/**
 * Reports the web app's own status and, alongside it, whether the CRM API
 * answers. The sprint 0 demo is "open the web app and see that the API is
 * healthy", so the probe belongs here rather than in the browser: the API is
 * not guaranteed to be reachable from the client's network.
 *
 * The probe runs even in mock mode. Whether authentication is mocked and
 * whether the backend is up are separate facts, and during the sprints where
 * the two halves are built at different speeds it helps to see both.
 */
async function probeApi(): Promise<{
  reachable: boolean;
  detail: string;
  upstream: UpstreamHealth | null;
}> {
  const url = `${env.NEXT_PUBLIC_API_URL.replace(/\/$/, "")}/health`;

  try {
    // A health probe must fail fast; without a timeout this hangs for as long
    // as the platform's default connect timeout.
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      return { reachable: false, detail: `API returned ${response.status}.`, upstream: null };
    }
    return { reachable: true, detail: "API healthy", upstream: await response.json() };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return {
      reachable: false,
      detail: timedOut ? "API did not respond in time." : "API unreachable.",
      upstream: null,
    };
  }
}

export async function GET() {
  const api = await probeApi();

  return NextResponse.json(
    {
      status: "ok",
      app: env.NEXT_PUBLIC_APP_NAME,
      mode: env.NEXT_PUBLIC_USE_MOCK_API ? "mock" : "live",
      apiUrl: env.NEXT_PUBLIC_API_URL,
      api,
    },
    // The web app itself is fine either way; the body carries the API verdict.
    { status: 200 },
  );
}
