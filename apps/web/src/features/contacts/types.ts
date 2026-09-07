export interface CrmContact {
  id: string;
  tenant_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  account_id: string | null;
  account_name?: string | null;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactCreateInput {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  account_id?: string | null;
  owner_id?: string | null;
}

export interface ContactUpdateInput {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  account_id?: string | null;
  owner_id?: string | null;
}

export interface ContactListFilters {
  q?: string;
  account_id?: string;
  owner_id?: string;
  sort?: string;
  desc?: boolean;
  limit?: number;
  offset?: number;
}

export interface ContactDuplicateCheckResponse {
  is_duplicate: boolean;
  matching_count: number;
  matching_contacts: CrmContact[];
}
