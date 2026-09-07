import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { AccountsTable } from "@/features/accounts/components/accounts-table";
import { CreateAccountDialog } from "@/features/accounts/components/create-account-dialog";

export const metadata: Metadata = { title: "Accounts" };

export default function AccountsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts"
        description="Manage company records, client accounts, and client relationships across your organization."
        actions={<CreateAccountDialog />}
      />
      <AccountsTable />
    </div>
  );
}
