import type { Activity, CreateActivityInput, TimelineItem } from "./types";

export interface PaginatedActivities {
  items: Activity[];
  total: number;
  limit: number;
  offset: number;
}

export async function fetchActivities(params?: {
  activity_type?: string;
  entity_type?: string;
  entity_id?: string;
  limit?: number;
  offset?: number;
}): Promise<PaginatedActivities> {
  const query = new URLSearchParams();
  if (params?.activity_type) query.set("activity_type", params.activity_type);
  if (params?.entity_type) query.set("entity_type", params.entity_type);
  if (params?.entity_id) query.set("entity_id", params.entity_id);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));

  const url = `/api/crm/activities${query.toString() ? `?${query.toString()}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch activities");
  }
  return res.json();
}

export async function fetchTimeline(entityType: string, entityId: string): Promise<TimelineItem[]> {
  const url = `/api/crm/activities/timeline?entity_type=${encodeURIComponent(
    entityType,
  )}&entity_id=${encodeURIComponent(entityId)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch activity timeline");
  }
  return res.json();
}

export async function createActivity(input: CreateActivityInput): Promise<Activity> {
  const res = await fetch("/api/crm/activities", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to log activity");
  }
  return res.json();
}

export async function deleteActivity(id: string): Promise<void> {
  const res = await fetch(`/api/crm/activities/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error("Failed to delete activity");
  }
}
