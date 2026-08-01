import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createUser,
  deleteUser,
  getOrganizationUsers,
  getUsers,
  updateUser,
  updateUserStatus,
} from '@/lib/api';
import type { UserListParams } from '@/lib/api';

export function useUsers(params?: UserListParams) {
  return useQuery({
    queryKey: params ? ['users', params] : ['users'],
    queryFn: () => getUsers(params),
  });
}

export function useOrganizationUsers() {
  return useQuery({
    queryKey: ['users', 'assignable'],
    queryFn: () => getOrganizationUsers(),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createUser>[0]) => createUser(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; data: Parameters<typeof updateUser>[1] }) =>
      updateUser(args.id, args.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useUpdateUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; isActive: boolean }) =>
      updateUserStatus(args.id, args.isActive),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
