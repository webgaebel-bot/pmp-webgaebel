import type { SupabaseApiService } from '@/services/supabaseApi';

export const createProjectService = (
  api: Pick<SupabaseApiService, 'getProjects' | 'getProject' | 'createProject' | 'updateProject' | 'deleteProject'>
) => ({
  getProjects: () => api.getProjects(),
  getProject: (id: string) => api.getProject(id),
  createProject: (payload: any) => api.createProject(payload),
  updateProject: (id: string, payload: any) => api.updateProject(id, payload),
  deleteProject: (id: string) => api.deleteProject(id),
});
