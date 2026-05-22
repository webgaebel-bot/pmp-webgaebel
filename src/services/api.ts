/**
 * Professional Error Handling for Frontend
 * Handles all API errors and converts them to user-friendly messages
 */
import { getDataProvider } from '@/lib/supabase';
import { SupabaseApiService } from '@/services/supabaseApi';

export class ApiError extends Error {
  status?: number;
  error_code?: string;
  details?: string;
  
  constructor(message: string, status?: number, error_code?: string, details?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.error_code = error_code;
    this.details = details;
  }
}

const DATA_PROVIDER = getDataProvider();

const normalizeBaseUrl = (url: string): string => url.replace(/\/+$/, '');

const joinUrl = (baseUrl: string, path: string): string => {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path ? `/${path.replace(/^\/+/, '')}` : '';
  return `${baseUrl}${normalizedPath}`;
};

const API_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_BACKEND_API_BASE_URL || (DATA_PROVIDER === 'supabase' ? '' : 'http://localhost:5000/api')
);
export const IMAGE_BASE_URL = normalizeBaseUrl(
  DATA_PROVIDER === 'supabase'
    ? ''
    : import.meta.env.VITE_BACKEND_IMAGE_BASE_URL || 'http://localhost:5000/api'
);

/**
 * Get user-friendly error message
 */
function getUserFriendlyMessage(error: any): string {
  // If it's our custom ApiError
  if (error instanceof ApiError) {
    return error.message;
  }
  
  // Handle fetch errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return 'Network error. Please check your connection.';
  }
  
  // Handle generic errors
  if (error instanceof Error) {
    return error.message || 'An unexpected error occurred.';
  }
  
  return 'An unexpected error occurred.';
}

class ApiService {
  private buildUrl(endpoint: string): string {
    if (!API_BASE_URL) {
      throw new ApiError(
        'This feature still uses the old REST backend, but VITE_BACKEND_API_BASE_URL is not configured.',
        501,
        'REST_BACKEND_NOT_CONFIGURED'
      );
    }
    return joinUrl(API_BASE_URL, endpoint);
  }

  private getToken(): string | null {
    return sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token');
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    // Handle 401 - Unauthorized
    if (response.status === 401) {
      const isAuthEndpoint = response.url.includes('/auth/login');
      
      if (!isAuthEndpoint) {
        localStorage.removeItem('auth_token');
        sessionStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
      
      try {
        const errorData = await response.json();
        throw new ApiError(
          errorData.message || 'Unauthorized. Please log in again.',
          401,
          errorData.error_code
        );
      } catch {
        throw new ApiError('Unauthorized. Please log in again.', 401);
      }
    }
    
    // Handle 403 - Forbidden
    if (response.status === 403) {
      try {
        const errorData = await response.json();
        throw new ApiError(
          errorData.message || 'You do not have permission to perform this action.',
          403,
          errorData.error_code
        );
      } catch {
        throw new ApiError('You do not have permission to perform this action.', 403);
      }
    }
    
    // Handle 404 - Not Found
    if (response.status === 404) {
      try {
        const errorData = await response.json();
        throw new ApiError(
          errorData.message || 'The requested resource was not found.',
          404,
          errorData.error_code
        );
      } catch {
        throw new ApiError('The requested resource was not found.', 404);
      }
    }
    
    // Handle 409 - Conflict
    if (response.status === 409) {
      try {
        const errorData = await response.json();
        throw new ApiError(
          errorData.message || 'This resource already exists.',
          409,
          errorData.error_code
        );
      } catch {
        throw new ApiError('This resource already exists.', 409);
      }
    }
    
    // Handle 500 - Server Error
    if (response.status >= 500) {
      try {
        const errorData = await response.json();
        throw new ApiError(
          errorData.message || 'An internal server error occurred. Please try again later.',
          500,
          errorData.error_code
        );
      } catch {
        throw new ApiError('An internal server error occurred. Please try again later.', 500);
      }
    }
    
    // Handle other errors
    if (!response.ok) {
      try {
        const errorData = await response.json();
        throw new ApiError(
          errorData.message || 'An error occurred.',
          response.status,
          errorData.error_code,
          errorData.details
        );
      } catch (e) {
        if (e instanceof ApiError) throw e;
        throw new ApiError('An error occurred.', response.status);
      }
    }
    
    return response.json();
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    
    const headers: HeadersInit = {
      ...options.headers,
    };
    
    // Only set Content-Type if body is not FormData
    // FormData needs browser to auto-set multipart/form-data with boundary
    if (!(options.body instanceof FormData)) {
      (headers as Record<string, string>)['Content-Type'] = 'application/json';
    }
    
    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }
    
    try {
      const response = await fetch(this.buildUrl(endpoint), {
        ...options,
        headers,
      });
      
      return await this.handleResponse<T>(response);
    } catch (error) {
      // Log error for debugging
      console.error(`API Error [${endpoint}]:`, error);
      
      // Re-throw ApiError instances
      if (error instanceof ApiError) {
        throw error;
      }
      
      // Handle network errors
      if (error instanceof TypeError) {
        throw new ApiError(
          getUserFriendlyMessage(error),
          0,
          'NETWORK_ERROR'
        );
      }
      
      // Wrap other errors
      throw new ApiError(
        getUserFriendlyMessage(error),
        0,
        'UNKNOWN_ERROR'
      );
    }
  }

