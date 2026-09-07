import type { Metadata } from "next";

import { ContactDetailView } from "@/features/contacts/components/contact-detail-view";

export const metadata: Metadata = { title: "Contact Details" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ContactDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <ContactDetailView id={id} />;
}
