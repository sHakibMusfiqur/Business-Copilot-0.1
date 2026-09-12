'use client';

import { useQuery } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';

import { formatDate, formatCurrency } from '@/lib/utils';
import { getInvoice } from '@/lib/api';
import type { Invoice, InvoiceStatus, PaymentStatus } from './invoices-types';

const statusStyle: Record<InvoiceStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  SENT: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  PAID: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  REFUNDED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

const paymentStatusStyle: Record<PaymentStatus, string> = {
  PENDING: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  PAID: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  PARTIALLY_PAID: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  OVERDUE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  CANCELLED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  REFUNDED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

interface InvoiceDetailsDialogProps {
  invoice: Invoice | null;
  open: boolean;
  onClose: () => void;
}

export function InvoiceDetailsDialog({ invoice, open, onClose }: InvoiceDetailsDialogProps) {
  const { data: fullInvoice, isLoading, error } = useQuery<Invoice>({
    queryKey: ['invoice', invoice?.id],
    queryFn: ({ signal }) => getInvoice(String(invoice?.id), signal),
    enabled: open && !!invoice?.id,
  });

  if (!open || !invoice) return null;

  const display = fullInvoice ?? invoice;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-3xl rounded-xl border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Invoice Details</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-sm text-destructive">Failed to load invoice details.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Invoice Number</p>
                <p className="text-sm font-medium">{display.invoiceNumber}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Status</p>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle[display.status]}`}>
                  {display.status.charAt(0) + display.status.slice(1).toLowerCase()}
                </span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Customer</p>
                <p className="text-sm font-medium">{display.customer?.name ?? '\u2014'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Sales Order</p>
                <p className="text-sm">{display.salesOrder?.orderNumber ?? '\u2014'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Issue Date</p>
                <p className="text-sm">{formatDate(display.issueDate)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Due Date</p>
                <p className="text-sm">{display.dueDate ? formatDate(display.dueDate) : '\u2014'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Payment Status</p>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${paymentStatusStyle[display.paymentStatus]}`}>
                  {display.paymentStatus.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                </span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Created By</p>
                <p className="text-sm">{display.createdBy?.name ?? '\u2014'}</p>
              </div>
              {display.notes && (
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{display.notes}</p>
                </div>
              )}
            </div>

            <div className="rounded-lg border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Product</th>
                    <th className="text-right p-3 text-xs font-medium text-muted-foreground">Qty</th>
                    <th className="text-right p-3 text-xs font-medium text-muted-foreground">Unit Price</th>
                    <th className="text-right p-3 text-xs font-medium text-muted-foreground">Disc</th>
                    <th className="text-right p-3 text-xs font-medium text-muted-foreground">Tax</th>
                    <th className="text-right p-3 text-xs font-medium text-muted-foreground">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {display.items.map((item) => (
                    <tr key={item.id} className="border-b last:border-b-0">
                      <td className="p-3 text-sm">
                        {item.product?.name ?? item.description ?? 'Unknown Item'}
                        {item.product?.sku && <span className="text-xs text-muted-foreground ml-1">({item.product.sku})</span>}
                      </td>
                      <td className="p-3 text-sm text-right">{item.quantity}</td>
                      <td className="p-3 text-sm text-right">{formatCurrency(Number(item.unitPrice))}</td>
                      <td className="p-3 text-sm text-right">{Number(item.discount) > 0 ? `${item.discount}%` : '\u2014'}</td>
                      <td className="p-3 text-sm text-right">{Number(item.taxRate) > 0 ? `${item.taxRate}%` : '\u2014'}</td>
                      <td className="p-3 text-sm text-right font-medium">{formatCurrency(Number(item.total))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/30">
                    <td colSpan={5} className="p-3 text-sm text-right font-medium">Subtotal</td>
                    <td className="p-3 text-sm text-right">{formatCurrency(Number(display.subtotal))}</td>
                  </tr>
                  {Number(display.discountTotal) > 0 && (
                    <tr>
                      <td colSpan={5} className="p-3 text-sm text-right text-muted-foreground">Discount</td>
                      <td className="p-3 text-sm text-right text-muted-foreground">-{formatCurrency(Number(display.discountTotal))}</td>
                    </tr>
                  )}
                  {Number(display.taxTotal) > 0 && (
                    <tr>
                      <td colSpan={5} className="p-3 text-sm text-right text-muted-foreground">Tax</td>
                      <td className="p-3 text-sm text-right text-muted-foreground">{formatCurrency(Number(display.taxTotal))}</td>
                    </tr>
                  )}
                  <tr className="border-t">
                    <td colSpan={5} className="p-3 text-sm text-right font-semibold">Total</td>
                    <td className="p-3 text-sm text-right font-semibold">{formatCurrency(Number(display.total))}</td>
                  </tr>
                  <tr>
                    <td colSpan={5} className="p-3 text-sm text-right text-muted-foreground">Paid</td>
                    <td className="p-3 text-sm text-right text-muted-foreground">{formatCurrency(Number(display.paidAmount))}</td>
                  </tr>
                  <tr className="border-t">
                    <td colSpan={5} className="p-3 text-sm text-right font-semibold">Balance</td>
                    <td className="p-3 text-sm text-right font-semibold">{formatCurrency(Number(display.balance))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
