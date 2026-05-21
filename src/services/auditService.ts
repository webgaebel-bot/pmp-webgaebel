import type { SupabaseApiService } from '@/services/supabaseApi';

export const createAuditService = (api: Pick<SupabaseApiService, 'getActivityLogs'>) => ({
  getActivityLogs: () => api.getActivityLogs(),
});
