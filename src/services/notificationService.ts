import type { SupabaseApiService } from '@/services/supabaseApi';

export const createNotificationService = (
  api: Pick<SupabaseApiService, 'getNotifications' | 'markNotificationAsRead' | 'deleteNotification'>
) => ({
  getNotifications: () => api.getNotifications(),
  markNotificationAsRead: (id: string) => api.markNotificationAsRead(id),
  deleteNotification: (id: string) => api.deleteNotification(id),
});
