import type { SupabaseApiService } from '@/services/supabaseApi';

export const createTaskService = (
  api: Pick<
    SupabaseApiService,
    'getTasks' | 'getTask' | 'createTask' | 'updateTask' | 'deleteTask' | 'updateTaskStatus' | 'updateTaskPriority' | 'assignTask' | 'unassignTask'
  >
) => ({
  getTasks: (params?: Record<string, string>) => api.getTasks(params),
  getTask: (id: string) => api.getTask(id),
  createTask: (payload: any) => api.createTask(payload),
  updateTask: (id: string, payload: any) => api.updateTask(id, payload),
  deleteTask: (id: string) => api.deleteTask(id),
  updateTaskStatus: (id: string, status: string) => api.updateTaskStatus(id, status),
  updateTaskPriority: (id: string, priority: string) => api.updateTaskPriority(id, priority),
  assignTask: (taskId: string, userId: string) => api.assignTask(taskId, userId),
  unassignTask: (taskId: string) => api.unassignTask(taskId),
});
