"use client";

import { useContext } from "react";

import { SessionContext } from "@/providers/session-provider";
import { can, type Permission } from "@/lib/permissions";

/** Session for authenticated areas. Throws outside the dashboard shell. */
export function useSession() {
  const context = useContext(SessionContext);
  if (context === null) {
    throw new Error("useSession must be used inside SessionProvider.");
  }
  if (!context.session) {
    throw new Error(
      "useSession was called without a session. Use useOptionalSession outside the dashboard shell.",
    );
  }
  return context.session;
}

/** Session where absence is a valid state, such as the auth pages. */
export function useOptionalSession() {
  const context = useContext(SessionContext);
  return context?.session ?? null;
}

export function usePermission(permission: Permission | Permission[]) {
  const session = useOptionalSession();
  return can(session, permission);
}
