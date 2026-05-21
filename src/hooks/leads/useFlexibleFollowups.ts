import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/services/api';
import type { CreateFlexibleFollowupPayload, FlexibleFollowupRecord } from '@/types/leads';

export function useFlexibleFollowups(ownerId?: string, search?: string) {
  return useQuery<{ data: FlexibleFollowupRecord[] }>({
    queryKey: ['flexible-followups', ownerId || 'all', search || ''],
    queryFn: async () => {
      const response = await api.getFlexibleFollowups({ owner_id: ownerId, search });
      return { data: response?.data || [] };
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    placeholderData: (previous) => previous,
  });
}

export function useFlexibleFollowupMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['flexible-followups'] });

  const createFollowup = useMutation({
    mutationFn: async (payload: CreateFlexibleFollowupPayload) => api.createFlexibleFollowup(payload),
    onSuccess: () => {
      invalidate();
      toast.success('Follow-up row added.');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to add follow-up row.'),
  });

  const updateFollowup = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CreateFlexibleFollowupPayload }) => api.updateFlexibleFollowup(id, data),
    onSuccess: () => {
      invalidate();
      toast.success('Follow-up row updated.');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to update follow-up row.'),
  });

  const deleteFollowup = useMutation({
    mutationFn: async (id: string) => api.deleteFlexibleFollowup(id),
    onSuccess: () => {
      invalidate();
      toast.success('Follow-up row deleted.');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to delete follow-up row.'),
  });

  return { createFollowup, updateFollowup, deleteFollowup };
}
