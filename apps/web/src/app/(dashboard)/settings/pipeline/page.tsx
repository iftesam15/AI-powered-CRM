import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { PipelineStageManager } from "@/features/pipelines/components/pipeline-stage-manager";

export const metadata: Metadata = { title: "Pipeline Settings" };

export default function SettingsPipelinePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline Stages"
        description="Configure your sales cycle stages, win probabilities, reorder stage sequence, and manage outcome statuses."
      />

      <PipelineStageManager />
    </div>
  );
}
