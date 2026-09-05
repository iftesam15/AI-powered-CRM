import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { UsersTable } from "@/features/users/components/users-table";

export const metadata: Metadata = { title: "Users" };

export default function SettingsUsersPage() {
  return (
    <>
      <PageHeader
        title="Users"
        description="Everyone who can sign in to this organisation. A role decides what each person can see and change; the API enforces it on every request."
      />
      <UsersTable />
    </>
  );
}
