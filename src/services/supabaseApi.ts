import { ApiError } from '@/services/api';
import { getSupabaseClient } from '@/lib/supabase';
import type {
  AddLeadActivityPayload,
  CreateLeadPayload,
  Lead,
  LeadActivity,
  LeadContact,
  LeadFilters,
  LeadFollowup,
  LeadNote,
  LeadPriority,
  LeadSource,
  LeadStats,
  LeadTag,
  PipelineStage,
  ScheduleLeadFollowupPayload,
} from '@/types/leads';

type RestFallback = Record<string, (...args: any[]) => Promise<any>>;

const DEFAULT_PERMISSIONS = [
  { key: 'dashboard.view', name: 'dashboard.view', module: 'dashboard', description: 'Access dashboard shell' },
  { key: 'dashboard.stats.view', name: 'dashboard.stats.view', module: 'dashboard', description: 'View dashboard stats' },
  { key: 'dashboard.project_progress', name: 'dashboard.project_progress', module: 'dashboard', description: 'View project progress widgets' },
  { key: 'dashboard.team_performance', name: 'dashboard.team_performance', module: 'dashboard', description: 'View team performance widgets' },
  { key: 'dashboard.task_charts', name: 'dashboard.task_charts', module: 'dashboard', description: 'View task charts' },
  { key: 'dashboard.activity_logs', name: 'dashboard.activity_logs', module: 'dashboard', description: 'View dashboard activity widgets' },
  { key: 'dashboard.view.total_projects', name: 'dashboard.view.total_projects', module: 'dashboard', description: 'View total projects stat' },
  { key: 'dashboard.view.tasks', name: 'dashboard.view.tasks', module: 'dashboard', description: 'View total tasks stat' },
  { key: 'dashboard.view.overdue', name: 'dashboard.view.overdue', module: 'dashboard', description: 'View overdue tasks stat' },
  { key: 'dashboard.view.team', name: 'dashboard.view.team', module: 'dashboard', description: 'View team members stat' },
  { key: 'dashboard.view.online_users', name: 'dashboard.view.online_users', module: 'dashboard', description: 'View online users stat' },
  { key: 'projects.view', name: 'projects.view', module: 'projects', description: 'View projects' },
  { key: 'projects.view.all', name: 'projects.view.all', module: 'projects', description: 'View all projects' },
  { key: 'projects.create', name: 'projects.create', module: 'projects', description: 'Create projects' },
  { key: 'projects.update', name: 'projects.update', module: 'projects', description: 'Edit projects' },
  { key: 'projects.delete', name: 'projects.delete', module: 'projects', description: 'Delete projects' },
  { key: 'tasks.view', name: 'tasks.view', module: 'tasks', description: 'View tasks' },
  { key: 'tasks.view.all', name: 'tasks.view.all', module: 'tasks', description: 'View all tasks' },
  { key: 'tasks.create', name: 'tasks.create', module: 'tasks', description: 'Create tasks' },
  { key: 'tasks.update', name: 'tasks.update', module: 'tasks', description: 'Edit tasks' },
  { key: 'tasks.delete', name: 'tasks.delete', module: 'tasks', description: 'Delete tasks' },
  { key: 'tasks.assign', name: 'tasks.assign', module: 'tasks', description: 'Assign tasks' },
  { key: 'tasks.update_status', name: 'tasks.update_status', module: 'tasks', description: 'Update task status' },
  { key: 'tasks.update_priority', name: 'tasks.update_priority', module: 'tasks', description: 'Update task priority' },
  { key: 'comments.create', name: 'comments.create', module: 'comments', description: 'Add task comments' },
  { key: 'comments.delete', name: 'comments.delete', module: 'comments', description: 'Delete task comments' },
  { key: 'files.upload', name: 'files.upload', module: 'files', description: 'Upload files' },
  { key: 'files.delete', name: 'files.delete', module: 'files', description: 'Delete files' },
  { key: 'leads.view', name: 'leads.view', module: 'leads', description: 'View leads CRM' },
  { key: 'leads.detail.view', name: 'leads.detail.view', module: 'leads', description: 'View detailed lead CRM data' },
  { key: 'leads.create', name: 'leads.create', module: 'leads', description: 'Create leads' },
  { key: 'leads.update', name: 'leads.update', module: 'leads', description: 'Update leads' },
  { key: 'leads.delete', name: 'leads.delete', module: 'leads', description: 'Delete leads' },
  { key: 'leads.import', name: 'leads.import', module: 'leads', description: 'Import leads' },
  { key: 'users.view', name: 'users.view', module: 'users', description: 'View users' },
  { key: 'users.create', name: 'users.create', module: 'users', description: 'Create users' },
  { key: 'users.update', name: 'users.update', module: 'users', description: 'Edit users' },
  { key: 'users.delete', name: 'users.delete', module: 'users', description: 'Delete users' },
  { key: 'roles.manage', name: 'roles.manage', module: 'roles', description: 'Manage roles' },
  { key: 'permissions.manage', name: 'permissions.manage', module: 'permissions', description: 'Manage permissions' },
  { key: 'reports.view', name: 'reports.view', module: 'reports', description: 'View reports' },
  { key: 'members.view', name: 'members.view', module: 'members', description: 'View project members' },
  { key: 'members.create', name: 'members.create', module: 'members', description: 'Add project members' },
  { key: 'members.update', name: 'members.update', module: 'members', description: 'Update project members' },
  { key: 'members.delete', name: 'members.delete', module: 'members', description: 'Remove project members' },
  { key: 'activity_logs.view', name: 'activity_logs.view', module: 'activity_logs', description: 'View activity logs' },
  { key: 'activity_logs.dashboard', name: 'activity_logs.dashboard', module: 'activity_logs', description: 'View dashboard activity logs' },
];

const sortByCreatedAtDesc = <T extends { created_at?: string | null }>(items: T[]): T[] =>
  [...items].sort((a, b) => {
    const left = a.created_at ? new Date(a.created_at).getTime() : 0;
    const right = b.created_at ? new Date(b.created_at).getTime() : 0;
    return right - left;
  });

const formatError = (error: any, fallbackMessage: string) =>
  new ApiError(error?.message || fallbackMessage, error?.status, error?.code, error?.details);

const ensureArray = <T>(value: T[] | null | undefined): T[] => (Array.isArray(value) ? value : []);

const normalizeStatus = (status?: string | null) => (status || '').toLowerCase();
const isCompletedStatus = (status?: string | null) => ['done', 'completed', 'complete'].includes(normalizeStatus(status));

const monthKey = (value?: string | null) => {
  if (!value) return 'Unknown';
  return new Date(value).toLocaleString('en-US', { month: 'short' });
};

export class SupabaseApiService {
  constructor(private fallback?: RestFallback) {}

  private get client() {
    return getSupabaseClient();
  }

  private unsupported(methodName: string): never {
    throw new ApiError(
      `${methodName} is not migrated to direct Supabase yet. Keep the REST API configured for this module, or add a Supabase implementation.`,
      501,
      'SUPABASE_NOT_IMPLEMENTED'
    );
  }

  private async fallbackOrThrow(methodName: string, ...args: any[]) {
    const handler = this.fallback?.[methodName];
    if (typeof handler === 'function') {
      return handler.apply(this.fallback, args);
    }
    this.unsupported(methodName);
  }

  private async getCurrentProfileOrThrow() {
    const {
      data: { user },
      error: authError,
    } = await this.client.auth.getUser();

    if (authError || !user) {
      throw formatError(authError, 'Unauthorized. Please log in again.');
    }

    const { data, error } = await this.client
      .from('profiles')
      .select('id, name, email, avatar_url, profile_image, status, created_at, last_login_at, role_id')
      .eq('id', user.id)
      .single();

    if (error || !data) {
      throw formatError(error, 'Unable to load your profile.');
    }

    return data;
  }

  private async getPermissionsByRoleId(roleId?: string | null): Promise<string[]> {
    if (!roleId) return [];

    const { data, error } = await this.client
      .from('role_permissions')
      .select('permission:permissions(key)')
      .eq('role_id', roleId);

    if (error) {
      throw formatError(error, 'Unable to load permissions.');
    }

    return ensureArray(data)
      .map((row: any) => row.permission?.key)
      .filter(Boolean);
  }

  private async getRoleById(roleId?: string | null) {
    if (!roleId) return null;

    const { data, error } = await this.client
      .from('roles')
      .select('id, name, description, created_at')
      .eq('id', roleId)
      .single();

    if (error) {
      throw formatError(error, 'Unable to load role.');
    }

    return data;
  }

  private mapUser = (profile: any, role: any = null, permissions: string[] = []) => ({
    id: String(profile.id),
    name: profile.name || 'Unnamed User',
    email: profile.email || '',
    avatar: profile.avatar_url || profile.profile_image || '',
    profile_image: profile.profile_image || profile.avatar_url || '',
    role: role
      ? {
          id: role.id,
          name: role.name,
          description: role.description,
        }
      : null,
    status: profile.status || 'active',
    last_login: profile.last_login_at,
    last_login_at: profile.last_login_at,
    created_at: profile.created_at,
    permissions,
  });

  private async hydrateUser(profile: any) {
    const [role, permissions] = await Promise.all([
      this.getRoleById(profile.role_id),
      this.getPermissionsByRoleId(profile.role_id),
    ]);

    return this.mapUser(profile, role, permissions);
  }

  private mapProject = (row: any) => {
    const members = ensureArray(row.members).map((member: any) => ({
      id: String(member.id),
      user_id: String(member.user_id),
      project_role: member.role,
      role: member.role,
      joined_at: member.joined_at,
      name: member.user?.name,
      email: member.user?.email,
      user: member.user
        ? {
            id: String(member.user.id),
            name: member.user.name,
            email: member.user.email,
            avatar: member.user.avatar_url || member.user.profile_image || '',
            profile_image: member.user.profile_image || member.user.avatar_url || '',
          }
        : undefined,
    }));

    const taskCount = ensureArray(row.tasks).length;
    const completedTasks = ensureArray(row.tasks).filter((task: any) => isCompletedStatus(task.status)).length;
    const progress = taskCount > 0 ? Math.round((completedTasks / taskCount) * 100) : Number(row.progress || 0);

    return {
      id: String(row.id),
      name: row.name,
      description: row.description,
      status: row.status || 'planning',
      priority: row.priority || 'medium',
      progress,
      start_date: row.start_date,
      end_date: row.end_date,
      created_at: row.created_at,
      updated_at: row.updated_at,
      created_by_id: row.created_by,
      created_by_name: row.owner?.name || '',
      owner: row.owner
        ? {
            id: String(row.owner.id),
            name: row.owner.name,
            email: row.owner.email,
            avatar: row.owner.avatar_url || row.owner.profile_image || '',
            profile_image: row.owner.profile_image || row.owner.avatar_url || '',
          }
        : undefined,
      members,
      member_count: members.length,
      task_count: taskCount,
      completed_tasks: completedTasks,
    };
  };

  private mapTask = (row: any) => ({
    id: String(row.id),
    title: row.title,
    description: row.description,
    status: row.status || 'todo',
    priority: row.priority || 'medium',
    project_id: row.project_id ? String(row.project_id) : undefined,
    project_name: row.project?.name || '',
    project: row.project
      ? {
          id: String(row.project.id),
          name: row.project.name,
        }
      : undefined,
    assigned_to: row.assignee_id ? String(row.assignee_id) : undefined,
    assigned_user: row.assignee?.name || '',
    assignee: row.assignee
      ? {
          id: String(row.assignee.id),
          name: row.assignee.name,
          email: row.assignee.email,
          avatar: row.assignee.avatar_url || row.assignee.profile_image || '',
          profile_image: row.assignee.profile_image || row.assignee.avatar_url || '',
        }
      : undefined,
    reporter: row.reporter
      ? {
          id: String(row.reporter.id),
          name: row.reporter.name,
          email: row.reporter.email,
          avatar: row.reporter.avatar_url || row.reporter.profile_image || '',
          profile_image: row.reporter.profile_image || row.reporter.avatar_url || '',
        }
      : undefined,
    due_date: row.due_date,
    estimated_hours: row.estimated_hours,
    actual_hours: row.actual_hours,
    comments_count: Number(row.comments_count || 0),
    attachments_count: Number(row.attachments_count || 0),
    created_at: row.created_at,
    updated_at: row.updated_at,
  });

  private async logActivity(action: string, entityType: string, entityId: string, entityName: string) {
    try {
      const profile = await this.getCurrentProfileOrThrow();
      await this.client.from('activity_logs').insert({
        user_id: profile.id,
        action,
        entity_type: entityType,
        entity_id: entityId,
        entity_name: entityName,
      });
      await this.client.from('notifications').insert({
        user_id: null,
        title: `${entityType} ${action.toLowerCase()}`,
        message: `${profile.name || profile.email || 'A user'} ${action.toLowerCase()} ${entityName || entityType}.`,
        type: action.toLowerCase(),
        entity_type: entityType,
        entity_id: entityId,
      });
    } catch (error) {
      console.warn('Activity log insert skipped:', error);
    }
  }

  private async getCurrentUserId(): Promise<string> {
    const profile = await this.getCurrentProfileOrThrow();
    return String(profile.id);
  }

