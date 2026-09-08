import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { CreateLeadDialog } from "@/features/leads/components/create-lead-dialog";
import { LeadsTable } from "@/features/leads/components/leads-table";

export const metadata: Metadata = { title: "Leads" };

export default function LeadsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description="Capture prospective clients, manage qualification stages, and convert qualified leads to Contacts & Accounts."
        actions={<CreateLeadDialog />}
      />
      <LeadsTable />
    </div>
  );
}
