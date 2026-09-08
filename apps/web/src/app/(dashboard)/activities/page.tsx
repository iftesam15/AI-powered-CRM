"use client";

import { useEffect, useState } from "react";
import { Activity as ActivityIcon, Calendar, Filter, Plus, RefreshCw } from "lucide-react";

import { LogActivityModal } from "@/components/activities/LogActivityModal";
import { fetchActivities } from "@/features/activities/api";
import type { Activity, ActivityType } from "@/features/activities/types";

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [isLogOpen, setIsLogOpen] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const data = await fetchActivities({
        activity_type: filterType !== "all" ? filterType : undefined,
        limit: 50,
      });
      setActivities(data.items);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [filterType]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ActivityIcon className="h-6 w-6 text-primary" />
            Activities
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            System-wide log of interactions, discovery calls, strategy meetings, and notes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData()}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium hover:bg-muted"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-between gap-4 bg-card p-3 rounded-lg border">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Type:</span>
          <div className="flex gap-1">
            {["all", "call", "meeting", "email", "note"].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-all ${
                  filterType === type
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "hover:bg-muted text-muted-foreground"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{activities.length}</span> of{" "}
          <span className="font-semibold text-foreground">{total}</span> activities
        </div>
      </div>

      {/* Activities List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-lg border bg-card p-4 animate-pulse" />
          ))}
        </div>
      ) : activities.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <ActivityIcon className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <h3 className="mt-3 text-sm font-semibold text-foreground">No activities found</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            No activity logs match the selected filter.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((act) => (
            <div
              key={act.id}
              className="group rounded-xl border bg-card p-4 shadow-xs transition-all hover:border-primary/50 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                      {act.title}
                    </span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary capitalize">
                      {act.activity_type}
                    </span>
                  </div>
                  {act.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{act.description}</p>
                  )}
                </div>

                <time className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(act.performed_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </time>
              </div>

              <div className="mt-3 flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-3">
                  {act.account_name && (
                    <span>
                      Account: <strong className="text-foreground">{act.account_name}</strong>
                    </span>
                  )}
                  {act.contact_name && (
                    <span>
                      Contact: <strong className="text-foreground">{act.contact_name}</strong>
                    </span>
                  )}
                </div>
                <span>Logged by {act.created_by_name || "User"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
