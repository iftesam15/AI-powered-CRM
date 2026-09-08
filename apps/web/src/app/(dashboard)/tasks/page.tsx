"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, ClipboardList, Clock, Filter, Plus, RefreshCw } from "lucide-react";

import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import { fetchTasks, updateTask } from "@/features/tasks/api";
import type { Task, TaskPriority, TaskStatus } from "@/features/tasks/types";

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const data = await fetchTasks({
        status: statusFilter !== "all" ? statusFilter : undefined,
        priority: priorityFilter !== "all" ? priorityFilter : undefined,
        limit: 50,
      });
      setTasks(data.items);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [statusFilter, priorityFilter]);

  async function toggleComplete(task: Task) {
    const newStatus: TaskStatus = task.status === "completed" ? "pending" : "completed";
    try {
      const updated = await updateTask(task.id, { status: newStatus });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            Tasks & Action Items
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manage due dates, action items, assignees, and task completion for team productivity.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            New Task
          </button>
          <button
            onClick={() => loadData()}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium hover:bg-muted"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-card p-3 rounded-lg border">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Status:</span>
            <div className="flex gap-1">
              {["all", "pending", "in_progress", "completed"].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-all ${
                    statusFilter === st
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "hover:bg-muted text-muted-foreground"
                  }`}
                >
                  {st.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 border-l pl-4">
            <span className="text-xs font-medium text-muted-foreground">Priority:</span>
            <div className="flex gap-1">
              {["all", "high", "medium", "low"].map((pr) => (
                <button
                  key={pr}
                  onClick={() => setPriorityFilter(pr)}
                  className={`rounded-md px-2 py-1 text-xs font-medium capitalize transition-all ${
                    priorityFilter === pr
                      ? "bg-secondary text-secondary-foreground font-semibold"
                      : "hover:bg-muted text-muted-foreground"
                  }`}
                >
                  {pr}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{tasks.length}</span> of{" "}
          <span className="font-semibold text-foreground">{total}</span> tasks
        </div>
      </div>

      {/* Task List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg border bg-card p-4 animate-pulse" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <h3 className="mt-3 text-sm font-semibold text-foreground">No tasks found</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Get started by creating a task for your team.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`group flex items-center justify-between gap-4 rounded-xl border p-4 shadow-xs transition-all ${
                task.status === "completed"
                  ? "bg-muted/40 opacity-75"
                  : "bg-card hover:border-primary/50 hover:shadow-md"
              }`}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleComplete(task)}
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  {task.status === "completed" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Circle className="h-5 w-5" />
                  )}
                </button>

                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-semibold ${
                        task.status === "completed" ? "line-through text-muted-foreground" : "text-foreground"
                      }`}
                    >
                      {task.title}
                    </span>

                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        task.priority === "high"
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          : task.priority === "medium"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : "bg-slate-500/10 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {task.priority}
                    </span>
                  </div>

                  {task.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground whitespace-nowrap">
                {task.due_date && (
                  <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Due {new Date(task.due_date).toLocaleDateString()}</span>
                  </div>
                )}
                {task.assigned_to_name && (
                  <span>Assigned: <strong className="text-foreground">{task.assigned_to_name}</strong></span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateTaskModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => loadData()}
      />
    </div>
  );
}