  async get<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint);
  }

  async post<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  }

  async put<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  }

  async patch<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  }

  async delete<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }

  // ==================== AUTH APIs ====================
  
  async login(email: string, password: string) {
    return this.request<{ success: boolean; token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }
  
  async logout() {
    return this.request<any>('/auth/logout', { method: 'POST' });
  }
  
  async getCurrentUser() {
    return this.request<{ success: boolean; data: any }>('/auth/me');
  }

  // ==================== DASHBOARD/REPORTS APIs ====================
  
  async getDashboard() {
    return this.request<any>('/report/reports/dashboard');
  }
  
  async getProjectProgress() {
    return this.request<any>('/report/reports/project-progress');
  }
  
  async getTeamPerformance() {
    return this.request<any>('/report/reports/team-performance');
  }
  
  async getTaskSummary() {
    return this.request<any>('/report/reports/task-summary');
  }

  // ==================== PROJECTS APIs ====================
  
  async getProjects(params?: Record<string, string>) {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.request<{ success: boolean; data: any[] }>(`/project/get${query}`);
  }
  
  async getProject(id: string): Promise<any> {
    return this.request<any>(`/project/${id}`);
  }
  
  async createProject(data: any) {
    return this.request<{ success: boolean; message: string; data: any }>('/project/create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  
  async updateProject(id: string, data: any) {
    return this.request<{ success: boolean; message: string }>(`/project/update/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
  
  async deleteProject(id: string) {
    return this.request<{ success: boolean; message: string }>(`/project/delete/${id}`, {
      method: 'DELETE',
    });
  }
  
  async getUserProjects(userId: string) {
    return this.request<any>(`/project/${userId}/projects`);
  }
  
  async getProjectMembers(projectId: string): Promise<any> {
    return this.request<any>(`/project/members/${projectId}`);
  }

  async getMinimalProjects(): Promise<any> {
    return this.request<any>('/projects/minimal');
  }
  
  async addProjectMember(projectId: string, userId: string, role: string) {
    return this.request<any>(`/project/members/add`, {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId, user_id: userId, role }),
    });
  }
  
  async removeProjectMember(projectId: string, userId: string) {
    return this.request<any>(`/project/members/remove/${projectId}/${userId}`, {
      method: 'DELETE',
    });
  }

  // ==================== TASKS APIs ====================
  
  async getTasks(params?: Record<string, string>) {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.request<{ success: boolean; data: any[] }>(`/task/get${query}`);
  }
  
  async getMyTasks(params?: Record<string, string>) {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.request<any>(`/task/my${query}`);
  }
  
  async getTask(id: string) {
    return this.request<{ success: boolean; data: any }>(`/task/${id}`);
  }
  
  async getTasksByProjectId(projectId: string) {
    return this.request<any>(`/task/project/${projectId}/tasks`);
  }
  
  async createTask(data: any) {
    return this.request<{ success: boolean; message: string; data: any }>('/task/create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  
  async updateTask(id: string, data: any) {
    return this.request<{ success: boolean; message: string }>(`/task/update/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
  
  async deleteTask(id: string) {
    return this.request<{ success: boolean; message: string }>(`/task/delete/${id}`, {
      method: 'DELETE',
    });
  }
  
  async updateTaskStatus(id: string, status: string) {
    return this.request<any>(`/task/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }
  
  async updateTaskPriority(id: string, priority: string) {
    return this.request<any>(`/task/${id}/priority`, {
      method: 'PATCH',
      body: JSON.stringify({ priority }),
    });
  }
  
  async getUserTasks(userId: string) {
    return this.request<any>(`/task/${userId}/tasks`);
  }
  
  async assignTask(taskId: string, userId: string) {
    return this.request<any>(`/task/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify({ assignee_id: userId }),
    });
  }
  
  async unassignTask(taskId: string) {
    return this.request<any>(`/task/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify({ assignee_id: null }),
    });
  }

  // ==================== TASK COMMENTS APIs ====================
  
  async getTaskComments(taskId: string) {
    return this.request<any>(`/task/comments/${taskId}`);
  }
  
  async addTaskComment(taskId: string, content: string, parentId?: string | number) {
    return this.request<any>(`/task/comments/add`, {
      method: 'POST',
      body: JSON.stringify({
        task_id: taskId,
        content,
        parent_id: parentId || null
      }),
    });
  }
  
  async deleteTaskComment(commentId: string) {
    return this.request<any>(`/task/comments/delete/${commentId}`, {
      method: 'DELETE',
    });
  }

  // ==================== FILES APIs ====================
  
  async uploadFile(formData: FormData) {
    const token = this.getToken();
    const response = await fetch(this.buildUrl('/task/files/upload'), {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    return this.handleResponse<any>(response);
  }
  
  async getFiles(relatedId: string): Promise<any> {
    return this.request<any>(`/task/files/${relatedId}`);
  }
  
  async getFile(id: string) {
    return this.request<any>(`/task/file/${id}`);
  }
  
  async deleteFile(id: string) {
    return this.request<any>(`/task/files/delete/${id}`, {
      method: 'DELETE',
    });
  }

  // ==================== USERS APIs ====================
  
  async getUsers(params?: Record<string, string>) {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.request<{ success: boolean; data: any[] }>(`/users/get${query}`);
  }
  
  async getUser(id: string) {
    return this.request<any>(`/users/${id}`);
  }
  
  async createUser(data: any) {
    return this.request<{ success: boolean; message: string; data: any }>('/users/create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  
  async updateUser(id: string, data: any) {
    return this.request<{ success: boolean; message: string }>(`/users/update/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
  
  async deleteUser(id: string) {
    return this.request<{ success: boolean; message: string }>(`/users/delete/${id}`, {
      method: 'DELETE',
    });
  }

  // ==================== ROLES APIs ====================
  
  async getRoles() {
    return this.request<{ success: boolean; data: any[] }>('/roles/get');
  }
  
  async getRole(id: string) {
    return this.request<any>(`/roles/${id}`);
  }
  
  async getRolePermissions(roleId: string) {
    return this.request<any>(`/roles/${roleId}/permissions`);
  }
  
  async createRole(data: any) {
    return this.request<{ success: boolean; message: string; data: any }>('/roles/create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  
  async updateRole(id: string, data: any) {
    return this.request<any>(`/roles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
  
  async deleteRole(id: string) {
    return this.request<any>(`/roles/${id}`, {
      method: 'DELETE',
    });
  }
  
  async assignPermissions(roleId: string, permissionIds: string[] | number[]) {
    return this.request<any>(`/roles/${roleId}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissions: permissionIds }),
    });
  }

  // ==================== PERMISSIONS APIs ====================
  
  async getPermissions() {
    return this.request<{ success: boolean; data: any[] }>('/permissions/get');
  }
  
  async createPermission(data: any) {
    return this.request<any>('/permissions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ==================== ACTIVITY LOGS APIs ====================
  
  async getActivityLogs(params?: Record<string, string>) {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.request<{ success: boolean; data: any[] }>(`/activity-logs/get${query}`);
  }
  
  async getMyActivityLogs(params?: Record<string, string>) {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.request<any>(`/activity-logs/me${query}`);
  }

  // ==================== PROFILE APIs ====================
  
  async getProfile() {
    return this.request<any>('/profile/profile');
  }
  
  async updateProfile(data: any) {
    // If data is FormData (has entries method), send it directly without JSON.stringify
    if (data instanceof FormData) {
      const token = this.getToken();
      const response = await fetch(this.buildUrl('/profile/profile'), {
        method: 'PUT',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: data,
      });
      return this.handleResponse<any>(response);
    }
    // Otherwise, treat it as a regular JSON object
    return this.request<any>('/profile/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
  
  async changePassword(currentPassword: string, newPassword: string) {
    return this.request<any>('/profile/profile/change-password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  // ==================== REPORT APIs ====================
  
  async getDashboardReport(): Promise<any> {
    return this.request<any>('/report/reports/dashboard');
  }
  
  async getProjectProgressReport(): Promise<any> {
    return this.request<any>('/report/reports/project-progress');
  }
  
  async getTaskDistributionReport(): Promise<any> {
    return this.request<any>('/report/reports/task-distribution');
  }
  
  async getTaskActivityReport(): Promise<any> {
    return this.request<any>('/report/reports/task-activity');
  }
  
  async getTeamPerformanceReport(): Promise<any> {
    return this.request<any>('/report/reports/team-performance');
  }

  // ==================== NOTIFICATIONS APIs ====================
  
  async getNotifications(): Promise<{ success: boolean; data: any[] }> {
    return this.request<any>('/notifications/get');
  }

  async getNotificationSettings(): Promise<any> {
    return this.request<any>('/notifications/settings');
  }

  async updateNotificationSettings(data: any): Promise<any> {
    return this.request<any>('/notifications/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
  
  async markNotificationAsRead(id: string): Promise<any> {
    return this.request<any>(`/notifications/read/${id}`, {
      method: 'PUT',
    });
  }
  
  async deleteNotification(id: string): Promise<any> {
    return this.request<any>(`/notifications/delete/${id}`, {
      method: 'DELETE',
    });
  }

  // ==================== CALENDAR APIs ====================
  
  async getCalendar(startDate?: string, endDate?: string): Promise<any> {
    if (startDate && endDate) {
      return this.request<any>('/calendar/events', {
        method: 'POST',
        body: JSON.stringify({ start_date: startDate, end_date: endDate }),
      });
    }
    return this.request<any>('/calendar/events');
  }

  async createTimeLog(data: any): Promise<any> {
    return this.request<any>('/time-logs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateLead(id: string | number, data: any): Promise<any> {
    return this.request<any>(`/leads/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async createLead(data: any): Promise<any> {
    return this.request<any>('/leads', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteLead(id: string | number): Promise<any> {
    return this.request<any>(`/leads/${id}`, {
      method: 'DELETE',
    });
  }

  async getLeads(params?: Record<string, unknown>): Promise<any> {
    const query = params ? `?${new URLSearchParams(Object.entries(params).reduce<Record<string, string>>((acc, [key, value]) => {
      if (value === undefined || value === null || value === '') return acc;
      acc[key] = Array.isArray(value) ? value.join(',') : String(value);
      return acc;
    }, {})).toString()}` : '';
    return this.request<any>(`/leads${query}`);
  }

  async getLeadById(id: string): Promise<any> {
    return this.request<any>(`/leads/${id}`);
  }

  async addActivity(leadId: string, data: any): Promise<any> {
    return this.request<any>(`/leads/${leadId}/activities`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async addNote(leadId: string, content: string): Promise<any> {
    return this.request<any>(`/leads/${leadId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async scheduleFollowup(leadId: string, data: any): Promise<any> {
    return this.request<any>(`/leads/${leadId}/followups`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async completeFollowup(followupId: string, notes?: string): Promise<any> {
    return this.request<any>(`/lead-followups/${followupId}/complete`, {
      method: 'PUT',
      body: JSON.stringify({ notes }),
    });
  }

  async addTag(leadId: string, tagName: string): Promise<any> {
    return this.request<any>(`/leads/${leadId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tagName }),
    });
  }

  async removeTag(leadId: string, tagName: string): Promise<any> {
    return this.request<any>(`/leads/${leadId}/tags/${encodeURIComponent(tagName)}`, {
      method: 'DELETE',
    });
  }

  async updateLeadScore(leadId: string, score: number): Promise<any> {
    return this.request<any>(`/leads/${leadId}/score`, {
      method: 'PUT',
      body: JSON.stringify({ score }),
    });
  }

  async bulkUpdateStatus(leadIds: string[], status: string): Promise<any> {
    return this.request<any>('/leads/bulk/status', {
      method: 'PUT',
      body: JSON.stringify({ leadIds, status }),
    });
  }

  async bulkAssign(leadIds: string[], userId: string): Promise<any> {
    return this.request<any>('/leads/bulk/assign', {
      method: 'PUT',
      body: JSON.stringify({ leadIds, userId }),
    });
  }

  async bulkDelete(leadIds: string[]): Promise<any> {
    return this.request<any>('/leads/bulk/delete', {
      method: 'DELETE',
      body: JSON.stringify({ leadIds }),
    });
  }

  async getLeadStats(): Promise<any> {
    return this.request<any>('/leads/stats');
  }

  async getLeadOwnershipReport(): Promise<any> {
    return this.request<any>('/report/reports/lead-ownership');
  }

  async importLeads(formData: FormData): Promise<any> {
    const token = this.getToken();
    const response = await fetch(this.buildUrl('/leads/import'), {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    return this.handleResponse<any>(response);
  }

  async getFlexibleFollowups(params?: Record<string, unknown>): Promise<any> {
    const query = params ? `?${new URLSearchParams(Object.entries(params).reduce<Record<string, string>>((acc, [key, value]) => {
      if (value === undefined || value === null || value === '') return acc;
      acc[key] = String(value);
      return acc;
    }, {})).toString()}` : '';
    return this.request<any>(`/lead-followup-records${query}`);
  }

  async createFlexibleFollowup(data: any): Promise<any> {
    return this.request<any>('/lead-followup-records', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateFlexibleFollowup(id: string | number, data: any): Promise<any> {
    return this.request<any>(`/lead-followup-records/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteFlexibleFollowup(id: string | number): Promise<any> {
    return this.request<any>(`/lead-followup-records/${id}`, {
      method: 'DELETE',
    });
  }

  // ==================== MAIL APIs ====================
  
  async getInbox(): Promise<{ success: boolean; data: any[] }> {
    return this.request<any>('/mails/inbox');
  }
  
  async getSentMails(): Promise<{ success: boolean; data: any[] }> {
    return this.request<any>('/mails/sent');
  }
  
  async getAllMails(): Promise<any> {
    return this.request<any>('/mails/admin/all');
  }
  
  async getMailDetail(id: string): Promise<any> {
    return this.request<any>(`/mails/${id}`);
  }
  
  async sendMail(mailData: {
    recipients: string[] | number[];
    subject: string;
    body: string;
  } | FormData): Promise<any> {
    const token = this.getToken();
    
    // For FormData with attachments
    if (mailData instanceof FormData) {
      const response = await fetch(this.buildUrl('/mails/send'), {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: mailData,
      });
      return this.handleResponse<any>(response);
    }
    
    // For JSON payload
    return this.request<any>('/mails/send', {
      method: 'POST',
      body: JSON.stringify(mailData),
    });
  }
  
  async replyMail(threadId: string, replyData: {
    body: string;
  }): Promise<any> {
    return this.request<any>(`/mails/${threadId}/reply`, {
      method: 'POST',
      body: JSON.stringify(replyData),
    });
  }
  
  async markMailAsRead(id: string): Promise<any> {
    return this.request<any>(`/mails/read/${id}`, {
      method: 'PUT',
    });
  }
  
  async deleteMail(id: string): Promise<any> {
    return this.request<any>(`/mails/delete/${id}`, {
      method: 'DELETE',
    });
  }

  // ==================== SYSTEM/MAILS USERS APIs ====================
  
  async getSystemUsers(search: string = ''): Promise<any> {
    const query = search ? `?q=${encodeURIComponent(search)}` : '';
    return this.request<any>(`/mails/users/suggestions${query}`);
  }
}

const restApi = new ApiService();
const provider = DATA_PROVIDER;

export const api =
  provider === 'supabase' ? (new SupabaseApiService(restApi as any) as any) : restApi;

export default api;
