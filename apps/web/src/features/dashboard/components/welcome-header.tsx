"use client";

import { PageHeader } from "@/components/shared/page-header";
import { useSession } from "@/features/auth/hooks/use-session";

/**
 * Reads the session from context rather than re-resolving it on the server, so
 * rendering the dashboard costs one `/auth/me` call, not two.
 */
export function WelcomeHeader() {
  const { user, tenant } = useSession();
  const firstName = user.fullName.split(" ")[0];

  return (
    <PageHeader
      title={`Welcome back, ${firstName}`}
      description={`You are signed in to ${tenant.name}. Records, pipeline and reporting arrive in the sprints noted below.`}
    />
  );
}
