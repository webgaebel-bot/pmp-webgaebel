export type LeadSource =
  | 'manual'
  | 'facebook'
  | 'instagram'
  | 'x'
  | 'linkedin'
  | 'whatsapp'
  | 'website'
  | 'referral'
  | 'cold_call'
  | 'email_campaign';

export type LeadPriority = 'low' | 'medium' | 'high' | 'urgent';
export type PipelineStage =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'proposal_sent'
  | 'negotiation'
  | 'won'
  | 'lost';

export type ActivityType =
  | 'note'
  | 'call'
  | 'email'
  | 'meeting'
  | 'whatsapp'
  | 'status_change'
  | 'followup'
  | 'document';

export type FollowupType = 'call' | 'email' | 'whatsapp' | 'meeting' | 'demo';
export type OutreachStatus = 'not_contacted' | 'contacted' | 'followup_sent' | 'replied' | 'qualified' | 'closed' | 'lost';
export type OutreachChannel = 'email' | 'phone' | 'whatsapp' | 'linkedin' | 'facebook' | 'instagram' | 'x' | 'website' | 'other';

export const LEAD_SOURCES: LeadSource[] = [
  'manual',
  'facebook',
  'instagram',
  'x',
  'linkedin',
  'whatsapp',
  'website',
  'referral',
  'cold_call',
  'email_campaign',
];

export const LEAD_PRIORITIES: LeadPriority[] = ['low', 'medium', 'high', 'urgent'];

export const PIPELINE_STAGES: PipelineStage[] = [
  'new',
  'contacted',
  'qualified',
  'proposal_sent',
  'negotiation',
  'won',
  'lost',
];

export const FOLLOWUP_TYPES: FollowupType[] = ['call', 'email', 'whatsapp', 'meeting', 'demo'];

export interface LeadContact {
  id: string;
  lead_id: string;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  is_primary: boolean;
  created_at: string;
}

export interface LeadTag {
  id: string;
  lead_id: string;
  tag_name: string;
  color?: string;
}

export interface LeadActivity {
  id: string;
  lead_id: string;
  activity_type: ActivityType;
  description: string;
  duration_minutes?: number;
  outcome?: string;
  created_by?: string;
  created_at: string;
  activity_at?: string;
}

export interface LeadNote {
  id: string;
  lead_id: string;
  content: string;
  created_at: string;
  user_id?: string;
}

export interface LeadFollowup {
  id: string;
  lead_id: string;
  followup_type: FollowupType;
  scheduled_at: string;
  completed: boolean;
  completed_at?: string;
  reminder_sent: boolean;
  notes?: string;
  created_at: string;
  assigned_to?: string;
}

export interface Lead {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  designation?: string;
  website?: string;
  linkedin_url?: string;
  facebook_url?: string;
  instagram_url?: string;
  x_url?: string;
  services_offered?: string;
  status: string;
  pipeline_stage: PipelineStage;
  source?: LeadSource;
  priority: LeadPriority;
  lead_score: number;
  budget?: number;
  expected_close_date?: string;
  outreach_status?: OutreachStatus;
  outreach_channel?: OutreachChannel;
  first_contacted_at?: string;
  last_reachout_at?: string;
  followup_sent_at?: string;
  followup_notes?: string;
  close_value?: number;
  assigned_to?: string;
  assigned_to_name?: string;
  assigned_to_avatar?: string;
  project_id?: string;
  project_name?: string;
  created_by?: string;
  created_by_name?: string;
  created_by_email?: string;
  lost_reason?: string;
  last_contacted_at?: string;
  next_followup_at?: string;
  completed: boolean;
  completed_at?: string;
  converted_at?: string;
  created_at: string;
  updated_at: string;
  notes?: string;
  company_value?: number;
  custom_fields?: Record<string, string>;
  metadata?: Record<string, unknown>;
  lead_activities?: LeadActivity[];
  lead_notes?: LeadNote[];
  lead_followups?: LeadFollowup[];
  lead_tags?: LeadTag[];
  lead_contacts?: LeadContact[];
}

export interface LeadStats {
  total: number;
  new_this_month: number;
  conversion_rate: number;
  avg_score: number;
  by_pipeline_stage: Record<PipelineStage, number>;
  by_source: Record<LeadSource, number>;
  by_priority: Record<LeadPriority, number>;
  monthly_trend: Array<{ month: string; count: number; converted: number }>;
}

export interface LeadFilters {
  search?: string;
  status?: string[];
  pipeline_stage?: PipelineStage[];
  source?: LeadSource[];
  priority?: LeadPriority[];
  assigned_to?: string[];
  designation?: string[];
  services_offered?: string[];
  score_min?: number;
  score_max?: number;
  budget_min?: number;
  budget_max?: number;
  date_from?: string;
  date_to?: string;
  has_followup_due?: boolean;
  overdue_only?: boolean;
  tags?: string[];
  owner_id?: string;
}

export interface LeadListResponse {
  data: Lead[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateLeadPayload {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  designation?: string;
  website?: string;
  linkedin_url?: string;
  facebook_url?: string;
  instagram_url?: string;
  x_url?: string;
  services_offered?: string;
  source?: LeadSource;
  priority?: LeadPriority;
  pipeline_stage?: PipelineStage;
  budget?: number;
  expected_close_date?: string;
  outreach_status?: OutreachStatus;
  outreach_channel?: OutreachChannel;
  first_contacted_at?: string;
  last_reachout_at?: string;
  followup_sent_at?: string;
  followup_notes?: string;
  close_value?: number;
  assigned_to?: string;
  project_id?: string;
  notes?: string;
  lead_score?: number;
  custom_fields?: Record<string, string>;
  metadata?: Record<string, unknown>;
  tags?: string[];
  contacts?: Array<{
    name: string;
    email?: string;
    phone?: string;
    role?: string;
    is_primary?: boolean;
  }>;
}

export interface AddLeadActivityPayload {
  activity_type: ActivityType;
  description: string;
  duration_minutes?: number;
  outcome?: string;
}

export interface ScheduleLeadFollowupPayload {
  followup_type: FollowupType;
  scheduled_at: string;
  notes?: string;
}

export interface FlexibleColumn {
  id: string;
  label: string;
  systemField?: keyof Lead | keyof FlexibleFollowupRecord;
  type?: 'text' | 'date' | 'boolean' | 'status' | 'email' | 'url' | 'phone';
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  width?: number;
}

export interface FlexibleFollowupRecord {
  id: string;
  owner_id: string;
  owner_name?: string;
  owner_email?: string;
  data: Record<string, string>;
  status?: string;
  lead_id?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateFlexibleFollowupPayload {
  data: Record<string, string>;
  lead_id?: string;
  status?: string;
}
