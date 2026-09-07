import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { ContactsTable } from "@/features/contacts/components/contacts-table";
import { CreateContactDialog } from "@/features/contacts/components/create-contact-dialog";

export const metadata: Metadata = { title: "Contacts" };

export default function ContactsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Contacts"
        description="Manage individual contact records, business relations, and primary account links."
        actions={<CreateContactDialog />}
      />
      <ContactsTable />
    </div>
  );
}
