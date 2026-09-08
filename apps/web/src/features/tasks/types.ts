export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type TaskPriority = "low" | "medium" | "high";

export interface Task {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  completed_at: string | null;
  entity_type: string | null;
  entity_id: string | null;
  account_id: string | null;
  contact_id: string | null;
  assigned_to_id: string | null;
  created_by_id: string | null;
  account_name?: string | null;
  contact_name?: string | null;
  assigned_to_name?: string | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string;
  entity_type?: string;
  entity_id?: string;
  account_id?: string;
  contact_id?: string;
  assigned_to_id?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string | null;
  assigned_to_id?: string | null;
}
