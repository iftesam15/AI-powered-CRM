import type { Metadata } from "next";
import Link from "next/link";
import { ListFilter, Settings } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { PipelineMetricsBar } from "@/features/pipelines/components/pipeline-metrics-bar";
import { KanbanBoard } from "@/features/pipelines/components/kanban-board";

export const metadata: Metadata = { title: "Sales Pipeline" };

export default function PipelinePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Pipeline"
        description="Visual deal pipeline. Drag and drop opportunities across stages to advance your sales cycle."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/opportunities">
              <Button variant="outline" className="gap-2">
                <ListFilter className="w-4 h-4" />
                Table View
              </Button>
            </Link>
            <Link href="/settings/pipeline">
              <Button variant="outline" size="icon" title="Stage Settings">
                <Settings className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        }
      />

      {/* Real-time Stage & Forecasting Metrics */}
      <PipelineMetricsBar />

      {/* Interactive Drag-and-Drop Board */}
      <KanbanBoard />
    </div>
  );
}
