"use client";

import type { ReactNode } from "react";

import { usePermission } from "@/features/auth/hooks/use-session";
import type { Permission } from "@/lib/permissions";

/**
 * Hides actions the current role cannot perform.
 *
 * This is a usability aid only. It prevents dead ends in the interface and must
 * never be treated as access control: the API re-checks every request and is
 * the only real boundary.
 */
export function PermissionGate({
  permission,
  fallback = null,
  children,
}: {
  permission: Permission | Permission[];
  fallback?: ReactNode;
  children: ReactNode;
}) {
  return usePermission(permission) ? <>{children}</> : <>{fallback}</>;
}