  private buildMailPreview(body?: string | null) {
    const text = String(body || '').trim();
    return text.length > 120 ? `${text.slice(0, 120)}...` : text;
  }

  private sanitizeFileName(name: string) {
    return String(name || 'file').replace(/[^\w.\-]+/g, '_').replace(/^_+/, '') || 'file';
  }

  private async uploadToStorage(file: File, folder: string) {
    const safeName = this.sanitizeFileName(file.name);
    const path = `${folder}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
    const { error } = await this.client.storage.from('files').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });

    if (error) {
      throw formatError(error, 'Failed to upload file. Make sure a public Supabase Storage bucket named "files" exists.');
    }

    const { data } = this.client.storage.from('files').getPublicUrl(path);
    return {
      path,
      url: data.publicUrl,
      name: file.name,
      size: file.size,
      type: file.type,
    };
  }

  private mapAttachment = (attachment: any) => ({
    id: attachment?.id,
    original_name: attachment?.original_name || attachment?.file_name || 'attachment',
    file_name: attachment?.file_name || '',
    file_path: attachment?.file_path || '',
    url: attachment?.file_url || attachment?.file_path || '',
    mime_type: attachment?.mime_type || '',
    file_size: attachment?.file_size || 0,
  });

  private mapFileRecord = (file: any) => ({
    id: String(file.id),
    related_id: file.related_id ? String(file.related_id) : undefined,
    related_type: file.related_type,
    url: file.file_url || file.file_path || '',
    file_url: file.file_url || file.file_path || '',
    name: file.file_name || 'File',
    file_name: file.file_name || 'File',
    path: file.file_path || '',
    file_path: file.file_path || '',
    size: Number(file.file_size || 0),
    file_size: Number(file.file_size || 0),
    type: file.file_type || '',
    file_type: file.file_type || '',
    created_at: file.created_at || file.uploaded_at,
    uploaded_at: file.uploaded_at || file.created_at,
  });

  private mapMailRow(mail: any, recipientMeta?: any) {
    const attachments = ensureArray(mail?.attachments).map(this.mapAttachment);
    return {
      id: String(mail?.id),
      thread_id: mail?.thread_id ? String(mail.thread_id) : null,
      subject: mail?.subject || 'No Subject',
      body: mail?.body || '',
      preview: this.buildMailPreview(mail?.body),
      created_at: mail?.created_at,
      sender_id: mail?.sender_id ? String(mail.sender_id) : undefined,
      sender_name: mail?.sender?.name || '',
      sender_email: mail?.sender?.email || '',
      recipients: ensureArray(mail?.recipients)
        .map((entry: any) => entry?.recipient?.name || entry?.recipient?.email || '')
        .filter(Boolean)
        .join(', '),
      is_read: recipientMeta?.is_read ?? true,
      is_deleted: recipientMeta?.is_deleted ?? false,
      sender_deleted: mail?.sender_deleted ? 1 : 0,
      attachments_count: attachments.length,
      has_attachments: attachments.length > 0,
      attachments,
      replies_count: Math.max(0, Number(mail?.replies_count || 0)),
      replies: ensureArray(mail?.replies).map((reply: any) => ({
        id: Number(reply.id),
        body: reply.body || '',
        created_at: reply.created_at,
        sender_id: Number(reply.sender_id || 0),
        sender_name: reply.sender?.name || '',
        sender_email: reply.sender?.email || '',
      })),
    };
  }

  private readonly leadStageMap: Record<string, PipelineStage> = {
    inbox: 'new',
    discovery: 'contacted',
    qualified: 'qualified',
    proposal: 'proposal_sent',
    proposal_sent: 'proposal_sent',
    negotiation: 'negotiation',
    won: 'won',
    converted: 'won',
    lost: 'lost',
    new: 'new',
    contacted: 'contacted',
  };

  private normalizeLeadStage(stage?: string | null): PipelineStage {
    return this.leadStageMap[String(stage || '').toLowerCase()] || 'new';
  }

  private normalizeLeadSource(source?: string | null): LeadSource {
    const normalized = String(source || 'manual').toLowerCase();
    const aliases: Record<string, LeadSource> = {
      social: 'instagram',
      twitter: 'x',
      other: 'manual',
    };
    const resolved = aliases[normalized] || normalized;
    return (
      ['manual', 'facebook', 'instagram', 'x', 'linkedin', 'whatsapp', 'website', 'referral', 'cold_call', 'email_campaign'].includes(resolved)
        ? (resolved as LeadSource)
        : 'manual'
    );
  }

  private normalizeLeadPriority(priority?: string | null): LeadPriority {
    const normalized = String(priority || 'medium').toLowerCase();
    return ['low', 'medium', 'high', 'urgent'].includes(normalized)
      ? (normalized as LeadPriority)
      : 'medium';
  }

  private statusFromPipeline(stage?: string | null) {
    const pipeline = this.normalizeLeadStage(stage);
    if (pipeline === 'won') return 'converted';
    if (pipeline === 'proposal_sent') return 'proposal';
    if (pipeline === 'new') return 'new';
    return pipeline;
  }

  private mapLeadTagLinks(tagLinks: any[]): LeadTag[] {
    return ensureArray(tagLinks).map((row: any) => ({
      id: String(row.tag?.id || row.tag_id || row.id),
      lead_id: String(row.lead_id),
      tag_name: String(row.tag?.name || row.tag_name || ''),
      color: row.tag?.color || '#64748b',
    }));
  }

  private mapLeadNotes(notes: any[]): LeadNote[] {
    return ensureArray(notes).map((note: any) => ({
      id: String(note.id),
      lead_id: String(note.lead_id),
      content: String(note.content || note.note || ''),
      created_at: String(note.created_at),
      user_id: note.user_id ? String(note.user_id) : undefined,
    }));
  }

  private mapLeadActivities(activities: any[]): LeadActivity[] {
    return ensureArray(activities).map((activity: any) => ({
      id: String(activity.id),
      lead_id: String(activity.lead_id),
      activity_type: (activity.activity_type || 'note') as LeadActivity['activity_type'],
      description: String(activity.description || activity.summary || ''),
      duration_minutes: activity.duration_minutes ? Number(activity.duration_minutes) : undefined,
      outcome: activity.outcome || undefined,
      created_by: activity.created_by ? String(activity.created_by) : activity.user_id ? String(activity.user_id) : undefined,
      created_at: String(activity.created_at),
      activity_at: activity.activity_at || undefined,
    }));
  }

  private mapLeadFollowups(followups: any[]): LeadFollowup[] {
    return ensureArray(followups).map((followup: any) => ({
      id: String(followup.id),
      lead_id: String(followup.lead_id),
      followup_type: (followup.followup_type || 'call') as LeadFollowup['followup_type'],
      scheduled_at: String(followup.scheduled_at || followup.due_at || followup.created_at),
      completed:
        typeof followup.completed === 'boolean'
          ? followup.completed
          : String(followup.status || '').toLowerCase() === 'done',
      completed_at: followup.completed_at || undefined,
      reminder_sent: Boolean(followup.reminder_sent),
      notes: followup.notes || followup.description || undefined,
      created_at: String(followup.created_at),
      assigned_to: followup.assigned_to ? String(followup.assigned_to) : undefined,
    }));
  }

  private mapLeadContacts(contacts: any[]): LeadContact[] {
    return ensureArray(contacts).map((contact: any) => ({
      id: String(contact.id),
      lead_id: String(contact.lead_id),
      name: String(contact.name),
      email: contact.email || undefined,
      phone: contact.phone || undefined,
      role: contact.role || undefined,
      is_primary: Boolean(contact.is_primary),
      created_at: String(contact.created_at),
    }));
  }

  private mapLeadRecord(row: any): Lead {
    const followups = this.mapLeadFollowups(row.lead_followups);
    const nextFollowup =
      followups
        .filter((followup) => !followup.completed)
        .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0]?.scheduled_at ||
      row.next_followup_at ||
      row.next_follow_up_at ||
      undefined;

    return {
      id: String(row.id),
      name: String(row.name),
      email: row.email || undefined,
        phone: row.phone || undefined,
        company: row.company || undefined,
        designation: row.designation || row.job_title || undefined,
        website: row.website || undefined,
        linkedin_url: row.linkedin_url || undefined,
        facebook_url: row.facebook_url || undefined,
        instagram_url: row.instagram_url || undefined,
        x_url: row.x_url || undefined,
        services_offered: row.services_offered || undefined,
        status: String(row.status || 'new'),
      pipeline_stage: this.normalizeLeadStage(row.pipeline_stage || row.status),
      source: this.normalizeLeadSource(row.source),
      priority: this.normalizeLeadPriority(row.priority),
        lead_score: Number(row.lead_score ?? row.score ?? 0),
        budget: row.budget != null ? Number(row.budget) : row.value != null ? Number(row.value) : undefined,
        expected_close_date: row.expected_close_date || undefined,
        outreach_status: row.outreach_status || 'not_contacted',
        outreach_channel: row.outreach_channel || undefined,
        first_contacted_at: row.first_contacted_at || undefined,
        last_reachout_at: row.last_reachout_at || row.last_contacted_at || row.last_contact_at || undefined,
        followup_sent_at: row.followup_sent_at || undefined,
        followup_notes: row.followup_notes || undefined,
        close_value: row.close_value != null ? Number(row.close_value) : undefined,
        assigned_to: row.assigned_to ? String(row.assigned_to) : undefined,
      assigned_to_name: row.assignee?.name || undefined,
      assigned_to_avatar: row.assignee?.avatar_url || row.assignee?.profile_image || undefined,
      lost_reason: row.lost_reason || undefined,
      last_contacted_at: row.last_contacted_at || row.last_contact_at || undefined,
      next_followup_at: nextFollowup,
      completed: Boolean(row.completed),
      completed_at: row.completed_at || undefined,
      converted_at: row.converted_at || undefined,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      notes: row.notes || undefined,
      lead_activities: this.mapLeadActivities(row.lead_activities),
      lead_notes: this.mapLeadNotes(row.lead_notes),
      lead_followups: followups,
      lead_tags: this.mapLeadTagLinks(row.lead_tag_links),
      lead_contacts: this.mapLeadContacts(row.lead_contacts),
    };
  }

  private getLeadSelectClause() {
    return `
      *,
      assignee:profiles!leads_assigned_to_fkey(id, name, email, avatar_url, profile_image),
      lead_activities(id, lead_id, activity_type, summary, description, duration_minutes, outcome, created_by, user_id, created_at, activity_at),
      lead_notes(id, lead_id, note, content, created_at, user_id),
      lead_followups(id, lead_id, followup_type, scheduled_at, due_at, completed, completed_at, reminder_sent, notes, description, status, created_at, assigned_to),
      lead_contacts(id, lead_id, name, email, phone, is_primary, role, created_at),
      lead_tag_links(lead_id, tag_id, tag:lead_tags(id, name, color))
    `;
  }

  private async resolveRecipientIds(
    recipients: Array<string | number | null | undefined>,
    currentUserId: string
  ): Promise<string[]> {
    const cleaned = recipients.map((value) => String(value || '').trim()).filter(Boolean);
    if (!cleaned.length) return [];

    const explicitIds = cleaned.filter((value) => /^[0-9a-f-]{36}$/i.test(value));
    const emails = cleaned.filter((value) => value.includes('@')).map((value) => value.toLowerCase());

    let profileIdsFromEmails: string[] = [];
    if (emails.length) {
      const { data, error } = await this.client
        .from('profiles')
        .select('id, email')
        .in('email', emails);

      if (error) {
        throw formatError(error, 'Unable to resolve mail recipients.');
      }

      profileIdsFromEmails = ensureArray(data).map((profile: any) => String(profile.id));
    }

    return [...new Set([...explicitIds, ...profileIdsFromEmails])].filter((id) => id !== currentUserId);
  }

  async get<T = any>(endpoint: string): Promise<T> {
    if (endpoint === '/leads') {
      return (await this.getLeads()) as T;
    }
    if (endpoint === '/finance/clients') {
      return (await this.getFinanceClients()) as T;
    }
    if (endpoint === '/finance/expenses') {
      return (await this.getFinanceExpenses()) as T;
    }
    if (endpoint === '/finance/payments') {
      return (await this.getFinancePayments()) as T;
    }
    if (endpoint === '/finance/founders') {
      return (await this.getFinanceFounders()) as T;
    }
    if (endpoint === '/finance/founders/equity-total') {
      return (await this.getFoundersEquityTotal()) as T;
    }
    if (endpoint === '/finance/settings') {
      return (await this.getFinanceSettings()) as T;
    }
    if (endpoint.startsWith('/finance/stats')) {
      const url = new URL(`http://local${endpoint}`);
      return (await this.getFinanceStats(url.searchParams.get('range') || 'month')) as T;
    }
    if (endpoint.startsWith('/finance/chart')) {
      const url = new URL(`http://local${endpoint}`);
      return (await this.getFinanceChart(url.searchParams.get('range') || 'month')) as T;
    }
    if (endpoint === '/time-logs') {
      return (await this.getTimeLogs()) as T;
    }
    if (endpoint === '/time-logs/stats') {
      return (await this.getTimeLogStats()) as T;
    }
    return this.fallbackOrThrow('get', endpoint);
  }

  async post<T = any>(endpoint: string, data?: any): Promise<T> {
    if (endpoint === '/leads') {
      return (await this.createLead(data)) as T;
    }
    if (endpoint === '/finance/clients') {
      return (await this.createFinanceClient(data)) as T;
    }
    if (endpoint === '/finance/expenses') {
      return (await this.createFinanceExpense(data)) as T;
    }
    if (endpoint === '/finance/payments') {
      return (await this.createFinancePayment(data)) as T;
    }
    if (endpoint === '/finance/founders') {
      return (await this.createFinanceFounder(data)) as T;
    }
    if (endpoint === '/finance/settings') {
      return (await this.saveFinanceSettings(data)) as T;
    }
    return this.fallbackOrThrow('post', endpoint, data);
  }

  async put<T = any>(endpoint: string, data?: any): Promise<T> {
    const founderUpdateMatch = endpoint.match(/^\/finance\/founders\/(.+)$/);
    if (founderUpdateMatch) {
      return (await this.updateFinanceFounder(founderUpdateMatch[1], data)) as T;
    }
    return this.fallbackOrThrow('put', endpoint, data);
  }

  async delete<T = any>(endpoint: string): Promise<T> {
    const leadDeleteMatch = endpoint.match(/^\/leads\/(.+)$/);
    if (leadDeleteMatch) {
      return (await this.deleteLead(leadDeleteMatch[1])) as T;
    }
    const clientDeleteMatch = endpoint.match(/^\/finance\/clients\/(.+)$/);
    if (clientDeleteMatch) {
      return (await this.deleteFinanceClient(clientDeleteMatch[1])) as T;
    }
    const expenseDeleteMatch = endpoint.match(/^\/finance\/expenses\/(.+)$/);
    if (expenseDeleteMatch) {
      return (await this.deleteFinanceExpense(expenseDeleteMatch[1])) as T;
    }
    const paymentDeleteMatch = endpoint.match(/^\/finance\/payments\/(.+)$/);
    if (paymentDeleteMatch) {
      return (await this.deleteFinancePayment(paymentDeleteMatch[1])) as T;
    }
    const founderDeleteMatch = endpoint.match(/^\/finance\/founders\/(.+)$/);
    if (founderDeleteMatch) {
      return (await this.deleteFinanceFounder(founderDeleteMatch[1])) as T;
    }
    const timeLogDeleteMatch = endpoint.match(/^\/time-logs\/(.+)$/);
    if (timeLogDeleteMatch) {
      return (await this.deleteTimeLog(timeLogDeleteMatch[1])) as T;
    }
    return this.fallbackOrThrow('delete', endpoint);
  }

  async login(email: string, password: string) {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user) {
      throw formatError(error, 'Invalid email or password.');
    }

    await this.client
      .from('profiles')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', data.user.id);

    const user = await this.getCurrentUser();

    return {
      success: true,
      token: data.session.access_token,
      user: user.data,
      data: {
        token: data.session.access_token,
        user: user.data,
      },
    };
  }

  async logout() {
    const { error } = await this.client.auth.signOut();
    if (error) {
      throw formatError(error, 'Failed to log out.');
    }
    return { success: true };
  }

  async getCurrentUser() {
    const profile = await this.getCurrentProfileOrThrow();
    const user = await this.hydrateUser(profile);
    return { success: true, data: user };
  }

  async getDashboard() {
    const [projectsRes, tasksRes, usersRes] = await Promise.all([
      this.client.from('projects').select('id, status'),
      this.client.from('tasks').select('id, status, due_date'),
      this.client.from('profiles').select('id, status'),
    ]);

    if (projectsRes.error) throw formatError(projectsRes.error, 'Unable to load project stats.');
    if (tasksRes.error) throw formatError(tasksRes.error, 'Unable to load task stats.');
    if (usersRes.error) throw formatError(usersRes.error, 'Unable to load team stats.');

    const now = new Date();
    const tasks = ensureArray(tasksRes.data);
    const overdueTasks = tasks.filter(
      (task: any) =>
        task.due_date &&
        new Date(task.due_date) < now &&
        normalizeStatus(task.status) !== 'done'
    ).length;

    return {
      success: true,
      data: {
        projects: {
          total: ensureArray(projectsRes.data).length,
          active: String(
            ensureArray(projectsRes.data).filter((project: any) =>
              ['active', 'in_progress', 'planning', 'on_hold'].includes(normalizeStatus(project.status))
            ).length
          ),
        },
        tasks: {
          total: tasks.length,
        },
        overdueTasks,
        teamMembers: {
          total: ensureArray(usersRes.data).length,
          online: String(ensureArray(usersRes.data).filter((user: any) => normalizeStatus(user.status) === 'active').length),
        },
      },
    };
  }

  async getProjectProgressReport() {
    const { data, error } = await this.client
      .from('projects')
      .select('id, name, status, tasks(id, status)');

    if (error) throw formatError(error, 'Unable to load project progress.');

    return {
      success: true,
      data: ensureArray(data).map((project: any) => {
        const totalTasks = ensureArray(project.tasks).length;
        const completedTasks = ensureArray(project.tasks).filter((task: any) => normalizeStatus(task.status) === 'done').length;

        return {
          id: String(project.id),
          name: project.name,
          status: project.status,
          total_tasks: totalTasks,
          completed_tasks: completedTasks,
          progress: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
        };
      }),
    };
  }

  async getTeamPerformanceReport() {
    const [usersRes, tasksRes] = await Promise.all([
      this.client.from('profiles').select('id, name, email, avatar_url, profile_image'),
      this.client.from('tasks').select('id, assignee_id, status'),
    ]);

    if (usersRes.error) throw formatError(usersRes.error, 'Unable to load users.');
    if (tasksRes.error) throw formatError(tasksRes.error, 'Unable to load tasks.');

    const tasks = ensureArray(tasksRes.data);
    const data = ensureArray(usersRes.data).map((user: any) => {
      const assigned = tasks.filter((task: any) => task.assignee_id === user.id);
      const completed = assigned.filter((task: any) => normalizeStatus(task.status) === 'done');
      const completionRate = assigned.length > 0 ? Math.round((completed.length / assigned.length) * 100) : 0;

      return {
        id: String(user.id),
        name: user.name,
        user_avatar: user.avatar_url || user.profile_image || '',
        total_tasks: assigned.length,
        completed_tasks: completed.length,
        completion_rate: completionRate,
      };
    });

    return { success: true, data };
  }

  async getTaskDistributionReport() {
    const { data, error } = await this.client.from('tasks').select('status');
    if (error) throw formatError(error, 'Unable to load task distribution.');

    const grouped = ensureArray(data).reduce((acc: Record<string, number>, task: any) => {
      const status = task.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    return {
      success: true,
      data: Object.entries(grouped).map(([status, count]) => ({ status, count })),
    };
  }

  async getTaskActivityReport() {
    const { data, error } = await this.client.from('tasks').select('created_at, completed_at, status');
    if (error) throw formatError(error, 'Unable to load task activity.');

    const grouped: Record<string, { month: string; created: number; completed: number }> = {};

    for (const task of ensureArray(data)) {
      const createdMonth = monthKey(task.created_at);
      grouped[createdMonth] = grouped[createdMonth] || { month: createdMonth, created: 0, completed: 0 };
      grouped[createdMonth].created += 1;

      if (normalizeStatus(task.status) === 'done' && task.completed_at) {
        const completedMonth = monthKey(task.completed_at);
        grouped[completedMonth] = grouped[completedMonth] || { month: completedMonth, created: 0, completed: 0 };
        grouped[completedMonth].completed += 1;
      }
    }

    return {
      success: true,
      data: Object.values(grouped),
    };
  }

  async getProjects() {
    const { data, error } = await this.client
      .from('projects')
      .select(`
        id,
        name,
        description,
        status,
        priority,
        progress,
        start_date,
        end_date,
        created_at,
        updated_at,
        created_by,
        owner:profiles!projects_created_by_fkey(id, name, email, avatar_url, profile_image),
        members:project_members(id, user_id, role, joined_at, user:profiles!project_members_user_id_fkey(id, name, email, avatar_url, profile_image)),
        tasks(id, status)
      `)
      .order('created_at', { ascending: false });

    if (error) throw formatError(error, 'Unable to load projects.');

    return {
      success: true,
      data: ensureArray(data).map(this.mapProject),
    };
  }

  async getProject(id: string) {
    const { data, error } = await this.client
      .from('projects')
      .select(`
        id,
        name,
        description,
        status,
        priority,
        progress,
        start_date,
        end_date,
        created_at,
        updated_at,
        created_by,
        owner:profiles!projects_created_by_fkey(id, name, email, avatar_url, profile_image),
        members:project_members(id, user_id, role, joined_at, user:profiles!project_members_user_id_fkey(id, name, email, avatar_url, profile_image)),
        tasks(id, status)
      `)
      .eq('id', id)
      .single();

    if (error || !data) throw formatError(error, 'Project not found.');

    return { success: true, data: this.mapProject(data) };
  }

  async createProject(payload: any) {
    const currentUser = await this.getCurrentProfileOrThrow();
    const insertPayload = {
      name: payload.name,
      description: payload.description || null,
      priority: payload.priority || 'medium',
      status: payload.status || 'planning',
      start_date: payload.start_date || null,
      end_date: payload.end_date || null,
      created_by: currentUser.id,
    };

    const { data, error } = await this.client.from('projects').insert(insertPayload).select().single();
    if (error || !data) throw formatError(error, 'Failed to create project.');

    await this.client.from('project_members').insert({
      project_id: data.id,
      user_id: currentUser.id,
      role: 'owner',
    });

    await this.logActivity('CREATE', 'project', String(data.id), data.name);

    return { success: true, message: 'Project created successfully.', data };
  }

  async updateProject(id: string, payload: any) {
    const { error } = await this.client
      .from('projects')
      .update({
        name: payload.name,
        description: payload.description,
        priority: payload.priority,
        status: payload.status,
        start_date: payload.start_date || null,
        end_date: payload.end_date || null,
        progress: payload.progress,
      })
      .eq('id', id);

    if (error) throw formatError(error, 'Failed to update project.');

    await this.logActivity('UPDATE', 'project', id, payload.name || id);

    return { success: true, message: 'Project updated successfully.' };
  }

  async deleteProject(id: string) {
    const project = await this.getProject(id);
    const { error } = await this.client.from('projects').delete().eq('id', id);
    if (error) throw formatError(error, 'Failed to delete project.');

    await this.logActivity('DELETE', 'project', id, project.data?.name || id);

    return { success: true, message: 'Project deleted successfully.' };
  }

  async getUserProjects(userId: string) {
    const { data, error } = await this.client
      .from('project_members')
      .select('project:projects(*)')
      .eq('user_id', userId);

    if (error) throw formatError(error, 'Unable to load user projects.');

    return { success: true, data: ensureArray(data).map((row: any) => row.project).filter(Boolean) };
  }

  async getProjectMembers(projectId: string) {
    const { data, error } = await this.client
      .from('project_members')
      .select('id, user_id, role, joined_at, user:profiles!project_members_user_id_fkey(id, name, email, avatar_url, profile_image)')
      .eq('project_id', projectId)
      .order('joined_at', { ascending: true });

    if (error) throw formatError(error, 'Unable to load project members.');

    return {
      success: true,
      data: ensureArray(data).map((member: any) => ({
        id: String(member.id),
        user_id: String(member.user_id),
        project_role: member.role,
        role: member.role,
        joined_at: member.joined_at,
        name: member.user?.name,
        email: member.user?.email,
        user: member.user
          ? {
              id: String(member.user.id),
              name: member.user.name,
              email: member.user.email,
              avatar: member.user.avatar_url || member.user.profile_image || '',
              profile_image: member.user.profile_image || member.user.avatar_url || '',
            }
          : undefined,
      })),
    };
  }

  async getMinimalProjects() {
    const { data, error } = await this.client
      .from('projects')
      .select('id, name')
      .order('name', { ascending: true });

    if (error) throw formatError(error, 'Unable to load projects.');

    return { success: true, data: ensureArray(data) };
  }

  async addProjectMember(projectId: string, userId: string, role: string) {
    const { data, error } = await this.client
      .from('project_members')
      .insert({
        project_id: projectId,
        user_id: userId,
        role: role || 'member',
      })
      .select()
      .single();

    if (error) throw formatError(error, 'Failed to add project member.');

    await this.logActivity('ASSIGN', 'project', projectId, `member:${userId}`);

    return { success: true, data };
  }

  async removeProjectMember(projectId: string, userId: string) {
    const { error } = await this.client
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId);

    if (error) throw formatError(error, 'Failed to remove project member.');

    await this.logActivity('DELETE', 'project', projectId, `member:${userId}`);

    return { success: true };
  }

  async getTasks(params?: Record<string, string>) {
    let query = this.client
      .from('tasks')
      .select(`
        id,
        title,
        description,
        status,
        priority,
        project_id,
        assignee_id,
        reporter_id,
        due_date,
        estimated_hours,
        actual_hours,
        comments_count,
        attachments_count,
        created_at,
        updated_at,
        completed_at,
        project:projects(id, name),
        assignee:profiles!tasks_assignee_id_fkey(id, name, email, avatar_url, profile_image),
        reporter:profiles!tasks_reporter_id_fkey(id, name, email, avatar_url, profile_image)
      `)
      .order('created_at', { ascending: false });

    if (params?.project_id) {
      query = query.eq('project_id', params.project_id);
    }

    const { data, error } = await query;
    if (error) throw formatError(error, 'Unable to load tasks.');

    return { success: true, data: ensureArray(data).map(this.mapTask) };
  }

  async getMyTasks() {
    const currentUser = await this.getCurrentProfileOrThrow();
    const { data, error } = await this.client
      .from('tasks')
      .select(`
        id,
        title,
        description,
        status,
        priority,
        project_id,
        assignee_id,
        reporter_id,
        due_date,
        estimated_hours,
        actual_hours,
        comments_count,
        attachments_count,
        created_at,
        updated_at,
        completed_at,
        project:projects(id, name),
        assignee:profiles!tasks_assignee_id_fkey(id, name, email, avatar_url, profile_image),
        reporter:profiles!tasks_reporter_id_fkey(id, name, email, avatar_url, profile_image)
      `)
      .eq('assignee_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (error) throw formatError(error, 'Unable to load your tasks.');

    return { success: true, data: ensureArray(data).map(this.mapTask) };
  }

  async getTask(id: string) {
    const { data, error } = await this.client
      .from('tasks')
      .select(`
        id,
        title,
        description,
        status,
        priority,
        project_id,
        assignee_id,
        reporter_id,
        due_date,
        estimated_hours,
        actual_hours,
        comments_count,
        attachments_count,
        created_at,
        updated_at,
        completed_at,
        project:projects(id, name),
        assignee:profiles!tasks_assignee_id_fkey(id, name, email, avatar_url, profile_image),
        reporter:profiles!tasks_reporter_id_fkey(id, name, email, avatar_url, profile_image)
      `)
      .eq('id', id)
      .single();

    if (error || !data) throw formatError(error, 'Task not found.');

    return { success: true, data: this.mapTask(data) };
  }

  async getTasksByProjectId(projectId: string) {
    return this.getTasks({ project_id: projectId });
  }

  async createTask(payload: any) {
    const currentUser = await this.getCurrentProfileOrThrow();
    const insertPayload: any = {
      title: payload.title,
      description: payload.description || null,
      priority: payload.priority || 'medium',
      status: payload.status || 'todo',
      project_id: payload.project_id,
      due_date: payload.due_date || null,
      reporter_id: currentUser.id,
      assignee_id: payload.assignee_id || null,
    };

    const { data, error } = await this.client.from('tasks').insert(insertPayload).select().single();
    if (error || !data) throw formatError(error, 'Failed to create task.');

    await this.logActivity('CREATE', 'task', String(data.id), data.title);

    return { success: true, message: 'Task created successfully.', data };
  }

  async updateTask(id: string, payload: any) {
    const updatePayload: any = {
      title: payload.title,
      description: payload.description,
      priority: payload.priority,
      status: payload.status,
      project_id: payload.project_id,
      due_date: payload.due_date || null,
      assignee_id: payload.assignee_id ?? payload.assigned_to ?? undefined,
      estimated_hours: payload.estimated_hours,
      actual_hours: payload.actual_hours,
    };

    if (normalizeStatus(payload.status) === 'done') {
      updatePayload.completed_at = new Date().toISOString();
    }

    const { error } = await this.client.from('tasks').update(updatePayload).eq('id', id);
    if (error) throw formatError(error, 'Failed to update task.');

    await this.logActivity('UPDATE', 'task', id, payload.title || id);

    return { success: true, message: 'Task updated successfully.' };
  }

  async deleteTask(id: string) {
    const task = await this.getTask(id);
    const { error } = await this.client.from('tasks').delete().eq('id', id);
    if (error) throw formatError(error, 'Failed to delete task.');

    await this.logActivity('DELETE', 'task', id, task.data?.title || id);

    return { success: true, message: 'Task deleted successfully.' };
  }

  async updateTaskStatus(id: string, status: string) {
    const updatePayload: any = { status };
    updatePayload.completed_at = normalizeStatus(status) === 'done' ? new Date().toISOString() : null;

    const { error } = await this.client.from('tasks').update(updatePayload).eq('id', id);
    if (error) throw formatError(error, 'Failed to update task status.');

    await this.logActivity('UPDATE', 'task', id, `status:${status}`);

    return { success: true };
  }

  async updateTaskPriority(id: string, priority: string) {
    const { error } = await this.client.from('tasks').update({ priority }).eq('id', id);
    if (error) throw formatError(error, 'Failed to update task priority.');

    await this.logActivity('UPDATE', 'task', id, `priority:${priority}`);

    return { success: true };
  }

  async getUserTasks(userId: string) {
    const { data, error } = await this.client
      .from('tasks')
      .select(`
        id,
        title,
        description,
        status,
        priority,
        project_id,
        assignee_id,
        reporter_id,
        due_date,
        estimated_hours,
        actual_hours,
        comments_count,
        attachments_count,
        created_at,
        updated_at,
        completed_at,
        project:projects(id, name),
        assignee:profiles!tasks_assignee_id_fkey(id, name, email, avatar_url, profile_image),
        reporter:profiles!tasks_reporter_id_fkey(id, name, email, avatar_url, profile_image)
      `)
      .eq('assignee_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw formatError(error, 'Unable to load user tasks.');

    return { success: true, data: ensureArray(data).map(this.mapTask) };
  }

  async assignTask(taskId: string, userId: string) {
    const { error } = await this.client.from('tasks').update({ assignee_id: userId }).eq('id', taskId);
    if (error) throw formatError(error, 'Failed to assign task.');

    await this.logActivity('ASSIGN', 'task', taskId, `assignee:${userId}`);

    return { success: true };
  }

  async unassignTask(taskId: string) {
    const { error } = await this.client.from('tasks').update({ assignee_id: null }).eq('id', taskId);
    if (error) throw formatError(error, 'Failed to unassign task.');

    await this.logActivity('UPDATE', 'task', taskId, 'assignee:removed');

    return { success: true };
  }

  async getTaskComments(taskId: string) {
    const { data, error } = await this.client
      .from('task_comments')
      .select('id, task_id, content, parent_id, created_at, updated_at, user:profiles!task_comments_user_id_fkey(id, name, email, avatar_url, profile_image)')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    if (error) throw formatError(error, 'Unable to load comments.');

    return {
      success: true,
      data: ensureArray(data).map((comment: any) => ({
        id: String(comment.id),
        task_id: String(comment.task_id),
        parent_id: comment.parent_id ? String(comment.parent_id) : null,
        content: comment.content,
        created_at: comment.created_at,
        updated_at: comment.updated_at,
        user: comment.user
          ? {
              id: String(comment.user.id),
              name: comment.user.name,
              email: comment.user.email,
              avatar: comment.user.avatar_url || comment.user.profile_image || '',
              profile_image: comment.user.profile_image || comment.user.avatar_url || '',
            }
          : null,
      })),
    };
  }

  async addTaskComment(taskId: string, content: string, parentId?: string | number) {
    const currentUser = await this.getCurrentProfileOrThrow();
    const { data, error } = await this.client
      .from('task_comments')
      .insert({
        task_id: taskId,
        user_id: currentUser.id,
        content,
        parent_id: parentId || null,
      })
      .select()
      .single();

    if (error || !data) throw formatError(error, 'Failed to add comment.');

    await this.client.rpc('increment_task_comments_count', { task_id_input: taskId });
    await this.logActivity('TASK_COMMENT_ADDED', 'task', taskId, content.slice(0, 60));

    return { success: true, data };
  }

  async deleteTaskComment(commentId: string) {
    const { data: comment, error: readError } = await this.client
      .from('task_comments')
      .select('task_id, content')
      .eq('id', commentId)
      .single();

    if (readError || !comment) throw formatError(readError, 'Comment not found.');

    const { error } = await this.client.from('task_comments').delete().eq('id', commentId);
    if (error) throw formatError(error, 'Failed to delete comment.');

    await this.client.rpc('decrement_task_comments_count', { task_id_input: comment.task_id });
    await this.logActivity('DELETE', 'task', String(comment.task_id), comment.content.slice(0, 60));

    return { success: true };
  }

  async uploadFile(formData: FormData) {
    const currentProfile = await this.getCurrentProfileOrThrow();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      throw new ApiError('Please select a file to upload.', 400, 'FILE_REQUIRED');
    }

    const relatedId = String(formData.get('related_id') || formData.get('relatedId') || '');
    const relatedType = String(formData.get('related_type') || formData.get('relatedType') || 'task');
    if (!relatedId) {
      throw new ApiError('File related record is required.', 400, 'FILE_RELATED_ID_REQUIRED');
    }

    const uploaded = await this.uploadToStorage(file, `${relatedType}/${relatedId}`);
    const { data, error } = await this.client
      .from('files')
      .insert({
        related_id: relatedId,
        related_type: relatedType,
        file_url: uploaded.url,
        file_name: uploaded.name,
        file_path: uploaded.path,
        file_size: uploaded.size,
        file_type: uploaded.type,
        uploaded_by: currentProfile.id,
      })
      .select()
      .single();

    if (error || !data) throw formatError(error, 'Failed to save uploaded file.');
    return { success: true, data: this.mapFileRecord(data) };
  }

  async getFiles(relatedId: string) {
    const { data, error } = await this.client
      .from('files')
      .select('*')
      .eq('related_id', relatedId)
      .order('created_at', { ascending: false });
    if (error) throw formatError(error, 'Unable to load files.');
    return { success: true, data: ensureArray(data).map((file: any) => this.mapFileRecord(file)) };
  }

  async getFile(id: string) {
    const { data, error } = await this.client.from('files').select('*').eq('id', id).single();
    if (error || !data) throw formatError(error, 'File not found.');
    return { success: true, data: this.mapFileRecord(data) };
  }

  async deleteFile(id: string) {
    const { data, error: readError } = await this.client.from('files').select('*').eq('id', id).single();
    if (readError || !data) throw formatError(readError, 'File not found.');
    if (data.file_path) {
      await this.client.storage.from('files').remove([data.file_path]);
    }
    const { error } = await this.client.from('files').delete().eq('id', id);
    if (error) throw formatError(error, 'Failed to delete file.');
    return { success: true };
  }

  async getUsers() {
    const currentProfile = await this.getCurrentProfileOrThrow().catch(() => null);
    const currentRole = currentProfile ? await this.getRoleById(currentProfile.role_id).catch(() => null) : null;
    const hideCurrentUser = ['super admin', 'superadmin'].includes(String(currentRole?.name || '').toLowerCase().replace(/_/g, ' '));

    const { data, error } = await this.client
      .from('profiles')
      .select('id, name, email, avatar_url, profile_image, status, created_at, last_login_at, role_id')
      .order('created_at', { ascending: false });

    if (error) throw formatError(error, 'Unable to load users.');

    const visibleProfiles = hideCurrentUser
      ? ensureArray(data).filter((profile: any) => String(profile.id) !== String(currentProfile?.id))
      : ensureArray(data);
    const users = await Promise.all(visibleProfiles.map((profile: any) => this.hydrateUser(profile)));
    return { success: true, data: users };
  }

  async getUser(id: string) {
    const { data, error } = await this.client
      .from('profiles')
      .select('id, name, email, avatar_url, profile_image, status, created_at, last_login_at, role_id')
      .eq('id', id)
      .single();

    if (error || !data) throw formatError(error, 'User not found.');

    return { success: true, data: await this.hydrateUser(data) };
  }

  async createUser() {
    throw new ApiError(
      'Direct browser-side user creation is not safe with Supabase Auth. Create users from Supabase Auth dashboard, or add an Edge Function invite flow for this action.',
      501,
      'SUPABASE_AUTH_ADMIN_REQUIRED'
    );
  }

  async updateUser(id: string, payload: any) {
    const updatePayload: any = {
      name: payload.name,
      email: payload.email,
      status: payload.status,
      role_id: payload.role_id || payload.role?.id,
    };

    Object.keys(updatePayload).forEach((key) => updatePayload[key] === undefined && delete updatePayload[key]);

    const { error } = await this.client.from('profiles').update(updatePayload).eq('id', id);
    if (error) throw formatError(error, 'Failed to update user.');

    await this.logActivity('UPDATE', 'user', id, payload.name || id);

    return { success: true, message: 'User updated successfully.' };
  }

  async deleteUser(id: string) {
    throw new ApiError(
      'Deleting auth users directly from the browser is not supported. Remove the user from Supabase Auth dashboard or add an Edge Function for admin deletion.',
      501,
      'SUPABASE_AUTH_ADMIN_REQUIRED'
    );
  }

  async getRoles() {
    const { data, error } = await this.client
      .from('roles')
      .select('id, name, description, created_at, role_permissions(permission_id)')
      .order('name', { ascending: true });

    if (error) throw formatError(error, 'Unable to load roles.');

    return {
      success: true,
      data: ensureArray(data).map((role: any) => ({
        id: String(role.id),
        name: role.name,
        description: role.description,
        created_at: role.created_at,
        permission_count: ensureArray(role.role_permissions).length,
      })),
    };
  }

  async getRole(id: string) {
    const { data, error } = await this.client.from('roles').select('*').eq('id', id).single();
    if (error || !data) throw formatError(error, 'Role not found.');
    return { success: true, data };
  }

  async getRolePermissions(roleId: string) {
    const { data, error } = await this.client
      .from('role_permissions')
      .select('permission:permissions(id, name, key, module, description)')
      .eq('role_id', roleId);

    if (error) throw formatError(error, 'Unable to load role permissions.');

    return {
      success: true,
      permissions: ensureArray(data).map((row: any) => row.permission).filter(Boolean),
    };
  }

  async createRole(payload: any) {
    const { data, error } = await this.client
      .from('roles')
      .insert({
        name: payload.name,
        description: payload.description || null,
      })
      .select()
      .single();

    if (error || !data) throw formatError(error, 'Failed to create role.');

    await this.logActivity('CREATE', 'role', String(data.id), data.name);

    return { success: true, message: 'Role created successfully.', data };
  }

  async updateRole(id: string, payload: any) {
    const { error } = await this.client
      .from('roles')
      .update({ name: payload.name, description: payload.description || null })
      .eq('id', id);

    if (error) throw formatError(error, 'Failed to update role.');

    await this.logActivity('UPDATE', 'role', id, payload.name || id);

    return { success: true };
  }

  async deleteRole(id: string) {
    const role = await this.getRole(id);
    const { error } = await this.client.from('roles').delete().eq('id', id);
    if (error) throw formatError(error, 'Failed to delete role.');

    await this.logActivity('DELETE', 'role', id, role.data?.name || id);

    return { success: true };
  }

  async assignPermissions(roleId: string, permissionIds: string[] | number[]) {
    const normalizedIds = permissionIds.map(String);
    const { error: deleteError } = await this.client.from('role_permissions').delete().eq('role_id', roleId);
    if (deleteError) throw formatError(deleteError, 'Failed to clear role permissions.');

    if (normalizedIds.length > 0) {
      const { error: insertError } = await this.client.from('role_permissions').insert(
        normalizedIds.map((permissionId) => ({
          role_id: roleId,
          permission_id: permissionId,
        }))
      );

      if (insertError) throw formatError(insertError, 'Failed to save role permissions.');
    }

    await this.logActivity('UPDATE', 'rolepermissions', roleId, `permissions:${normalizedIds.length}`);

    return { success: true };
  }

  async getPermissions() {
    const { data, error } = await this.client
      .from('permissions')
      .select('id, name, key, module, description')
      .order('module', { ascending: true })
      .order('key', { ascending: true });

    if (error) throw formatError(error, 'Unable to load permissions.');

    const mapped = ensureArray(data).length
      ? ensureArray(data)
      : DEFAULT_PERMISSIONS.map((permission, index) => ({
          id: String(index + 1),
          ...permission,
        }));

    return {
      success: true,
      data: mapped.map((permission: any) => ({
        id: String(permission.id),
        name: permission.key || permission.name,
        key: permission.key || permission.name,
        module: permission.module,
        description: permission.description,
      })),
    };
  }

  async createPermission(payload: any) {
    const { data, error } = await this.client
      .from('permissions')
      .insert({
        key: payload.key || payload.name,
        name: payload.name || payload.key,
        module: payload.module || 'general',
        description: payload.description || null,
      })
      .select()
      .single();

    if (error || !data) throw formatError(error, 'Failed to create permission.');

    await this.logActivity('CREATE', 'rolepermissions', String(data.id), data.name);

    return { success: true, data };
  }

  async getActivityLogs(params?: Record<string, string>) {
    let query = this.client
      .from('activity_logs')
      .select('id, action, entity_type, entity_id, entity_name, created_at, user:profiles!activity_logs_user_id_fkey(id, name, email, avatar_url, profile_image)')
      .order('created_at', { ascending: false });

    if (params?.limit) {
      query = query.limit(Number(params.limit));
    }

    const { data, error } = await query;
    if (error) throw formatError(error, 'Unable to load activity logs.');

    return {
      success: true,
      data: sortByCreatedAtDesc(
        ensureArray(data).map((log: any) => ({
          id: String(log.id),
          action: log.action,
          entity_type: log.entity_type,
          entity_id: log.entity_id,
          entity_name: log.entity_name,
          created_at: log.created_at,
          user_name: log.user?.name || 'Unknown User',
          email: log.user?.email || '',
          user_avatar: log.user?.avatar_url || log.user?.profile_image || '',
        }))
      ),
    };
  }

  async getMyActivityLogs(params?: Record<string, string>) {
    const currentUser = await this.getCurrentProfileOrThrow();
    const response = await this.getActivityLogs(params);
    return {
      success: true,
      data: ensureArray(response.data).filter((log: any) => log.user_id === currentUser.id || log.user_name === currentUser.name),
    };
  }

  async getProfile() {
    return this.getCurrentUser();
  }

  async updateProfile(data: any) {
    if (data instanceof FormData) {
      return this.fallbackOrThrow('updateProfile', data);
    }

    const currentUser = await this.getCurrentProfileOrThrow();
    const payload: any = {
      name: data.name,
      email: data.email,
      avatar_url: data.avatar || data.profile_image,
      profile_image: data.profile_image || data.avatar,
    };

    Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);

    const { error } = await this.client.from('profiles').update(payload).eq('id', currentUser.id);
    if (error) throw formatError(error, 'Failed to update profile.');

    return this.getCurrentUser();
  }

  async changePassword(currentPassword: string, newPassword: string) {
    const profile = await this.getCurrentProfileOrThrow();
    const { error: verifyError } = await this.client.auth.signInWithPassword({
      email: profile.email,
      password: currentPassword,
    });

    if (verifyError) {
      throw formatError(verifyError, 'Current password is incorrect.');
    }

    const { error } = await this.client.auth.updateUser({ password: newPassword });
    if (error) throw formatError(error, 'Failed to change password.');

    return { success: true };
  }

  async getDashboardReport() {
    return this.getDashboard();
  }

  async getNotifications() {
    const currentUserId = await this.getCurrentUserId();
    const { data, error } = await this.client
      .from('notifications')
      .select('*')
      .or(`user_id.is.null,user_id.eq.${currentUserId}`)
      .order('created_at', { ascending: false });

    if (error) {
      throw formatError(error, 'Unable to load notifications.');
    }

    return { success: true, data: ensureArray(data) };
  }

  async getNotificationSettings() {
    const currentUserId = await this.getCurrentUserId();
    const storageKey = `notification_settings_${currentUserId}`;
    const raw = localStorage.getItem(storageKey);
    const defaults = {
      email_tasks: true,
      email_projects: true,
      email_mentions: true,
      browser_notifications: false,
    };

    return {
      success: true,
      data: raw ? { ...defaults, ...JSON.parse(raw) } : defaults,
    };
  }

  async updateNotificationSettings(data: any) {
    const currentUserId = await this.getCurrentUserId();
    const storageKey = `notification_settings_${currentUserId}`;
    localStorage.setItem(storageKey, JSON.stringify(data || {}));
    return { success: true, data };
  }

  async markNotificationAsRead(id: string) {
    const { error } = await this.client.from('notifications').update({ is_read: true }).eq('id', id);
    if (error) {
      throw formatError(error, 'Failed to mark notification as read.');
    }
    return { success: true };
  }

  async deleteNotification(id: string) {
    const { error } = await this.client.from('notifications').delete().eq('id', id);
    if (error) {
      throw formatError(error, 'Failed to delete notification.');
    }
    return { success: true };
  }

  async getCalendar(startDate?: string, endDate?: string) {
    const [projectsRes, tasksRes] = await Promise.all([
      this.client
        .from('projects')
        .select('id, name, description, status, start_date, end_date, created_at')
        .order('created_at', { ascending: false }),
      this.client
        .from('tasks')
        .select('id, title, description, status, due_date, project_id, created_at')
        .order('created_at', { ascending: false }),
    ]);

    if (projectsRes.error) {
      throw formatError(projectsRes.error, 'Unable to load calendar projects.');
    }
    if (tasksRes.error) {
      throw formatError(tasksRes.error, 'Unable to load calendar tasks.');
    }

    const rangeStart = startDate ? new Date(startDate) : null;
    const rangeEnd = endDate ? new Date(endDate) : null;

    const projectEvents = ensureArray(projectsRes.data)
      .filter((project: any) => project.start_date || project.end_date)
      .map((project: any) => ({
        id: String(project.id),
        name: project.name,
        description: project.description,
        start_date: project.start_date || project.created_at?.split('T')[0],
        end_date: project.end_date || project.start_date || project.created_at?.split('T')[0],
        status: project.status || 'active',
        type: 'project',
        project_id: project.id,
      }));

    const taskEvents = ensureArray(tasksRes.data)
      .filter((task: any) => task.due_date)
      .map((task: any) => ({
        id: `task-${task.id}`,
        name: task.title,
        description: task.description,
        start_date: task.due_date,
        end_date: task.due_date,
        status: task.status || 'pending',
        type: 'task',
        project_id: task.project_id,
      }));

    const inRange = (event: any) => {
      if (!rangeStart || !rangeEnd) return true;
      const eventStart = new Date(event.start_date);
      const eventEnd = new Date(event.end_date || event.start_date);
      return eventStart <= rangeEnd && eventEnd >= rangeStart;
    };

    return {
      success: true,
      data: [...projectEvents, ...taskEvents].filter(inRange),
    };
  }

  async createTimeLog(data: any) {
    const currentUserId = await this.getCurrentUserId();
    const hours = Number(data?.hours || 0);
    const minutes = Number(data?.minutes || 0);
    const normalizedHours = hours > 0 ? hours : minutes / 60;

    const { data: created, error } = await this.client
      .from('time_logs')
      .insert({
        user_id: currentUserId,
        project_id: data?.project_id || null,
        task_id: data?.task_id || null,
        log_date: data?.date,
        hours: normalizedHours,
        description: data?.description || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error || !created) {
      throw formatError(error, 'Failed to create time log.');
    }

    return { success: true, data: created };
  }

  async updateLead(id: string | number, data: Partial<Lead> & { tags?: string[]; contacts?: CreateLeadPayload['contacts'] }) {
    const payload: Record<string, unknown> = {
      name: data.name,
      email: data.email ? String(data.email).toLowerCase() : data.email,
        phone: data.phone || null,
        company: data.company || null,
        designation: data.designation || null,
        website: data.website || null,
        linkedin_url: data.linkedin_url || null,
        facebook_url: data.facebook_url || null,
        instagram_url: data.instagram_url || null,
        x_url: data.x_url || null,
        services_offered: data.services_offered || null,
        status: data.status,
      source: data.source,
      priority: data.priority,
      pipeline_stage: data.pipeline_stage,
      lead_score: data.lead_score,
        budget: data.budget,
        expected_close_date: data.expected_close_date || null,
        outreach_status: data.outreach_status,
        outreach_channel: data.outreach_channel || null,
        first_contacted_at: data.first_contacted_at || null,
        last_reachout_at: data.last_reachout_at || null,
        followup_sent_at: data.followup_sent_at || null,
        followup_notes: data.followup_notes || null,
        close_value: data.close_value,
        assigned_to: data.assigned_to || null,
      lost_reason: data.lost_reason || null,
      notes: data.notes || null,
      last_contacted_at: data.last_contacted_at || null,
      next_followup_at: data.next_followup_at || null,
    };

    if (payload.pipeline_stage === 'won') {
      payload.completed = true;
      payload.converted_at = new Date().toISOString();
      payload.completed_at = new Date().toISOString();
      payload.status = 'converted';
    } else if (payload.pipeline_stage === 'lost') {
      payload.completed = true;
      payload.completed_at = new Date().toISOString();
      payload.status = 'lost';
    } else if (payload.pipeline_stage) {
      payload.completed = false;
      payload.completed_at = null;
      payload.status = this.statusFromPipeline(String(payload.pipeline_stage));
    }

    Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);

    const { error } = await this.client.from('leads').update(payload).eq('id', id);
    if (error) throw formatError(error, 'Failed to update lead.');

    if (Array.isArray(data.tags)) {
      const normalizedTags = [...new Set(data.tags.map((tag) => tag.trim()).filter(Boolean))];
      await this.replaceLeadTags(String(id), normalizedTags);
    }

    if (Array.isArray(data.contacts)) {
      await this.replaceLeadContacts(String(id), data.contacts);
    }

    await this.logActivity('UPDATE', 'lead', String(id), data.name || String(id));
    await this.addActivity(String(id), { activity_type: 'status_change', description: 'Lead updated' });

    return this.getLeadById(String(id));
  }

  async importLeads(formData: FormData) {
    const file = formData.get('file');
    if (!(file instanceof File)) {
      throw new ApiError('Please provide a CSV file.', 400, 'LEAD_IMPORT_FILE_REQUIRED');
    }

    const raw = await file.text();
    const rows = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (rows.length < 2) {
      return { success: true, data: { inserted: 0, skipped: 0 } };
    }

    const headers = rows[0].split(',').map((header) => header.trim().toLowerCase());
    let inserted = 0;
    let skipped = 0;

    for (const row of rows.slice(1)) {
      const values = row.split(',').map((value) => value.trim());
      const record = headers.reduce<Record<string, string>>((acc, header, index) => {
        acc[header] = values[index] || '';
        return acc;
      }, {});

      try {
        await this.createLead({
          name: record.name,
          email: record.email || undefined,
            phone: record.phone || undefined,
            company: record.company || undefined,
            designation: record.designation || undefined,
            website: record.website || undefined,
            linkedin_url: record.linkedin_url || record.linkedin || undefined,
            facebook_url: record.facebook_url || record.facebook || undefined,
            instagram_url: record.instagram_url || record.instagram || undefined,
            x_url: record.x_url || record.twitter || record.x || undefined,
            services_offered: record.services_offered || record.services || undefined,
            source: this.normalizeLeadSource(record.source || 'manual'),
          priority: this.normalizeLeadPriority(record.priority || 'medium'),
          pipeline_stage: this.normalizeLeadStage(record.pipeline_stage || 'new'),
            budget: record.budget ? Number(record.budget) : undefined,
            expected_close_date: record.expected_close_date || undefined,
            outreach_status: (record.outreach_status as any) || undefined,
            outreach_channel: (record.outreach_channel as any) || undefined,
            last_reachout_at: record.last_reachout_at || undefined,
            followup_sent_at: record.followup_sent_at || undefined,
            followup_notes: record.followup_notes || undefined,
            close_value: record.close_value ? Number(record.close_value) : undefined,
            notes: record.notes || undefined,
          lead_score: record.lead_score ? Number(record.lead_score) : undefined,
        });
        inserted += 1;
      } catch {
        skipped += 1;
      }
    }

    return { success: true, data: { inserted, skipped } };
  }

  async getLeads(filters?: LeadFilters & { page?: number; pageSize?: number }) {
    const buildQuery = (selectClause: string, includeExtendedSearch: boolean) => {
      let query = this.client
        .from('leads')
        .select(selectClause)
        .order('created_at', { ascending: false });

      if (filters?.status?.length) query = query.in('status', filters.status);
      if (filters?.pipeline_stage?.length) query = query.in('pipeline_stage', filters.pipeline_stage);
      if (filters?.priority?.length) query = query.in('priority', filters.priority);
      if (filters?.source?.length) query = query.in('source', filters.source);
      if (filters?.assigned_to?.length) query = query.in('assigned_to', filters.assigned_to);
      if (filters?.search) {
        const term = filters.search.trim().replace(/[%(),]/g, '');
        if (includeExtendedSearch) {
          query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,company.ilike.%${term}%,designation.ilike.%${term}%,website.ilike.%${term}%,linkedin_url.ilike.%${term}%,facebook_url.ilike.%${term}%,instagram_url.ilike.%${term}%,x_url.ilike.%${term}%,services_offered.ilike.%${term}%`);
        } else {
          query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,company.ilike.%${term}%`);
        }
      }
      if (filters?.date_from) query = query.gte('created_at', filters.date_from);
      if (filters?.date_to) query = query.lte('created_at', filters.date_to);
      if (typeof filters?.score_min === 'number') query = query.gte('lead_score', filters.score_min);
      if (typeof filters?.score_max === 'number') query = query.lte('lead_score', filters.score_max);
      if (typeof filters?.budget_min === 'number') query = query.gte('budget', filters.budget_min);
      if (typeof filters?.budget_max === 'number') query = query.lte('budget', filters.budget_max);
      if (filters?.has_followup_due) query = query.not('next_followup_at', 'is', null);
      if (filters?.overdue_only) query = query.lt('next_followup_at', new Date().toISOString());
      return query;
    };

    let { data, error } = await buildQuery(this.getLeadSelectClause(), true);
    if (error) {
      console.warn('Rich lead query failed; retrying with base lead columns.', error);
      const fallback = await buildQuery('*', false);
      data = fallback.data;
      error = fallback.error;
    }
    if (error) throw formatError(error, 'Unable to load leads.');

    let mapped = ensureArray(data).map((row: any) => this.mapLeadRecord(row));

    if (filters?.tags?.length) {
      mapped = mapped.filter((lead) => {
        const tagNames = (lead.lead_tags || []).map((tag) => tag.tag_name.toLowerCase());
        return filters.tags!.some((tag) => tagNames.includes(tag.toLowerCase()));
      });
    }

    const page = filters?.page || 1;
    const pageSize = filters?.pageSize || 25;
    const start = (page - 1) * pageSize;
    const paged = mapped.slice(start, start + pageSize);

    return {
      success: true,
      data: paged,
      total: mapped.length,
      page,
      pageSize,
    };
  }

  async getLeadById(id: string) {
    let { data, error } = await this.client
      .from('leads')
      .select(this.getLeadSelectClause())
      .eq('id', id)
      .single();
    if (error) {
      console.warn('Rich lead detail query failed; retrying with base lead columns.', error);
      const fallback = await this.client.from('leads').select('*').eq('id', id).single();
      data = fallback.data;
      error = fallback.error;
    }

    if (error || !data) throw formatError(error, 'Lead not found.');

    return {
      success: true,
      data: this.mapLeadRecord(data),
    };
  }

  async createLead(payload: CreateLeadPayload) {
    const currentUser = await this.getCurrentProfileOrThrow();
    const { tags, contacts, notes, ...leadData } = payload;

    const insertPayload = {
      name: leadData.name,
      email: leadData.email ? leadData.email.toLowerCase() : null,
        phone: leadData.phone || null,
        company: leadData.company || null,
        designation: leadData.designation || null,
        website: leadData.website || null,
        linkedin_url: leadData.linkedin_url || null,
        facebook_url: leadData.facebook_url || null,
        instagram_url: leadData.instagram_url || null,
        x_url: leadData.x_url || null,
        services_offered: leadData.services_offered || null,
        source: this.normalizeLeadSource(leadData.source || 'manual'),
      priority: this.normalizeLeadPriority(leadData.priority || 'medium'),
      pipeline_stage: this.normalizeLeadStage(leadData.pipeline_stage || 'new'),
      lead_score: Number(leadData.lead_score || 0),
        budget: leadData.budget || null,
        expected_close_date: leadData.expected_close_date || null,
        outreach_status: leadData.outreach_status || 'not_contacted',
        outreach_channel: leadData.outreach_channel || null,
        first_contacted_at: leadData.first_contacted_at || null,
        last_reachout_at: leadData.last_reachout_at || null,
        followup_sent_at: leadData.followup_sent_at || null,
        followup_notes: leadData.followup_notes || null,
        close_value: leadData.close_value || null,
        assigned_to: leadData.assigned_to || null,
      notes: notes || null,
      created_by: currentUser.id,
        status: this.statusFromPipeline(leadData.pipeline_stage || 'new'),
        completed: ['won', 'lost'].includes(this.normalizeLeadStage(leadData.pipeline_stage || 'new')),
    };

    const { data: lead, error } = await this.client.from('leads').insert([insertPayload]).select().single();
    if (error || !lead) throw formatError(error, 'Failed to create lead.');

    if (tags?.length) {
      await this.replaceLeadTags(String(lead.id), [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))]);
    }

    if (contacts?.length) {
      await this.replaceLeadContacts(String(lead.id), contacts);
    }

    if (notes) {
      await this.client.from('lead_notes').insert([
        {
          lead_id: lead.id,
          user_id: currentUser.id,
          note: notes,
          content: notes,
        },
      ]);
    }

    await this.logActivity('CREATE', 'lead', String(lead.id), lead.name);
    await this.addActivity(String(lead.id), {
      activity_type: 'note',
      description: 'Lead created',
    });

    return this.getLeadById(String(lead.id));
  }

  async deleteLead(id: string | number) {
    const { data: lead, error: readError } = await this.client.from('leads').select('id, name').eq('id', id).single();
    if (readError || !lead) throw formatError(readError, 'Lead not found.');

    const { error } = await this.client.from('leads').delete().eq('id', id);
    if (error) throw formatError(error, 'Failed to delete lead.');

    await this.logActivity('DELETE', 'lead', String(id), lead.name);
    return { success: true };
  }

  async addActivity(leadId: string, data: AddLeadActivityPayload) {
    const currentUser = await this.getCurrentProfileOrThrow();
    const { data: created, error } = await this.client
      .from('lead_activities')
      .insert([
        {
          lead_id: leadId,
          user_id: currentUser.id,
          created_by: currentUser.id,
          activity_type: data.activity_type,
          summary: data.description,
          description: data.description,
          duration_minutes: data.duration_minutes || null,
          outcome: data.outcome || null,
        },
      ])
      .select()
      .single();

    if (error || !created) throw formatError(error, 'Failed to add activity.');
    return { success: true, data: this.mapLeadActivities([created])[0] };
  }

  async addNote(leadId: string, content: string) {
    const currentUser = await this.getCurrentProfileOrThrow();
    const { data: created, error } = await this.client
      .from('lead_notes')
      .insert([
        {
          lead_id: leadId,
          user_id: currentUser.id,
          note: content,
          content,
        },
      ])
      .select()
      .single();

    if (error || !created) throw formatError(error, 'Failed to add note.');
    await this.addActivity(leadId, { activity_type: 'note', description: 'Note added' });
    return { success: true, data: this.mapLeadNotes([created])[0] };
  }

  async scheduleFollowup(leadId: string, data: ScheduleLeadFollowupPayload) {
    const currentUser = await this.getCurrentProfileOrThrow();
    const { data: created, error } = await this.client
      .from('lead_followups')
      .insert([
        {
          lead_id: leadId,
          assigned_to: currentUser.id,
          created_by: currentUser.id,
          title: `${data.followup_type} follow-up`,
          description: data.notes || null,
          notes: data.notes || null,
          due_at: data.scheduled_at,
          scheduled_at: data.scheduled_at,
          followup_type: data.followup_type,
          completed: false,
          status: 'pending',
        },
      ])
      .select()
      .single();

    if (error || !created) throw formatError(error, 'Failed to schedule follow-up.');

    await this.client.from('leads').update({ next_followup_at: data.scheduled_at }).eq('id', leadId);
    await this.addActivity(leadId, { activity_type: 'followup', description: `${data.followup_type} follow-up scheduled` });
    return { success: true, data: this.mapLeadFollowups([created])[0] };
  }

  async completeFollowup(followupId: string, notes?: string) {
    const { data: updated, error } = await this.client
      .from('lead_followups')
      .update({
        completed: true,
        completed_at: new Date().toISOString(),
        status: 'done',
        notes: notes || undefined,
      })
      .eq('id', followupId)
      .select()
      .single();

    if (error || !updated) throw formatError(error, 'Failed to complete follow-up.');

    await this.addActivity(String(updated.lead_id), { activity_type: 'followup', description: 'Follow-up completed' });
    return { success: true, data: this.mapLeadFollowups([updated])[0] };
  }

  async addTag(leadId: string, tagName: string) {
    const normalized = tagName.trim();
    if (!normalized) throw new ApiError('Tag name is required.', 400, 'LEAD_TAG_REQUIRED');

    const { data: tag, error: tagError } = await this.client
      .from('lead_tags')
      .upsert([{ name: normalized }], { onConflict: 'name' })
      .select()
      .single();

    if (tagError || !tag) throw formatError(tagError, 'Failed to create tag.');

    const { error } = await this.client
      .from('lead_tag_links')
      .upsert([{ lead_id: leadId, tag_id: tag.id }], { onConflict: 'lead_id,tag_id' });

    if (error) throw formatError(error, 'Failed to attach tag.');
    return { success: true };
  }

  async removeTag(leadId: string, tagName: string) {
    const { data: tag, error: tagError } = await this.client
      .from('lead_tags')
      .select('id')
      .eq('name', tagName.trim())
      .single();

    if (tagError || !tag) throw formatError(tagError, 'Tag not found.');

    const { error } = await this.client.from('lead_tag_links').delete().eq('lead_id', leadId).eq('tag_id', tag.id);
    if (error) throw formatError(error, 'Failed to remove tag.');
    return { success: true };
  }

  async updateLeadScore(leadId: string, score: number) {
    const { error } = await this.client.from('leads').update({ lead_score: score }).eq('id', leadId);
    if (error) throw formatError(error, 'Failed to update lead score.');
    return { success: true };
  }

  async bulkUpdateStatus(leadIds: string[], status: string) {
    const pipelineStage = this.normalizeLeadStage(status);
    const { error } = await this.client
      .from('leads')
      .update({ status, pipeline_stage: pipelineStage, completed: pipelineStage === 'won' || pipelineStage === 'lost' })
      .in('id', leadIds);

    if (error) throw formatError(error, 'Failed to update selected leads.');
    return { success: true };
  }

  async bulkAssign(leadIds: string[], userId: string) {
    const { error } = await this.client.from('leads').update({ assigned_to: userId }).in('id', leadIds);
    if (error) throw formatError(error, 'Failed to assign selected leads.');
    return { success: true };
  }

  async bulkDelete(leadIds: string[]) {
    const { error } = await this.client.from('leads').delete().in('id', leadIds);
    if (error) throw formatError(error, 'Failed to delete selected leads.');
    return { success: true };
  }

  async getLeadStats(): Promise<{ success: true; data: LeadStats }> {
    const { data, error } = await this.client.from('leads').select('created_at, pipeline_stage, source, priority, lead_score, completed, converted_at');
    if (error) throw formatError(error, 'Unable to load lead stats.');

    const leads = ensureArray(data);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const emptyPipeline: Record<PipelineStage, number> = {
      new: 0,
      contacted: 0,
      qualified: 0,
      proposal_sent: 0,
      negotiation: 0,
      won: 0,
      lost: 0,
    };
    const emptySource: Record<LeadSource, number> = {
        manual: 0,
        facebook: 0,
        instagram: 0,
        x: 0,
        linkedin: 0,
        whatsapp: 0,
      website: 0,
      referral: 0,
      cold_call: 0,
      email_campaign: 0,
    };
    const emptyPriority: Record<LeadPriority, number> = {
      low: 0,
      medium: 0,
      high: 0,
      urgent: 0,
    };

    const monthlyTrendMap = new Map<string, { month: string; count: number; converted: number }>();
    for (let i = 5; i >= 0; i -= 1) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const label = date.toLocaleString('en-US', { month: 'short' });
      monthlyTrendMap.set(label, { month: label, count: 0, converted: 0 });
    }

    leads.forEach((lead: any) => {
      const pipeline = this.normalizeLeadStage(lead.pipeline_stage || lead.status);
      emptyPipeline[pipeline] += 1;
      emptySource[this.normalizeLeadSource(lead.source)] += 1;
      emptyPriority[this.normalizeLeadPriority(lead.priority)] += 1;

      const created = new Date(lead.created_at);
      const monthLabel = created.toLocaleString('en-US', { month: 'short' });
      if (monthlyTrendMap.has(monthLabel)) {
        const bucket = monthlyTrendMap.get(monthLabel)!;
        bucket.count += 1;
        if (pipeline === 'won' || lead.converted_at) bucket.converted += 1;
      }
    });

    const total = leads.length;
    const convertedCount = emptyPipeline.won;
    const avgScore = total ? leads.reduce((sum: number, lead: any) => sum + Number(lead.lead_score ?? lead.score ?? 0), 0) / total : 0;

    return {
      success: true,
      data: {
        total,
        new_this_month: leads.filter((lead: any) => new Date(lead.created_at) >= monthStart).length,
        conversion_rate: total ? (convertedCount / total) * 100 : 0,
        avg_score: avgScore,
        by_pipeline_stage: emptyPipeline,
        by_source: emptySource,
        by_priority: emptyPriority,
        monthly_trend: [...monthlyTrendMap.values()],
      },
    };
  }

  private async replaceLeadTags(leadId: string, tags: string[]) {
    const normalizedTags = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
    const { error: deleteError } = await this.client.from('lead_tag_links').delete().eq('lead_id', leadId);
    if (deleteError) throw formatError(deleteError, 'Failed to clear lead tags.');

    if (!normalizedTags.length) return;

    const { data: createdTags, error: tagsError } = await this.client
      .from('lead_tags')
      .upsert(normalizedTags.map((name) => ({ name })), { onConflict: 'name' })
      .select();

    if (tagsError) throw formatError(tagsError, 'Failed to create lead tags.');

    const tagMap = new Map(ensureArray(createdTags).map((tag: any) => [tag.name, tag.id]));
    const { data: existingTags, error: existingTagsError } = await this.client.from('lead_tags').select('id, name').in('name', normalizedTags);
    if (existingTagsError) throw formatError(existingTagsError, 'Failed to read lead tags.');
    ensureArray(existingTags).forEach((tag: any) => tagMap.set(tag.name, tag.id));

    const { error: linkError } = await this.client.from('lead_tag_links').insert(
      normalizedTags.map((tagName) => ({
        lead_id: leadId,
        tag_id: tagMap.get(tagName),
      }))
    );

    if (linkError) throw formatError(linkError, 'Failed to attach lead tags.');
  }

  private async replaceLeadContacts(leadId: string, contacts: NonNullable<CreateLeadPayload['contacts']>) {
    const { error: deleteError } = await this.client.from('lead_contacts').delete().eq('lead_id', leadId);
    if (deleteError) throw formatError(deleteError, 'Failed to clear lead contacts.');

    const normalizedContacts = contacts
      .filter((contact) => contact.name.trim())
      .map((contact, index) => ({
        lead_id: leadId,
        name: contact.name.trim(),
        email: contact.email?.trim() || null,
        phone: contact.phone?.trim() || null,
        role: contact.role?.trim() || null,
        is_primary: Boolean(contact.is_primary ?? index === 0),
      }));

    if (!normalizedContacts.length) return;

    const { error } = await this.client.from('lead_contacts').insert(normalizedContacts);
    if (error) throw formatError(error, 'Failed to save lead contacts.');
  }

  async getFinanceClients() {
    const { data, error } = await this.client.from('clients').select('*').order('created_at', { ascending: false });
    if (error) throw formatError(error, 'Unable to load clients.');
    return { success: true, data: ensureArray(data) };
  }

  async createFinanceClient(data: any) {
    const { data: created, error } = await this.client
      .from('clients')
      .insert({
        name: data?.name,
        email: data?.email,
        phone: data?.phone || null,
        company: data?.company || null,
        address: data?.address || null,
        status: data?.status || 'active',
      })
      .select()
      .single();

    if (error || !created) throw formatError(error, 'Failed to create client.');
    return { success: true, data: created };
  }

  async deleteFinanceClient(id: string) {
    const { error } = await this.client.from('clients').delete().eq('id', id);
    if (error) throw formatError(error, 'Failed to delete client.');
    return { success: true };
  }

  async getFinanceExpenses() {
    const { data, error } = await this.client.from('expenses').select('*').order('expense_date', { ascending: false });
    if (error) throw formatError(error, 'Unable to load expenses.');
    return { success: true, data: ensureArray(data) };
  }

  async createFinanceExpense(data: any) {
    const currentUserId = await this.getCurrentUserId();
    const { data: created, error } = await this.client
      .from('expenses')
      .insert({
        category: data?.category,
        description: data?.description,
        amount: Number(data?.amount || 0),
        expense_date: data?.expense_date,
        payment_method: data?.payment_method || 'bank_transfer',
        created_by: currentUserId,
      })
      .select()
      .single();

    if (error || !created) throw formatError(error, 'Failed to create expense.');
    return { success: true, data: created };
  }

  async deleteFinanceExpense(id: string) {
    const { error } = await this.client.from('expenses').delete().eq('id', id);
    if (error) throw formatError(error, 'Failed to delete expense.');
    return { success: true };
  }

  async getFinancePayments() {
    const { data, error } = await this.client.from('payments').select('*').order('payment_date', { ascending: false });
    if (error) throw formatError(error, 'Unable to load payments.');
    return { success: true, data: ensureArray(data) };
  }

  async createFinancePayment(data: any) {
    const currentUserId = await this.getCurrentUserId();
    const { data: created, error } = await this.client
      .from('payments')
      .insert({
        client_name: data?.client_name,
        amount: Number(data?.amount || 0),
        payment_date: data?.payment_date,
        payment_method: data?.payment_method || 'bank_transfer',
        status: data?.status || 'completed',
        description: data?.description || null,
        created_by: currentUserId,
      })
      .select()
      .single();

    if (error || !created) throw formatError(error, 'Failed to create payment.');
    return { success: true, data: created };
  }

  async deleteFinancePayment(id: string) {
    const { error } = await this.client.from('payments').delete().eq('id', id);
    if (error) throw formatError(error, 'Failed to delete payment.');
    return { success: true };
  }

  async getFinanceFounders() {
    const { data, error } = await this.client.from('founders').select('*').order('created_at', { ascending: false });
    if (error) throw formatError(error, 'Unable to load founders.');
    return { success: true, data: ensureArray(data) };
  }

  async createFinanceFounder(data: any) {
    const { data: created, error } = await this.client
      .from('founders')
      .insert({
        name: data?.name,
        role: data?.role || null,
        equity_percentage: Number(data?.equity_percentage || 0),
        join_date: data?.join_date || new Date().toISOString().split('T')[0],
      })
      .select()
      .single();

    if (error || !created) throw formatError(error, 'Failed to create founder.');
    return { success: true, data: created };
  }

  async updateFinanceFounder(id: string, data: any) {
    const { data: updated, error } = await this.client
      .from('founders')
      .update({
        name: data?.name,
        role: data?.role || null,
        equity_percentage: Number(data?.equity_percentage || 0),
      })
      .eq('id', id)
      .select()
      .single();

    if (error || !updated) throw formatError(error, 'Failed to update founder.');
    return { success: true, data: updated };
  }

  async deleteFinanceFounder(id: string) {
    const { error } = await this.client.from('founders').delete().eq('id', id);
    if (error) throw formatError(error, 'Failed to delete founder.');
    return { success: true };
  }

  async getFoundersEquityTotal() {
    const { data, error } = await this.client.from('founders').select('equity_percentage');
    if (error) throw formatError(error, 'Unable to load founder equity.');
    const total = ensureArray(data).reduce((sum: number, founder: any) => sum + Number(founder.equity_percentage || 0), 0);
    return { success: true, data: { data: { total } } };
  }

  async getFinanceSettings() {
    const { data, error } = await this.client.from('finance_settings').select('*');
    if (error) throw formatError(error, 'Unable to load finance settings.');
    const mapped = ensureArray(data).reduce((acc: Record<string, any>, item: any) => {
      acc[item.setting_key] = item.setting_value;
      return acc;
    }, {});
    return { success: true, data: { data: mapped } };
  }

  async saveFinanceSettings(data: any) {
    const rows = Object.entries(data || {}).map(([setting_key, setting_value]) => ({
      setting_key,
      setting_value: String(setting_value),
    }));

    const { error } = await this.client.from('finance_settings').upsert(rows, { onConflict: 'setting_key' });
    if (error) throw formatError(error, 'Failed to save finance settings.');
    return { success: true };
  }

  async getFinanceStats(range: string) {
    const [paymentsRes, expensesRes, foundersEquityRes, settingsRes] = await Promise.all([
      this.client.from('payments').select('amount, payment_date, status'),
      this.client.from('expenses').select('amount, expense_date'),
      this.getFoundersEquityTotal(),
      this.getFinanceSettings(),
    ]);

    if (paymentsRes.error) throw formatError(paymentsRes.error, 'Unable to load payments stats.');
    if (expensesRes.error) throw formatError(expensesRes.error, 'Unable to load expenses stats.');

    const payments = ensureArray(paymentsRes.data);
    const expenses = ensureArray(expensesRes.data);
    const revenue = payments.filter((p: any) => p.status === 'completed').reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
    const expenseTotal = expenses.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
    const netProfit = revenue - expenseTotal;
    const settings = (settingsRes as any)?.data?.data || {};
    const futureFundPercentage = Number(settings.future_fund_percentage || 20);
    const commissionPercentage = Number(settings.commission_percentage || 15);
    const taxRate = Number(settings.tax_rate || 30);
    const outstanding = payments.filter((p: any) => p.status !== 'completed').reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

    return {
      success: true,
      data: {
        data: {
          revenue,
          expenses: expenseTotal,
          netProfit,
          outstanding,
          distribution: [
            { label: 'Future Fund', percentage: futureFundPercentage, amount: netProfit * (futureFundPercentage / 100) },
            { label: 'Commission', percentage: commissionPercentage, amount: netProfit * (commissionPercentage / 100) },
            { label: 'Tax Reserve', percentage: taxRate, amount: netProfit * (taxRate / 100) },
            { label: 'Founder Equity Allocated', percentage: foundersEquityRes.data.data.total || 0, amount: 0 },
          ],
        },
        range,
      },
    };
  }

  async getFinanceChart(_range: string) {
    const [paymentsRes, expensesRes] = await Promise.all([
      this.client.from('payments').select('amount, payment_date, status'),
      this.client.from('expenses').select('amount, expense_date'),
    ]);

    if (paymentsRes.error) throw formatError(paymentsRes.error, 'Unable to load payment chart.');
    if (expensesRes.error) throw formatError(expensesRes.error, 'Unable to load expense chart.');

    const buckets: Record<string, { month: string; revenue: number; expenses: number }> = {};
    ensureArray(paymentsRes.data).forEach((payment: any) => {
      const key = monthKey(payment.payment_date);
      buckets[key] = buckets[key] || { month: key, revenue: 0, expenses: 0 };
      if (payment.status === 'completed') buckets[key].revenue += Number(payment.amount || 0);
    });
    ensureArray(expensesRes.data).forEach((expense: any) => {
      const key = monthKey(expense.expense_date);
      buckets[key] = buckets[key] || { month: key, revenue: 0, expenses: 0 };
      buckets[key].expenses += Number(expense.amount || 0);
    });

    return {
      success: true,
      data: {
        data: Object.values(buckets),
      },
    };
  }

  async getTimeLogs() {
    const { data, error } = await this.client
      .from('time_logs')
      .select(`
        id,
        log_date,
        hours,
        description,
        status,
        user:profiles!time_logs_user_id_fkey(id, name),
        project:projects(id, name),
        task:tasks(id, title)
      `)
      .order('log_date', { ascending: false });

    if (error) throw formatError(error, 'Unable to load time logs.');

    return {
      success: true,
      data: ensureArray(data).map((log: any) => ({
        id: String(log.id),
        date: log.log_date,
        hours: log.hours,
        description: log.description,
        status: log.status,
        user_name: log.user?.name || '',
        project_name: log.project?.name || '',
        task_title: log.task?.title || '',
      })),
    };
  }

  async getTimeLogStats() {
    const currentUserId = await this.getCurrentUserId();
    const { data, error } = await this.client
      .from('time_logs')
      .select('hours, status, log_date')
      .eq('user_id', currentUserId);

    if (error) throw formatError(error, 'Unable to load time log stats.');

    const logs = ensureArray(data);
    const today = new Date().toISOString().split('T')[0];
    const todaysHours = logs.filter((log: any) => log.log_date === today).reduce((sum: number, log: any) => sum + Number(log.hours || 0), 0);
    const weeklyHours = logs.reduce((sum: number, log: any) => sum + Number(log.hours || 0), 0);
    const approvedHours = logs.filter((log: any) => log.status === 'approved').reduce((sum: number, log: any) => sum + Number(log.hours || 0), 0);
    const productivity = weeklyHours > 0 ? (approvedHours / weeklyHours) * 100 : 0;

    return {
      success: true,
      data: {
        todays_hours: todaysHours,
        weekly_hours: weeklyHours,
        productivity_percentage: productivity,
        weekly_change_percentage: 0,
      },
    };
  }

  async deleteTimeLog(id: string) {
    const { error } = await this.client.from('time_logs').delete().eq('id', id);
    if (error) throw formatError(error, 'Failed to delete time log.');
    return { success: true };
  }

  async getInbox() {
    const currentUserId = await this.getCurrentUserId();
    const { data, error } = await this.client
      .from('mail_recipients')
      .select(`
        id,
        is_read,
        is_deleted,
        read_at,
        mail:mails!mail_recipients_mail_id_fkey(
          id,
          subject,
          body,
          created_at,
          thread_id,
          sender_id,
          sender_deleted,
          sender:profiles!mails_sender_id_fkey(id, name, email, avatar_url, profile_image),
          attachments:mail_attachments(id, original_name, file_name, file_path, mime_type, file_size)
        )
      `)
      .eq('recipient_id', currentUserId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (error) {
      throw formatError(error, 'Unable to load inbox.');
    }

    return {
      success: true,
      data: ensureArray(data)
        .map((row: any) => this.mapMailRow(row.mail, row))
        .filter((mail: any) => mail?.id),
    };
  }

  async getSentMails() {
    const currentUserId = await this.getCurrentUserId();
    const { data, error } = await this.client
      .from('mails')
      .select(`
        id,
        subject,
        body,
        created_at,
        thread_id,
        sender_id,
        sender_deleted,
        sender:profiles!mails_sender_id_fkey(id, name, email, avatar_url, profile_image),
        attachments:mail_attachments(id, original_name, file_name, file_path, mime_type, file_size),
        recipients:mail_recipients(
          id,
          is_read,
          is_deleted,
          recipient:profiles!mail_recipients_recipient_id_fkey(id, name, email)
        )
      `)
      .eq('sender_id', currentUserId)
      .eq('sender_deleted', false)
      .order('created_at', { ascending: false });

    if (error) {
      throw formatError(error, 'Unable to load sent mails.');
    }

    return {
      success: true,
      data: ensureArray(data).map((mail: any) => this.mapMailRow(mail)),
    };
  }

  async getAllMails() {
    const { data, error } = await this.client
      .from('mail_threads')
      .select(`
        id,
        subject,
        created_at,
        mails:mails(
          id,
          subject,
          body,
          created_at,
          thread_id,
          sender_id,
          sender_deleted,
          sender:profiles!mails_sender_id_fkey(id, name, email, avatar_url, profile_image),
          attachments:mail_attachments(id, original_name, file_name, file_path, mime_type, file_size),
          recipients:mail_recipients(
            id,
            is_read,
            is_deleted,
            recipient:profiles!mail_recipients_recipient_id_fkey(id, name, email)
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw formatError(error, 'Unable to load mail threads.');
    }

    return {
      success: true,
      data: ensureArray(data).map((thread: any) => ({
        id: String(thread.id),
        subject: thread.subject,
        created_at: thread.created_at,
        mails: ensureArray(thread.mails).map((mail: any) => this.mapMailRow(mail)),
      })),
    };
  }

  async getMailDetail(id: string) {
    const { data, error } = await this.client
      .from('mails')
      .select(`
        id,
        subject,
        body,
        created_at,
        thread_id,
        sender_id,
        sender_deleted,
        sender:profiles!mails_sender_id_fkey(id, name, email, avatar_url, profile_image),
        attachments:mail_attachments(id, original_name, file_name, file_path, mime_type, file_size),
        recipients:mail_recipients(
          id,
          is_read,
          is_deleted,
          recipient:profiles!mail_recipients_recipient_id_fkey(id, name, email)
        )
      `)
      .or(`thread_id.eq.${id},id.eq.${id}`)
      .order('created_at', { ascending: true });

    if (error) {
      throw formatError(error, 'Unable to load mail detail.');
    }

    return {
      success: true,
      data: {
        mails: ensureArray(data).map((mail: any) => this.mapMailRow(mail)),
      },
    };
  }

  async sendMail(mailData: any) {
    const currentProfile = await this.getCurrentProfileOrThrow();
    let recipients: Array<string | number | null | undefined> = [];
    let subject = '';
    let body = '';

    if (mailData instanceof FormData) {
      recipients = JSON.parse(String(mailData.get('recipients') || '[]'));
      subject = String(mailData.get('subject') || '');
      body = String(mailData.get('body') || '');
    } else {
      recipients = ensureArray(mailData?.recipients);
      subject = String(mailData?.subject || '');
      body = String(mailData?.body || '');
    }

    const recipientIds = await this.resolveRecipientIds(recipients, String(currentProfile.id));
    if (!recipientIds.length) {
      throw new ApiError('No valid recipients found for this email.', 400, 'MAIL_RECIPIENTS_REQUIRED');
    }

    const { data: thread, error: threadError } = await this.client
      .from('mail_threads')
      .insert({
        subject,
        created_by: currentProfile.id,
      })
      .select()
      .single();

    if (threadError || !thread) {
      throw formatError(threadError, 'Failed to create mail thread.');
    }

    const { data: mail, error: mailError } = await this.client
      .from('mails')
      .insert({
        sender_id: currentProfile.id,
        subject,
        body,
        thread_id: thread.id,
      })
      .select()
      .single();

    if (mailError || !mail) {
      throw formatError(mailError, 'Failed to send mail.');
    }

    const { error: recipientsError } = await this.client.from('mail_recipients').insert(
      recipientIds.map((recipientId) => ({
        mail_id: mail.id,
        recipient_id: recipientId,
      }))
    );

    if (recipientsError) {
      throw formatError(recipientsError, 'Failed to assign mail recipients.');
    }

    if (mailData instanceof FormData) {
      const attachments = mailData.getAll('attachments').filter((item): item is File => item instanceof File);
      for (const attachment of attachments) {
        const uploaded = await this.uploadToStorage(attachment, `mail/${mail.id}`);
        const { error: attachmentError } = await this.client.from('mail_attachments').insert({
          mail_id: mail.id,
          original_name: uploaded.name,
          file_name: uploaded.name,
          file_path: uploaded.url,
          mime_type: uploaded.type,
          file_size: uploaded.size,
        });
        if (attachmentError) {
          throw formatError(attachmentError, 'Mail sent, but an attachment could not be saved.');
        }
      }
    }

    await this.logActivity('CREATE', 'mail', String(mail.id), subject || 'Mail');

    return { success: true, data: mail };
  }

  async replyMail(threadId: string, replyData: any) {
    const currentProfile = await this.getCurrentProfileOrThrow();
    const { data: threadMails, error: threadError } = await this.client
      .from('mails')
      .select(`
        id,
        sender_id,
        recipients:mail_recipients(recipient_id)
      `)
      .eq('thread_id', threadId);

    if (threadError) {
      throw formatError(threadError, 'Failed to load thread recipients.');
    }

    const participantIds = new Set<string>();
    ensureArray(threadMails).forEach((mail: any) => {
      if (mail.sender_id) participantIds.add(String(mail.sender_id));
      ensureArray(mail.recipients).forEach((recipient: any) => {
        if (recipient.recipient_id) participantIds.add(String(recipient.recipient_id));
      });
    });
    participantIds.delete(String(currentProfile.id));

    const { data: mail, error: mailError } = await this.client
      .from('mails')
      .insert({
        sender_id: currentProfile.id,
        subject: 'Re:',
        body: String(replyData?.body || ''),
        thread_id: threadId,
      })
      .select()
      .single();

    if (mailError || !mail) {
      throw formatError(mailError, 'Failed to send reply.');
    }

    if (participantIds.size > 0) {
      const { error: recipientsError } = await this.client.from('mail_recipients').insert(
        [...participantIds].map((recipientId) => ({
          mail_id: mail.id,
          recipient_id: recipientId,
        }))
      );

      if (recipientsError) {
        throw formatError(recipientsError, 'Failed to assign reply recipients.');
      }
    }

    await this.logActivity('UPDATE', 'mail', String(mail.id), 'Reply sent');

    return { success: true, data: mail };
  }

  async markMailAsRead(id: string) {
    const currentUserId = await this.getCurrentUserId();
    const { data: directRecipients, error: directError } = await this.client
      .from('mail_recipients')
      .select('id')
      .eq('mail_id', id)
      .eq('recipient_id', currentUserId);

    if (directError) {
      throw formatError(directError, 'Failed to load mail recipient state.');
    }

    let targetMailIds: string[] = [];
    if (ensureArray(directRecipients).length > 0) {
      targetMailIds = [id];
    } else {
      const { data: threadMails, error: threadError } = await this.client
        .from('mails')
        .select('id')
        .eq('thread_id', id);

      if (threadError) {
        throw formatError(threadError, 'Failed to load thread mails.');
      }

      targetMailIds = ensureArray(threadMails).map((mail: any) => String(mail.id));
    }

    if (!targetMailIds.length) {
      return { success: true };
    }

    const { error } = await this.client
      .from('mail_recipients')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('recipient_id', currentUserId)
      .in('mail_id', targetMailIds);

    if (error) {
      throw formatError(error, 'Failed to mark mail as read.');
    }

    return { success: true };
  }

  async deleteMail(id: string) {
    const currentUserId = await this.getCurrentUserId();
    const { data: ownedMail, error: ownedMailError } = await this.client
      .from('mails')
      .select('id, sender_id, thread_id')
      .or(`id.eq.${id},thread_id.eq.${id}`)
      .eq('sender_id', currentUserId);

    if (ownedMailError) {
      throw formatError(ownedMailError, 'Failed to load mail for deletion.');
    }

    if (ensureArray(ownedMail).length > 0) {
      const { error } = await this.client
        .from('mails')
        .update({ sender_deleted: true })
        .in('id', ensureArray(ownedMail).map((mail: any) => String(mail.id)));

      if (error) {
        throw formatError(error, 'Failed to delete sent mail.');
      }
      return { success: true };
    }

    const { data: recipientTargets, error: recipientTargetError } = await this.client
      .from('mail_recipients')
      .select('id, mail_id')
      .eq('recipient_id', currentUserId)
      .eq('is_deleted', false)
      .eq('mail_id', id);

    if (recipientTargetError) {
      throw formatError(recipientTargetError, 'Failed to load received mail for deletion.');
    }

    let targetMailIds = ensureArray(recipientTargets).map((row: any) => String(row.mail_id));
    if (!targetMailIds.length) {
      const { data: threadMails, error: threadError } = await this.client
        .from('mails')
        .select('id')
        .eq('thread_id', id);

      if (threadError) {
        throw formatError(threadError, 'Failed to load thread mails for deletion.');
      }
      targetMailIds = ensureArray(threadMails).map((mail: any) => String(mail.id));
    }

    if (!targetMailIds.length) {
      return { success: true };
    }

    const { error } = await this.client
      .from('mail_recipients')
      .update({ is_deleted: true })
      .eq('recipient_id', currentUserId)
      .in('mail_id', targetMailIds);

    if (error) {
      throw formatError(error, 'Failed to delete received mail.');
    }

    return { success: true };
  }

  async getSystemUsers(search = '') {
    const currentProfile = await this.getCurrentProfileOrThrow().catch(() => null);
    const currentRole = currentProfile ? await this.getRoleById(currentProfile.role_id).catch(() => null) : null;
    const hideCurrentUser = ['super admin', 'superadmin'].includes(String(currentRole?.name || '').toLowerCase().replace(/_/g, ' '));

    let query = this.client
      .from('profiles')
      .select('id, name, email')
      .order('name', { ascending: true })
      .limit(10);

    if (search.trim()) {
      query = query.or(`name.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%`);
    }

    const { data, error } = await query;
    if (error) {
      throw formatError(error, 'Unable to load users.');
    }

    return {
      success: true,
      data: hideCurrentUser
        ? ensureArray(data).filter((profile: any) => String(profile.id) !== String(currentProfile?.id))
        : ensureArray(data),
    };
  }
}
