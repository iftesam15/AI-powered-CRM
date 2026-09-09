"use client";

import { useState } from "react";
import { Calendar, FileText, Mail, PhoneCall, X } from "lucide-react";

import { createActivity } from "@/features/activities/api";
import type { ActivityType, EntityType } from "@/features/activities/types";

interface LogActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  entityType: EntityType;
  entityId: string;
  entityName?: string;
  accountId?: string;
  contactId?: string;
}

export function LogActivityModal({
  isOpen,
  onClose,
  onSuccess,
  entityType,
  entityId,
  entityName,
  accountId,
  contactId,
}: LogActivityModalProps) {
  const [activityType, setActivityType] = useState<ActivityType>("call");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createActivity({
        activity_type: activityType,
        title: title.trim(),
        description: description.trim() || undefined,
        entity_type: entityType,
        entity_id: entityId,
        account_id: accountId,
        contact_id: contactId,
      });
      setTitle("");
      setDescription("");
      setActivityType("call");
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to log activity");
    } finally {
      setLoading(false);
    }
  }

  const types: Array<{ type: ActivityType; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { type: "call", label: "Call", icon: PhoneCall },
    { type: "meeting", label: "Meeting", icon: Calendar },
    { type: "email", label: "Email", icon: Mail },
    { type: "note", label: "Note", icon: FileText },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h2 className="text-lg font-semibold">Log Activity</h2>
            {entityName && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Recording activity for <span className="font-medium text-foreground">{entityName}</span>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-xs font-medium text-destructive">
              {error}
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground">Activity Type</label>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {types.map((t) => {
                const Icon = t.icon;
                const active = activityType === t.type;
                return (
                  <button
                    key={t.type}
                    type="button"
                    onClick={() => setActivityType(t.type)}
                    className={`flex flex-col items-center justify-center rounded-lg border p-3 text-xs font-medium transition-all ${
                      active
                        ? "border-primary bg-primary/10 text-primary shadow-xs"
                        : "border-border hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5 mb-1" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="activity-title" className="text-xs font-medium text-muted-foreground">
              Title / Summary *
            </label>
            <input
              id="activity-title"
              type="text"
              required
              placeholder="e.g. Discovery call regarding Q4 expansion"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor="activity-desc" className="text-xs font-medium text-muted-foreground">
              Details & Notes
            </label>
            <textarea
              id="activity-desc"
              rows={4}
              placeholder="Capture key discussion points, requirements, or next steps..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1.5 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-4 py-2 text-xs font-medium hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "Logging..." : "Save Activity"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
