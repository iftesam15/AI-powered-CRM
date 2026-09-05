import { Building2 } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { routes } from "@/config/routes";
import { can, PERMISSIONS } from "@/lib/permissions";
import { getSession } from "@/server/auth-service";
import { readAccessToken } from "@/server/session";

export const metadata: Metadata = { title: "Organisation" };
export const dynamic = "force-dynamic";

/**
 * Read-only for now. The tenant record exists and is worth showing — it is what
 * every row in the database is scoped by — but no sprint has built an endpoint
 * to change it, so this reports rather than pretending to be a form.
 */
export default async function SettingsTenantPage() {
  const accessToken = await readAccessToken();
  const session = accessToken ? await getSession(accessToken) : null;
  if (!session || !can(session, PERMISSIONS.tenantRead)) redirect(routes.settingsUsers);

  const { tenant } = session;
  const fields = [
    { label: "Name", value: tenant.name },
    { label: "Default currency", value: tenant.defaultCurrency },
    { label: "Locale", value: tenant.locale },
    { label: "Tenant ID", value: tenant.id, mono: true },
  ];

  return (
    <>
      <PageHeader
        title="Organisation"
        description="Every record in the CRM belongs to this organisation. Its identifier comes from your session, never from anything the browser sends."
      />

      <div className="max-w-2xl overflow-hidden rounded-lg border">
        <div className="flex items-center gap-3 border-b bg-muted/40 px-5 py-4">
          <span className="flex size-9 items-center justify-center rounded-md bg-background text-muted-foreground">
            <Building2 className="size-4.5" aria-hidden />
          </span>
          <div>
            <p className="font-medium">{tenant.name}</p>
            <p className="text-xs text-muted-foreground">Multi-tenant workspace</p>
          </div>
        </div>

        <dl className="divide-y">
          {fields.map((field) => (
            <div key={field.label} className="flex gap-4 px-5 py-3">
              <dt className="w-40 shrink-0 text-sm text-muted-foreground">{field.label}</dt>
              <dd className={field.mono ? "font-mono text-xs break-all" : "text-sm"}>
                {field.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <p className="text-sm text-muted-foreground">
        Editing these details is not part of any sprint yet. Changing the currency after
        deals exist would reinterpret every stored amount, so it needs a migration path
        before it becomes a form.
      </p>
    </>
  );
}
