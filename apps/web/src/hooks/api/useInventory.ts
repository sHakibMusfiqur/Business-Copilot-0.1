import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adjustStock, getInventory, getInventoryHistory, getInventorySummary } from '@/lib/api';
import type { InventoryListParams } from '@/lib/api';

export function useInventory(params?: InventoryListParams) {
  return useQuery({
    queryKey: params ? ['inventory', params] : ['inventory'],
    queryFn: () => getInventory(params),
  });
}

export function useInventorySummary() {
  return useQuery({
    queryKey: ['inventory', 'summary'],
    queryFn: () => getInventorySummary(),
  });
}

export function useInventoryHistory(productId: string) {
  return useQuery({
    queryKey: ['inventory', 'history', productId],
    queryFn: () => getInventoryHistory(productId),
    enabled: Boolean(productId),
  });
}

export function useAdjustStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof adjustStock>[0]) => adjustStock(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}
