import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { Lead } from '@/types/leads';

export function useLeadDetail(leadId?: string) {
  return useQuery<Lead>({
    queryKey: ['lead', leadId],
    enabled: Boolean(leadId),
    queryFn: async () => {
      if (!leadId) {
        throw new Error('Lead id is required.');
      }

      const response = await api.getLeadById(leadId);
      return response.data;
    },
  });
}
