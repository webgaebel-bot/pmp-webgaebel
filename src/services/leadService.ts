import type { SupabaseApiService } from '@/services/supabaseApi';

export const createLeadService = (
  api: Pick<
    SupabaseApiService,
    | 'getLeads'
    | 'getLeadById'
    | 'createLead'
    | 'updateLead'
    | 'deleteLead'
    | 'getLeadStats'
    | 'addActivity'
    | 'addNote'
    | 'scheduleFollowup'
    | 'completeFollowup'
    | 'addTag'
    | 'removeTag'
    | 'bulkUpdateStatus'
    | 'bulkAssign'
    | 'bulkDelete'
  >
) => ({
  getLeads: (filters?: any) => api.getLeads(filters),
  getLeadById: (id: string) => api.getLeadById(id),
  createLead: (payload: any) => api.createLead(payload),
  updateLead: (id: string, payload: any) => api.updateLead(id, payload),
  deleteLead: (id: string | number) => api.deleteLead(id),
  getLeadStats: () => api.getLeadStats(),
  addActivity: (leadId: string, data: any) => api.addActivity(leadId, data),
  addNote: (leadId: string, content: string) => api.addNote(leadId, content),
  scheduleFollowup: (leadId: string, data: any) => api.scheduleFollowup(leadId, data),
  completeFollowup: (followupId: string, notes?: string) => api.completeFollowup(followupId, notes),
  addTag: (leadId: string, tagName: string) => api.addTag(leadId, tagName),
  removeTag: (leadId: string, tagName: string) => api.removeTag(leadId, tagName),
  bulkUpdateStatus: (leadIds: string[], status: string) => api.bulkUpdateStatus(leadIds, status),
  bulkAssign: (leadIds: string[], userId: string) => api.bulkAssign(leadIds, userId),
  bulkDelete: (leadIds: string[]) => api.bulkDelete(leadIds),
});
