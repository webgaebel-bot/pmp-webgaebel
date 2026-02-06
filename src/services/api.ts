const API_BASE_URL = import.meta.env.VITE_BACKEND_API_BASE_URL || 'http://localhost:5000/api';
export const IMAGE_BASE_URL = import.meta.env.VITE_BACKEND_IMAGE_BASE_URL || 'http://localhost:5000/api';

class ApiService {
  private getToken(): string | null {
    return localStorage.getItem('auth_token');
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

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      const isAuthEndpoint = endpoint.startsWith('/auth/login');
      if (isAuthEndpoint) {
        const error = await response.json().catch(() => ({ message: 'Unauthorized' }));
        throw new Error(error.message || 'Unauthorized');
      }
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'An error occurred' }));
      throw new Error(error.message || 'An error occurred');
    }

    return response.json();
  }

  // Auth APIs
  async login(email: string, password: string) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async logout() {
    return this.request('/auth/logout', { method: 'POST' });
  }

  async getCurrentUser() {
    return this.request('/auth/me');
  }

  // Dashboard/Reports APIs
  async getDashboard() {
    return this.request('/report/reports/dashboard');
  }

  async getProjectProgress() {
    return this.request('/report/reports/project-progress');
  }

  async getTeamPerformance() {
    return this.request('/report/reports/team-performance');
  }

  async getTaskSummary() {
    return this.request('/report/reports/task-summary');
  }

  // Projects APIs
  async getProjects(params?: Record<string, string>) {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.request(`/project/get${query}`);
  }

  async getProject(id: string): Promise<any> {
    return this.request(`/project/${id}`);
  }

  async createProject(data: any) {
    return this.request('/project/add', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProject(id: string, data: any) {
    return this.request(`/project/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteProject(id: string) {
    return this.request(`/project/${id}`, { method: 'DELETE' });
  }

  async getUserProjects(userId: string) {
    return this.request(`/project/${userId}/projects`);
  }

  async getProjectMembers(projectId: string): Promise<any> {
    return this.request(`/project/projects/${projectId}/members`);
  }

  async addProjectMember(projectId: string, userId: string, role: string) {
    return this.request(`/project/projects/${projectId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId, role }),
    });
  }

  async removeProjectMember(projectId: string, userId: string) {
    return this.request(`/project/projects/${projectId}/members/${userId}`, {
      method: 'DELETE',
    });
  }

  // Tasks APIs
  async getTasks(params?: Record<string, string>): Promise<any> {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.request(`/task/tasks${query}`);
  }

  async getMyTasks(params?: Record<string, string>) {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.request(`/task/tasks/my${query}`);
  }

  async getTask(id: string) {
    return this.request(`/task/tasks/${id}`);
  }
 
  async getTasksByProjectId(projectId: string) {
    return this.request(`/task/projects/${projectId}/tasks`);
  }

  async createTask(data: any) {
    return this.request('/task/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTask(id: string, data: any) {
    return this.request(`/task/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTask(id: string) {
    return this.request(`/task/tasks/${id}`, { method: 'DELETE' });
  }

  async updateTaskStatus(id: string, status: string) {
    return this.request(`/task/tasks/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async updateTaskPriority(id: string, priority: string) {
    return this.request(`/task/tasks/${id}/priority`, {
      method: 'PATCH',
      body: JSON.stringify({ priority }),
    });
  }

  async getUserTasks(userId: string) {
    return this.request(`/task/${userId}/tasks`);
  }

  async assignTask(taskId: string, userId: string) {
    return this.request(`/task/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify({ assignee_id: userId }),
    });
  }

  async unassignTask(taskId: string) {
    return this.request(`/task/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify({ assignee_id: null }),
    });
  }

  // Task Comments APIs
  async getTaskComments(taskId: string) {
    return this.request(`/taskcomment/tasks/${taskId}/comments`);
  }

  async addTaskComment(taskId: string, content: string, parentId?: string | number) {
    return this.request(`/taskcomment/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ 
        content,
        parent_id: parentId || null
      }),
    });
  }

  async deleteTaskComment(commentId: string) {
    return this.request(`/taskcomment/comments/${commentId}`, {
      method: 'DELETE',
    });
  }

  // Files APIs
  async uploadFile(formData: FormData) {
    const token = this.getToken();
    const response = await fetch(`${API_BASE_URL}/files/files/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    return response.json();
  }

  async getFiles(relatedId: string): Promise<any> {
    return this.request(`/files/files/${relatedId}`);
  }

  async getFile(id: string) {
    return this.request(`/files/file/${id}`);
  }

  async deleteFile(id: string) {
    return this.request(`/files/files/${id}`, { method: 'DELETE' });
  }

  // Users APIs
  async getUsers(params?: Record<string, string>): Promise<any> {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.request(`/users/get${query}`);
  }

  async getUser(id: string) {
    return this.request(`/users/${id}`);
  }

  async createUser(data: any) {
    return this.request('/users/add', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateUser(id: string, data: any) {
    return this.request(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteUser(id: string) {
    return this.request(`/users/${id}`, { method: 'DELETE' });
  }

  // Roles APIs
  async getRoles() {
    return this.request('/role/get');
  }

  async getRole(id: string) {
    return this.request(`/role/${id}`);
  }

  async getRolePermissions(roleId: string) {
    return this.request(`/roles/${roleId}/permissions`);
  }

  async createRole(data: any) {
    return this.request('/role/add', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateRole(id: string, data: any) {
    return this.request(`/role/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteRole(id: string) {
    return this.request(`/role/${id}`, { method: 'DELETE' });
  }

  async assignPermissions(roleId: string, permissionIds: string[] | number[]) {
    return this.request(`/roles/${roleId}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissions: permissionIds }),
    });
  }

  // Permissions APIs
  async getPermissions() {
    return this.request('/permissioins/get');
  }

  async createPermission(data: any) {
    return this.request('/permissioins/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Activity Logs APIs
  async getActivityLogs(params?: Record<string, string>) {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.request(`/activitylog/activity-logs${query}`);
  }

  async getMyActivityLogs(params?: Record<string, string>) {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.request(`/activitylog/activity-logs/me${query}`);
  }

  // Profile APIs
  async getProfile() {
    return this.request('/profile/profile');
  }

  async updateProfile(data: any) {
    // If data is FormData (has entries method), send it directly without JSON.stringify
    if (data instanceof FormData) {
      return this.request('/profile/profile', {
        method: 'PUT',
        body: data,
        // Don't set Content-Type header - let browser set it with multipart boundary
      });
    }
    // Otherwise, treat it as a regular JSON object
    return this.request('/profile/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return this.request('/profile/profile/change-password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  // Report APIs
  async getDashboardReport(): Promise<any> {
    return this.request('/report/reports/dashboard');
  }

  async getProjectProgressReport(): Promise<any> {
    return this.request('/report/reports/project-progress');
  }

  async getTaskDistributionReport(): Promise<any> {
    return this.request('/report/reports/task-distribution');
  }

  async getTaskActivityReport(): Promise<any> {
    return this.request('/report/reports/task-activity');
  }

  async getTeamPerformanceReport(): Promise<any> {
    return this.request('/report/reports/team-performance');
  }

  // Notifications APIs
  async getNotifications(): Promise<any> {
    return this.request('/notifications');
  }

  async markNotificationAsRead(id: string): Promise<any> {
    return this.request(`/notifications/${id}/read`, {
      method: 'PUT',
    });
  }

  async deleteNotification(id: string): Promise<any> {
    return this.request(`/notifications/${id}`, {
      method: 'DELETE',
    });
  }

  // Calendar APIs
  async getCalendar(startDate?: string, endDate?: string): Promise<any> {
    if (startDate && endDate) {
      return this.request('/calendar', {
        method: 'POST',
        body: JSON.stringify({ start_date: startDate, end_date: endDate }),
      });
    }
    return this.request('/calendar');
  }

  // Mail APIs
  async getInbox(): Promise<any> {
    return this.request('/mails/inbox');
  }

  async getSentMails(): Promise<any> {
    return this.request('/mails/sent');
  }

  async getAllMails(): Promise<any> {
    return this.request('/mails/admin/all');
  }

  async getMailDetail(id: string): Promise<any> {
    return this.request(`/mails/${id}`);
  }

  async sendMail(mailData: {
    recipients: string[] | number[];
    subject: string;
    body: string;
  } | FormData): Promise<any> {
    const token = this.getToken();
    
    if (mailData instanceof FormData) {
      // For FormData with attachments
      const response = await fetch(`${API_BASE_URL}/mails`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: mailData,
      });

      if (response.status === 401) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'An error occurred' }));
        throw new Error(error.message || 'An error occurred');
      }

      return response.json();
    }

    // For JSON payload
    return this.request('/mails', {
      method: 'POST',
      body: JSON.stringify(mailData),
    });
  }

  async replyMail(threadId: string, replyData: {
    body: string;
  }): Promise<any> {
    return this.request(`/mails/${threadId}/reply`, {
      method: 'POST',
      body: JSON.stringify(replyData),
    });
  }

  async markMailAsRead(id: string): Promise<any> {
    return this.request(`/mails/${id}/read`, {
      method: 'PUT',
    });
  }

  async deleteMail(id: string): Promise<any> {
    return this.request(`/mails/${id}`, {
      method: 'DELETE',
    });
  }

  // System/Mails Users APIs
  async getSystemUsers(search: string = ''): Promise<any> {
    const query = search ? `?q=${encodeURIComponent(search)}` : '';
    return this.request(`/mails/users/suggestions${query}`);
  }
}

export const api = new ApiService();
export default api;
