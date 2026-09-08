"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, X } from "lucide-react";

import { accountsQueryOptions } from "@/features/accounts/api/queries";
import { createTask } from "@/features/tasks/api";
import type { TaskPriority, TaskStatus } from "@/features/tasks/types";

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  entityType?: string;
  entityId?: string;
  entityName?: string;
  accountId?: string;
  contactId?: string;
}

export function CreateTaskModal({
  isOpen,
  onClose,
  onSuccess,
  entityType,
  entityId,
  entityName,
  accountId,
  contactId,
}: CreateTaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState(accountId || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available accounts when no account is pre-provided
  const { data: accountsData } = useQuery({
    ...accountsQueryOptions({ limit: 100 }),
    enabled: isOpen && !accountId,
  });

  useEffect(() => {
    if (accountId) {
      setSelectedAccountId(accountId);
    }
  }, [accountId]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Task title is required");
      return;
    }

    setLoading(true);
    setError(null);

    const finalAccountId = accountId || (selectedAccountId && selectedAccountId !== "none" ? selectedAccountId : undefined);
    const finalEntityType = entityType || (finalAccountId ? "account" : undefined);
    const finalEntityId = entityId || (finalAccountId ? finalAccountId : undefined);

    try {
      await createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
        entity_type: finalEntityType,
        entity_id: finalEntityId,
        account_id: finalAccountId,
        contact_id: contactId,
      });
      setTitle("");
      setDescription("");
      setPriority("medium");
      setDueDate("");
      setSelectedAccountId(accountId || "");
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create task");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h2 className="text-lg font-semibold">Create Task</h2>
            {entityName && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Task linked to <span className="font-medium text-foreground">{entityName}</span>
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
            <label htmlFor="task-title" className="text-xs font-medium text-muted-foreground">
              Task Title *
            </label>
            <input
              id="task-title"
              type="text"
              required
              placeholder="e.g. Send updated pricing proposal"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor="task-desc" className="text-xs font-medium text-muted-foreground">
              Description
            </label>
            <textarea
              id="task-desc"
              rows={3}
              placeholder="Additional action details or preparation instructions..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1.5 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          {!accountId && (
            <div>
              <label htmlFor="task-account" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                Company / Account (Optional)
              </label>
              <select
                id="task-account"
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="mt-1.5 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-background"
              >
                <option value="none">None (General / Internal Task)</option>
                {accountsData?.items.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="task-priority" className="text-xs font-medium text-muted-foreground">
                Priority
              </label>
              <select
                id="task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="mt-1.5 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-background"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div>
              <label htmlFor="task-duedate" className="text-xs font-medium text-muted-foreground">
                Due Date
              </label>
              <input
                id="task-duedate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1.5 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-background"
              />
            </div>
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
              {loading ? "Creating..." : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
