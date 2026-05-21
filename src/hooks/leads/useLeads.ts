import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { LeadFilters, LeadListResponse } from '@/types/leads';

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timeoutId);
  }, [delay, value]);

  return debouncedValue;
}

export function useLeads(filters: LeadFilters, page: number, pageSize = 25) {
  const debouncedSearch = useDebouncedValue(filters.search ?? '', 300);

  return useQuery<LeadListResponse>({
    queryKey: ['leads', { ...filters, search: debouncedSearch }, page, pageSize],
    queryFn: async () => {
      const response = await api.getLeads({
        ...filters,
        search: debouncedSearch || undefined,
        page,
        pageSize,
      });

      return {
        data: response?.data || [],
        total: response?.total || 0,
        page: response?.page || page,
        pageSize: response?.pageSize || pageSize,
      };
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    placeholderData: (previous) => previous,
  });
}
