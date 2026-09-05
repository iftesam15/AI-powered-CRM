import { redirect } from "next/navigation";

import { routes } from "@/config/routes";

/** `/settings` has no landing page of its own; users is the first section. */
export default function SettingsIndexPage() {
  redirect(routes.settingsUsers);
}
