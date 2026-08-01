import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createProduct,
  deleteProduct,
  getCategories,
  getProducts,
  updateProduct,
  updateProductStatus,
} from '@/lib/api';
import type { ProductListParams } from '@/lib/api';

export function useProducts(params?: ProductListParams) {
  return useQuery({
    queryKey: params ? ['products', params] : ['products'],
    queryFn: () => getProducts(params),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => getCategories(),
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createProduct>[0]) => createProduct(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; data: Parameters<typeof updateProduct>[1] }) =>
      updateProduct(args.id, args.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUpdateProductStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; isActive: boolean }) =>
      updateProductStatus(args.id, args.isActive),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
