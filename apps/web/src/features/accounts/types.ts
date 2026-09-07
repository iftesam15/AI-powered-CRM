export interface CrmAccount {
  id: string;
  tenant_id: string;
  name: string;
  industry: string | null;
  size: string | null;
  website: string | null;
  address: string | null;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccountCreateInput {
  name: string;
  industry?: string | null;
  size?: string | null;
  website?: string | null;
  address?: string | null;
  owner_id?: string | null;
}

export interface AccountUpdateInput {
  name?: string | null;
  industry?: string | null;
  size?: string | null;
  website?: string | null;
  address?: string | null;
  owner_id?: string | null;
}

export interface AccountListFilters {
  q?: string;
  industry?: string;
  owner_id?: string;
  sort?: string;
  desc?: boolean;
  limit?: number;
  offset?: number;
}
