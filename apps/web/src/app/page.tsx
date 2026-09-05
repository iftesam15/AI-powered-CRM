import { redirect } from "next/navigation";

import { routes } from "@/config/routes";

/**
 * The root path has no content of its own. Middleware has already decided
 * whether the visitor is authenticated, so this only forwards to the workspace.
 */
export default function RootPage() {
  redirect(routes.dashboard);
}
