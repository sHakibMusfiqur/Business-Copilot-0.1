'use client';

import { useMutation } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { updateCustomerStatus } from '@/lib/api';
import type { Customer } from './customer-types';

interface StatusToggleDialogProps {
  customer: Customer | null;
  open: boolean;
  onClose: () => void;
  onToggled: () => void;
}

export function StatusToggleDialog({ customer, open, onClose, onToggled }: StatusToggleDialogProps) {
  const { toast } = useToast();
  const newStatus = customer ? !customer.isActive : false;

  const toggleMutation = useMutation({
    mutationFn: () => {
      if (!customer) throw new Error('No customer selected');
      return updateCustomerStatus(customer.id, newStatus);
    },
    onSuccess: () => {
      toast({ title: newStatus ? 'Customer activated' : 'Customer deactivated' });
      onToggled();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message ?? 'Failed to update customer status.',
        variant: 'destructive',
      });
    },
  });

  if (!open || !customer) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {newStatus ? 'Activate' : 'Deactivate'} Customer
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          {newStatus
            ? `Activate ${customer.name}? They will be visible and usable across the system.`
            : `Deactivate ${customer.name}? They will be hidden from most views until reactivated.`}
        </p>

        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={newStatus ? 'default' : 'destructive'}
            onClick={() => toggleMutation.mutate()}
            disabled={toggleMutation.isPending}
          >
            {toggleMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              newStatus ? 'Activate' : 'Deactivate'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
