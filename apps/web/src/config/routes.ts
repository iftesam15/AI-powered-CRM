/**
 * Typed path helpers. Never hand-write a route string in a component.
 */
export const routes = {
  home: "/",

  login: "/login",
  forgotPassword: "/forgot-password",
  resetPassword: (token?: string) =>
    token ? `/reset-password?token=${encodeURIComponent(token)}` : "/reset-password",

  dashboard: "/dashboard",

  accounts: "/accounts",
  account: (id: string) => `/accounts/${id}`,

  contacts: "/contacts",
  contact: (id: string) => `/contacts/${id}`,

  leads: "/leads",
  lead: (id: string) => `/leads/${id}`,

  opportunities: "/opportunities",
  opportunity: (id: string) => `/opportunities/${id}`,

  pipeline: "/pipeline",
  activities: "/activities",
  tasks: "/tasks",
  search: (q?: string) => (q ? `/search?q=${encodeURIComponent(q)}` : "/search"),
  reports: "/reports",
  imports: "/imports",

  settings: "/settings",
  settingsUsers: "/settings/users",
  settingsRoles: "/settings/roles",
  settingsPipeline: "/settings/pipeline",
  settingsTenant: "/settings/tenant",
  settingsAudit: "/settings/audit",
} as const;

/** Route groups the middleware treats as protected / public. */
export const PUBLIC_ROUTES = [
  routes.login,
  routes.forgotPassword,
  "/reset-password",
] as const;
