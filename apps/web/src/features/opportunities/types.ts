export type OpportunityStatus = "open" | "won" | "lost";

export interface CrmOpportunityStageHistory {
  id: string;
  opportunity_id: string;
  from_stage_id: string | null;
  from_stage_name: string | null;
  to_stage_id: string;
  to_stage_name: string | null;
  changed_by_id: string | null;
  changed_by_name: string | null;
  days_in_stage: number | null;
  created_at: string;
}

export interface CrmOpportunity {
  id: string;
  tenant_id: string;
  name: string;
  amount: string;
  currency: string;
  pipeline_id: string;
  pipeline_name: string | null;
  stage_id: string;
  stage_name: string | null;
  account_id: string | null;
  account_name: string | null;
  primary_contact_id: string | null;
  primary_contact_name: string | null;
  owner_id: string | null;
  owner_name: string | null;
  lead_id: string | null;
  expected_close_date: string | null;
  probability: number;
  weighted_amount: string;
  status: OpportunityStatus | string;
  loss_reason: string | null;
  won_at: string | null;
  lost_at: string | null;
  notes: string | null;
  days_in_current_stage?: number;
  stage_history?: CrmOpportunityStageHistory[];
  created_at: string;
  updated_at: string;
}

export interface OpportunityCreateInput {
  name: string;
  amount?: number | string;
  currency?: string;
  pipeline_id?: string;
  stage_id?: string;
  account_id?: string | null;
  primary_contact_id?: string | null;
  owner_id?: string | null;
  lead_id?: string | null;
  expected_close_date?: string | null;
  probability?: number;
  notes?: string | null;
}

export interface OpportunityUpdateInput {
  name?: string;
  amount?: number | string;
  currency?: string;
  stage_id?: string;
  account_id?: string | null;
  primary_contact_id?: string | null;
  owner_id?: string | null;
  expected_close_date?: string | null;
  probability?: number;
  notes?: string | null;
  loss_reason?: string | null;
}

export interface StageMoveInput {
  stage_id: string;
  loss_reason?: string | null;
}

export interface CloseWonInput {
  notes?: string | null;
}

export interface CloseLostInput {
  loss_reason: string;
  notes?: string | null;
}

export interface PipelineSummaryStage {
  stage_id: string;
  stage_name: string;
  display_order: number;
  probability: number;
  is_won: boolean;
  is_lost: boolean;
  count: number;
  total_amount: string;
  weighted_amount: string;
}

export interface PipelineSummaryResponse {
  total_opportunities: number;
  total_pipeline_value: string;
  weighted_pipeline_value: string;
  won_value: string;
  lost_value: string;
  stages: PipelineSummaryStage[];
}

export interface OpportunityListFilters {
  q?: string;
  pipeline_id?: string;
  stage_id?: string;
  status?: string;
  owner_id?: string;
  account_id?: string;
  sort?: string;
  desc?: boolean;
  limit?: number;
  offset?: number;
}
