import type { Metadata } from "next";

import { FormAlert } from "@/components/shared/form-alert";
import { env } from "@/config/env";
import { LoginForm } from "@/features/auth";
import { REDIRECT_PARAM } from "@/lib/constants";
import { routes } from "@/config/routes";

export const metadata: Metadata = { title: "Sign in" };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Only same-origin relative paths are accepted as a post-login destination, so
 * a crafted `?next=` cannot bounce the user to another site after sign in.
 */
function safeRedirect(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) return routes.dashboard;
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return routes.dashboard;
  return candidate;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const redirectTo = safeRedirect(params[REDIRECT_PARAM]);
  const expired = params.expired === "1";

  return (
    <div className="space-y-7">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Use the email address your administrator registered.
        </p>
      </header>

      {expired ? (
        <FormAlert tone="info" title="You were signed out">
          Your session expired. Sign in again to pick up where you left off.
        </FormAlert>
      ) : null}

      <LoginForm redirectTo={redirectTo} />

      {env.NEXT_PUBLIC_USE_MOCK_API ? (
        <FormAlert tone="info" title="Local mock mode">
          The backend is not wired up yet. Sign in with{" "}
          <span className="font-mono text-xs">admin@calderfreight.test</span> or{" "}
          <span className="font-mono text-xs">rep@calderfreight.test</span>, password{" "}
          <span className="font-mono text-xs">Sprint1demo!</span>
        </FormAlert>
      ) : null}
    </div>
  );
}
