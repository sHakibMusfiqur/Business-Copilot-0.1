import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  confirmSale,
  createSale,
  deleteSale,
  deliverSale,
  getSales,
  updateSale,
} from '@/lib/api';
import type { SalesListParams } from '@/lib/api';

export function useSales(params?: SalesListParams) {
  return useQuery({
    queryKey: params ? ['sales', params] : ['sales'],
    queryFn: () => getSales(params),
  });
}

export function useCreateSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createSale>[0]) => createSale(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sales'] });
    },
  });
}

export function useUpdateSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; data: Parameters<typeof updateSale>[1] }) =>
      updateSale(args.id, args.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sales'] });
    },
  });
}

export function useConfirmSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => confirmSale(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sales'] });
    },
  });
}

export function useDeliverSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; notes?: string }) => deliverSale(args.id, args.notes),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sales'] });
    },
  });
}

export function useDeleteSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSale(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sales'] });
    },
  });
}
