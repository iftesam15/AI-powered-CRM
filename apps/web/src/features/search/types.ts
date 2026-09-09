export type EntityType = "account" | "contact" | "lead" | "opportunity";

export interface SearchResultItem {
  entity_type: EntityType;
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
  score: number;
}

export interface SearchResponse {
  query: string;
  total: number;
  items: SearchResultItem[];
}
