import type { SupabaseApiService } from '@/services/supabaseApi';

export const createFileService = (
  api: Pick<SupabaseApiService, 'getFiles' | 'getFileById' | 'uploadFile' | 'deleteFile'>
) => ({
  getFiles: (relatedType?: string, relatedId?: string) => api.getFiles(relatedType, relatedId),
  getFileById: (id: string) => api.getFileById(id),
  uploadFile: (file: File, relatedType: string, relatedId: string) => api.uploadFile(file, relatedType, relatedId),
  deleteFile: (id: string) => api.deleteFile(id),
});
