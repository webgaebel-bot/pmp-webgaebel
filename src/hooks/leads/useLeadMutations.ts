import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/services/api';
import type { AddLeadActivityPayload, CreateLeadPayload, ScheduleLeadFollowupPayload } from '@/types/leads';

function invalidateLeadQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['leads'] });
  queryClient.invalidateQueries({ queryKey: ['leads-all'] });
  queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
}

export function useLeadMutations() {
  const queryClient = useQueryClient();

  const createLead = useMutation({
    mutationFn: async (payload: CreateLeadPayload) => api.createLead(payload),
    onSuccess: () => {
      invalidateLeadQueries(queryClient);
      toast.success('Lead saved successfully.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save lead.');
    },
  });

  const updateLead = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateLeadPayload> & Record<string, unknown> }) =>
      api.updateLead(id, data),
    onSuccess: (_, variables) => {
      invalidateLeadQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ['lead', variables.id] });
      toast.success('Lead updated successfully.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update lead.');
    },
  });

  const deleteLead = useMutation({
    mutationFn: async (id: string) => api.deleteLead(id),
    onSuccess: () => {
      invalidateLeadQueries(queryClient);
      toast.success('Lead deleted successfully.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete lead.');
    },
  });

  const addActivity = useMutation({
    mutationFn: async ({ leadId, payload }: { leadId: string; payload: AddLeadActivityPayload }) => api.addActivity(leadId, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead', variables.leadId] });
      invalidateLeadQueries(queryClient);
      toast.success('Activity added.');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to add activity.'),
  });

  const addNote = useMutation({
    mutationFn: async ({ leadId, content }: { leadId: string; content: string }) => api.addNote(leadId, content),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead', variables.leadId] });
      invalidateLeadQueries(queryClient);
      toast.success('Note added.');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to add note.'),
  });

  const scheduleFollowup = useMutation({
    mutationFn: async ({ leadId, payload }: { leadId: string; payload: ScheduleLeadFollowupPayload }) =>
      api.scheduleFollowup(leadId, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead', variables.leadId] });
      invalidateLeadQueries(queryClient);
      toast.success('Follow-up scheduled.');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to schedule follow-up.'),
  });

  const completeFollowup = useMutation({
    mutationFn: async ({ followupId, notes }: { followupId: string; notes?: string }) => api.completeFollowup(followupId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead'] });
      toast.success('Follow-up completed.');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to complete follow-up.'),
  });

  const addTag = useMutation({
    mutationFn: async ({ leadId, tagName }: { leadId: string; tagName: string }) => api.addTag(leadId, tagName),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead', variables.leadId] });
      invalidateLeadQueries(queryClient);
      toast.success('Tag added.');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to add tag.'),
  });

  const removeTag = useMutation({
    mutationFn: async ({ leadId, tagName }: { leadId: string; tagName: string }) => api.removeTag(leadId, tagName),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead', variables.leadId] });
      invalidateLeadQueries(queryClient);
      toast.success('Tag removed.');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to remove tag.'),
  });

  const updateLeadScore = useMutation({
    mutationFn: async ({ leadId, score }: { leadId: string; score: number }) => api.updateLeadScore(leadId, score),
    onSuccess: () => {
      invalidateLeadQueries(queryClient);
      toast.success('Lead score updated.');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to update score.'),
  });

  const bulkUpdateStatus = useMutation({
    mutationFn: async ({ leadIds, status }: { leadIds: string[]; status: string }) => api.bulkUpdateStatus(leadIds, status),
    onSuccess: () => {
      invalidateLeadQueries(queryClient);
      toast.success('Status updated for selected leads.');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to update selected leads.'),
  });

  const bulkAssign = useMutation({
    mutationFn: async ({ leadIds, userId }: { leadIds: string[]; userId: string }) => api.bulkAssign(leadIds, userId),
    onSuccess: () => {
      invalidateLeadQueries(queryClient);
      toast.success('Selected leads assigned.');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to assign selected leads.'),
  });

  const bulkDelete = useMutation({
    mutationFn: async (leadIds: string[]) => api.bulkDelete(leadIds),
    onSuccess: () => {
      invalidateLeadQueries(queryClient);
      toast.success('Selected leads deleted.');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to delete selected leads.'),
  });

  const importLeads = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.importLeads(formData);
    },
    onSuccess: (response) => {
      invalidateLeadQueries(queryClient);
      const result = response?.data || {};
      const errors = Array.isArray(result.errors) && result.errors.length ? ` First issue: ${result.errors[0]}` : '';
      toast.success(`Import complete: ${result.inserted || 0} inserted, ${result.skipped || 0} skipped.${errors}`);
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to import leads.'),
  });

  return {
    createLead,
    updateLead,
    deleteLead,
    addActivity,
    addNote,
    scheduleFollowup,
    completeFollowup,
    addTag,
    removeTag,
    updateLeadScore,
    bulkUpdateStatus,
    bulkAssign,
    bulkDelete,
    importLeads,
  };
}
