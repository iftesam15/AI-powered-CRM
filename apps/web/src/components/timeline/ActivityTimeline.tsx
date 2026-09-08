"use client";

import {
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Mail,
  MessageSquare,
  PhoneCall,
  UserCheck,
} from "lucide-react";

import type { TimelineItem } from "@/features/activities/types";

interface ActivityTimelineProps {
  items: TimelineItem[];
  loading?: boolean;
}

function categoryIcon(category: string) {
  switch (category) {
    case "call":
      return <PhoneCall className="h-4 w-4 text-emerald-500" />;
    case "meeting":
      return <Calendar className="h-4 w-4 text-blue-500" />;
    case "email":
      return <Mail className="h-4 w-4 text-violet-500" />;
    case "note":
      return <FileText className="h-4 w-4 text-amber-500" />;
    case "task_completed":
      return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
    case "task":
    default:
      return <Clock className="h-4 w-4 text-sky-500" />;
  }
}

function priorityBadge(priority: string | null) {
  if (!priority) return null;
  switch (priority) {
    case "high":
      return (
        <span className="inline-flex items-center rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-600 dark:text-rose-400">
          High
        </span>
      );
    case "medium":
      return (
        <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
          Medium
        </span>
      );
    case "low":
      return (
        <span className="inline-flex items-center rounded-full bg-slate-500/10 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-400">
          Low
        </span>
      );
    default:
      return null;
  }
}

function statusBadge(status: string | null) {
  if (!status) return null;
  switch (status) {
    case "completed":
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="h-3 w-3" /> Completed
        </span>
      );
    case "in_progress":
      return (
        <span className="inline-flex items-center rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
          In progress
        </span>
      );
    case "pending":
      return (
        <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          Pending
        </span>
      );
    case "cancelled":
      return (
        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
          Cancelled
        </span>
      );
    default:
      return null;
  }
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ActivityTimeline({ items, loading }: ActivityTimelineProps) {
  if (loading) {
    return (
      <div className="space-y-4 py-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4 animate-pulse">
            <div className="h-8 w-8 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 rounded bg-muted" />
              <div className="h-3 w-2/3 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center">
        <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground/60" />
        <h3 className="mt-2 text-sm font-semibold text-foreground">No activities or tasks yet</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Log calls, meetings, notes, or assign tasks to build the chronological interaction timeline.
        </p>
      </div>
    );
  }

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[2px] before:bg-gradient-to-b before:from-primary/20 before:via-border before:to-transparent">
      {items.map((item) => (
        <div key={`${item.item_type}-${item.id}`} className="relative group">
          {/* Node Bullet */}
          <div className="absolute -left-6 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border bg-background shadow-xs transition-transform group-hover:scale-110">
            {categoryIcon(item.category)}
          </div>

          <div className="rounded-lg border bg-card p-4 shadow-xs transition-all hover:border-primary/50 hover:shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                  {item.title}
                </span>
                {priorityBadge(item.priority)}
                {statusBadge(item.status)}
              </div>
              <time className="text-xs text-muted-foreground">{formatDate(item.timestamp)}</time>
            </div>

            {item.description && (
              <p className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {item.description}
              </p>
            )}

            <div className="mt-3 flex items-center justify-between border-t pt-2 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5 text-muted-foreground/70" />
                <span>{item.actor_name || "System"}</span>
              </div>
              {item.due_date && (
                <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <Clock className="h-3 w-3" />
                  <span>Due {new Date(item.due_date).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
