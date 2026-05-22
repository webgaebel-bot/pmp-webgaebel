import { ApiError } from '@/services/api';
import { getSupabaseClient } from '@/lib/supabase';
import { PERMISSION_DEFINITIONS, isSuperAdminRole, normalizeRoleName } from '@/lib/permissions';
import { createAuditService } from '@/services/auditService';
import { createAuthService } from '@/services/authService';
import { createCalendarService } from '@/services/calendarService';
import { createFileService } from '@/services/fileService';
import { createFinanceService } from '@/services/financeService';
import { createLeadService } from '@/services/leadService';
import { createNotificationService } from '@/services/notificationService';
import { createPayrollService } from '@/services/payrollService';
import { createPermissionService } from '@/services/permissionService';
import { createProfileService } from '@/services/profileService';
import { createProjectService } from '@/services/projectService';
import { createTaskService } from '@/services/taskService';
import { createTimeTrackingService } from '@/services/timeTrackingService';
import { calculateFinanceSummary } from '@/lib/financeEngine';
import {
  clampPage,
  clampPageSize,
  evaluateRole,
  requireOwnership,
  requirePermission,
  requireProjectMembership,
  resolveScope,
} from '@/services/security/accessControl';
import type { Task } from '@/types';
import type {
  AddLeadActivityPayload,
  CreateFlexibleFollowupPayload,
  CreateLeadPayload,
  FlexibleFollowupRecord,
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

const DEFAULT_PERMISSIONS = PERMISSION_DEFINITIONS;

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
const splitMultiValue = (value?: string | null): string[] =>
  String(value || '')
    .split(/[\n,;|]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
const normalizeDigits = (value?: string | null) => String(value || '').replace(/\D/g, '');
const normalizeUrlValue = (value?: string | null) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '');

const humanizeText = (value?: string | null) =>
  String(value || '')
    .trim()
    .replace(/[_:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatActivityEntityLabel = (entityType?: string | null) => {
  const key = String(entityType || '').trim().toLowerCase();
  const map: Record<string, string> = {
    project: 'Project',
    task: 'Task',
    user: 'User',
    role: 'Role',
    rolepermissions: 'Role permissions',
    rolepermission: 'Role permissions',
    permission: 'Permission',
    file: 'File',
    mail: 'Mail',
    lead: 'Lead',
    lead_taxonomy: 'Lead taxonomy',
    time_log: 'Time log',
    notification: 'Notification',
  };

  return map[key] || humanizeText(key || 'Activity');
};

const isLikelyIdentifier = (value?: string | null) =>
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+)$/i.test(String(value || '').trim());

const formatActivitySummary = (action?: string | null, entityType?: string | null) => {
  const label = formatActivityEntityLabel(entityType).toLowerCase();
  const verbMap: Record<string, string> = {
    create: 'Created',
    update: 'Updated',
    delete: 'Deleted',
    assign: 'Assigned',
    task_comment_added: 'Added comment to',
  };
  const normalizedAction = String(action || 'update').trim().toLowerCase();
  const verb = verbMap[normalizedAction] || 'Updated';

  if (normalizedAction === 'task_comment_added') {
    return `${verb} ${label}`;
  }

  return `${verb} ${label}`;
};

const formatActivityDetail = (entityType?: string | null, entityName?: string | null, entityId?: string | null) => {
  const type = String(entityType || '').trim().toLowerCase();
  const rawName = String(entityName || '').trim();
  const rawId = String(entityId || '').trim();

  const identifier = rawName || rawId;
  if (!identifier || isLikelyIdentifier(identifier)) return '';

  if (rawName.startsWith('permissions:')) {
    const count = rawName.split(':')[1] || '0';
    return `Updated ${count} permission${count === '1' ? '' : 's'}`;
  }

  if (rawName.startsWith('member:')) {
    return `Updated member assignment ${rawName.split(':')[1] || ''}`.trim();
  }

  if (rawName.startsWith('assignee:removed')) return 'Removed assignee';
  if (rawName.startsWith('assignee:')) return `Assigned to ${rawName.split(':')[1] || 'user'}`;
  if (rawName.startsWith('status:')) return `Status changed to ${humanizeText(rawName.split(':')[1] || '')}`;
  if (rawName.startsWith('priority:')) return `Priority changed to ${humanizeText(rawName.split(':')[1] || '')}`;

  if (type === 'rolepermissions') return 'Role permission settings updated';
  if (type === 'time_log') return 'Time log entry created';
  if (type === 'lead_taxonomy') return 'Lead taxonomy entry created';
  if (type === 'mail') return 'Mail activity updated';
  if (type === 'lead') return 'Lead record updated';

  return humanizeText(rawName || rawId);
};

const monthKey = (value?: string | null) => {
  if (!value) return 'Unknown';
  return new Date(value).toLocaleString('en-US', { month: 'short', year: 'numeric' });
};

const getRangeBounds = (range?: string) => {
  const end = new Date();
  const start = new Date(end);
  switch (String(range || 'month').toLowerCase()) {
    case 'year':
      start.setMonth(start.getMonth() - 11);
      start.setDate(1);
      break;
    case 'quarter':
      start.setMonth(start.getMonth() - 2);
      start.setDate(1);
      break;
    case 'month':
    default:
      start.setDate(1);
      break;
  }
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
};

export class SupabaseApiService {
  private readonly modules = {
    auth: createAuthService(this),
    permission: createPermissionService(this),
    profile: createProfileService(this),
    project: createProjectService(this),
    task: createTaskService(this),
    lead: createLeadService(this),
    notification: createNotificationService(this),
    calendar: createCalendarService(this),
    timeTracking: createTimeTrackingService(this),
    finance: createFinanceService(this),
    payroll: createPayrollService(this),
    audit: createAuditService(this),
    file: createFileService(this),
  };

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

  private async getAccessibleProjectIds(userId: string) {
    const { data, error } = await this.client
      .from('project_members')
      .select('project_id')
      .eq('user_id', userId);

    if (error) {
      throw formatError(error, 'Unable to load project access.');
    }

    return ensureArray(data).map((row: any) => String(row.project_id)).filter(Boolean);
  }

  private async getCurrentAccessContext() {
    const profile = await this.getCurrentProfileOrThrow();
    const role = await this.getRoleById(profile.role_id);
    const permissions = await this.getPermissionsByRoleId(profile.role_id);
    const canViewAllLeads = permissions.includes('leads.view.all');
    const canViewTeamLeads = permissions.includes('leads.view.team');
    const canViewAllProjects = permissions.includes('projects.view.all');
    const canViewTeamProjects = permissions.includes('projects.view.team');
    const canViewAllTime = permissions.includes('time.view.all');
    const canViewTeamTime = permissions.includes('time.view.team');
    const canViewAllNotifications = permissions.includes('notifications.view.all');
    const canViewAllFinance = permissions.includes('finance.view.all');
    const canViewTeamFinance = permissions.includes('finance.view.team');
    const isAdminActor =
      isSuperAdminRole(role) ||
      permissions.includes('roles.manage') ||
      permissions.includes('permissions.manage');

    return {
      profile,
      role,
      permissions,
      canViewAllLeads,
      canViewTeamLeads,
      canViewAllProjects,
      canViewTeamProjects,
      canViewAllTime,
      canViewTeamTime,
      canViewAllNotifications,
      canViewAllFinance,
      canViewTeamFinance,
      isAdminActor,
    };
  }

  private isMissingRpcFunctionError(error: any, functionName: string) {
    const message = [error?.message, error?.details, error?.hint]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const code = String(error?.code || '').toUpperCase();
    const fnName = functionName.toLowerCase();
    return (
      code === 'PGRST202' ||
      message.includes(`public.${fnName}`) ||
      message.includes(`function ${fnName}`) ||
      message.includes('schema cache')
    );
  }

  private isMissingTableError(error: any, tableName: string) {
    const message = [error?.message, error?.details, error?.hint]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const code = String(error?.code || '').toUpperCase();
    return code === 'PGRST205' || message.includes(`table 'public.${tableName}'`) || message.includes(`public.${tableName}`);
  }

  private isRpcResultShapeError(error: any) {
    const message = [error?.message, error?.details, error?.hint]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return message.includes('cannot coerce the result to a single json object');
  }

  private firstRpcRow<T = any>(value: T | T[] | null | undefined): T | null {
    if (Array.isArray(value)) return (value[0] as T) || null;
    return (value as T) || null;
  }

  private async updateLeadWithFallback(leadId: string, patch: Record<string, any>, fallbackMessage: string) {
    const { data, error } = await this.client.rpc('update_lead_secure', {
      p_lead_id: leadId,
      p_patch: patch,
    });

    const normalizedData = this.firstRpcRow(data);
    if (!error && normalizedData) {
      return normalizedData;
    }

    if (!this.isMissingRpcFunctionError(error, 'update_lead_secure') && !this.isRpcResultShapeError(error)) {
      throw formatError(error, fallbackMessage);
    }

    const { error: fallbackError } = await this.client
      .from('leads')
      .update(patch)
      .eq('id', leadId);

    if (fallbackError) {
      throw formatError(fallbackError, fallbackMessage);
    }

    return null;
  }

  private async createTimeTrackingSessionWithFallback(session: Record<string, any>, fallbackMessage: string) {
    const { data, error } = await this.client.rpc('create_time_tracking_session_secure', {
      p_session: session,
    });

    if (!error && data) {
      return data;
    }

    if (!this.isMissingRpcFunctionError(error, 'create_time_tracking_session_secure')) {
      throw formatError(error, fallbackMessage);
    }

    const insertPayload = {
      ...session,
      started_at: session.started_at || new Date().toISOString(),
    };

    const { data: created, error: fallbackError } = await this.client
      .from('time_tracking_sessions')
      .insert([insertPayload])
      .select()
      .single();

    if (fallbackError || !created) {
      throw formatError(fallbackError, fallbackMessage);
    }

    return created;
  }

  private extractDuplicateSignals(input: Partial<Lead> & Partial<CreateLeadPayload>) {
    const emails = splitMultiValue(input.email);
    const phones = splitMultiValue(input.phone).map(normalizeDigits).filter(Boolean);
    const websites = splitMultiValue(input.website).map(normalizeUrlValue).filter(Boolean);
    const linkedin = splitMultiValue(input.linkedin_url).map(normalizeUrlValue).filter(Boolean);
    const facebook = splitMultiValue(input.facebook_url).map(normalizeUrlValue).filter(Boolean);
    const instagram = splitMultiValue(input.instagram_url).map(normalizeUrlValue).filter(Boolean);

    return {
      emails,
      phones,
      websites,
      linkedin,
      facebook,
      instagram,
      fullName: String(input.name || '').trim().toLowerCase(),
      company: String(input.company || '').trim().toLowerCase(),
      niche: String(input.designation || input.custom_fields?.Niche || '').trim().toLowerCase(),
      service: String(input.services_offered || '').trim().toLowerCase(),
      source: String(input.source || '').trim().toLowerCase(),
    };
  }

  private hasAnyOverlap(left: string[], right: string[]) {
    return left.some((value) => right.includes(value));
  }

  private async assertLeadIsNotDuplicate(payload: Partial<Lead> & Partial<CreateLeadPayload>, ignoreLeadId?: string | number) {
    const incoming = this.extractDuplicateSignals(payload);
    const { data, error } = await this.client
      .from('leads')
      .select('id, name, email, phone, company, designation, website, linkedin_url, facebook_url, instagram_url, services_offered, source, metadata')
      .order('created_at', { ascending: false })
      .limit(250);

    if (error) throw formatError(error, 'Unable to validate duplicate lead.');

    const duplicate = ensureArray(data).find((row: any) => {
      if (ignoreLeadId && String(row.id) === String(ignoreLeadId)) return false;
      const existing = this.extractDuplicateSignals({
        name: row.name,
        email: row.email,
        phone: row.phone,
        company: row.company,
        designation: row.designation,
        website: row.website,
        linkedin_url: row.linkedin_url,
        facebook_url: row.facebook_url,
        instagram_url: row.instagram_url,
        services_offered: row.services_offered,
        source: row.source,
        custom_fields: row.metadata?.custom_fields || {},
      });

      const strongMatch =
        this.hasAnyOverlap(incoming.emails, existing.emails) ||
        this.hasAnyOverlap(incoming.phones, existing.phones) ||
        this.hasAnyOverlap(incoming.websites, existing.websites) ||
        this.hasAnyOverlap(incoming.linkedin, existing.linkedin) ||
        this.hasAnyOverlap(incoming.facebook, existing.facebook) ||
        this.hasAnyOverlap(incoming.instagram, existing.instagram);

      const weakMatchFields = [
        incoming.fullName && incoming.fullName === existing.fullName,
        incoming.company && incoming.company === existing.company,
      ].filter(Boolean).length;

      const fullRecordMatch = Boolean(incoming.fullName && incoming.company && weakMatchFields >= 3);

      return strongMatch || fullRecordMatch;
    });

    if (duplicate) {
      const duplicateName = String(duplicate.name || duplicate.company || 'Existing lead').trim();
      const duplicateCreatedAt = duplicate.created_at ? new Date(duplicate.created_at).toLocaleString() : '';
      const duplicateDetails = JSON.stringify({
        duplicate_id: duplicate.id,
        duplicate_name: duplicateName,
        duplicate_created_at: duplicateCreatedAt || undefined,
      });

      throw new ApiError(
        `This lead already exists: ${duplicateName}.`,
        409,
        'LEAD_DUPLICATE',
        duplicateDetails
      );
    }
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
      const normalizedEntityName = formatActivityDetail(entityType, entityName, entityId) || entityName || entityId;
      await this.client.from('activity_logs').insert({
        user_id: profile.id,
        action,
        entity_type: entityType,
        entity_id: entityId,
        entity_name: normalizedEntityName,
      });
      await this.client.from('notifications').insert({
        user_id: null,
        title: `${entityType} ${action.toLowerCase()}`,
        message: `${profile.name || profile.email || 'A user'} ${action.toLowerCase()} ${normalizedEntityName || entityType}.`,
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

  private getStoragePublicUrl(pathOrUrl?: string | null) {
    const value = String(pathOrUrl || '');
    if (!value) return '';
    if (/^https?:\/\//i.test(value) || value.startsWith('data:') || value.startsWith('blob:')) return value;
    return this.client.storage.from('files').getPublicUrl(value).data.publicUrl;
  }

  private mapAttachment = (attachment: any) => {
    const storedPath = attachment?.file_path || attachment?.file_url || '';
    const publicUrl = this.getStoragePublicUrl(storedPath);
    return {
      id: attachment?.id,
      original_name: attachment?.original_name || attachment?.file_name || 'attachment',
      file_name: attachment?.file_name || '',
      file_path: publicUrl,
      path: storedPath,
      url: publicUrl,
      file_url: publicUrl,
      mime_type: attachment?.mime_type || '',
      file_size: attachment?.file_size || 0,
    };
  };

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

  private parseCsv(text: string) {
    const rows: string[][] = [];
    let row: string[] = [];
    let value = '';
    let inQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const nextChar = text[index + 1];

      if (char === '"' && inQuotes && nextChar === '"') {
        value += '"';
        index += 1;
        continue;
      }

      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }

      if (char === ',' && !inQuotes) {
        row.push(value.trim());
        value = '';
        continue;
      }

      if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') index += 1;
        row.push(value.trim());
        if (row.some((cell) => cell)) rows.push(row);
        row = [];
        value = '';
        continue;
      }

      value += char;
    }

    row.push(value.trim());
    if (row.some((cell) => cell)) rows.push(row);
    return rows;
  }

  private normalizeCsvHeader(header: string) {
    const normalized = header.trim().toLowerCase().replace(/^\uFEFF/, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const aliases: Record<string, string> = {
      company_name: 'company',
      company: 'company',
      niche: 'designation',
      industry_niche: 'designation',
      designation: 'designation',
      job_title: 'designation',
      service: 'services_offered',
      services: 'services_offered',
      services_offered: 'services_offered',
      platform_source: 'source',
      source: 'source',
      gmail_email: 'email',
      email_address: 'email',
      email: 'email',
      phone_number: 'phone',
      phone: 'phone',
      linkedin: 'linkedin_url',
      linked_in: 'linkedin_url',
      facebook: 'facebook_url',
      insta: 'instagram_url',
      instagram: 'instagram_url',
      twitter: 'x_url',
      x: 'x_url',
      x_url: 'x_url',
      name: 'name',
      client_name: 'name',
      lead_name: 'name',
      notes: 'notes',
      note: 'notes',
    };

    return aliases[normalized] || normalized;
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
    const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
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
      project_id: row.project_id ? String(row.project_id) : undefined,
      project_name: row.project?.name || undefined,
      assigned_to_name: row.assignee?.name || undefined,
      assigned_to_avatar: row.assignee?.avatar_url || row.assignee?.profile_image || undefined,
      created_by: row.created_by ? String(row.created_by) : undefined,
      created_by_name: row.owner?.name || undefined,
      created_by_email: row.owner?.email || undefined,
      lost_reason: row.lost_reason || undefined,
      last_contacted_at: row.last_contacted_at || row.last_contact_at || undefined,
      next_followup_at: nextFollowup,
      completed: Boolean(row.completed),
      completed_at: row.completed_at || undefined,
      converted_at: row.converted_at || undefined,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      notes: row.notes || undefined,
      custom_fields: metadata.custom_fields || {},
      metadata,
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
      owner:profiles!leads_created_by_fkey(id, name, email),
      project:projects(id, name),
      lead_activities(id, lead_id, activity_type, summary, description, duration_minutes, outcome, created_by, user_id, created_at, activity_at),
      lead_notes(id, lead_id, note, content, created_at, user_id),
      lead_followups(id, lead_id, followup_type, scheduled_at, due_at, completed, completed_at, reminder_sent, notes, description, status, created_at, assigned_to),
      lead_contacts(id, lead_id, name, email, phone, is_primary, created_at),
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
    if (endpoint === '/users') {
      return (await this.getUsers()) as T;
    }
    if (endpoint === '/currencies') {
      return (await this.getCurrencies()) as T;
    }
    if (endpoint === '/leads') {
      return (await this.getLeads()) as T;
    }
    if (endpoint === '/leads/taxonomies' || endpoint.startsWith('/leads/taxonomies?')) {
      return (await this.getLeadTaxonomies(endpoint)) as T;
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
    if (endpoint === '/finance/salaries') {
      return (await this.getFinanceSalaries()) as T;
    }
    if (endpoint === '/finance/taxes') {
      return (await this.getFinanceTaxes()) as T;
    }
    if (endpoint === '/finance/commissions') {
      return (await this.getFinanceCommissions()) as T;
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
    if (endpoint === '/currencies') {
      return (await this.createCurrency(data)) as T;
    }
    if (endpoint === '/leads') {
      return (await this.createLead(data)) as T;
    }
    if (endpoint === '/leads/taxonomies') {
      return (await this.createLeadTaxonomy(data)) as T;
    }
    if (endpoint === '/time-logs') {
      return (await this.createTimeLog(data)) as T;
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
    if (endpoint === '/finance/salaries') {
      return (await this.createFinanceSalary(data)) as T;
    }
    if (endpoint === '/finance/taxes') {
      return (await this.createFinanceTax(data)) as T;
    }
    if (endpoint === '/finance/commissions') {
      return (await this.createFinanceCommission(data)) as T;
    }
    if (endpoint === '/finance/settings') {
      return (await this.saveFinanceSettings(data)) as T;
    }
    if (endpoint === '/time-logs/session/start') {
      return (await this.startTimeSession(data)) as T;
    }
    if (endpoint === '/time-logs/session/stop') {
      return (await this.stopTimeSession(data.session_id, data)) as T;
    }
    return this.fallbackOrThrow('post', endpoint, data);
  }

  async patch<T = any>(endpoint: string, data?: any): Promise<T> {
    const taxonomyUpdateMatch = endpoint.match(/^\/leads\/taxonomies\/(.+)$/);
    if (taxonomyUpdateMatch) {
      return (await this.updateLeadTaxonomy(taxonomyUpdateMatch[1], data)) as T;
    }
    return this.fallbackOrThrow('patch', endpoint, data);
  }

  async put<T = any>(endpoint: string, data?: any): Promise<T> {
    const founderUpdateMatch = endpoint.match(/^\/finance\/founders\/(.+)$/);
    if (founderUpdateMatch) {
      return (await this.updateFinanceFounder(founderUpdateMatch[1], data)) as T;
    }
    const salaryUpdateMatch = endpoint.match(/^\/finance\/salaries\/(.+)$/);
    if (salaryUpdateMatch) {
      return (await this.updateFinanceSalary(salaryUpdateMatch[1], data)) as T;
    }
    return this.fallbackOrThrow('put', endpoint, data);
  }

  async delete<T = any>(endpoint: string): Promise<T> {
    const taxonomyDeleteMatch = endpoint.match(/^\/leads\/taxonomies\/(.+)$/);
    if (taxonomyDeleteMatch) {
      return (await this.deleteLeadTaxonomy(taxonomyDeleteMatch[1])) as T;
    }
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
    const salaryDeleteMatch = endpoint.match(/^\/finance\/salaries\/(.+)$/);
    if (salaryDeleteMatch) {
      return (await this.deleteFinanceSalary(salaryDeleteMatch[1])) as T;
    }
    const taxDeleteMatch = endpoint.match(/^\/finance\/taxes\/(.+)$/);
    if (taxDeleteMatch) {
      return (await this.deleteFinanceTax(taxDeleteMatch[1])) as T;
    }
    const commissionDeleteMatch = endpoint.match(/^\/finance\/commissions\/(.+)$/);
    if (commissionDeleteMatch) {
      return (await this.deleteFinanceCommission(commissionDeleteMatch[1])) as T;
    }
    const timeLogDeleteMatch = endpoint.match(/^\/time-logs\/(.+)$/);
    if (timeLogDeleteMatch) {
      return (await this.deleteTimeLog(timeLogDeleteMatch[1])) as T;
    }
    const logDeleteMatch = endpoint.match(/^\/activity-logs\/(.+)$/);
    if (logDeleteMatch) {
      return (await this.deleteActivityLog(logDeleteMatch[1])) as T;
    }
    const currencyDeleteMatch = endpoint.match(/^\/currencies\/(.+)$/);
    if (currencyDeleteMatch) {
      return (await this.deleteCurrency(currencyDeleteMatch[1])) as T;
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
    const [projectsRes, tasksRes] = await Promise.all([this.getProjects(), this.getTasks()]);

    const projects = ensureArray((projectsRes as any).data);
    const tasks = ensureArray((tasksRes as any).data);
    const projectMembers = new Set<string>();
    projects.forEach((project: any) => {
      ensureArray(project.members).forEach((member: any) => {
        if (member?.user_id) projectMembers.add(String(member.user_id));
      });
    });
    tasks.forEach((task: any) => {
      if (task.assigned_to) projectMembers.add(String(task.assigned_to));
      if (task.reporter?.id) projectMembers.add(String(task.reporter.id));
    });
    const memberIds = [...projectMembers];
    const { data: memberProfiles, error: memberError } = memberIds.length
      ? await this.client.from('profiles').select('id, status').in('id', memberIds)
      : { data: [], error: null as any };

    if (memberError) throw formatError(memberError, 'Unable to load team stats.');

    const now = new Date();
    const overdueTasks = tasks.filter((task: any) => task.due_date && new Date(task.due_date) < now && normalizeStatus(task.status) !== 'done').length;
    const activeMembers = ensureArray(memberProfiles).filter((profile: any) => normalizeStatus(profile.status) === 'active').length;

    return {
      success: true,
      data: {
        projects: {
          total: projects.length,
          active: String(
            projects.filter((project: any) => ['active', 'in_progress', 'planning', 'on_hold'].includes(normalizeStatus(project.status))).length
          ),
        },
        tasks: {
          total: tasks.length,
        },
        overdueTasks,
        teamMembers: {
          total: memberIds.length,
          online: String(activeMembers),
        },
      },
    };
  }

  async getProjectProgressReport() {
    const projectsRes = await this.getProjects();
    const projects = ensureArray((projectsRes as any).data);

    return {
      success: true,
      data: projects.map((project: any) => {
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
    const tasksRes = await this.getTasks();
    const tasks = ensureArray((tasksRes as any).data);
    const assigneeIds = [...new Set(tasks.map((task: any) => task.assigned_to).filter(Boolean))];
    const { data: users, error } = assigneeIds.length
      ? await this.client
          .from('profiles')
          .select('id, name, email, avatar_url, profile_image')
          .in('id', assigneeIds)
      : { data: [], error: null as any };

    if (error) throw formatError(error, 'Unable to load users.');

    const data = ensureArray(users).map((user: any) => {
      const assigned = tasks.filter((task: any) => String(task.assigned_to || '') === String(user.id));
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
    const tasksRes = await this.getTasks();
    const data = ensureArray((tasksRes as any).data).map((task: any) => ({ status: task.status }));
    const error = null;
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
    const tasksRes = await this.getTasks();
    const data = ensureArray((tasksRes as any).data).map((task: any) => ({
      created_at: task.created_at,
      completed_at: task.completed_at,
      status: task.status,
    }));
    const error = null;
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
    const access = await this.getCurrentAccessContext();
    const projectIds = access.canViewAllProjects ? [] : await this.getAccessibleProjectIds(access.profile.id);

    let query = this.client
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

    if (!access.canViewAllProjects) {
      if (projectIds.length > 0) {
        query = query.in('id', projectIds);
      } else {
        query = query.eq('created_by', access.profile.id);
      }
    }

    const { data, error } = await query;

    if (error) throw formatError(error, 'Unable to load projects.');

    return {
      success: true,
      data: ensureArray(data).map(this.mapProject),
    };
  }

  async getProject(id: string) {
    const access = await this.getCurrentAccessContext();
    if (!access.canViewAllProjects) {
      const projectIds = await this.getAccessibleProjectIds(access.profile.id);
      if (!projectIds.includes(String(id))) {
        throw new ApiError('You do not have access to this project.', 403, 'PROJECT_ACCESS_DENIED');
      }
    }

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
    const access = await this.getCurrentAccessContext();
    if (!access.canViewAllProjects && !access.permissions.includes('projects.create')) {
      throw new ApiError('You do not have permission to create projects.', 403, 'PROJECT_CREATE_DENIED');
    }
    const { data, error } = await this.client.rpc('create_project_secure', {
      p_project: {
        name: payload.name,
        description: payload.description || null,
        priority: payload.priority || 'medium',
        status: payload.status || 'planning',
        progress: payload.progress || 0,
        start_date: payload.start_date || null,
        end_date: payload.end_date || null,
      },
    });
    if (error || !data) throw formatError(error, 'Failed to create project.');

    await this.logActivity('CREATE', 'project', String(data.id), data.name);

    return { success: true, message: 'Project created successfully.', data };
  }

  async updateProject(id: string, payload: any) {
    const access = await this.getCurrentAccessContext();
    if (!access.canViewAllProjects && !access.permissions.includes('projects.update')) {
      const project = await this.getProject(id);
      const projectData = project.data as any;
      const currentUserId = String(access.profile.id);
      const isOwnerOrManager =
        String(projectData.created_by_id || '') === currentUserId ||
        ensureArray(projectData.members).some((member: any) =>
          String(member.user_id) === currentUserId && ['owner', 'manager'].includes(String(member.role || '').toLowerCase())
        );
      if (!isOwnerOrManager) {
        throw new ApiError('You do not have permission to update projects.', 403, 'PROJECT_UPDATE_DENIED');
      }
    }

    const { error } = await this.client.rpc('update_project_secure', {
      p_project_id: id,
      p_patch: {
        name: payload.name,
        description: payload.description,
        priority: payload.priority,
        status: payload.status,
        start_date: payload.start_date || null,
        end_date: payload.end_date || null,
        progress: payload.progress,
      },
    });
    if (error) throw formatError(error, 'Failed to update project.');

    await this.logActivity('UPDATE', 'project', id, payload.name || id);

    return { success: true, message: 'Project updated successfully.' };
  }

  async deleteProject(id: string) {
    const project = await this.getProject(id);
    const access = await this.getCurrentAccessContext();
    if (!access.canViewAllProjects && !access.permissions.includes('projects.delete')) {
      const projectData = project.data as any;
      const currentUserId = String(access.profile.id);
      const isOwnerOrManager =
        String(projectData.created_by_id || '') === currentUserId ||
        ensureArray(projectData.members).some((member: any) =>
          String(member.user_id) === currentUserId && ['owner', 'manager'].includes(String(member.role || '').toLowerCase())
        );
      if (!isOwnerOrManager) {
        throw new ApiError('You do not have permission to delete projects.', 403, 'PROJECT_DELETE_DENIED');
      }
    }
    const { error } = await this.client.rpc('delete_project_secure', { p_project_id: id });
    if (error) throw formatError(error, 'Failed to delete project.');

    await this.logActivity('DELETE', 'project', id, project.data?.name || id);

    return { success: true, message: 'Project deleted successfully.' };
  }

  async getUserProjects(userId: string) {
    const access = await this.getCurrentAccessContext();
    const targetUserId = access.canViewAllProjects ? String(userId) : String(access.profile.id);
    const { data, error } = await this.client
      .from('project_members')
      .select('project:projects(*)')
      .eq('user_id', targetUserId);

    if (error) throw formatError(error, 'Unable to load user projects.');

    return { success: true, data: ensureArray(data).map((row: any) => row.project).filter(Boolean) };
  }

  async getProjectMembers(projectId: string) {
    const access = await this.getCurrentAccessContext();
    if (!access.canViewAllProjects) {
      const projectIds = await this.getAccessibleProjectIds(access.profile.id);
      if (!projectIds.includes(String(projectId))) {
        throw new ApiError('You do not have access to this project.', 403, 'PROJECT_ACCESS_DENIED');
      }
    }

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
    const access = await this.getCurrentAccessContext();
    let query = this.client
      .from('projects')
      .select('id, name')
      .order('name', { ascending: true });

    if (!access.canViewAllProjects) {
      const projectIds = await this.getAccessibleProjectIds(access.profile.id);
      if (projectIds.length > 0) {
        query = query.in('id', projectIds);
      } else {
        query = query.eq('created_by', access.profile.id);
      }
    }

    const { data, error } = await query;

    if (error) throw formatError(error, 'Unable to load projects.');

    return { success: true, data: ensureArray(data) };
  }

  async addProjectMember(projectId: string, userId: string, role: string) {
    const access = await this.getCurrentAccessContext();
    if (!access.canViewAllProjects && !access.permissions.includes('members.create')) {
      throw new ApiError('You do not have permission to add project members.', 403, 'PROJECT_MEMBER_CREATE_DENIED');
    }
    const { data, error } = await this.client.rpc('assign_project_member_secure', {
      p_project_id: projectId,
      p_user_id: userId,
      p_role: role || 'member',
    });

    if (error) throw formatError(error, 'Failed to add project member.');

    await this.logActivity('ASSIGN', 'project', projectId, `member:${userId}`);

    return { success: true, data };
  }

  async removeProjectMember(projectId: string, userId: string) {
    const access = await this.getCurrentAccessContext();
    if (!access.canViewAllProjects && !access.permissions.includes('members.delete')) {
      throw new ApiError('You do not have permission to remove project members.', 403, 'PROJECT_MEMBER_DELETE_DENIED');
    }
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
    const access = await this.getCurrentAccessContext();
    const currentUserId = String(access.profile.id);
    const accessibleProjectIds = access.canViewAllProjects ? [] : await this.getAccessibleProjectIds(currentUserId);
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

    if (!access.canViewAllProjects) {
      const conditions = [`reporter_id.eq.${currentUserId}`, `assignee_id.eq.${currentUserId}`];
      if (accessibleProjectIds.length > 0) {
        conditions.push(`project_id.in.(${accessibleProjectIds.join(',')})`);
      }
      query = query.or(conditions.join(','));
    }

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
    const access = await this.getCurrentAccessContext();
    const currentUserId = String(access.profile.id);
    const accessibleProjectIds = access.canViewAllProjects ? [] : await this.getAccessibleProjectIds(currentUserId);

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
      .eq('id', id);

    if (!access.canViewAllProjects) {
      const conditions = [`reporter_id.eq.${currentUserId}`, `assignee_id.eq.${currentUserId}`];
      if (accessibleProjectIds.length > 0) {
        conditions.push(`project_id.in.(${accessibleProjectIds.join(',')})`);
      }
      query = query.or(conditions.join(','));
    }

    const { data, error } = await query.single();

    if (error || !data) throw formatError(error, 'Task not found.');

    return { success: true, data: this.mapTask(data) };
  }

  async getTasksByProjectId(projectId: string) {
    return this.getTasks({ project_id: projectId });
  }

  async createTask(payload: any) {
    const access = await this.getCurrentAccessContext();
    if (!access.permissions.includes('tasks.create') && !access.canViewAllProjects) {
      throw new ApiError('You do not have permission to create tasks.', 403, 'TASK_CREATE_DENIED');
    }

    if (!access.canViewAllProjects) {
      const accessibleProjectIds = await this.getAccessibleProjectIds(String(access.profile.id));
      if (!accessibleProjectIds.includes(String(payload.project_id))) {
        throw new ApiError('You do not have access to this project.', 403, 'TASK_PROJECT_DENIED');
      }
    }

    const { data, error } = await this.client.rpc('create_task_secure', {
      p_task: {
        title: payload.title,
        description: payload.description || null,
        priority: payload.priority || 'medium',
        status: payload.status || 'todo',
        project_id: payload.project_id,
        due_date: payload.due_date || null,
        assignee_id: payload.assignee_id || null,
        estimated_hours: payload.estimated_hours,
        actual_hours: payload.actual_hours,
      },
    });
    if (error || !data) throw formatError(error, 'Failed to create task.');

    await this.logActivity('CREATE', 'task', String(data.id), data.title);

    return { success: true, message: 'Task created successfully.', data };
  }

  async updateTask(id: string, payload: any) {
    const access = await this.getCurrentAccessContext();
    const task = await this.getTask(id);
    const taskData = task.data as Task;
    const currentUserId = String(access.profile.id);
    const accessibleProjectIds = access.canViewAllProjects ? [] : await this.getAccessibleProjectIds(currentUserId);
    const canAccessTask =
      String(taskData.reporter?.id || '') === currentUserId ||
      String(taskData.assigned_to || '') === currentUserId ||
      (taskData.project_id ? accessibleProjectIds.includes(taskData.project_id) : false) ||
      access.permissions.includes('tasks.update') ||
      access.isAdminActor;

    if (!canAccessTask) {
      throw new ApiError('You do not have access to this task.', 403, 'TASK_ACCESS_DENIED');
    }
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

    const { error } = await this.client.rpc('update_task_secure', {
      p_task_id: id,
      p_patch: updatePayload,
    });
    if (error) throw formatError(error, 'Failed to update task.');

    await this.logActivity('UPDATE', 'task', id, payload.title || id);

    return { success: true, message: 'Task updated successfully.' };
  }

  async deleteTask(id: string) {
    const task = await this.getTask(id);
    const access = await this.getCurrentAccessContext();
    const taskData = task.data as Task;
    const isReporter = taskData.reporter?.id === access.profile.id;
    if (!isReporter && !access.permissions.includes('tasks.delete') && !access.isAdminActor) {
      throw new ApiError('You do not have permission to delete tasks.', 403, 'TASK_DELETE_DENIED');
    }
    const { error } = await this.client.rpc('delete_task_secure', { p_task_id: id });
    if (error) throw formatError(error, 'Failed to delete task.');

    await this.logActivity('DELETE', 'task', id, task.data?.title || id);

    return { success: true, message: 'Task deleted successfully.' };
  }

  async updateTaskStatus(id: string, status: string) {
    const access = await this.getCurrentAccessContext();
    const task = await this.getTask(id);
    const taskData = task.data as Task;
    const canUpdate =
      taskData.assigned_to === access.profile.id ||
      taskData.reporter?.id === access.profile.id ||
      access.permissions.includes('tasks.update') ||
      access.isAdminActor;
    if (!canUpdate) {
      throw new ApiError('You do not have permission to update this task.', 403, 'TASK_UPDATE_DENIED');
    }
    const { error } = await this.client.rpc('update_task_secure', {
      p_task_id: id,
      p_patch: { status },
    });
    if (error) throw formatError(error, 'Failed to update task status.');

    await this.logActivity('UPDATE', 'task', id, `status:${status}`);

    return { success: true };
  }

  async updateTaskPriority(id: string, priority: string) {
    const access = await this.getCurrentAccessContext();
    const task = await this.getTask(id);
    const taskData = task.data as Task;
    const canUpdate =
      taskData.assigned_to === access.profile.id ||
      taskData.reporter?.id === access.profile.id ||
      access.permissions.includes('tasks.update') ||
      access.isAdminActor;
    if (!canUpdate) {
      throw new ApiError('You do not have permission to update this task.', 403, 'TASK_UPDATE_DENIED');
    }
    const { error } = await this.client.rpc('update_task_secure', {
      p_task_id: id,
      p_patch: { priority },
    });
    if (error) throw formatError(error, 'Failed to update task priority.');

    await this.logActivity('UPDATE', 'task', id, `priority:${priority}`);

    return { success: true };
  }

  async getUserTasks(userId: string) {
    const access = await this.getCurrentAccessContext();
    const currentUserId = String(access.profile.id);
    const targetUserId = access.canViewAllProjects ? String(userId) : currentUserId;
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
      .eq('assignee_id', targetUserId)
      .order('created_at', { ascending: false });

    if (error) throw formatError(error, 'Unable to load user tasks.');

    return { success: true, data: ensureArray(data).map(this.mapTask) };
  }

  async assignTask(taskId: string, userId: string) {
    const access = await this.getCurrentAccessContext();
    await this.getTask(taskId);
    if (!access.permissions.includes('tasks.assign') && !access.isAdminActor) {
      throw new ApiError('You do not have permission to assign tasks.', 403, 'TASK_ASSIGN_DENIED');
    }
    const { error } = await this.client.rpc('update_task_secure', {
      p_task_id: taskId,
      p_patch: { assignee_id: userId },
    });
    if (error) throw formatError(error, 'Failed to assign task.');

    await this.logActivity('ASSIGN', 'task', taskId, `assignee:${userId}`);

    return { success: true };
  }

  async unassignTask(taskId: string) {
    const access = await this.getCurrentAccessContext();
    await this.getTask(taskId);
    if (!access.permissions.includes('tasks.assign') && !access.isAdminActor) {
      throw new ApiError('You do not have permission to unassign tasks.', 403, 'TASK_ASSIGN_DENIED');
    }
    const { error } = await this.client.rpc('update_task_secure', {
      p_task_id: taskId,
      p_patch: { assignee_id: null },
    });
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
    await this.getTask(taskId);
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
    const currentUser = await this.getCurrentProfileOrThrow();
    const access = await this.getCurrentAccessContext();
    const { data: comment, error: readError } = await this.client
      .from('task_comments')
      .select('task_id, content, user_id')
      .eq('id', commentId)
      .single();

    if (readError || !comment) throw formatError(readError, 'Comment not found.');
    if (
      String(comment.user_id) !== String(currentUser.id) &&
      !access.permissions.includes('tasks.delete') &&
      !access.isAdminActor
    ) {
      throw new ApiError('You do not have permission to delete this comment.', 403, 'COMMENT_DELETE_DENIED');
    }

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
    if (relatedType === 'project') {
      await this.getProject(relatedId);
    } else if (relatedType === 'task') {
      await this.getTask(relatedId);
    } else if (relatedType === 'lead') {
      await this.getLeadById(relatedId);
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
    const access = await this.getCurrentAccessContext();
    const { data, error: readError } = await this.client.from('files').select('*').eq('id', id).single();
    if (readError || !data) throw formatError(readError, 'File not found.');
    if (
      String(data.uploaded_by) !== String(access.profile.id) &&
      !access.permissions.includes('files.delete') &&
      !access.isAdminActor
    ) {
      throw new ApiError('You do not have permission to delete this file.', 403, 'FILE_DELETE_DENIED');
    }
    if (data.file_path) {
      await this.client.storage.from('files').remove([data.file_path]);
    }
    const { error } = await this.client.from('files').delete().eq('id', id);
    if (error) throw formatError(error, 'Failed to delete file.');
    return { success: true };
  }

  async getUsers() {
    const access = await this.getCurrentAccessContext();
    let query = this.client
      .from('profiles')
      .select('id, name, email, avatar_url, profile_image, status, created_at, last_login_at, role_id')
      .order('created_at', { ascending: false });

    if (!access.permissions.includes('users.view.all') && !access.isAdminActor) {
      query = query.eq('id', access.profile.id);
    }

    const { data, error } = await query;

    if (error) throw formatError(error, 'Unable to load users.');

    const users = await Promise.all(ensureArray(data).map((profile: any) => this.hydrateUser(profile)));
    return { success: true, data: users };
  }

  async getUser(id: string) {
    const access = await this.getCurrentAccessContext();
    if (String(id) !== String(access.profile.id) && !access.permissions.includes('users.view.all')) {
      throw new ApiError('You do not have permission to view this profile.', 403, 'USER_VIEW_DENIED');
    }

    const { data, error } = await this.client
      .from('profiles')
      .select('id, name, email, avatar_url, profile_image, status, created_at, last_login_at, role_id')
      .eq('id', id)
      .single();

    if (error || !data) throw formatError(error, 'User not found.');

    return { success: true, data: await this.hydrateUser(data) };
  }

  async createUser(payload: {
  email: string;
  password: string;
  full_name?: string;
  name?: string;
  role_id?: string;      // ← ye UUID hai roles table se e.g. "ffd85053-c24b-48b4-87cb-e3377021ba43"
  phone?: string;
}) {
  const access = await this.getCurrentAccessContext();
  if (!access.permissions.includes('users.create') && !access.isAdminActor) {
    throw new ApiError('You do not have permission to create users.', 403, 'USER_CREATE_DENIED');
  }

  // Current session ka token lo
  const { data: { session } } = await this.client.auth.getSession();
 
  if (!session?.access_token) {
    throw new ApiError('Not authenticated', 401, 'UNAUTHORIZED');
  }
 
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
 
  const response = await fetch(`${supabaseUrl}/functions/v1/create-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': anonKey,
    },
    body: JSON.stringify({
      email: payload.email,
      password: payload.password,
      full_name: payload.full_name || payload.name || '',
      role_id: payload.role_id || null,
      phone: payload.phone || null,
    }),
  });
 
  const result = await response.json();
 
  if (!response.ok) {
    throw new ApiError(result.error || 'Failed to create user', response.status, 'USER_CREATE_FAILED');
  }
 
  return { success: true, data: result.user, message: result.message };
}

  async updateUser(id: string, payload: any) {
    const access = await this.getCurrentAccessContext();
    const isOwnProfile = String(id) === String(access.profile.id);
    const canAdminUpdate = access.permissions.includes('users.update') || access.isAdminActor;
    if (!isOwnProfile && !canAdminUpdate) {
      throw new ApiError('You do not have permission to update this user.', 403, 'USER_UPDATE_DENIED');
    }

    const updatePayload: any = {
      name: payload.name,
      email: payload.email,
      status: canAdminUpdate ? payload.status : undefined,
      role_id: canAdminUpdate ? payload.role_id || payload.role?.id : undefined,
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
    const requestedValues = [...new Set(permissionIds.map((value) => String(value).trim()).filter(Boolean))];
    const { data: permissions, error: permissionsError } = await this.client
      .from('permissions')
      .select('id, key');

    if (permissionsError) throw formatError(permissionsError, 'Unable to validate selected permissions.');

    const matchedPermissions = ensureArray(permissions).filter((permission: any) =>
      requestedValues.includes(String(permission.id)) || requestedValues.includes(String(permission.key))
    );
    const normalizedIds = matchedPermissions.map((permission: any) => String(permission.id));
    const missingValues = requestedValues.filter((value) =>
      !matchedPermissions.some((permission: any) => String(permission.id) === value || String(permission.key) === value)
    );

    if (missingValues.length > 0) {
      throw new ApiError(`Invalid permission selection: ${missingValues.join(', ')}`, 400, 'INVALID_PERMISSION_IDS');
    }

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
    const { error: seedError } = await this.client
      .from('permissions')
      .upsert(DEFAULT_PERMISSIONS, { onConflict: 'key', ignoreDuplicates: true });

    if (seedError) {
      console.warn('Unable to sync default permissions:', seedError);
    }

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
          user_id: log.user?.id ? String(log.user.id) : '',
          action: log.action,
          entity_type: log.entity_type,
          entity_id: log.entity_id,
          entity_name: formatActivityEntityLabel(log.entity_type),
          entity_label: formatActivityEntityLabel(log.entity_type),
          details: formatActivityDetail(log.entity_type, log.entity_name, log.entity_id),
          summary: formatActivitySummary(log.action, log.entity_type),
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
    const currentUser = await this.getCurrentProfileOrThrow();
    let profileImageUrl: string | undefined;

    // Handle FormData with file upload
    if (data instanceof FormData) {
      const file = data.get('file') as File;
      const name = data.get('name') as string;
      const email = data.get('email') as string;
      const phone = data.get('phone') as string;
      const bio = data.get('bio') as string;

      // Upload image to Supabase Storage if provided
      if (file && file.size > 0) {
        const uploadResult = await this.uploadToStorage(file, 'avatars');
        profileImageUrl = uploadResult.url;
      }

      // Update profile with form data
      const payload: any = {
        name,
        email,
        phone,
        bio,
      };

      if (profileImageUrl) {
        payload.avatar_url = profileImageUrl;
        payload.profile_image = profileImageUrl;
      }

      Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);

      const { error } = await this.client.from('profiles').update(payload).eq('id', currentUser.id);
      if (error) throw formatError(error, 'Failed to update profile.');

      return this.getCurrentUser();
    }

    // Handle regular JSON data
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
      .eq('user_id', currentUserId)
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
    const currentUserId = await this.getCurrentUserId();
    const { data: notification, error: loadError } = await this.client
      .from('notifications')
      .select('id')
      .eq('id', id)
      .eq('user_id', currentUserId)
      .single();

    if (loadError || !notification) {
      throw formatError(loadError, 'Notification not found.');
    }

    const { error } = await this.client.from('notifications').update({ is_read: true }).eq('id', id);
    if (error) {
      throw formatError(error, 'Failed to mark notification as read.');
    }
    return { success: true };
  }

  async deleteNotification(id: string) {
    const currentUserId = await this.getCurrentUserId();
    const { data: notification, error: loadError } = await this.client
      .from('notifications')
      .select('id')
      .eq('id', id)
      .eq('user_id', currentUserId)
      .single();

    if (loadError || !notification) {
      throw formatError(loadError, 'Notification not found.');
    }

    const { error } = await this.client.from('notifications').delete().eq('id', id);
    if (error) {
      throw formatError(error, 'Failed to delete notification.');
    }
    return { success: true };
  }

  async getCalendar(startDate?: string, endDate?: string) {
    const [projectsRes, tasksRes] = await Promise.all([
      this.getProjects(),
      this.getTasks(),
    ]);

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
    const access = await this.getCurrentAccessContext();
    const hours = Number(data?.hours || 0);
    const minutes = Number(data?.minutes || 0);
    const normalizedHours = hours > 0 ? hours : minutes / 60;
    const projectId = data?.project_id ? String(data.project_id) : '';
    const taskId = data?.task_id ? String(data.task_id) : '';

    if (normalizedHours <= 0) {
      throw new ApiError('Time entry duration must be greater than zero.', 400, 'TIME_DURATION_REQUIRED');
    }

    if (projectId) {
      const projectIds = await this.getAccessibleProjectIds(currentUserId);
      if (!access.canViewAllTime && !projectIds.includes(projectId)) {
        throw new ApiError('You do not have access to this project.', 403, 'TIME_PROJECT_DENIED');
      }
    }

    if (taskId) {
      await this.getTask(taskId);
    }

    const { data: created, error } = await this.client.rpc('create_time_log_secure', {
      p_time_log: {
        user_id: currentUserId,
        created_by: currentUserId,
        updated_by: currentUserId,
        project_id: projectId || null,
        task_id: taskId || null,
        lead_id: data?.lead_id || null,
        session_id: data?.session_id || data?.timer_session_id || null,
        log_date: data?.date,
        hours: normalizedHours,
        duration_minutes: Math.round(normalizedHours * 60),
        start_time: data?.start_time || null,
        end_time: data?.end_time || null,
        description: data?.description || null,
        status: 'pending',
        is_manual: data?.is_manual === true || (data?.manual_hours != null && Number(data?.manual_hours) > 0) || (data?.manual_minutes != null && Number(data?.manual_minutes) > 0),
        approval_status: 'pending',
        lead_source: data?.lead_source || data?.source_platform || data?.source || null,
        timer_type: data?.timer_type || (data?.project_id ? 'project' : 'sales'),
        work_type: data?.work_type || null,
        manual_leads_count: Number(data?.manual_leads_count || 0),
      },
    });

    if (error || !created) {
      if (!this.isMissingRpcFunctionError(error, 'create_time_log_secure')) {
        throw formatError(error, 'Failed to create time log.');
      }

      const fallbackPayload = {
        user_id: currentUserId,
        created_by: currentUserId,
        updated_by: currentUserId,
        project_id: projectId || null,
        task_id: taskId || null,
        lead_id: data?.lead_id || null,
        session_id: data?.session_id || data?.timer_session_id || null,
        log_date: data?.date,
        hours: normalizedHours,
        duration_minutes: Math.round(normalizedHours * 60),
        start_time: data?.start_time || null,
        end_time: data?.end_time || null,
        description: data?.description || null,
        status: 'pending',
        is_manual: data?.is_manual === true || (data?.manual_hours != null && Number(data?.manual_hours) > 0) || (data?.manual_minutes != null && Number(data?.manual_minutes) > 0),
        approval_status: 'pending',
        lead_source: data?.lead_source || data?.source_platform || data?.source || null,
        timer_type: data?.timer_type || (data?.project_id ? 'project' : 'sales'),
        work_type: data?.work_type || null,
        manual_leads_count: Number(data?.manual_leads_count || 0),
      };

      const { data: fallbackCreated, error: fallbackError } = await this.client
        .from('time_logs')
        .insert([fallbackPayload])
        .select()
        .single();

      if (fallbackError || !fallbackCreated) {
        throw formatError(fallbackError, 'Failed to create time log.');
      }

      await this.logActivity('CREATE', 'time_log', String(fallbackCreated.id), String(fallbackCreated.id));
      return { success: true, data: fallbackCreated };
    }

    await this.logActivity('CREATE', 'time_log', String(created.id), String(created.id));

    return { success: true, data: created };
  }

  async updateLead(id: string | number, data: Partial<Lead> & { tags?: string[]; contacts?: CreateLeadPayload['contacts'] }) {
    const access = await this.getCurrentAccessContext();
    if (!access.canViewAllLeads) {
      const lead = await this.getLeadById(String(id));
      const leadData = lead.data as Lead;
      const currentUserId = String(access.profile.id);
      const canAccessLead =
        leadData.created_by === currentUserId ||
        leadData.assigned_to === currentUserId ||
        (leadData.project_id ? (await this.getAccessibleProjectIds(currentUserId)).includes(leadData.project_id) : false);
      if (!canAccessLead) {
        throw new ApiError('You do not have permission to update this lead.', 403, 'LEAD_UPDATE_DENIED');
      }
    }

    await this.assertLeadIsNotDuplicate(data, id);
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
      metadata: data.metadata || data.custom_fields ? { ...(data.metadata || {}), custom_fields: data.custom_fields || {} } : undefined,
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

    const updatedLead = await this.updateLeadWithFallback(String(id), payload, 'Failed to update lead.');

    if (Array.isArray(data.tags)) {
      const normalizedTags = [...new Set(data.tags.map((tag) => tag.trim()).filter(Boolean))];
      await this.replaceLeadTags(String(id), normalizedTags);
    }

    if (Array.isArray(data.contacts)) {
      await this.replaceLeadContacts(String(id), data.contacts);
    }

    return { success: true, data: updatedLead ? this.mapLeadRecord(updatedLead) : (await this.getLeadById(String(id))).data };
  }

  async importLeads(formData: FormData) {
    const file = formData.get('file');
    if (!(file instanceof File)) {
      throw new ApiError('Please provide a CSV file.', 400, 'LEAD_IMPORT_FILE_REQUIRED');
    }

    const rows = this.parseCsv(await file.text());

    if (rows.length < 2) {
      return { success: true, data: { inserted: 0, skipped: 0 } };
    }

    const headers = rows[0].map((header) => this.normalizeCsvHeader(header));
    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const [index, row] of rows.slice(1).entries()) {
      const record = headers.reduce<Record<string, string>>((acc, header, index) => {
        acc[header] = row[index] || '';
        return acc;
      }, {});

      const leadName = record.name || record.company || record.email || record.phone;
      if (!leadName) {
        skipped += 1;
        errors.push(`Row ${index + 2}: missing name, company, email, or phone.`);
        continue;
      }

      try {
        await this.createLead({
          name: leadName,
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
      } catch (error: any) {
        skipped += 1;
        errors.push(`Row ${index + 2}: ${error?.message || 'Import failed.'}`);
      }
    }

    return { success: true, data: { inserted, skipped, errors: errors.slice(0, 10) } };
  }

  async getLeadTaxonomies(endpoint?: string) {
    const access = await this.getCurrentAccessContext();
    requirePermission(access, 'leads.view', 'You do not have permission to view lead taxonomies.');
    const url = new URL(`http://local${endpoint || '/leads/taxonomies'}`);
    const activeParam = url.searchParams.get('active');
    let query = this.client
      .from('lead_taxonomies')
      .select('*')
      .order('name', { ascending: true });

    if (activeParam === 'true' || activeParam === '1') {
      query = query.eq('is_active', true);
    } else if (activeParam === 'false' || activeParam === '0') {
      query = query.eq('is_active', false);
    }

    const { data, error } = await query;

    if (error) {
      throw formatError(error, 'Failed to fetch lead taxonomies.');
    }
    return { success: true, data: ensureArray(data) };
  }

  async createLeadTaxonomy(data: any) {
    const access = await this.getCurrentAccessContext();
    requirePermission(access, 'leads.taxonomies.manage', 'You do not have permission to create lead taxonomies.');
    const currentUserId = access.profile.id;

    // Payload mein sirf wahi fields rakhi hain jo aapne batayi hain
    const payload = {
      name: String(data.name).trim(),
      taxonomy_type: data.taxonomy_type,
      created_by: currentUserId,
      is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
      // created_at database khud handle karega (DEFAULT now())
      // id database khud generate karega (UUID/Serial)
    };

    const { data: created, error } = await this.client
      .from('lead_taxonomies')
      .insert(payload)
      .select('id, name, taxonomy_type, created_by, created_at, is_active') // Explicitly sirf yehi columns select kiye hain
      .single();

    if (error) {
      throw formatError(error, 'Failed to create lead taxonomy.');
    }

    await this.logActivity('CREATE', 'lead_taxonomy', String(created.id), String(created.id));
    return { success: true, data: created };
  }

  async updateLeadTaxonomy(id: string, data: any) {
    const access = await this.getCurrentAccessContext();
    requirePermission(access, 'leads.taxonomies.manage', 'You do not have permission to update lead taxonomies.');

    const payload: Record<string, any> = {};
    if (data?.name !== undefined) payload.name = String(data.name).trim();
    if (data?.taxonomy_type !== undefined) payload.taxonomy_type = data.taxonomy_type;
    if (data?.is_active !== undefined) payload.is_active = Boolean(data.is_active);

    if (!Object.keys(payload).length) {
      throw new ApiError('No taxonomy fields to update.', 400, 'TAXONOMY_UPDATE_EMPTY');
    }

    const { data: updated, error } = await this.client
      .from('lead_taxonomies')
      .update(payload)
      .eq('id', id)
      .select('id, name, taxonomy_type, created_by, created_at, is_active')
      .single();

    if (error || !updated) {
      throw formatError(error, 'Failed to update lead taxonomy.');
    }

    await this.logActivity('UPDATE', 'lead_taxonomy', String(updated.id), String(updated.id));
    return { success: true, data: updated };
  }

  async deleteLeadTaxonomy(id: string) {
    const access = await this.getCurrentAccessContext();
    requirePermission(access, 'leads.taxonomies.manage', 'You do not have permission to delete lead taxonomies.');
    const { error } = await this.client
      .from('lead_taxonomies')
      .delete()
      .eq('id', id);

    if (error) {
      throw formatError(error, 'Failed to delete lead taxonomy.');
    }

    await this.logActivity('DELETE', 'lead_taxonomy', id, id);
    return { success: true };
  }

  async getLeads(filters?: LeadFilters & { page?: number; pageSize?: number }) {
    const access = await this.getCurrentAccessContext();
    const currentUserId = String(access.profile.id);
    const page = clampPage(filters?.page);
    const pageSize = clampPageSize(filters?.pageSize);
    const buildQuery = (selectClause: string, includeExtendedSearch: boolean) => {
      let query = this.client
        .from('leads')
        .select(selectClause)
        .order('created_at', { ascending: false });

      if (access.canViewAllLeads && filters?.owner_id) {
        query = query.eq('created_by', filters.owner_id);
      } else if (!access.canViewAllLeads) {
        query = query.or(`created_by.eq.${currentUserId},assigned_to.eq.${currentUserId}`);
      }
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
      const start = (page - 1) * pageSize;
      query = query.range(start, start + pageSize - 1);
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

    return {
      success: true,
      data: mapped,
      total: mapped.length,
      page,
      pageSize,
    };
  }

  async getLeadById(id: string) {
    const access = await this.getCurrentAccessContext();
    if (!access.canViewAllLeads) {
      const currentUserId = String(access.profile.id);
      const scopedConditions = [`created_by.eq.${currentUserId}`, `assigned_to.eq.${currentUserId}`];

      let { data: scopedLead, error: scopedError } = await this.client
        .from('leads')
        .select(this.getLeadSelectClause())
        .eq('id', id)
        .or(scopedConditions.join(','))
        .single();

      if (scopedError) {
        console.warn('Rich scoped lead detail query failed; retrying with base lead columns.', scopedError);
        const fallback = await this.client
          .from('leads')
          .select('id, name, email, phone, company, designation, website, linkedin_url, facebook_url, instagram_url, x_url, services_offered, source, priority, pipeline_stage, lead_score, budget, expected_close_date, outreach_status, outreach_channel, first_contacted_at, last_reachout_at, followup_sent_at, followup_notes, close_value, assigned_to, project_id, notes, metadata, created_by, status, completed, converted_at, created_at, updated_at')
          .eq('id', id)
          .or(scopedConditions.join(','))
          .single();
        scopedLead = fallback.data;
        scopedError = fallback.error;
      }

      if (scopedError || !scopedLead) throw formatError(scopedError, 'Lead not found.');

      return {
        success: true,
        data: this.mapLeadRecord(scopedLead),
      };
    }

    let { data, error } = await this.client
      .from('leads')
      .select(this.getLeadSelectClause())
      .eq('id', id)
      .single();
    if (error) {
      console.warn('Rich lead detail query failed; retrying with base lead columns.', error);
      const fallback = await this.client
        .from('leads')
        .select('id, name, email, phone, company, designation, website, linkedin_url, facebook_url, instagram_url, x_url, services_offered, source, priority, pipeline_stage, lead_score, budget, expected_close_date, outreach_status, outreach_channel, first_contacted_at, last_reachout_at, followup_sent_at, followup_notes, close_value, assigned_to, project_id, notes, metadata, created_by, status, completed, converted_at, created_at, updated_at')
        .eq('id', id)
        .single();
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
    await this.assertLeadIsNotDuplicate(leadData);

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
      project_id: leadData.project_id || null,
      notes: notes || null,
      metadata: { ...(leadData.metadata || {}), custom_fields: leadData.custom_fields || {} },
      created_by: currentUser.id,
        status: this.statusFromPipeline(leadData.pipeline_stage || 'new'),
        completed: ['won', 'lost'].includes(this.normalizeLeadStage(leadData.pipeline_stage || 'new')),
    };

    const { data: leadResult, error } = await this.client.rpc('create_lead_secure', {
      p_lead: insertPayload,
    });
    const leadRow = this.firstRpcRow<any>(leadResult);
    let createdLeadId = leadRow?.id ?? leadRow ?? null;
    if (error || !createdLeadId) {
      if (!this.isMissingRpcFunctionError(error, 'create_lead_secure') && !this.isRpcResultShapeError(error)) {
        throw formatError(error, 'Failed to create lead.');
      }

      const { data: fallbackLead, error: fallbackError } = await this.client
        .from('leads')
        .insert([insertPayload])
        .select('id')
        .single();

      if (fallbackError || !fallbackLead?.id) {
        throw formatError(fallbackError, 'Failed to create lead.');
      }

      createdLeadId = fallbackLead.id;
    }

    if (tags?.length) {
      await this.replaceLeadTags(String(createdLeadId), [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))]);
    }

    if (contacts?.length) {
      await this.replaceLeadContacts(String(createdLeadId), contacts);
    }

    if (notes) {
      await this.client.from('lead_notes').insert([
        {
          lead_id: createdLeadId,
          user_id: currentUser.id,
          note: notes,
          content: notes,
        },
      ]);
    }

    // Auto link running session
    const { data: runningSession } = await this.client
      .from('time_tracking_sessions')
      .select('id')
      .eq('user_id', currentUser.id)
      .eq('session_status', 'running')
      .order('started_at', { ascending: false })
      .limit(1);

    if (runningSession && runningSession.length > 0) {
      const activeSessionId = runningSession[0].id;
      const { error: linkError } = await this.client.rpc('link_lead_to_time_session_secure', {
        p_session_id: activeSessionId,
        p_lead_id: createdLeadId,
      });
      if (linkError && !this.isMissingRpcFunctionError(linkError, 'link_lead_to_time_session_secure')) {
        throw formatError(linkError, 'Failed to link lead to active timer session.');
      }

      const { error: summaryError } = await this.client.rpc('refresh_time_tracking_session_summary', {
        p_session_id: activeSessionId,
      });
      if (summaryError && !this.isMissingRpcFunctionError(summaryError, 'refresh_time_tracking_session_summary')) {
        throw formatError(summaryError, 'Failed to refresh active timer session.');
      }

      const { data: sessionRow, error: sessionReadError } = await this.client
        .from('time_tracking_sessions')
        .select('id, manual_leads_count')
        .eq('id', activeSessionId)
        .single();

      if (!sessionReadError && sessionRow) {
        const nextCount = Number(sessionRow.manual_leads_count || 0) + 1;
        const { error: sessionUpdateError } = await this.client
          .from('time_tracking_sessions')
          .update({ manual_leads_count: nextCount })
          .eq('id', activeSessionId);

        if (sessionUpdateError) {
          console.warn('Failed to increment running session lead count:', sessionUpdateError);
        }
      }
    }

    return this.getLeadById(String(createdLeadId));
  }

  async deleteLead(id: string | number) {
    const access = await this.getCurrentAccessContext();
    const { data: lead, error: readError } = await this.client.from('leads').select('id, name, created_by, assigned_to, project_id').eq('id', id).single();
    if (readError || !lead) throw formatError(readError, 'Lead not found.');

    if (!access.canViewAllLeads) {
      const currentUserId = String(access.profile.id);
      const canAccessLead =
        String(lead.created_by) === currentUserId ||
        String(lead.assigned_to || '') === currentUserId;
      if (!canAccessLead) {
        throw new ApiError('You do not have permission to delete this lead.', 403, 'LEAD_DELETE_DENIED');
      }
    }

    const { error } = await this.client.rpc('delete_lead_secure', { p_lead_id: id });
    if (error) throw formatError(error, 'Failed to delete lead.');

    await this.logActivity('DELETE', 'lead', String(id), lead.name);
    return { success: true };
  }

  async addActivity(leadId: string, data: AddLeadActivityPayload) {
    const currentUser = await this.getCurrentProfileOrThrow();
    await this.getLeadById(leadId);
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
    await this.getLeadById(leadId);
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
    await this.getLeadById(leadId);
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

    await this.updateLeadWithFallback(leadId, { next_follow_up_at: data.scheduled_at }, 'Failed to schedule follow-up.');
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
    await this.updateLeadWithFallback(leadId, { lead_score: score }, 'Failed to update lead score.');
    return { success: true };
  }

  async bulkUpdateStatus(leadIds: string[], status: string) {
    const pipelineStage = this.normalizeLeadStage(status);
    await Promise.all(leadIds.map(async (leadId) => {
      await this.updateLeadWithFallback(leadId, { status, pipeline_stage: pipelineStage, completed: pipelineStage === 'won' || pipelineStage === 'lost' }, 'Failed to update selected leads.');
    }));
    return { success: true };
  }

  async bulkAssign(leadIds: string[], userId: string) {
    await Promise.all(leadIds.map(async (leadId) => {
      await this.updateLeadWithFallback(leadId, { assigned_to: userId }, 'Failed to assign selected leads.');
    }));
    return { success: true };
  }

  async bulkDelete(leadIds: string[]) {
    await Promise.all(leadIds.map(async (leadId) => {
      const { error } = await this.client.rpc('delete_lead_secure', { p_lead_id: leadId });
      if (error) throw formatError(error, 'Failed to delete selected leads.');
    }));
    return { success: true };
  }

  async getLeadStats(): Promise<{ success: true; data: LeadStats }> {
    const access = await this.getCurrentAccessContext();
    requirePermission(access, 'leads.view', 'You do not have permission to view lead stats.');
    const { data, error } = await this.client
      .from('leads')
      .select('created_at, pipeline_stage, source, priority, lead_score, completed, converted_at, created_by, assigned_to')
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error) throw formatError(error, 'Unable to load lead stats.');

    const currentUserId = String(access.profile.id);
    const leads = ensureArray(data).filter((row: any) => access.canViewAllLeads || String(row.created_by || '') === currentUserId || String(row.assigned_to || '') === currentUserId);
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

  async getLeadOwnershipReport() {
    const access = await this.getCurrentAccessContext();
    const isDashboardAdmin =
      isSuperAdminRole(access.role) ||
      normalizeRoleName(access.role).includes('admin') ||
      access.isAdminActor;

    if (!isDashboardAdmin) {
      throw new ApiError('You do not have permission to view lead ownership stats.', 403, 'DASHBOARD_ADMIN_REQUIRED');
    }

    const { data: usersData, error: usersError } = await this.getUsers();
    if (usersError) throw formatError(usersError, 'Unable to load users for lead ownership stats.');
    const users = ensureArray((usersData as any)?.data || (usersData as any) || []);

    let query = this.client
      .from('leads')
      .select('created_by, owner:profiles!leads_created_by_fkey(id, name, email, avatar_url, profile_image)')
      .order('created_at', { ascending: false })
      .limit(2000);

    if (!access.canViewAllLeads) {
      const currentUserId = String(access.profile.id);
      query = query.or(`created_by.eq.${currentUserId},assigned_to.eq.${currentUserId}`);
    }

    const { data, error } = await query;
    if (error) throw formatError(error, 'Unable to load lead ownership stats.');

    const countMap = new Map<string, number>();
    ensureArray(data).forEach((row: any) => {
      const ownerId = String(row.created_by || row.owner?.id || '');
      if (!ownerId) return;
      countMap.set(ownerId, (countMap.get(ownerId) || 0) + 1);
    });

    const report = ensureArray(users)
      .map((user: any) => ({
        user_id: String(user.id),
        user_name: user.name || user.email || 'User',
        user_email: user.email || '',
        user_avatar: user.avatar || user.profile_image || '',
        leads_count: countMap.get(String(user.id)) || 0,
      }))
      .sort((a: any, b: any) => b.leads_count - a.leads_count || a.user_name.localeCompare(b.user_name));

    return { success: true, data: report };
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

  private mapFlexibleFollowup(row: any): FlexibleFollowupRecord {
    return {
      id: String(row.id),
      owner_id: String(row.owner_id),
      owner_name: row.owner?.name || undefined,
      owner_email: row.owner?.email || undefined,
      lead_id: row.lead_id ? String(row.lead_id) : undefined,
      data: row.data && typeof row.data === 'object' ? row.data : {},
      status: row.status || row.data?.Status || undefined,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at || row.created_at),
    };
  }

  async getFlexibleFollowups(filters?: { owner_id?: string; search?: string }) {
    const access = await this.getCurrentAccessContext();
    let query = this.client
      .from('lead_followup_records')
      .select('*, owner:profiles!lead_followup_records_owner_id_fkey(id, name, email)')
      .order('created_at', { ascending: false });

    if (access.canViewAllLeads && filters?.owner_id) {
      query = query.eq('owner_id', filters.owner_id);
    } else if (!access.canViewAllLeads) {
      query = query.eq('owner_id', access.profile.id);
    }

    const { data, error } = await query;
    if (error) throw formatError(error, 'Unable to load follow-up sheet.');

    let rows = ensureArray(data).map((row) => this.mapFlexibleFollowup(row));
    if (filters?.search?.trim()) {
      const term = filters.search.trim().toLowerCase();
      rows = rows.filter((row) => Object.values(row.data || {}).some((value) => String(value || '').toLowerCase().includes(term)));
    }

    return { success: true, data: rows };
  }

  async createFlexibleFollowup(payload: CreateFlexibleFollowupPayload) {
    const currentUser = await this.getCurrentProfileOrThrow();
    const { data, error } = await this.client
      .from('lead_followup_records')
      .insert({
        owner_id: currentUser.id,
        lead_id: payload.lead_id || null,
        data: payload.data || {},
        status: payload.status || payload.data?.Status || null,
      })
      .select('*, owner:profiles!lead_followup_records_owner_id_fkey(id, name, email)')
      .single();

    if (error || !data) throw formatError(error, 'Failed to create follow-up row.');
    return { success: true, data: this.mapFlexibleFollowup(data) };
  }

  async updateFlexibleFollowup(id: string, payload: Partial<CreateFlexibleFollowupPayload>) {
    const { data, error } = await this.client
      .from('lead_followup_records')
      .update({
        data: payload.data,
        lead_id: payload.lead_id,
        status: payload.status || payload.data?.Status,
      })
      .eq('id', id)
      .select('*, owner:profiles!lead_followup_records_owner_id_fkey(id, name, email)')
      .single();

    if (error || !data) throw formatError(error, 'Failed to update follow-up row.');
    return { success: true, data: this.mapFlexibleFollowup(data) };
  }

  async deleteFlexibleFollowup(id: string) {
    const { error } = await this.client.from('lead_followup_records').delete().eq('id', id);
    if (error) throw formatError(error, 'Failed to delete follow-up row.');
    return { success: true };
  }

  async getFinanceClients() {
    const access = await this.getCurrentAccessContext();
    requirePermission(access, 'finance.clients.view', 'You do not have permission to view finance clients.');
    const { data, error } = await this.client
      .from('clients')
      .select('id, name, email, phone, company, address, status, notes, total_revenue, last_payment_date, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error) throw formatError(error, 'Unable to load clients.');
    return { success: true, data: ensureArray(data) };
  }

  async createFinanceClient(data: any) {
    const access = await this.getCurrentAccessContext();
    requirePermission(access, 'finance.clients.manage', 'You do not have permission to create finance clients.');
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
    const access = await this.getCurrentAccessContext();
    requirePermission(access, 'finance.clients.manage', 'You do not have permission to delete finance clients.');
    const { error } = await this.client.from('clients').delete().eq('id', id);
    if (error) throw formatError(error, 'Failed to delete client.');
    return { success: true };
  }

  async getFinanceExpenses() {
    const access = await this.getCurrentAccessContext();
    requirePermission(access, 'finance.expenses.view', 'You do not have permission to view expenses.');
    const currentUserId = String(access.profile.id);
    let query = this.client
      .from('expenses')
      .select('id, category, description, amount, currency, expense_date, payment_method, payment_method_other, project_id, receipt_url, approved_by, created_by, created_at, updated_at')
      .order('expense_date', { ascending: false })
      .limit(1000);

    if (!access.canViewAllFinance) {
      query = query.eq('created_by', currentUserId);
    }

    const { data, error } = await query;
    if (error) throw formatError(error, 'Unable to load expenses.');
    return { success: true, data: ensureArray(data) };
  }

  async createFinanceExpense(data: any) {
    const access = await this.getCurrentAccessContext();
    requirePermission(access, 'finance.expenses.manage', 'You do not have permission to create expenses.');
    const { data: created, error } = await this.client.rpc('create_finance_expense_secure', {
      p_expense: {
        category: data?.category,
        description: data?.description,
        amount: Number(data?.amount || 0),
        currency: data?.currency || 'USD',
        expense_date: data?.expense_date,
        payment_method: data?.payment_method || 'bank_transfer',
        payment_method_other: data?.payment_method_other || null,
        project_id: data?.project_id || null,
        receipt_url: data?.receipt_url || null,
      },
    });

    if (error || !created) throw formatError(error, 'Failed to create expense.');
    return { success: true, data: created };
  }

  async deleteFinanceExpense(id: string) {
    const access = await this.getCurrentAccessContext();
    requirePermission(access, 'finance.expenses.manage', 'You do not have permission to delete expenses.');
    const { error } = await this.client.rpc('delete_finance_expense_secure', { p_expense_id: id });
    if (error) throw formatError(error, 'Failed to delete expense.');
    return { success: true };
  }

  async getFinancePayments() {
    const access = await this.getCurrentAccessContext();
    requirePermission(access, 'finance.payments.view', 'You do not have permission to view payments.');
    const currentUserId = String(access.profile.id);
    let query = this.client
      .from('payments')
      .select('id, client_name, amount, currency, payment_date, payment_method, payment_method_other, status, description, project_id, received_amount, tax_amount, commission_amount, invoice_id, created_by, created_at, updated_at')
      .order('payment_date', { ascending: false })
      .limit(1000);

    if (!access.canViewAllFinance) {
      query = query.eq('created_by', currentUserId);
    }

    const { data, error } = await query;
    if (error) throw formatError(error, 'Unable to load payments.');
    return { success: true, data: ensureArray(data) };
  }

  async createFinancePayment(data: any) {
    const access = await this.getCurrentAccessContext();
    requirePermission(access, 'finance.payments.manage', 'You do not have permission to create payments.');
    const { data: created, error } = await this.client.rpc('create_finance_payment_secure', {
      p_payment: {
        client_name: data?.client_name,
        amount: Number(data?.amount || 0),
        currency: data?.currency || 'USD',
        payment_date: data?.payment_date,
        payment_method: data?.payment_method || 'bank_transfer',
        payment_method_other: data?.payment_method_other || null,
        status: data?.status || 'completed',
        description: data?.description || null,
        project_id: data?.project_id || null,
        received_amount: Number(data?.received_amount || 0),
        tax_amount: Number(data?.tax_amount || 0),
        commission_amount: Number(data?.commission_amount || 0),
        invoice_id: data?.invoice_id || null,
      },
    });

    if (error || !created) throw formatError(error, 'Failed to create payment.');
    return { success: true, data: created };
  }

  async deleteFinancePayment(id: string) {
    const access = await this.getCurrentAccessContext();
    requirePermission(access, 'finance.payments.manage', 'You do not have permission to delete payments.');
    const { error } = await this.client.rpc('delete_finance_payment_secure', { p_payment_id: id });
    if (error) throw formatError(error, 'Failed to delete payment.');
    return { success: true };
  }

  async getFinanceFounders() {
    const access = await this.getCurrentAccessContext();
    requirePermission(access, 'finance.founders.view', 'You do not have permission to view founders.');
    const { data, error } = await this.client
      .from('founders')
      .select('id, name, role, equity_percentage, vested_percentage, join_date, user_id, email, phone, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error) throw formatError(error, 'Unable to load founders.');
    return { success: true, data: ensureArray(data) };
  }

  async createFinanceFounder(data: any) {
    const access = await this.getCurrentAccessContext();
    requirePermission(access, 'finance.founders.manage', 'You do not have permission to create founders.');
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
    const access = await this.getCurrentAccessContext();
    requirePermission(access, 'finance.founders.manage', 'You do not have permission to update founders.');
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
    const access = await this.getCurrentAccessContext();
    requirePermission(access, 'finance.founders.manage', 'You do not have permission to delete founders.');
    const { error } = await this.client.from('founders').delete().eq('id', id);
    if (error) throw formatError(error, 'Failed to delete founder.');
    return { success: true };
  }

  async getFoundersEquityTotal() {
    const access = await this.getCurrentAccessContext();
    requirePermission(access, 'finance.founders.view', 'You do not have permission to view founders.');
    const { data, error } = await this.client.from('founders').select('equity_percentage').limit(1000);
    if (error) throw formatError(error, 'Unable to load founder equity.');
    const total = ensureArray(data).reduce((sum: number, founder: any) => sum + Number(founder.equity_percentage || 0), 0);
    return { success: true, data: { data: { total } } };
  }

  async getFinanceSettings() {
    const access = await this.getCurrentAccessContext();
    requirePermission(access, 'finance.view', 'You do not have permission to view finance settings.');
    const { data, error } = await this.client
      .from('finance_settings')
      .select('id, setting_key, setting_value, created_at, updated_at')
      .limit(1000);
    if (error) throw formatError(error, 'Unable to load finance settings.');
    const mapped = ensureArray(data).reduce((acc: Record<string, any>, item: any) => {
      acc[item.setting_key] = item.setting_value;
      return acc;
    }, {});
    return { success: true, data: { data: mapped } };
  }

  async getFinanceSalaries() {
    const access = await this.getCurrentAccessContext();
    requirePermission(access, 'finance.salaries.view', 'You do not have permission to view salaries.');
    const currentUserId = String(access.profile.id);
    let query = this.client
      .from('salary_runs')
      .select('id, salary_month, currency, created_at, created_by, salary_entries(id, user_id, months_count, monthly_salary, total_salary, notes, profiles:user_id(id, name))')
      .order('salary_month', { ascending: false });
    if (!access.canViewAllFinance) {
      query = query.eq('created_by', currentUserId);
    }

    const { data: runs, error: runError } = await query;

    if (runError) throw formatError(runError, 'Failed to fetch salaries.');

    const formatted: any[] = [];
    ensureArray(runs).forEach((run: any) => {
      ensureArray(run.salary_entries).forEach((entry: any) => {
        let details: any = {};
        try {
          if (entry.notes) details = JSON.parse(entry.notes);
        } catch (e) {
          details = { notes: entry.notes };
        }
        
        formatted.push({
          id: entry.id,
          run_id: run.id,
          employee_id: entry.user_id,
          employee_name: entry.profiles?.name || 'Unknown',
          base_salary: entry.monthly_salary,
          salary_months: entry.months_count,
          total_salary: entry.total_salary,
          currency: run.currency,
          salary_date: run.salary_month,
          bonus: details.bonus || 0,
          deductions: details.deductions || 0,
          payment_method: details.payment_method || 'bank_transfer',
          payment_method_other: details.payment_method_other || '',
          notes: details.notes || '',
        });
      });
    });

    return { success: true, data: formatted };
  }

  async createFinanceSalary(data: any) {
    const access = await this.getCurrentAccessContext();
    requirePermission(access, 'finance.salaries.manage', 'You do not have permission to create salary records.');
    const currentUserId = await this.getCurrentUserId();
    
    // First find or create a salary run for this month and currency
    const salaryDate = data.salary_date || new Date().toISOString().split('T')[0];
    const { data: runSearch, error: searchError } = await this.client
      .from('salary_runs')
      .select('id')
      .eq('salary_month', salaryDate)
      .eq('currency', data.currency || 'USD')
      .maybeSingle();

    let runId = runSearch?.id;

    if (!runId) {
      const { data: newRun, error: createError } = await this.client
        .from('salary_runs')
        .insert({
          salary_month: salaryDate,
          currency: data.currency || 'USD',
          total_salary: 0,
          created_by: currentUserId
        })
        .select()
        .single();
      
      if (createError) throw formatError(createError, 'Failed to create salary run.');
      runId = newRun.id;
    }

    const monthsCount = Number(data.salary_months) || 1;
    const baseSalary = Number(data.base_salary) || 0;
    const bonus = Number(data.bonus) || 0;
    const deductions = Number(data.deductions) || 0;
    const totalSalary = (baseSalary * monthsCount) + bonus - deductions;

    const details = JSON.stringify({
      bonus,
      deductions,
      payment_method: data.payment_method,
      payment_method_other: data.payment_method_other,
      notes: data.notes
    });

    const { data: entry, error: entryError } = await this.client
      .from('salary_entries')
      .insert({
        salary_run_id: runId,
        user_id: data.employee_id,
        months_count: monthsCount,
        monthly_salary: baseSalary,
        total_salary: totalSalary,
        notes: details
      })
      .select()
      .single();

    if (entryError) throw formatError(entryError, 'Failed to create salary entry.');
    return { success: true, data: entry };
  }

  async updateFinanceSalary(id: string, data: any) {
    const access = await this.getCurrentAccessContext();
    requirePermission(access, 'finance.salaries.manage', 'You do not have permission to update salary records.');
    // Basic update for the entry
    const monthsCount = Number(data.salary_months) || 1;
    const baseSalary = Number(data.base_salary) || 0;
    const bonus = Number(data.bonus) || 0;
    const deductions = Number(data.deductions) || 0;
    const totalSalary = (baseSalary * monthsCount) + bonus - deductions;

    const details = JSON.stringify({
      bonus,
      deductions,
      payment_method: data.payment_method,
      payment_method_other: data.payment_method_other,
      notes: data.notes
    });

    const { data: entry, error } = await this.client
      .from('salary_entries')
      .update({
        user_id: data.employee_id,
        months_count: monthsCount,
        monthly_salary: baseSalary,
        total_salary: totalSalary,
        notes: details
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw formatError(error, 'Failed to update salary entry.');
    return { success: true, data: entry };
  }

  async deleteFinanceSalary(id: string) {
    const access = await this.getCurrentAccessContext();
    requirePermission(access, 'finance.salaries.manage', 'You do not have permission to delete salary records.');
    const { error } = await this.client
      .from('salary_entries')
      .delete()
      .eq('id', id);

    if (error) throw formatError(error, 'Failed to delete salary entry.');
    return { success: true };
  }

  async getFinanceTaxes() {
    const access = await this.getCurrentAccessContext();
    requirePermission(access, 'finance.taxes.view', 'You do not have permission to view taxes.');
    const currentUserId = String(access.profile.id);
    let query = this.client.from('project_taxes').select('*, projects(name)').order('created_at', { ascending: false });
    if (!access.canViewAllFinance) {
      query = query.eq('created_by', currentUserId);
    }
    const { data, error } = await query;
    if (error) throw formatError(error, 'Failed to fetch taxes.');
    return { success: true, data };
  }

  async createFinanceTax(data: any) {
    const access = await this.getCurrentAccessContext();
    requirePermission(access, 'finance.taxes.manage', 'You do not have permission to add taxes.');
    const currentUserId = await this.getCurrentUserId();
    const { data: created, error } = await this.client.from('project_taxes').insert({
      project_id: data.project_id,
      title: data.title,
      rate: Number(data.rate) || 0,
      amount: Number(data.amount) || 0,
      currency: data.currency || 'USD',
      status: data.status || 'active',
      effective_from: data.effective_from || null,
      effective_to: data.effective_to || null,
      created_by: currentUserId,
    }).select().single();
    if (error) throw formatError(error, 'Failed to add project tax.');
    return { success: true, data: created };
  }

  async deleteFinanceTax(id: string) {
    const access = await this.getCurrentAccessContext();
    requirePermission(access, 'finance.taxes.manage', 'You do not have permission to delete taxes.');
    const { error } = await this.client.from('project_taxes').delete().eq('id', id);
    if (error) throw formatError(error, 'Failed to delete tax.');
    return { success: true };
  }

  async getFinanceCommissions() {
    const access = await this.getCurrentAccessContext();
    requirePermission(access, 'finance.commissions.view', 'You do not have permission to view commissions.');
    const currentUserId = String(access.profile.id);
    let query = this.client.from('project_commissions').select('*, projects(name)').order('created_at', { ascending: false });
    if (!access.canViewAllFinance) {
      query = query.eq('created_by', currentUserId);
    }
    const { data, error } = await query;
    if (error) throw formatError(error, 'Failed to fetch commissions.');
    return { success: true, data };
  }

  async getCurrencies() {
    const { data, error } = await this.client.from('system_currencies').select('*').order('code', { ascending: true });
    // If table doesn't exist yet, return defaults
    if (error) {
      return { success: true, data: [{ code: 'USD', symbol: '$', name: 'US Dollar' }, { code: 'EUR', symbol: '€', name: 'Euro' }, { code: 'GBP', symbol: '£', name: 'British Pound' }, { code: 'PKR', symbol: 'Rs', name: 'Pakistani Rupee' }] };
    }
    return { success: true, data };
  }

  async createCurrency(data: any) {
    const { data: created, error } = await this.client.from('system_currencies').insert({
      code: data.code,
      symbol: data.symbol,
      name: data.name,
    }).select().single();
    if (error) throw formatError(error, 'Failed to add currency.');
    return { success: true, data: created };
  }

  async deleteCurrency(id: string) {
    const { error } = await this.client.from('system_currencies').delete().eq('id', id);
    if (error) throw formatError(error, 'Failed to delete currency.');
    return { success: true };
  }

  async createFinanceCommission(data: any) {
    const access = await this.getCurrentAccessContext();
    requirePermission(access, 'finance.commissions.manage', 'You do not have permission to add commissions.');
    const currentUserId = await this.getCurrentUserId();
    const { data: created, error } = await this.client.from('project_commissions').insert({
      project_id: data.project_id,
      title: data.title,
      rate: Number(data.rate) || 0,
      amount: Number(data.amount) || 0,
      currency: data.currency || 'USD',
      status: data.status || 'active',
      effective_from: data.effective_from || null,
      effective_to: data.effective_to || null,
      created_by: currentUserId,
    }).select().single();
    if (error) throw formatError(error, 'Failed to add project commission.');
    return { success: true, data: created };
  }

  async deleteFinanceCommission(id: string) {
    const access = await this.getCurrentAccessContext();
    requirePermission(access, 'finance.commissions.manage', 'You do not have permission to delete commissions.');
    const { error } = await this.client.from('project_commissions').delete().eq('id', id);
    if (error) throw formatError(error, 'Failed to delete commission.');
    return { success: true };
  }

  async saveFinanceSettings(data: any) {
    const access = await this.getCurrentAccessContext();
    requirePermission(access, 'finance.settings.manage', 'You do not have permission to update finance settings.');
    const rows = Object.entries(data || {}).map(([setting_key, setting_value]) => ({
      setting_key,
      setting_value: String(setting_value),
    }));

    const { error } = await this.client.from('finance_settings').upsert(rows, { onConflict: 'setting_key' });
    if (error) throw formatError(error, 'Failed to save finance settings.');
    return { success: true };
  }

  async getFinanceStats(range: string) {
    const access = await this.getCurrentAccessContext();
    requirePermission(access, 'finance.view', 'You do not have permission to view finance stats.');
    const bounds = getRangeBounds(range);
    const currentUserId = String(access.profile.id);
    const restrictToOwn = !access.canViewAllFinance;
    const foundersEquityPromise = access.permissions.includes('finance.founders.view')
      ? this.getFoundersEquityTotal()
      : Promise.resolve({ success: true, data: { data: { total: 0 } } });
    const [paymentsRes, expensesRes, foundersEquityRes, settingsRes] = await Promise.all([
      restrictToOwn
        ? this.client.from('payments').select('amount, payment_date, status, created_by').gte('payment_date', bounds.start).lte('payment_date', bounds.end).eq('created_by', currentUserId).limit(1000)
        : this.client.from('payments').select('amount, payment_date, status').gte('payment_date', bounds.start).lte('payment_date', bounds.end).limit(1000),
      restrictToOwn
        ? this.client.from('expenses').select('amount, expense_date, created_by').gte('expense_date', bounds.start).lte('expense_date', bounds.end).eq('created_by', currentUserId).limit(1000)
        : this.client.from('expenses').select('amount, expense_date').gte('expense_date', bounds.start).lte('expense_date', bounds.end).limit(1000),
      foundersEquityPromise,
      this.getFinanceSettings(),
    ]);

    if (paymentsRes.error) throw formatError(paymentsRes.error, 'Unable to load payments stats.');
    if (expensesRes.error) throw formatError(expensesRes.error, 'Unable to load expenses stats.');

    const payments = ensureArray(paymentsRes.data);
    const expenses = ensureArray(expensesRes.data);
    const settings = (settingsRes as any)?.data?.data || {};
    const futureFundPercentage = Number(settings.future_fund_percentage || 20);
    const commissionPercentage = Number(settings.commission_percentage || 15);
    const taxRate = Number(settings.tax_rate || 30);
    const revenue = payments
      .filter((p: any) => p.status === 'completed')
      .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
    const expenseTotal = expenses.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
    const summary = calculateFinanceSummary({
      revenue,
      expenses: expenseTotal,
      futureFundRate: futureFundPercentage,
      salaries: Number(settings.monthly_salaries || 0),
      taxes: Number(revenue * (taxRate / 100)),
      commissions: Number(revenue * (commissionPercentage / 100)),
    });
    const outstanding = payments
      .filter((p: any) => p.status !== 'completed')
      .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

    return {
      success: true,
      data: {
        data: {
          revenue: summary.revenue,
          expenses: summary.expenses,
          netProfit: summary.netProfit,
          grossProfit: summary.grossProfit,
          futureFund: summary.futureFund,
          founderProfit: summary.founderProfit,
          liabilities: summary.liabilities,
          outstanding,
          distribution: [
            { label: 'Future Fund', percentage: futureFundPercentage, amount: summary.futureFund },
            { label: 'Commission', percentage: commissionPercentage, amount: summary.commissions },
            { label: 'Tax Reserve', percentage: taxRate, amount: summary.taxes },
            { label: 'Founder Equity Allocated', percentage: foundersEquityRes.data.data.total || 0, amount: 0 },
          ],
        },
        range,
      },
    };
  }

  async getFinanceChart(_range: string) {
    const access = await this.getCurrentAccessContext();
    requirePermission(access, 'finance.view', 'You do not have permission to view finance charts.');
    const bounds = getRangeBounds(_range);
    const currentUserId = String(access.profile.id);
    const restrictToOwn = !access.canViewAllFinance;
    const [paymentsRes, expensesRes] = await Promise.all([
      restrictToOwn
        ? this.client.from('payments').select('amount, payment_date, status, created_by').gte('payment_date', bounds.start).lte('payment_date', bounds.end).eq('created_by', currentUserId).limit(1000)
        : this.client.from('payments').select('amount, payment_date, status').gte('payment_date', bounds.start).lte('payment_date', bounds.end).limit(1000),
      restrictToOwn
        ? this.client.from('expenses').select('amount, expense_date, created_by').gte('expense_date', bounds.start).lte('expense_date', bounds.end).eq('created_by', currentUserId).limit(1000)
        : this.client.from('expenses').select('amount, expense_date').gte('expense_date', bounds.start).lte('expense_date', bounds.end).limit(1000),
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
    const access = await this.getCurrentAccessContext();
    const currentUserId = String(access.profile.id);
    const buildQuery = async (rich: boolean) => {
      const selectClause = rich
        ? `
          id,
          user_id,
          project_id,
          task_id,
          log_date,
          hours,
          duration_minutes,
          start_time,
          end_time,
          is_manual,
          approval_status,
          work_type,
          manual_leads_count,
          description,
          status,
          created_by,
          updated_by,
          timer_type,
          lead_source,
          session_id,
          user:profiles!time_logs_user_id_fkey(id, name),
          project:projects(id, name),
          task:tasks(id, title)
        `
        : `
          id,
          user_id,
          project_id,
          task_id,
          log_date,
          hours,
          duration_minutes,
          start_time,
          end_time,
          is_manual,
          approval_status,
          work_type,
          manual_leads_count,
          description,
          status,
          created_by,
          updated_by,
          timer_type,
          lead_source,
          session_id
        `;

      let query = this.client
        .from('time_logs')
        .select(selectClause)
        .order('log_date', { ascending: false });

      if (access.canViewAllTime) {
        // Full access is intentionally limited to elevated roles/permissions.
      } else if (access.canViewTeamTime) {
        const projectIds = await this.getAccessibleProjectIds(currentUserId);
        if (projectIds.length > 0) {
          query = query.or(`user_id.eq.${currentUserId},project_id.in.(${projectIds.join(',')})`);
        } else {
          query = query.eq('user_id', currentUserId);
        }
      } else {
        query = query.eq('user_id', currentUserId);
      }

      return query;
    };

    let result = await buildQuery(true);
    if (result.error) {
      console.warn('Rich time log query failed; retrying with base columns.', result.error);
      result = await buildQuery(false);
    }

    const { data, error } = result;
    if (error) throw formatError(error, 'Unable to load time logs.');

    return {
      success: true,
      data: ensureArray(data).map((log: any) => ({
        id: String(log.id),
        user_id: log.user_id ? String(log.user_id) : '',
        project_id: log.project_id ? String(log.project_id) : '',
        task_id: log.task_id ? String(log.task_id) : '',
        date: log.log_date,
        hours: log.hours,
        duration_minutes: Number(log.duration_minutes || 0),
        start_time: log.start_time || null,
        end_time: log.end_time || null,
        is_manual: Boolean(log.is_manual),
        created_by: log.created_by ? String(log.created_by) : String(log.user_id || ''),
        updated_by: log.updated_by ? String(log.updated_by) : undefined,
        timer_type: log.timer_type || (log.project_id ? 'project' : 'sales'),
        lead_source: log.lead_source || '',
        approval_status: log.approval_status || log.status,
        work_type: log.work_type || '',
        manual_leads_count: Number(log.manual_leads_count || 0),
        session_id: log.session_id ? String(log.session_id) : undefined,
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
      .select('hours, approval_status, status, log_date')
      .eq('user_id', currentUserId);

    if (error) throw formatError(error, 'Unable to load time log stats.');

    const logs = ensureArray(data);
    const today = new Date().toISOString().split('T')[0];
    const todaysHours = logs.filter((log: any) => log.log_date === today).reduce((sum: number, log: any) => sum + Number(log.hours || 0), 0);
    const weeklyHours = logs.reduce((sum: number, log: any) => sum + Number(log.hours || 0), 0);
    const approvedHours = logs.filter((log: any) => (log.approval_status || log.status) === 'approved').reduce((sum: number, log: any) => sum + Number(log.hours || 0), 0);
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
    const access = await this.getCurrentAccessContext();
    requirePermission(access, 'time.delete', 'You do not have permission to delete time logs.');
    const { error } = await this.client.rpc('delete_time_entry_secure', {
      p_time_log_id: id,
    });
    if (error) throw formatError(error, 'Failed to delete time log.');
    return { success: true };
  }

  async startTimeSession(data: any) {
    const currentUserId = await this.getCurrentUserId();
    const sessionPayload = {
      user_id: currentUserId,
      project_id: data.project_id || null,
      task_id: data.task_id || null,
      session_status: 'running',
      entry_mode: 'timer',
      source_platform: data.source_platform ? String(data.source_platform).toLowerCase() : null,
      source_platform_other: data.source_platform_other || null,
      lead_generation_target: Number(data.lead_generation_target || 0),
      manual_leads_count: 0,
      notes: data.notes || null,
    };

    const { data: created, error } = await this.client.rpc('create_time_tracking_session_secure', {
      p_session: sessionPayload,
    });

    if (!error && created) {
      return { success: true, data: created };
    }

    if (!this.isMissingRpcFunctionError(error, 'create_time_tracking_session_secure') && !this.isMissingTableError(error, 'time_tracking_sessions')) {
      throw formatError(error, 'Failed to start time tracking session.');
    }

    const syntheticId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return {
      success: true,
      data: {
        id: syntheticId,
        ...sessionPayload,
        started_at: new Date().toISOString(),
        session_status: 'running',
      },
    };
  }

  async stopTimeSession(sessionId: string, data: any) {
    if (String(sessionId || '').startsWith('local-')) {
      return {
        success: true,
        data: {
          id: sessionId,
          session_status: 'stopped',
          stopped_at: new Date().toISOString(),
          notes: data.notes || null,
        },
      };
    }

    const { data: updated, error } = await this.client
      .from('time_tracking_sessions')
      .update({
        session_status: 'stopped',
        stopped_at: new Date().toISOString(),
        notes: data.notes || null,
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error || !updated) {
      if (this.isMissingTableError(error, 'time_tracking_sessions')) {
        return {
          success: true,
          data: {
            id: sessionId,
            session_status: 'stopped',
            stopped_at: new Date().toISOString(),
            notes: data.notes || null,
          },
        };
      }
      throw formatError(error, 'Failed to stop time tracking session.');
    }
    return { success: true, data: updated };
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
    const access = await this.getCurrentAccessContext();
    const roleName = String(access.role?.name || '').toLowerCase().replace(/_/g, ' ');
    const canViewAllMails =
      roleName === 'super admin' ||
      roleName === 'superadmin' ||
      roleName === 'admin' ||
      access.permissions.includes('mails.view.all');

    if (!canViewAllMails) {
      throw new ApiError('You do not have permission to view all mails.', 403, 'MAILS_VIEW_ALL_REQUIRED');
    }

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
          file_path: uploaded.path,
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
