"use client";

import React from "react";
import { ArrowRight, Clock, User as UserIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CrmOpportunityStageHistory } from "@/features/opportunities/types";

interface StageHistoryTimelineProps {
  history: CrmOpportunityStageHistory[];
}

export function StageHistoryTimeline({ history }: StageHistoryTimelineProps) {
  if (!history || history.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            Stage Progression History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No stage transitions recorded yet.</p>
        </CardContent>
      </Card>
    );
  }

  // Newest transitions on top
  const sorted = [...history].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          Stage Progression History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
          {sorted.map((item, idx) => {
            const isLatest = idx === 0;
            const dateStr = new Date(item.created_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div key={item.id} className="relative group">
                {/* Dot */}
                <div
                  className={`absolute -left-[27px] top-1.5 w-3 h-3 rounded-full border-2 border-background transition-colors ${
                    isLatest ? "bg-primary ring-4 ring-primary/20" : "bg-muted-foreground"
                  }`}
                />

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.from_stage_name ? (
                      <>
                        <span className="text-xs font-medium text-muted-foreground line-through">
                          {item.from_stage_name}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                      </>
                    ) : (
                      <span className="text-xs font-medium text-muted-foreground">
                        Created in
                      </span>
                    )}
                    <span className="text-sm font-semibold text-foreground">
                      {item.to_stage_name || "Stage"}
                    </span>

                    {typeof item.days_in_stage === "number" && item.days_in_stage > 0 && (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                        {item.days_in_stage} {item.days_in_stage === 1 ? "day" : "days"} in stage
                      </span>
                    )}
                  </div>

                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {dateStr}
                  </span>
                </div>

                {item.changed_by_name && (
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                    <UserIcon className="w-3 h-3" />
                    <span>Moved by {item.changed_by_name}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
