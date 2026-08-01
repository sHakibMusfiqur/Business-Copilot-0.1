import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createCustomer,
  deleteCustomer,
  getCustomers,
  updateCustomer,
  updateCustomerStatus,
} from '@/lib/api';
import type { CustomerListParams } from '@/lib/api';

export function useCustomers(params?: CustomerListParams) {
  return useQuery({
    queryKey: params ? ['customers', params] : ['customers'],
    queryFn: () => getCustomers(params),
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createCustomer>[0]) => createCustomer(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; data: Parameters<typeof updateCustomer>[1] }) =>
      updateCustomer(args.id, args.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCustomer(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useUpdateCustomerStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; isActive: boolean }) =>
      updateCustomerStatus(args.id, args.isActive),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}
