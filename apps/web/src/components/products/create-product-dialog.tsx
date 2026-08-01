'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { createProduct, getCategories } from '@/lib/api';
import type { CategoryOption } from './product-types';

const createProductSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  sku: z.string().min(1, 'SKU is required'),
});

interface CreateProductDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateProductDialog({ open, onClose, onCreated }: CreateProductDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [brand, setBrand] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [costPrice, setCostPrice] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [taxRate, setTaxRate] = useState('');
  const [minimumStock, setMinimumStock] = useState('');
  const [maximumStock, setMaximumStock] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: () => getCategories(),
    enabled: open,
  });

  const categories: CategoryOption[] = categoriesQuery.data ?? [];

  const createMutation = useMutation({
    mutationFn: () => createProduct({
      name,
      sku,
      barcode: barcode || undefined,
      brand: brand || undefined,
      categoryId: categoryId || undefined,
      unit: unit || 'pcs',
      costPrice: costPrice ? Number(costPrice) : undefined,
      unitPrice: unitPrice ? Number(unitPrice) : undefined,
      taxRate: taxRate ? Number(taxRate) : undefined,
      minimumStock: minimumStock ? Number(minimumStock) : undefined,
      maximumStock: maximumStock ? Number(maximumStock) : undefined,
      description: description || undefined,
    }),
    onSuccess: () => {
      toast({ title: 'Product created' });
      onCreated();
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message ?? 'Failed to create product.',
        variant: 'destructive',
      });
    },
  });

  function handleClose() {
    setName('');
    setSku('');
    setBarcode('');
    setBrand('');
    setCategoryId('');
    setUnit('pcs');
    setCostPrice('');
    setUnitPrice('');
    setTaxRate('');
    setMinimumStock('');
    setMaximumStock('');
    setDescription('');
    setErrors({});
    onClose();
  }

  function handleSubmit() {
    const result = createProductSchema.safeParse({ name, sku });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        fieldErrors[issue.path[0] as string] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    createMutation.mutate();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative z-50 w-full max-w-2xl rounded-xl border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Create Product</h2>
          <button onClick={handleClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Wireless Mouse"
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
            </div>
            <div>
              <Label htmlFor="sku">SKU *</Label>
              <Input
                id="sku"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="WM-001"
                className={errors.sku ? 'border-destructive' : ''}
              />
              {errors.sku && <p className="text-xs text-destructive mt-1">{errors.sku}</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="barcode">Barcode</Label>
              <Input
                id="barcode"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="123456789012"
              />
            </div>
            <div>
              <Label htmlFor="brand">Brand</Label>
              <Input
                id="brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Logitech"
              />
            </div>
            <div>
              <Label htmlFor="unit">Unit</Label>
              <Input
                id="unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="pcs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">No category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="taxRate">Tax Rate (%)</Label>
              <Input
                id="taxRate"
                type="number"
                min="0"
                step="0.01"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="costPrice">Purchase Price</Label>
              <Input
                id="costPrice"
                type="number"
                min="0"
                step="0.01"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="unitPrice">Selling Price</Label>
              <Input
                id="unitPrice"
                type="number"
                min="0"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="minimumStock">Min. Stock</Label>
              <Input
                id="minimumStock"
                type="number"
                min="0"
                value={minimumStock}
                onChange={(e) => setMinimumStock(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <Label htmlFor="maximumStock">Max. Stock</Label>
              <Input
                id="maximumStock"
                type="number"
                min="0"
                value={maximumStock}
                onChange={(e) => setMaximumStock(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Product description..."
              className="min-h-[80px]"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Product'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
