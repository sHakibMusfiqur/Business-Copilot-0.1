import type { Meta } from '@/lib/types';

export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'CANCELLED' | 'REFUNDED';

export type PaymentStatus = 'PENDING' | 'PAID' | 'PARTIALLY_PAID' | 'OVERDUE' | 'CANCELLED' | 'REFUNDED';

export interface InvoiceCustomer {
  id: string;
  name: string;
}

export interface InvoiceSalesOrder {
  id: string;
  orderNumber: string;
}

export interface InvoiceCreatedBy {
  id: string;
  name: string;
}

export interface InvoiceItem {
  id: string;
  productId: string | null;
  product?: { id: string; name: string; sku: string } | null;
  description?: string | null;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  taxAmount?: number;
  discount?: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  type: string;
  status: InvoiceStatus;
  paymentStatus: PaymentStatus;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  total: number;
  paidAmount: number;
  balance: number;
  notes: string | null;
  issueDate: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  customer: InvoiceCustomer | null;
  salesOrder: InvoiceSalesOrder | null;
  createdBy: InvoiceCreatedBy | null;
  items: InvoiceItem[];
  itemCount?: number;
}

export type InvoiceMeta = Meta;

export interface InvoiceListResponse {
  data: Invoice[];
  meta: InvoiceMeta;
}
