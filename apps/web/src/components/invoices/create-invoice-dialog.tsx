'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { X, Loader2, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { createInvoice, getCustomers, getProducts } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import type { Customer } from '@/components/customers/customer-types';
import type { Product } from '@/components/products/product-types';

interface LineItem {
  productId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxAmount: number;
  discount: number;
}

interface CreateInvoiceDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const emptyItem = (): LineItem => ({
  productId: '',
  description: '',
  quantity: 1,
  unitPrice: 0,
  taxAmount: 0,
  discount: 0,
});

export function CreateInvoiceDialog({ open, onClose, onCreated }: CreateInvoiceDialogProps) {
  const { toast } = useToast();
  const [customerId, setCustomerId] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [items, setItems] = useState<LineItem[]>([emptyItem()]);

  const customersQuery = useQuery({
    queryKey: ['customers', { limit: 200 }],
    queryFn: ({ signal }) => getCustomers({ limit: 200 }, signal),
    enabled: open,
  });

  const productsQuery = useQuery({
    queryKey: ['products', { limit: 200 }],
    queryFn: ({ signal }) => getProducts({ limit: 200 }, signal),
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createInvoice({
        customerId,
        notes: notes || undefined,
        dueDate: dueDate || undefined,
        items: items
          .filter((item) => item.productId && item.description)
          .map((item) => ({
            productId: item.productId,
            description: item.description,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            taxAmount: Number(item.taxAmount) || 0,
            discount: Number(item.discount) || 0,
          })),
      }),
    onSuccess: () => {
      toast({ title: 'Invoice created', description: 'A new draft invoice has been created.' });
      setCustomerId('');
      setNotes('');
      setDueDate('');
      setItems([emptyItem()]);
      onCreated();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message ?? 'Failed to create invoice.',
        variant: 'destructive',
      });
    },
  });

  const updateItem = (index: number, patch: Partial<LineItem>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const handleProductChange = (index: number, productId: string) => {
    const product = productsQuery.data?.data?.find((p: Product) => p.id === productId);
    updateItem(index, {
      productId,
      description: product?.name ?? '',
      unitPrice: product ? Number(product.unitPrice) : 0,
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  };

  const canSubmit =
    !!customerId && items.some((item) => item.productId && item.description && item.quantity > 0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-2xl rounded-xl border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Create Invoice</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <div className="space-y-2">
            <Label htmlFor="invoice-customer">Customer</Label>
            <select
              id="invoice-customer"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select customer</option>
              {customersQuery.data?.data?.map((customer: Customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoice-due">Due Date</Label>
            <Input
              id="invoice-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Items</Label>
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4 space-y-1">
                  <select
                    value={item.productId}
                    onChange={(e) => handleProductChange(index, e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                  >
                    <option value="">Product</option>
                    {productsQuery.data?.data?.map((product: Product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-3">
                  <Input
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => updateItem(index, { description: e.target.value })}
                    className="h-9"
                  />
                </div>
                <div className="col-span-1">
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })}
                    className="h-9"
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(index, { unitPrice: Number(e.target.value) })}
                    className="h-9"
                  />
                </div>
                <div className="col-span-1">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.discount}
                    onChange={(e) => updateItem(index, { discount: Number(e.target.value) })}
                    className="h-9"
                    placeholder="Disc"
                  />
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => handleRemoveItem(index)}
                    disabled={items.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setItems((prev) => [...prev, emptyItem()])}
            >
              <Plus className="h-4 w-4 mr-1" /> Add Item
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoice-notes">Notes</Label>
            <Textarea
              id="invoice-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => createMutation.mutate()} disabled={!canSubmit || createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Invoice
          </Button>
        </div>
      </div>
    </div>
  );
}
