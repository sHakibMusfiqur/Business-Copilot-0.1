'use client';

import { X } from 'lucide-react';

import { formatDate, formatCurrency } from '@/lib/utils';
import type { Purchase, PurchaseStatus } from './purchase-types';

const statusStyle: Record<PurchaseStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  APPROVED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  RECEIVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

interface PurchaseDetailsDialogProps {
  purchase: Purchase | null;
  open: boolean;
  onClose: () => void;
}

export function PurchaseDetailsDialog({ purchase, open, onClose }: PurchaseDetailsDialogProps) {
  if (!open || !purchase) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-3xl rounded-xl border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Purchase Order Details</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Order Number</p>
            <p className="text-sm font-medium">{purchase.orderNumber}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Status</p>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle[purchase.status]}`}>
              {purchase.status.charAt(0) + purchase.status.slice(1).toLowerCase()}
            </span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Supplier</p>
            <p className="text-sm font-medium">{purchase.supplier?.name ?? '\u2014'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Order Date</p>
            <p className="text-sm">{formatDate(purchase.orderDate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Created By</p>
            <p className="text-sm">{purchase.createdBy?.name ?? '\u2014'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Created At</p>
            <p className="text-sm">{formatDate(purchase.createdAt)}</p>
          </div>
          {purchase.notes && (
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground mb-1">Notes</p>
              <p className="text-sm">{purchase.notes}</p>
            </div>
          )}
        </div>

        <div className="rounded-lg border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 text-xs font-medium text-muted-foreground">Product</th>
                <th className="text-right p-3 text-xs font-medium text-muted-foreground">Qty</th>
                <th className="text-right p-3 text-xs font-medium text-muted-foreground">Unit Cost</th>
                <th className="text-right p-3 text-xs font-medium text-muted-foreground">Disc</th>
                <th className="text-right p-3 text-xs font-medium text-muted-foreground">Tax</th>
                <th className="text-right p-3 text-xs font-medium text-muted-foreground">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {purchase.items.map((item) => (
                <tr key={item.id} className="border-b last:border-b-0">
                  <td className="p-3 text-sm">
                    {item.product?.name ?? 'Unknown Product'}
                    {item.product?.sku && <span className="text-xs text-muted-foreground ml-1">({item.product.sku})</span>}
                  </td>
                  <td className="p-3 text-sm text-right">{item.quantity}</td>
                  <td className="p-3 text-sm text-right">{formatCurrency(Number(item.unitCost))}</td>
                  <td className="p-3 text-sm text-right">{Number(item.discount) > 0 ? `${item.discount}%` : '\u2014'}</td>
                  <td className="p-3 text-sm text-right">{Number(item.tax) > 0 ? `${item.tax}%` : '\u2014'}</td>
                  <td className="p-3 text-sm text-right font-medium">{formatCurrency(Number(item.lineTotal))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30">
                <td colSpan={5} className="p-3 text-sm text-right font-medium">Subtotal</td>
                <td className="p-3 text-sm text-right">{formatCurrency(Number(purchase.subtotal))}</td>
              </tr>
              {Number(purchase.discount) > 0 && (
                <tr>
                  <td colSpan={5} className="p-3 text-sm text-right text-muted-foreground">Discount</td>
                  <td className="p-3 text-sm text-right text-muted-foreground">-{formatCurrency(Number(purchase.discount))}</td>
                </tr>
              )}
              {Number(purchase.tax) > 0 && (
                <tr>
                  <td colSpan={5} className="p-3 text-sm text-right text-muted-foreground">Tax</td>
                  <td className="p-3 text-sm text-right text-muted-foreground">{formatCurrency(Number(purchase.tax))}</td>
                </tr>
              )}
              {Number(purchase.shippingCost) > 0 && (
                <tr>
                  <td colSpan={5} className="p-3 text-sm text-right text-muted-foreground">Shipping</td>
                  <td className="p-3 text-sm text-right text-muted-foreground">{formatCurrency(Number(purchase.shippingCost))}</td>
                </tr>
              )}
              <tr className="border-t">
                <td colSpan={5} className="p-3 text-sm text-right font-semibold">Total</td>
                <td className="p-3 text-sm text-right font-semibold">{formatCurrency(Number(purchase.total))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
