import type { SupabaseApiService } from '@/services/supabaseApi';

export const createProfileService = (api: Pick<SupabaseApiService, 'getCurrentUser' | 'updateProfile' | 'getSystemUsers'>) => ({
  getCurrentUser: () => api.getCurrentUser(),
  updateProfile: (payload: any) => api.updateProfile(payload),
  getSystemUsers: (search = '') => api.getSystemUsers(search),
});
