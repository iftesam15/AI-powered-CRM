"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Offset pager for list pages, matching the `Page` envelope the API returns.
 *
 * It reports the range on screen rather than a page number, because "26–50 of
 * 214" answers the question a person actually has when they are scanning a
 * filtered list. Both controls stay mounted and disable at the ends so the
 * footer does not change height between pages.
 */
export function PaginationFooter({
  total,
  limit,
  offset,
  onOffsetChange,
  unit = "results",
}: {
  total: number;
  limit: number;
  offset: number;
  onOffsetChange: (offset: number) => void;
  unit?: string;
}) {
  const first = total === 0 ? 0 : offset + 1;
  const last = Math.min(offset + limit, total);
  const hasPrevious = offset > 0;
  const hasNext = offset + limit < total;

  if (total === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-1 pt-3">
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {first}–{last} of {total} {unit}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!hasPrevious}
          onClick={() => onOffsetChange(Math.max(0, offset - limit))}
        >
          <ChevronLeft className="size-4" aria-hidden />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasNext}
          onClick={() => onOffsetChange(offset + limit)}
        >
          Next
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
