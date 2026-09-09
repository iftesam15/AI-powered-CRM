export interface FieldOption {
  value: string;
  label: string;
}

export interface ImportFieldsResponse {
  entity_type: string;
  fields: FieldOption[];
}

export interface ImportPreviewRow {
  values: Record<string, string>;
}

export interface ImportPreviewResponse {
  headers: string[];
  sample_rows: ImportPreviewRow[];
  total_rows: number;
}

export interface ImportRowError {
  row: number;
  field: string;
  message: string;
}

export interface ImportResult {
  entity_type: string;
  total_rows: number;
  created_count: number;
  error_count: number;
  errors: ImportRowError[];
}
