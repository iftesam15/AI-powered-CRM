"use client";

import { createContext, useMemo, type ReactNode } from "react";

import type { Session } from "@/types/session";

interface SessionContextValue {
  session: Session | null;
}

export const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * The dashboard layout resolves the session on the server and hands it down, so
 * the shell renders with the user and tenant already known. There is no
 * authenticated loading flash and no client fetch on first paint.
 */
export function SessionProvider({
  session,
  children,
}: {
  session: Session | null;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ session }), [session]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
