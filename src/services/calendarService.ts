import type { SupabaseApiService } from '@/services/supabaseApi';

export const createCalendarService = (api: Pick<SupabaseApiService, 'getCalendar'>) => ({
  getCalendar: (startDate?: string, endDate?: string) => api.getCalendar(startDate, endDate),
});
