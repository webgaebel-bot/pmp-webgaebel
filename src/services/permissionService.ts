import type { SupabaseApiService } from '@/services/supabaseApi';

export const createPermissionService = (api: Pick<SupabaseApiService, 'getCurrentUser' | 'getSystemUsers'>) => ({
  getCurrentUser: () => api.getCurrentUser(),
  getSystemUsers: (search = '') => api.getSystemUsers(search),
});
