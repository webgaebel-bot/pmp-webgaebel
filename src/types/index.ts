// User & Auth Types
export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: Role;
  status: 'active' | 'inactive';
  last_login?: string;
  created_at: string;
  permissions: string[];
}

export interface Role {
  id: string | number;
  name: string;
  description?: string;
  permissions?: Permission[];
  permission_count?: number;
  created_at?: string;
}

export interface Permission {
  id: string;
  name: string;
  key: string;
  module: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

// Project Types
export interface Project {
  id: string;
  name: string;
  description?: string;
  status: 'planning' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  progress: number;
  start_date?: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
  owner: User;
  members: ProjectMember[];
  task_count?: number;
  completed_tasks?: number;
}

export interface ProjectMember {
  id: string;
  user: User;
  role: 'owner' | 'manager' | 'member' | 'viewer';
  joined_at: string;
}

// Task Types
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'critical';
  project: Project;
  assignee?: User;
  reporter: User;
  due_date?: string;
  estimated_hours?: number;
  actual_hours?: number;
  created_at: string;
  updated_at: string;
  comments_count?: number;
  attachments_count?: number;
}

export interface TaskComment {
  id: string;
  task_id: string;
  user: User;
  content: string;
  created_at: string;
  updated_at: string;
}

// File Types
export interface FileAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  related_id: string;
  related_type: 'task' | 'project' | 'comment';
  uploaded_by: User;
  created_at: string;
}

// Activity Log Types
export interface ActivityLog {
  id: string;
  user: User;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  details?: string;
  ip_address?: string;
  created_at: string;
}

// Dashboard Types
export interface DashboardStats {
  total_projects: number;
  active_projects: number;
  total_tasks: number;
  completed_tasks: number;
  pending_tasks: number;
  overdue_tasks: number;
  total_users: number;
  active_users: number;
}

export interface ProjectProgress {
  project_id: string;
  project_name: string;
  progress: number;
  status: string;
  tasks_completed: number;
  tasks_total: number;
}

export interface TeamPerformance {
  user_id: string;
  user_name: string;
  user_avatar?: string;
  tasks_completed: number;
  tasks_assigned: number;
  completion_rate: number;
}

export interface TaskSummary {
  status: string;
  count: number;
  percentage: number;
}

// Report Types
export interface Report {
  dashboard: DashboardStats;
  project_progress: ProjectProgress[];
  team_performance: TeamPerformance[];
  task_summary: TaskSummary[];
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: Pagination;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

// Notification Types
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  created_at: string;
}
