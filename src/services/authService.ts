import type { SupabaseApiService } from '@/services/supabaseApi';

export const createAuthService = (api: Pick<SupabaseApiService, 'login' | 'logout' | 'getCurrentUser'>) => ({
  login: (email: string, password: string) => api.login(email, password),
  logout: () => api.logout(),
  getCurrentUser: () => api.getCurrentUser(),
});
