"use client";

import { useEffect } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { TriangleAlert } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EmptyState
      icon={TriangleAlert}
      title="This section could not be loaded"
      description="The CRM API did not answer as expected. Your session is still active, so you can retry without signing in again."
      action={
        <Button onClick={reset} size="sm">
          Try again
        </Button>
      }
    />
  );
}
