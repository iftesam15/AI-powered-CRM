export type LeadStatus = "new" | "contacted" | "qualified" | "unqualified" | "converted";

export interface CrmLead {
  id: string;
  tenant_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  title: string | null;
  status: LeadStatus | string;
  source: string | null;
  notes: string | null;
  is_converted: boolean;
  converted_at: string | null;
  converted_contact_id: string | null;
  converted_account_id: string | null;
  converted_opportunity_id: string | null;
  converted_contact_name?: string | null;
  converted_account_name?: string | null;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadCreateInput {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  company_name?: string | null;
  title?: string | null;
  status?: string;
  source?: string | null;
  notes?: string | null;
  owner_id?: string | null;
}

export interface LeadUpdateInput {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  company_name?: string | null;
  title?: string | null;
  status?: string | null;
  source?: string | null;
  notes?: string | null;
  owner_id?: string | null;
}

export interface ConvertLeadInput {
  create_account?: boolean;
  account_id?: string | null;
  account_name?: string | null;
  opportunity_name?: string | null;
  opportunity_amount?: number | string | null;
}

export interface ConvertLeadResponse {
  lead: CrmLead;
  contact_id: string;
  account_id: string | null;
  opportunity_id?: string | null;
}

export interface LeadListFilters {
  q?: string;
  status?: string;
  is_converted?: boolean;
  owner_id?: string;
  sort?: string;
  desc?: boolean;
  limit?: number;
  offset?: number;
}
