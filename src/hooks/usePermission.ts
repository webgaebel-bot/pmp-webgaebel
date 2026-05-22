import { useAuth } from '@/contexts/AuthContext';
import { isSuperAdminRole, normalizeRoleName, userHasAllPermissions } from '@/lib/permissions';

/**
 * Custom hook for permission checking
 * Provides methods to check single and multiple permissions
 */
export const usePermission = () => {
  const { user, hasPermission, hasAnyPermission } = useAuth();

  return {
    /**
     * Check if user has a specific permission
     */
    can: (permission: string): boolean => {
      return hasPermission(permission);
    },

    /**
     * Check if user has any of the provided permissions
     */
    canAny: (permissions: string[]): boolean => {
      return hasAnyPermission(permissions);
    },

    /**
     * Check if user has ALL of the provided permissions
     */
    canAll: (permissions: string[]): boolean => {
      return userHasAllPermissions(user, permissions);
    },

    /**
     * Check if user is Super Admin
     */
    isSuperAdmin: (): boolean => {
      return isSuperAdminRole(user?.role);
    },

    /**
     * Check if user is Admin
     */
    isAdmin: (): boolean => {
      const roleName = normalizeRoleName(user?.role);
      return roleName.includes('admin');
    },

    /**
     * Check if user is Project Manager
     */
    isProjectManager: (): boolean => {
      const roleName = normalizeRoleName(user?.role);
      return roleName.includes('project manager') || roleName.includes('manager');
    },

    /**
     * Check if user is Developer
     */
    isDeveloper: (): boolean => {
      const roleName = normalizeRoleName(user?.role);
      return roleName.includes('developer') || roleName.includes('dev');
    },

    /**
     * Check if user is Viewer (read-only access)
     */
    isViewer: (): boolean => {
      const roleName = normalizeRoleName(user?.role);
      return roleName.includes('viewer');
    },

    /**
     * Dashboard (1 + 5 new + 5 granular)
     */
    canViewDashboard: (): boolean => hasPermission('dashboard.view'),
    canViewDashboardStats: (): boolean => isAdmin() && hasPermission('dashboard.stats.view'),
    canViewProjectProgress: (): boolean => isAdmin() && hasPermission('dashboard.project_progress'),
    canViewTeamPerformance: (): boolean => isAdmin() && hasPermission('dashboard.team_performance'),
    canViewTaskCharts: (): boolean => isAdmin() && hasPermission('dashboard.task_charts'),
    canViewProjectDashboard: (): boolean => isAdmin() && hasPermission('dashboard.projects.view'),
    canViewLeadDashboard: (): boolean => isAdmin() && hasPermission('dashboard.leads.view'),
    canViewFinanceDashboard: (): boolean => isAdmin() && hasPermission('dashboard.finance.view'),
    canViewSalesDashboard: (): boolean => hasPermission('sales.dashboard.view') || hasPermission('sales.view'),
    // Leads
    canViewLeads: (): boolean => hasPermission('leads.view'),
    
    // Granular dashboard stat permissions
    canViewTotalProjects: (): boolean => hasPermission('dashboard.view.total_projects'),
    canViewTotalTasks: (): boolean => hasPermission('dashboard.view.tasks'),
    canViewOverdueTasks: (): boolean => hasPermission('dashboard.view.overdue'),
    canViewTeamMembers: (): boolean => hasPermission('dashboard.view.team'),
    canViewOnlineUsers: (): boolean => hasPermission('dashboard.view.online_users'),

    /**
     * Projects (5)
     */
    canViewProjects: (): boolean => hasPermission('projects.view') || hasPermission('projects.view.all'),
    canCreateProject: (): boolean => hasPermission('projects.create'),
    canEditProject: (): boolean => hasPermission('projects.update'),
    canDeleteProject: (): boolean => hasPermission('projects.delete'),
    canManageProjectMembers: (): boolean => 
      hasPermission('members.create') || 
      hasPermission('members.update') || 
      hasPermission('members.delete'),

    /**
     * Tasks (7)
     */
    canViewTasks: (): boolean => hasPermission('tasks.view'),
    canCreateTask: (): boolean => hasPermission('tasks.create'),
    canEditTask: (): boolean => hasPermission('tasks.update'),
    canDeleteTask: (): boolean => hasPermission('tasks.delete'),
    canAssignTask: (): boolean => hasPermission('tasks.assign'),
    canUpdateTaskStatus: (): boolean => hasPermission('tasks.update_status'),
    canUpdateTaskPriority: (): boolean => hasPermission('tasks.update_priority'),

    /**
     * Comments (2)
     */
    canCreateComment: (): boolean => hasPermission('comments.create'),
    canDeleteComment: (): boolean => hasPermission('comments.delete'),

    /**
     * Files (2)
     */
    canUploadFiles: (): boolean => hasPermission('files.upload'),
    canDeleteFiles: (): boolean => hasPermission('files.delete'),

    /**
     * Users (4)
     */
    canViewUsers: (): boolean => hasPermission('users.view'),
    canCreateUser: (): boolean => hasPermission('users.create'),
    canEditUser: (): boolean => hasPermission('users.update'),
    canDeleteUser: (): boolean => hasPermission('users.delete'),

    /**
     * Roles (1)
     */
    canManageRoles: (): boolean => hasPermission('roles.manage'),

    /**
     * Permissions (1)
     */
    canManagePermissions: (): boolean => hasPermission('permissions.manage'),

    /**
     * Reports (1)
     */
    canViewReports: (): boolean => hasPermission('reports.view'),

    /**
     * Members (4)
     */
    canViewMembers: (): boolean => hasPermission('members.view'),
    canCreateMembers: (): boolean => hasPermission('members.create'),
    canUpdateMembers: (): boolean => hasPermission('members.update'),
    canDeleteMembers: (): boolean => hasPermission('members.delete'),
    canManageMembers: (): boolean => 
      hasPermission('members.create') || 
      hasPermission('members.update') || 
      hasPermission('members.delete'),

    /**
     * Project Members - specific permissions
     */
    canAddProjectMembers: (): boolean => hasPermission('members.create'),
    canUpdateProjectMembers: (): boolean => hasPermission('members.update'),
    canRemoveProjectMembers: (): boolean => hasPermission('members.delete'),

    /**
     * Activity Logs (2)
     */
    canViewActivityLogs: (): boolean => hasPermission('activity_logs.view'),
    canViewActivityLogsDashboard: (): boolean => isAdmin() && hasPermission('activity_logs.dashboard'),

    /**
     * Mails/Email (7)
     */
    canSendMail: (): boolean => hasPermission('mails.send'),
    canViewMails: (): boolean => hasPermission('mails.view'),
    canViewAllMails: (): boolean => hasPermission('mails.view.all'),
    canDeleteMails: (): boolean => hasPermission('mails.delete'),
    canReplyMail: (): boolean => hasPermission('mails.reply'),
    canManageMails: (): boolean => hasPermission('mails.manage'),
    canViewMailThreads: (): boolean => hasPermission('mail_threads.view'),
    canCreateMailThreads: (): boolean => hasPermission('mail_threads.create'),

    /**
     * Finance submodules
     */
    canViewSalaries: (): boolean => hasPermission('finance.salaries.view'),
    canManageSalaries: (): boolean => hasPermission('finance.salaries.manage'),
    canViewTaxes: (): boolean => hasPermission('finance.taxes.view'),
    canManageTaxes: (): boolean => hasPermission('finance.taxes.manage'),
    canViewCommissions: (): boolean => hasPermission('finance.commissions.view'),
    canManageCommissions: (): boolean => hasPermission('finance.commissions.manage'),
  };
};
