import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { InvoicesService } from './invoices.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { AccountingService } from '../accounting/accounting.service';

const ORG_ID = 'org-1';
const USER_ID = 'user-1';

function createMocks() {
  const invoiceFindFirst = jest.fn();
  const invoiceFindMany = jest.fn();
  const invoiceCount = jest.fn();
  const invoiceCreate = jest.fn();
  const invoiceUpdate = jest.fn();
  const invoiceUpdateMany = jest.fn();
  const invoiceDelete = jest.fn();
  const customerFindFirst = jest.fn();
  const productFindMany = jest.fn();
  const salesOrderFindFirst = jest.fn();
  const orgFindMany = jest.fn();
  const $transaction = jest.fn();
  const $executeRaw = jest.fn();
  const auditRecord = jest.fn().mockResolvedValue(undefined);
  const sendOrgEmail = jest.fn().mockResolvedValue({ sent: true });
  const updateReceivableOverdueStatuses = jest.fn().mockResolvedValue(0);

  const prisma = {
    invoice: {
      findFirst: invoiceFindFirst,
      findMany: invoiceFindMany,
      count: invoiceCount,
      create: invoiceCreate,
      update: invoiceUpdate,
      updateMany: invoiceUpdateMany,
      delete: invoiceDelete,
    },
    customer: { findFirst: customerFindFirst },
    product: { findMany: productFindMany },
    salesOrder: { findFirst: salesOrderFindFirst },
    organization: { findMany: orgFindMany },
    $transaction,
    $executeRaw,
  } as unknown as PrismaService;

  const auditService = { record: auditRecord } as unknown as AuditService;
  const mailService = { sendOrgEmail } as unknown as MailService;
  const accountingService = { updateReceivableOverdueStatuses } as unknown as AccountingService;

  const service = new InvoicesService(prisma, auditService, mailService, accountingService);

  return {
    service,
    prisma,
    auditService,
    mailService,
    accountingService,
    invoiceFindFirst,
    invoiceFindMany,
    invoiceCount,
    invoiceCreate,
    invoiceUpdate,
    invoiceUpdateMany,
    invoiceDelete,
    customerFindFirst,
    productFindMany,
    salesOrderFindFirst,
    orgFindMany,
    $transaction,
    $executeRaw,
    auditRecord,
    sendOrgEmail,
    updateReceivableOverdueStatuses,
  };
}

const mockInvoice = (overrides: Record<string, unknown> = {}) => ({
  id: 'inv-1',
  invoiceNumber: 'INV-2026-000001',
  organizationId: ORG_ID,
  type: 'SALES',
  status: 'DRAFT',
  paymentStatus: 'PENDING',
  subtotal: 100,
  taxTotal: 10,
  discountTotal: 5,
  total: 105,
  paidAmount: 0,
  notes: null,
  issueDate: new Date('2026-01-01'),
  dueDate: new Date('2026-02-01'),
  createdAt: new Date(),
  updatedAt: new Date(),
  customerId: 'cust-1',
  salesOrderId: null,
  createdById: USER_ID,
  customer: { id: 'cust-1', name: 'Acme Corp' },
  salesOrder: null,
  createdBy: { id: USER_ID, name: 'Admin' },
  items: [],
  ...overrides,
});

