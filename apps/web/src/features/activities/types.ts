export type ActivityType = "call" | "meeting" | "email" | "note";
export type EntityType = "account" | "contact" | "lead";

export interface Activity {
  id: string;
  tenant_id: string;
  activity_type: ActivityType;
  title: string;
  description: string | null;
  performed_at: string;
  entity_type: EntityType;
  entity_id: string;
  account_id: string | null;
  contact_id: string | null;
  created_by_id: string | null;
  account_name?: string | null;
  contact_name?: string | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimelineItem {
  id: string;
  item_type: "activity" | "task";
  category: string;
  title: string;
  description: string | null;
  timestamp: string;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  entity_type: string | null;
  entity_id: string | null;
  actor_name: string | null;
  raw_id: string;
}

export interface CreateActivityInput {
  activity_type: ActivityType;
  title: string;
  description?: string;
  performed_at?: string;
  entity_type: EntityType;
  entity_id: string;
  account_id?: string;
  contact_id?: string;
}
