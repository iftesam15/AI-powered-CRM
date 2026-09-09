export interface CrmPipelineStage {
  id: string;
  tenant_id: string;
  pipeline_id: string;
  name: string;
  display_order: number;
  probability: number;
  is_won: boolean;
  is_lost: boolean;
  created_at: string;
  updated_at: string;
}

export interface CrmPipeline {
  id: string;
  tenant_id: string;
  name: string;
  is_default: boolean;
  stages: CrmPipelineStage[];
  created_at: string;
  updated_at: string;
}

export interface PipelineStageCreateInput {
  name: string;
  display_order?: number;
  probability?: number;
  is_won?: boolean;
  is_lost?: boolean;
}

export interface PipelineStageUpdateInput {
  name?: string;
  display_order?: number;
  probability?: number;
  is_won?: boolean;
  is_lost?: boolean;
}

export interface PipelineStageReorderItem {
  id: string;
  display_order: number;
}
