import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { routes } from "@/config/routes";
import { AuditLog } from "@/features/audit/components/audit-log";
import { can, PERMISSIONS } from "@/lib/permissions";
import { getSession } from "@/server/auth-service";
import { readAccessToken } from "@/server/session";

export const metadata: Metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

/**
 * `audit:read` is narrower than the `users:read` the settings layout checks: a
 * sales manager can see the user list but not the trail, so this page gates
 * again rather than inheriting.
 */
export default async function SettingsAuditPage() {
  const accessToken = await readAccessToken();
  const session = accessToken ? await getSession(accessToken) : null;
  if (!session || !can(session, PERMISSIONS.auditRead)) redirect(routes.settingsUsers);

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Sign-ins, lockouts and every change to a user account, newest first. Entries are append-only: nothing here can be edited or deleted, including by an administrator."
      />
      <AuditLog />
    </>
  );
}
