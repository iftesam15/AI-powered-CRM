import type { CreateTaskInput, Task, UpdateTaskInput } from "./types";

export interface PaginatedTasks {
  items: Task[];
  total: number;
  limit: number;
  offset: number;
}

export async function fetchTasks(params?: {
  status?: string;
  priority?: string;
  assigned_to_id?: string;
  entity_type?: string;
  entity_id?: string;
  limit?: number;
  offset?: number;
}): Promise<PaginatedTasks> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.priority) query.set("priority", params.priority);
  if (params?.assigned_to_id) query.set("assigned_to_id", params.assigned_to_id);
  if (params?.entity_type) query.set("entity_type", params.entity_type);
  if (params?.entity_id) query.set("entity_id", params.entity_id);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));

  const url = `/api/crm/tasks${query.toString() ? `?${query.toString()}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch tasks");
  }
  return res.json();
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const res = await fetch("/api/crm/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create task");
  }
  return res.json();
}

export async function updateTask(id: string, input: UpdateTaskInput): Promise<Task> {
  const res = await fetch(`/api/crm/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update task");
  }
  return res.json();
}

export async function deleteTask(id: string): Promise<void> {
  const res = await fetch(`/api/crm/tasks/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error("Failed to delete task");
  }
}
