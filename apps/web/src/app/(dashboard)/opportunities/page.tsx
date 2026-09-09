import type { Metadata } from "next";
import Link from "next/link";
import { Kanban } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { OpportunitiesTable } from "@/features/opportunities/components/opportunities-table";

export const metadata: Metadata = { title: "Opportunities" };

export default function OpportunitiesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Opportunities"
        description="Track deal stages, values, probabilities, and revenue forecasts across your sales pipeline."
        actions={
          <Link href="/pipeline">
            <Button variant="outline" className="gap-2">
              <Kanban className="w-4 h-4" />
              View Pipeline Board
            </Button>
          </Link>
        }
      />
      <OpportunitiesTable />
    </div>
  );
}
