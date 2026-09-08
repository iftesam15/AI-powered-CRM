import type { Metadata } from "next";

import { LeadDetailView } from "@/features/leads/components/lead-detail-view";

export const metadata: Metadata = { title: "Lead Detail" };

interface LeadDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function LeadDetailPage({ params }: LeadDetailPageProps) {
  const { id } = await params;
  return <LeadDetailView id={id} />;
}
