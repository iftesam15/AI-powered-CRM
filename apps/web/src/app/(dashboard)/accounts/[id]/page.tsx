import type { Metadata } from "next";

import { AccountDetailView } from "@/features/accounts/components/account-detail-view";

export const metadata: Metadata = { title: "Account Details" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AccountDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <AccountDetailView id={id} />;
}
