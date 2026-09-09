/** Cookie names owned by the BFF layer. Never read from client JavaScript. */
export const SESSION_COOKIE = "crm_session";
export const REFRESH_COOKIE = "crm_refresh";

/** Where the login page sends the user back to after a successful sign in. */
export const REDIRECT_PARAM = "next";

/** Backend API version prefix, per CRM_ARCHITECTURE.md section 7. */
export const API_PREFIX = "/api/v1";

/** TanStack Query root keys. Feature modules extend these, never redefine them. */
export const QUERY_KEYS = {
  session: ["session"] as const,
  accounts: ["accounts"] as const,
  contacts: ["contacts"] as const,
  leads: ["leads"] as const,
  opportunities: ["opportunities"] as const,
  pipeline: ["pipeline"] as const,
  activities: ["activities"] as const,
  tasks: ["tasks"] as const,
  users: ["users"] as const,
  audit: ["audit"] as const,
  search: ["search"] as const,
  dataOps: ["dataOps"] as const,
} as const;

export const DEFAULT_PAGE_SIZE = 25;
