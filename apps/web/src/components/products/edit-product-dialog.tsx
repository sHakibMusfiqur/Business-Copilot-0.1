'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { updateProduct, getCategories } from '@/lib/api';
import type { Product, CategoryOption } from './product-types';

const updateProductSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  sku: z.string().min(1, 'SKU is required'),
});

interface EditProductDialogProps {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export function EditProductDialog({ product, open, onClose, onUpdated }: EditProductDialogProps) {
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
    queryFn: getCategories,
    enabled: open,
  });

  const categories: CategoryOption[] = categoriesQuery.data ?? [];

  useEffect(() => {
    if (product) {
      setName(product.name);
      setSku(product.sku);
      setBarcode(product.barcode ?? '');
      setBrand(product.brand ?? '');
      setCategoryId(product.categoryId ?? '');
      setUnit(product.unit);
      setCostPrice(product.costPrice > 0 ? String(product.costPrice) : '');
      setUnitPrice(product.unitPrice > 0 ? String(product.unitPrice) : '');
      setTaxRate(product.taxRate > 0 ? String(product.taxRate) : '');
      setMinimumStock(product.minimumStock > 0 ? String(product.minimumStock) : '');
      setMaximumStock(product.maximumStock > 0 ? String(product.maximumStock) : '');
      setDescription(product.description ?? '');
    }
  }, [product]);

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!product) throw new Error('No product selected');
      return updateProduct(product.id, {
        name,
        sku,
        barcode: barcode || undefined,
        brand: brand || undefined,
        categoryId: categoryId || undefined,
        unit,
        costPrice: costPrice ? Number(costPrice) : undefined,
        unitPrice: unitPrice ? Number(unitPrice) : undefined,
        taxRate: taxRate ? Number(taxRate) : undefined,
        minimumStock: minimumStock ? Number(minimumStock) : undefined,
        maximumStock: maximumStock ? Number(maximumStock) : undefined,
        description: description || undefined,
      });
    },
    onSuccess: () => {
      toast({ title: 'Product updated' });
      onUpdated();
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message ?? 'Failed to update product.',
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
    const result = updateProductSchema.safeParse({ name, sku });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        fieldErrors[issue.path[0] as string] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    updateMutation.mutate();
  }

  if (!open || !product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative z-50 w-full max-w-2xl rounded-xl border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Edit Product</h2>
          <button onClick={handleClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-name">Product Name *</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Wireless Mouse"
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
            </div>
            <div>
              <Label htmlFor="edit-sku">SKU *</Label>
              <Input
                id="edit-sku"
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
              <Label htmlFor="edit-barcode">Barcode</Label>
              <Input
                id="edit-barcode"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="123456789012"
              />
            </div>
            <div>
              <Label htmlFor="edit-brand">Brand</Label>
              <Input
                id="edit-brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Logitech"
              />
            </div>
            <div>
              <Label htmlFor="edit-unit">Unit</Label>
              <Input
                id="edit-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="pcs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-category">Category</Label>
              <select
                id="edit-category"
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
              <Label htmlFor="edit-taxRate">Tax Rate (%)</Label>
              <Input
                id="edit-taxRate"
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
              <Label htmlFor="edit-costPrice">Purchase Price</Label>
              <Input
                id="edit-costPrice"
                type="number"
                min="0"
                step="0.01"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="edit-unitPrice">Selling Price</Label>
              <Input
                id="edit-unitPrice"
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
              <Label htmlFor="edit-minimumStock">Min. Stock</Label>
              <Input
                id="edit-minimumStock"
                type="number"
                min="0"
                value={minimumStock}
                onChange={(e) => setMinimumStock(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <Label htmlFor="edit-maximumStock">Max. Stock</Label>
              <Input
                id="edit-maximumStock"
                type="number"
                min="0"
                value={maximumStock}
                onChange={(e) => setMaximumStock(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
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
          <Button onClick={handleSubmit} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
