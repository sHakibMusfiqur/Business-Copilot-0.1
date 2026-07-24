'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X, Loader2, Plus as PlusIcon, Trash2 } from 'lucide-react';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { updateSale, getCustomers, getProducts } from '@/lib/api';
import type { Sale } from './sales-types';

const updateSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  items: z.array(z.object({
    productId: z.string().min(1, 'Product is required'),
    quantity: z.number().min(1, 'Quantity must be at least 1'),
    unitPrice: z.number().min(0, 'Unit price must be 0 or more'),
  })).min(1, 'At least one item is required'),
});

interface ItemRow {
  id: string;
  productId: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  tax: string;
}

let rowIdCounter = 0;
function newRowId(): string {
  rowIdCounter += 1;
  return `row_${rowIdCounter}`;
}

interface EditSaleDialogProps {
  sale: Sale | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export function EditSaleDialog({ sale, open, onClose, onUpdated }: EditSaleDialogProps) {
  const { toast } = useToast();

  const [customerId, setCustomerId] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ItemRow[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const customersQuery = useQuery({
    queryKey: ['customers', 'all'],
    queryFn: () => getCustomers({ limit: 100 }),
    enabled: open,
  });

  const productsQuery = useQuery({
    queryKey: ['products', 'all'],
    queryFn: () => getProducts({ limit: 100 }),
    enabled: open,
  });

  const customers: Array<{ id: string; name: string }> = customersQuery.data?.data ?? [];
  const allProducts: Array<{ id: string; name: string; sku: string; unitPrice: number }> = productsQuery.data?.data ?? [];
  const selectedProductIds = items.map((i) => i.productId).filter(Boolean);

  useEffect(() => {
    if (sale) {
      setCustomerId(sale.customer?.id ?? '');
      setNotes(sale.notes ?? '');
      setItems(
        sale.items.map((item) => ({
          id: newRowId(),
          productId: item.product?.id ?? item.productId ?? '',
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
          discount: String(item.discount),
          tax: String(item.tax),
        })),
      );
    }
  }, [sale]);

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!sale) throw new Error('No sale selected');
      return updateSale(sale.id, {
        customerId,
        notes: notes || undefined,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          discount: Number(item.discount) || undefined,
          tax: Number(item.tax) || undefined,
        })),
      });
    },
    onSuccess: () => {
      toast({ title: 'Sales order updated' });
      onUpdated();
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message ?? 'Failed to update sales order.',
        variant: 'destructive',
      });
    },
  });

  function handleClose() {
    setCustomerId('');
    setNotes('');
    setItems([]);
    setErrors({});
    onClose();
  }

  function addRow() {
    setItems((prev) => [...prev, { id: newRowId(), productId: '', quantity: '1', unitPrice: '0', discount: '0', tax: '0' }]);
  }

  function removeRow(id: string) {
    setItems((prev) => prev.filter((r) => r.id !== id));
  }

  function updateRow(id: string, field: keyof ItemRow, value: string) {
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function handleSubmit() {
    const parsedItems = items.map((item) => ({
      productId: item.productId,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
    }));

    const result = updateSchema.safeParse({ customerId, items: parsedItems });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        fieldErrors[issue.path.join('.')] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    updateMutation.mutate();
  }

  if (!open || !sale) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative z-50 w-full max-w-3xl rounded-xl border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Edit Sales Order</h2>
          <button onClick={handleClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="edit-customer">Customer *</Label>
            <select
              id="edit-customer"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">Select a customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {errors.customerId && <p className="text-xs text-destructive mt-1">{errors.customerId}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Items *</Label>
              <Button variant="outline" size="sm" onClick={addRow} className="gap-1">
                <PlusIcon className="h-3 w-3" />
                Add Item
              </Button>
            </div>

            {items.map((item) => (
              <div key={item.id} className="flex items-end gap-3 mb-3 p-3 rounded-lg border bg-muted/30">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Product</Label>
                  <select
                    value={item.productId}
                    onChange={(e) => {
                      updateRow(item.id, 'productId', e.target.value);
                      const product = allProducts.find((p) => p.id === e.target.value);
                      if (product && Number(product.unitPrice) > 0) {
                        updateRow(item.id, 'unitPrice', String(product.unitPrice));
                      }
                    }}
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="">Select product</option>
                    {allProducts
                      .filter((p) => !selectedProductIds.includes(p.id) || item.productId === p.id)
                      .map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                      ))}
                  </select>
                </div>
                <div className="w-20">
                  <Label className="text-xs text-muted-foreground">Qty</Label>
                  <Input type="number" min="1" value={item.quantity} onChange={(e) => updateRow(item.id, 'quantity', e.target.value)} />
                </div>
                <div className="w-24">
                  <Label className="text-xs text-muted-foreground">Unit Price</Label>
                  <Input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e) => updateRow(item.id, 'unitPrice', e.target.value)} />
                </div>
                <div className="w-20">
                  <Label className="text-xs text-muted-foreground">Disc %</Label>
                  <Input type="number" min="0" step="0.01" value={item.discount} onChange={(e) => updateRow(item.id, 'discount', e.target.value)} />
                </div>
                <div className="w-20">
                  <Label className="text-xs text-muted-foreground">Tax %</Label>
                  <Input type="number" min="0" step="0.01" value={item.tax} onChange={(e) => updateRow(item.id, 'tax', e.target.value)} />
                </div>
                <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 text-destructive" disabled={items.length === 1} onClick={() => removeRow(item.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div>
            <Label htmlFor="edit-notes">Notes</Label>
            <textarea
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Order notes..."
              className="flex min-h-[60px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
            ) : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
