'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X, Loader2, Plus as PlusIcon, Trash2 } from 'lucide-react';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { updatePurchase, getSuppliers, getProducts } from '@/lib/api';
import type { Purchase } from './purchase-types';

const updateSchema = z.object({
  supplierId: z.string().min(1, 'Supplier is required'),
  items: z.array(z.object({
    productId: z.string().min(1, 'Product is required'),
    quantity: z.number().min(1, 'Quantity must be at least 1'),
    unitCost: z.number().min(0, 'Unit cost must be 0 or more'),
  })).min(1, 'At least one item is required'),
});

interface ItemRow {
  id: string;
  productId: string;
  quantity: string;
  unitCost: string;
  discount: string;
  tax: string;
}

let rowIdCounter = 0;
function newRowId(): string {
  rowIdCounter += 1;
  return `row_${rowIdCounter}`;
}

interface EditPurchaseDialogProps {
  purchase: Purchase | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export function EditPurchaseDialog({ purchase, open, onClose, onUpdated }: EditPurchaseDialogProps) {
  const { toast } = useToast();

  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ItemRow[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const suppliersQuery = useQuery({
    queryKey: ['suppliers', 'all'],
    queryFn: () => getSuppliers({ limit: 100 }),
    enabled: open,
  });

  const productsQuery = useQuery({
    queryKey: ['products', 'all'],
    queryFn: () => getProducts({ limit: 100 }),
    enabled: open,
  });

  const suppliers: Array<{ id: string; name: string }> = suppliersQuery.data?.data ?? [];
  const allProducts: Array<{ id: string; name: string; sku: string }> = productsQuery.data?.data ?? [];

  useEffect(() => {
    if (purchase) {
      setSupplierId(purchase.supplier?.id ?? '');
      setNotes(purchase.notes ?? '');
      setItems(
        purchase.items.map((item) => ({
          id: newRowId(),
          productId: item.product?.id ?? item.productId ?? '',
          quantity: String(item.quantity),
          unitCost: String(item.unitCost),
          discount: String(item.discount),
          tax: String(item.tax),
        })),
      );
    }
  }, [purchase]);

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!purchase) throw new Error('No purchase selected');
      return updatePurchase(purchase.id, {
        supplierId,
        notes: notes || undefined,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: Number(item.quantity),
          unitCost: Number(item.unitCost),
          discount: Number(item.discount) || undefined,
          tax: Number(item.tax) || undefined,
        })),
      });
    },
    onSuccess: () => {
      toast({ title: 'Purchase order updated' });
      onUpdated();
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message ?? 'Failed to update purchase order.',
        variant: 'destructive',
      });
    },
  });

  function handleClose() {
    setSupplierId('');
    setNotes('');
    setItems([]);
    setErrors({});
    onClose();
  }

  function addRow() {
    setItems((prev) => [...prev, { id: newRowId(), productId: '', quantity: '1', unitCost: '0', discount: '0', tax: '0' }]);
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
      unitCost: Number(item.unitCost),
    }));

    const result = updateSchema.safeParse({ supplierId, items: parsedItems });
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

  if (!open || !purchase) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative z-50 w-full max-w-3xl rounded-xl border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Edit Purchase Order</h2>
          <button onClick={handleClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="edit-supplier">Supplier *</Label>
            <select
              id="edit-supplier"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">Select a supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {errors.supplierId && <p className="text-xs text-destructive mt-1">{errors.supplierId}</p>}
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
                    onChange={(e) => updateRow(item.id, 'productId', e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="">Select product</option>
                    {allProducts.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                    ))}
                  </select>
                </div>
                <div className="w-20">
                  <Label className="text-xs text-muted-foreground">Qty</Label>
                  <Input type="number" min="1" value={item.quantity} onChange={(e) => updateRow(item.id, 'quantity', e.target.value)} />
                </div>
                <div className="w-24">
                  <Label className="text-xs text-muted-foreground">Unit Cost</Label>
                  <Input type="number" min="0" step="0.01" value={item.unitCost} onChange={(e) => updateRow(item.id, 'unitCost', e.target.value)} />
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
