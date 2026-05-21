import type { SupabaseApiService } from '@/services/supabaseApi';

export const createTimeTrackingService = (
  api: Pick<SupabaseApiService, 'getTimeLogs' | 'getTimeLogStats' | 'createTimeLog' | 'deleteTimeLog'>
) => ({
  getTimeLogs: () => api.getTimeLogs(),
  getTimeLogStats: () => api.getTimeLogStats(),
  createTimeLog: (data: any) => api.createTimeLog(data),
  deleteTimeLog: (id: string) => api.deleteTimeLog(id),
});