describe('InvoicesService', () => {
  afterEach(() => jest.clearAllMocks());

  describe('A. findAll', () => {
    it('scopes query to organization', async () => {
      const m = createMocks();
      m.invoiceCount.mockResolvedValue(0);
      m.invoiceFindMany.mockResolvedValue([]);

      await m.service.findAll(ORG_ID, {});

      expect(m.invoiceCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ organizationId: ORG_ID }) }),
      );
      expect(m.invoiceFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ organizationId: ORG_ID }) }),
      );
    });

    it('applies pagination', async () => {
      const m = createMocks();
      m.invoiceCount.mockResolvedValue(0);
      m.invoiceFindMany.mockResolvedValue([]);

      await m.service.findAll(ORG_ID, { page: 2, limit: 5 });

      expect(m.invoiceFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5, take: 5 }),
      );
    });

    it('applies search filter', async () => {
      const m = createMocks();
      m.invoiceCount.mockResolvedValue(0);
      m.invoiceFindMany.mockResolvedValue([]);

      await m.service.findAll(ORG_ID, { search: 'test' });

      expect(m.invoiceFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ invoiceNumber: expect.objectContaining({ contains: 'test' }) }),
            ]),
          }),
        }),
      );
    });

    it('applies customerId filter', async () => {
      const m = createMocks();
      m.invoiceCount.mockResolvedValue(0);
      m.invoiceFindMany.mockResolvedValue([]);

      await m.service.findAll(ORG_ID, { customerId: 'cust-1' });

      expect(m.invoiceFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ customerId: 'cust-1' }),
        }),
      );
    });

    it('applies paymentStatus filter', async () => {
      const m = createMocks();
      m.invoiceCount.mockResolvedValue(0);
      m.invoiceFindMany.mockResolvedValue([]);

      await m.service.findAll(ORG_ID, { paymentStatus: 'PAID' as never });

      expect(m.invoiceFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ paymentStatus: 'PAID' }),
        }),
      );
    });

    it('applies dateFrom/dateTo filter', async () => {
      const m = createMocks();
      m.invoiceCount.mockResolvedValue(0);
      m.invoiceFindMany.mockResolvedValue([]);

      await m.service.findAll(ORG_ID, { dateFrom: '2026-01-01', dateTo: '2026-12-31' });

      expect(m.invoiceFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            issueDate: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
          }),
        }),
      );
    });

    it('falls back to createdAt for invalid sort field', async () => {
      const m = createMocks();
      m.invoiceCount.mockResolvedValue(0);
      m.invoiceFindMany.mockResolvedValue([]);

      await m.service.findAll(ORG_ID, { sortBy: 'invalid' as never });

      expect(m.invoiceFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });

    it('allows valid sort fields', async () => {
      const m = createMocks();
      m.invoiceCount.mockResolvedValue(0);
      m.invoiceFindMany.mockResolvedValue([]);

      await m.service.findAll(ORG_ID, { sortBy: 'total', sortOrder: 'asc' });

      expect(m.invoiceFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { total: 'asc' } }),
      );
    });

    it('calculates balance and itemCount', async () => {
      const m = createMocks();
      m.invoiceCount.mockResolvedValue(1);
      m.invoiceFindMany.mockResolvedValue([
        { ...mockInvoice(), items: [{ id: 'i1', quantity: 1, unitPrice: 10, total: 10 }] },
      ]);

      const result = await m.service.findAll(ORG_ID, {});

      expect(result.data[0].balance).toBe(105);
      expect(result.data[0].itemCount).toBe(1);
    });

    it('returns correct meta shape', async () => {
      const m = createMocks();
      m.invoiceCount.mockResolvedValue(25);
      m.invoiceFindMany.mockResolvedValue([]);

      const result = await m.service.findAll(ORG_ID, { page: 2, limit: 10 });

      expect(result.meta).toEqual({ total: 25, page: 2, limit: 10, totalPages: 3 });
    });
  });

  describe('B. findById', () => {
    it('returns invoice with balance', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue(mockInvoice());

      const result = await m.service.findById(ORG_ID, 'inv-1');

      expect(result.id).toBe('inv-1');
      expect(result.balance).toBe(105);
    });

    it('scopes to organization', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue(mockInvoice());

      await m.service.findById(ORG_ID, 'inv-1');

      expect(m.invoiceFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1', organizationId: ORG_ID },
        }),
      );
    });

    it('throws NotFoundException for missing invoice', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue(null);

      await expect(m.service.findById(ORG_ID, 'missing')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for cross-org access', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue(null);

      await expect(m.service.findById('org-other', 'inv-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('C. create', () => {
    const validDto = {
      customerId: 'cust-1',
      items: [{ productId: 'prod-1', description: 'Item', quantity: 2, unitPrice: 50, taxAmount: 10 }],
    };

    it('validates customer belongs to org', async () => {
      const m = createMocks();
      m.customerFindFirst.mockResolvedValue(null);

      await expect(m.service.create(ORG_ID, USER_ID, validDto as never)).rejects.toThrow(BadRequestException);
    });

    it('validates products belong to org', async () => {
      const m = createMocks();
      m.customerFindFirst.mockResolvedValue({ id: 'cust-1' });
      m.productFindMany.mockResolvedValue([]);

      await expect(m.service.create(ORG_ID, USER_ID, validDto as never)).rejects.toThrow(BadRequestException);
    });

    it('calculates totals correctly', async () => {
      const m = createMocks();
      m.customerFindFirst.mockResolvedValue({ id: 'cust-1' });
      m.productFindMany.mockResolvedValue([{ id: 'prod-1' }]);
      m.invoiceCreate.mockResolvedValue({ ...mockInvoice(), items: [] });

      await m.service.create(ORG_ID, USER_ID, validDto as never);

      expect(m.invoiceCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotal: 100,
            taxTotal: 10,
            discountTotal: 0,
            total: 110,
          }),
        }),
      );
    });

    it('sets paidAmount to 0 and paymentStatus to PENDING', async () => {
      const m = createMocks();
      m.customerFindFirst.mockResolvedValue({ id: 'cust-1' });
      m.productFindMany.mockResolvedValue([{ id: 'prod-1' }]);
      m.invoiceCreate.mockResolvedValue({ ...mockInvoice(), items: [] });

      await m.service.create(ORG_ID, USER_ID, validDto as never);

      expect(m.invoiceCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ paidAmount: 0, paymentStatus: 'PENDING', status: 'DRAFT' }),
        }),
      );
    });

    it('rejects negative total', async () => {
      const m = createMocks();
      m.customerFindFirst.mockResolvedValue({ id: 'cust-1' });
      m.productFindMany.mockResolvedValue([{ id: 'prod-1' }]);

      const dto = {
        customerId: 'cust-1',
        items: [{ productId: 'prod-1', description: 'Item', quantity: 1, unitPrice: 100, discount: 200 }],
      };

      await expect(m.service.create(ORG_ID, USER_ID, dto as never)).rejects.toThrow(BadRequestException);
    });

    it('records audit event', async () => {
      const m = createMocks();
      m.customerFindFirst.mockResolvedValue({ id: 'cust-1' });
      m.productFindMany.mockResolvedValue([{ id: 'prod-1' }]);
      m.invoiceCreate.mockResolvedValue({ ...mockInvoice(), items: [] });

      await m.service.create(ORG_ID, USER_ID, validDto as never);

      expect(m.auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'INVOICE_CREATED', entity: 'Invoice' }),
      );
    });

    it('retries on P2002 collision', async () => {
      const m = createMocks();
      m.customerFindFirst.mockResolvedValue({ id: 'cust-1' });
      m.productFindMany.mockResolvedValue([{ id: 'prod-1' }]);
      m.invoiceCreate
        .mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: '5.0.0' }))
        .mockResolvedValueOnce({ ...mockInvoice(), items: [] });

      await m.service.create(ORG_ID, USER_ID, validDto as never);

      expect(m.invoiceCreate).toHaveBeenCalledTimes(2);
    });

    it('uses orgId from method argument, not DTO', async () => {
      const m = createMocks();
      m.customerFindFirst.mockResolvedValue({ id: 'cust-1' });
      m.productFindMany.mockResolvedValue([{ id: 'prod-1' }]);
      m.invoiceCreate.mockResolvedValue({ ...mockInvoice(), items: [] });

      await m.service.create(ORG_ID, USER_ID, validDto as never);

      expect(m.invoiceCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ organizationId: ORG_ID }),
        }),
      );
    });
  });

  describe('D. createFromOrder', () => {
    const deliveredSale = {
      id: 'so-1',
      orderNumber: 'SO-2026-000001',
      status: 'DELIVERED',
      orderDate: new Date('2026-01-01'),
      subtotal: 200,
      discount: 0,
      tax: 20,
      total: 220,
      customerId: 'cust-1',
      items: [{ productId: 'p1', description: 'Widget', quantity: 2, unitPrice: 100, tax: 20, discount: 0, lineTotal: 200 }],
      customer: { id: 'cust-1', name: 'Acme' },
    };

    it('rejects non-DELIVERED sales order', async () => {
      const m = createMocks();
      m.salesOrderFindFirst.mockResolvedValue({ ...deliveredSale, status: 'PENDING' });

      await expect(m.service.createFromOrder(ORG_ID, USER_ID, 'so-1')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for missing sales order', async () => {
      const m = createMocks();
      m.salesOrderFindFirst.mockResolvedValue(null);

      await expect(m.service.createFromOrder(ORG_ID, USER_ID, 'missing')).rejects.toThrow(NotFoundException);
    });

    it('scopes sales order to organization', async () => {
      const m = createMocks();
      m.salesOrderFindFirst.mockResolvedValue(null);

      await expect(m.service.createFromOrder('org-other', USER_ID, 'so-1')).rejects.toThrow(NotFoundException);

      expect(m.salesOrderFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'so-1', organizationId: 'org-other', deletedAt: null },
        }),
      );
    });

    it('creates invoice with correct data from sales order', async () => {
      const m = createMocks();
      m.salesOrderFindFirst.mockResolvedValue(deliveredSale);
      m.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          $executeRaw: m.$executeRaw,
          invoice: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ ...mockInvoice(), items: [], customer: deliveredSale.customer, salesOrder: { id: 'so-1', orderNumber: 'SO-2026-000001' } }),
          },
        };
        return fn(tx);
      });

      await m.service.createFromOrder(ORG_ID, USER_ID, 'so-1');

      expect(m.auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'INVOICE_CREATED' }),
      );
    });

    it('links salesOrderId', async () => {
      const m = createMocks();
      m.salesOrderFindFirst.mockResolvedValue(deliveredSale);
      let capturedData: unknown;
      m.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          $executeRaw: m.$executeRaw,
          invoice: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockImplementation((args: unknown) => {
              capturedData = args;
              return { ...mockInvoice(), items: [], customer: deliveredSale.customer, salesOrder: { id: 'so-1' } };
            }),
          },
        };
        return fn(tx);
      });

      await m.service.createFromOrder(ORG_ID, USER_ID, 'so-1');

      expect(capturedData).toEqual(
        expect.objectContaining({
          data: expect.objectContaining({ salesOrderId: 'so-1' }),
        }),
      );
    });

    it('throws ConflictException if invoice already exists for sales order', async () => {
      const m = createMocks();
      m.salesOrderFindFirst.mockResolvedValue(deliveredSale);
      m.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          $executeRaw: m.$executeRaw,
          invoice: {
            findFirst: jest.fn().mockResolvedValue({ id: 'existing-inv', invoiceNumber: 'INV-2026-000001' }),
            create: jest.fn(),
          },
        };
        return fn(tx);
      });

      await expect(m.service.createFromOrder(ORG_ID, USER_ID, 'so-1')).rejects.toThrow(ConflictException);
    });
  });

  describe('E. update', () => {
    it('allows editing DRAFT invoice', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue(mockInvoice());
      m.invoiceUpdate.mockResolvedValue({ ...mockInvoice(), notes: 'Updated' });

      const result = await m.service.update(ORG_ID, USER_ID, 'inv-1', { notes: 'Updated' } as never);

      expect(result.notes).toBe('Updated');
    });

    it('rejects non-DRAFT invoice', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue(mockInvoice({ status: 'PAID' }));

      await expect(m.service.update(ORG_ID, USER_ID, 'inv-1', { notes: 'X' } as never)).rejects.toThrow(BadRequestException);
    });

    it('validates new customer belongs to org', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue(mockInvoice());
      m.customerFindFirst.mockResolvedValue(null);

      await expect(m.service.update(ORG_ID, USER_ID, 'inv-1', { customerId: 'cust-new' } as never)).rejects.toThrow(BadRequestException);
    });

    it('scopes to organization', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue(null);

      await expect(m.service.update('org-other', USER_ID, 'inv-1', {} as never)).rejects.toThrow(NotFoundException);
    });

    it('records audit event', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue(mockInvoice());
      m.invoiceUpdate.mockResolvedValue(mockInvoice());

      await m.service.update(ORG_ID, USER_ID, 'inv-1', { notes: 'X' } as never);

      expect(m.auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'INVOICE_UPDATED' }),
      );
    });
  });

  describe('F. remove', () => {
    it('allows deleting DRAFT invoice', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue(mockInvoice());
      m.invoiceDelete.mockResolvedValue(undefined);

      const result = await m.service.remove(ORG_ID, USER_ID, 'inv-1');

      expect(result.message).toContain('deleted');
    });

    it('rejects non-DRAFT invoice', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue(mockInvoice({ status: 'SENT' }));

      await expect(m.service.remove(ORG_ID, USER_ID, 'inv-1')).rejects.toThrow(BadRequestException);
    });

    it('scopes to organization', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue(null);

      await expect(m.service.remove('org-other', USER_ID, 'inv-1')).rejects.toThrow(NotFoundException);
    });

    it('records audit event', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue(mockInvoice());
      m.invoiceDelete.mockResolvedValue(undefined);

      await m.service.remove(ORG_ID, USER_ID, 'inv-1');

      expect(m.auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'INVOICE_DELETED' }),
      );
    });
  });

  describe('G. updateOverdueStatuses', () => {
    it('updates overdue PENDING invoices to OVERDUE', async () => {
      const m = createMocks();
      m.invoiceUpdateMany.mockResolvedValue({ count: 3 });

      const count = await m.service.updateOverdueStatuses(ORG_ID);

      expect(count).toBe(3);
      expect(m.invoiceUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: ORG_ID,
            dueDate: expect.objectContaining({ lt: expect.any(Date) }),
            paymentStatus: { in: ['PENDING', 'PARTIALLY_PAID'] },
            status: { not: 'CANCELLED' },
          }),
          data: { paymentStatus: 'OVERDUE' },
        }),
      );
    });

    it('returns 0 when no invoices are overdue', async () => {
      const m = createMocks();
      m.invoiceUpdateMany.mockResolvedValue({ count: 0 });

      const count = await m.service.updateOverdueStatuses(ORG_ID);

      expect(count).toBe(0);
    });

    it('scopes to organization', async () => {
      const m = createMocks();
      m.invoiceUpdateMany.mockResolvedValue({ count: 0 });

      await m.service.updateOverdueStatuses('org-other');

      expect(m.invoiceUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org-other' }),
        }),
      );
    });
  });

  describe('H. generatePdf', () => {
    it('throws NotFoundException for missing invoice', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue(null);

      await expect(m.service.generatePdf(ORG_ID, 'missing')).rejects.toThrow(NotFoundException);
    });

    it('scopes to organization', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue(null);

      await expect(m.service.generatePdf('org-other', 'inv-1')).rejects.toThrow(NotFoundException);

      expect(m.invoiceFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1', organizationId: 'org-other' },
        }),
      );
    });

    it('returns a Buffer', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue({
        ...mockInvoice(),
        items: [{ description: 'Item', quantity: 1, unitPrice: 100, total: 100 }],
        customer: { name: 'Acme', email: 'a@b.com', phone: '555-0100' },
        organization: { name: 'Test Org' },
      });

      const result = await m.service.generatePdf(ORG_ID, 'inv-1');

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('I. emailInvoice', () => {
    it('throws NotFoundException for missing invoice', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue(null);

      await expect(m.service.emailInvoice(ORG_ID, 'missing')).rejects.toThrow(NotFoundException);
    });

    it('rejects invoice with no customer email', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue({
        ...mockInvoice(),
        customer: { email: null },
      });

      await expect(m.service.emailInvoice(ORG_ID, 'inv-1')).rejects.toThrow(BadRequestException);
    });

    it('calls sendOrgEmail with correct data', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue({
        ...mockInvoice(),
        customer: { email: 'test@example.com' },
        organization: { name: 'Test Org' },
      });

      await m.service.emailInvoice(ORG_ID, 'inv-1');

      expect(m.sendOrgEmail).toHaveBeenCalledWith(
        ORG_ID,
        expect.objectContaining({ to: 'test@example.com', type: 'invoice' }),
      );
    });

    it('records success audit', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue({
        ...mockInvoice(),
        customer: { email: 'test@example.com' },
        organization: { name: 'Test Org' },
      });

      await m.service.emailInvoice(ORG_ID, 'inv-1');

      expect(m.auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'INVOICE_EMAIL_SENT', status: 'SUCCESS' }),
      );
    });

    it('records failure audit and throws on send error', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue({
        ...mockInvoice(),
        customer: { email: 'test@example.com' },
        organization: { name: 'Test Org' },
      });
      m.sendOrgEmail.mockRejectedValue(new Error('SMTP error'));

      await expect(m.service.emailInvoice(ORG_ID, 'inv-1')).rejects.toThrow(InternalServerErrorException);

      expect(m.auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'INVOICE_EMAIL_FAILED', status: 'FAILURE' }),
      );
    });

    it('scopes invoice lookup to organization', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue(null);

      await expect(m.service.emailInvoice('org-other', 'inv-1')).rejects.toThrow(NotFoundException);

      expect(m.invoiceFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1', organizationId: 'org-other' },
        }),
      );
    });
  });

  describe('J. handleOverdueInvoices', () => {
    it('processes all organizations', async () => {
      const m = createMocks();
      m.orgFindMany.mockResolvedValue([{ id: 'org-1' }, { id: 'org-2' }]);
      m.invoiceUpdateMany.mockResolvedValue({ count: 0 });
      m.updateReceivableOverdueStatuses.mockResolvedValue(0);

      await m.service.handleOverdueInvoices();

      expect(m.invoiceUpdateMany).toHaveBeenCalledTimes(2);
      expect(m.updateReceivableOverdueStatuses).toHaveBeenCalledTimes(2);
    });

    it('continues processing after per-org failure', async () => {
      const m = createMocks();
      m.orgFindMany.mockResolvedValue([{ id: 'org-1' }, { id: 'org-2' }]);
      m.invoiceUpdateMany
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValueOnce({ count: 1 });
      m.updateReceivableOverdueStatuses.mockResolvedValue(0);

      await m.service.handleOverdueInvoices();

      expect(m.invoiceUpdateMany).toHaveBeenCalledTimes(2);
      expect(m.updateReceivableOverdueStatuses).toHaveBeenCalledTimes(1);
    });

    it('handles zero organizations', async () => {
      const m = createMocks();
      m.orgFindMany.mockResolvedValue([]);

      await m.service.handleOverdueInvoices();

      expect(m.invoiceUpdateMany).not.toHaveBeenCalled();
    });

    it('propagates organization list failure', async () => {
      const m = createMocks();
      m.orgFindMany.mockRejectedValue(new Error('DB connection lost'));

      await expect(m.service.handleOverdueInvoices()).rejects.toThrow('DB connection lost');
    });

    it('calls updateReceivableOverdueStatuses for each org', async () => {
      const m = createMocks();
      m.orgFindMany.mockResolvedValue([{ id: 'org-1' }]);
      m.invoiceUpdateMany.mockResolvedValue({ count: 0 });
      m.updateReceivableOverdueStatuses.mockResolvedValue(2);

      await m.service.handleOverdueInvoices();

      expect(m.updateReceivableOverdueStatuses).toHaveBeenCalledWith('org-1');
    });
  });

  describe('Security: tenant isolation', () => {
    it('update rejects cross-org invoice', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue(null);

      await expect(m.service.update('org-other', USER_ID, 'inv-1', {} as never)).rejects.toThrow(NotFoundException);
    });

    it('remove rejects cross-org invoice', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue(null);

      await expect(m.service.remove('org-other', USER_ID, 'inv-1')).rejects.toThrow(NotFoundException);
    });

    it('emailInvoice rejects cross-org invoice', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue(null);

      await expect(m.service.emailInvoice('org-other', 'inv-1')).rejects.toThrow(NotFoundException);
    });

    it('generatePdf rejects cross-org invoice', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue(null);

      await expect(m.service.generatePdf('org-other', 'inv-1')).rejects.toThrow(NotFoundException);
    });

    it('createFromOrder rejects cross-org sales order', async () => {
      const m = createMocks();
      m.salesOrderFindFirst.mockResolvedValue(null);

      await expect(m.service.createFromOrder('org-other', USER_ID, 'so-1')).rejects.toThrow(NotFoundException);
    });
  });
});
