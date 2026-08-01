import { useQuery } from '@tanstack/react-query';

import { getDashboardOverview } from '@/lib/api';

export function useDashboardOverview() {
  return useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: () => getDashboardOverview(),
  });
}
