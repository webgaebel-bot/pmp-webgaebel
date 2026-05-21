import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { LeadStats } from '@/types/leads';

export function useLeadStats() {
  return useQuery<LeadStats>({
    queryKey: ['lead-stats'],
    queryFn: async () => {
      const response = await api.getLeadStats();
      return response.data;
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
}
