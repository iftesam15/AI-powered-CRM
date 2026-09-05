import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { routes } from "@/config/routes";
import { can, PERMISSIONS } from "@/lib/permissions";
import { getSession } from "@/server/auth-service";
import { readAccessToken } from "@/server/session";

export const dynamic = "force-dynamic";

/**
 * Server-side gate for the whole settings area.
 *
 * `PermissionGate` hides nav entries, but hiding a link is not access control:
 * anyone can type a URL. The pages under here are checked on the server before
 * anything renders, and the API re-checks every request underneath that. Three
 * layers, of which only the last two are actually load-bearing.
 *
 * Non-admins are sent to the dashboard rather than shown a "forbidden" screen —
 * they arrived by guessing a URL, and there is nothing here for them to do.
 */
export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const accessToken = await readAccessToken();
  const session = accessToken ? await getSession(accessToken) : null;

  if (!session) redirect(routes.login);
  if (!can(session, PERMISSIONS.usersRead)) redirect(routes.dashboard);

  return <>{children}</>;
}
