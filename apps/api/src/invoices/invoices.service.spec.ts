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
  const updatePayableOverdueStatuses = jest.fn().mockResolvedValue(0);

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
  const accountingService = {
    updateReceivableOverdueStatuses,
    updatePayableOverdueStatuses,
  } as unknown as AccountingService;

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
    updatePayableOverdueStatuses,
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

    it('applies salesOrderId filter', async () => {
      const m = createMocks();
      m.invoiceCount.mockResolvedValue(0);
      m.invoiceFindMany.mockResolvedValue([]);

      await m.service.findAll(ORG_ID, { salesOrderId: 'so-1' });

      expect(m.invoiceFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ salesOrderId: 'so-1' }),
        }),
      );
    });

    it('applies combined customerId and paymentStatus filters', async () => {
      const m = createMocks();
      m.invoiceCount.mockResolvedValue(0);
      m.invoiceFindMany.mockResolvedValue([]);

      await m.service.findAll(ORG_ID, { customerId: 'cust-1', paymentStatus: 'PAID' as never });

      expect(m.invoiceFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ customerId: 'cust-1', paymentStatus: 'PAID' }),
        }),
      );
    });

    it('applies dateFrom only (no dateTo)', async () => {
      const m = createMocks();
      m.invoiceCount.mockResolvedValue(0);
      m.invoiceFindMany.mockResolvedValue([]);

      await m.service.findAll(ORG_ID, { dateFrom: '2026-06-01' });

      expect(m.invoiceFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            issueDate: expect.objectContaining({ gte: expect.any(Date) }),
          }),
        }),
      );
      const where = m.invoiceFindMany.mock.calls[0][0].where;
      expect(where.issueDate.lte).toBeUndefined();
    });

    it('applies dateTo only (no dateFrom)', async () => {
      const m = createMocks();
      m.invoiceCount.mockResolvedValue(0);
      m.invoiceFindMany.mockResolvedValue([]);

      await m.service.findAll(ORG_ID, { dateTo: '2026-12-31' });

      const where = m.invoiceFindMany.mock.calls[0][0].where;
      expect(where.issueDate.gte).toBeUndefined();
      expect(where.issueDate.lte).toBeDefined();
    });

    it('defaults to createdAt desc sort when no sort params provided', async () => {
      const m = createMocks();
      m.invoiceCount.mockResolvedValue(0);
      m.invoiceFindMany.mockResolvedValue([]);

      await m.service.findAll(ORG_ID, {});

      expect(m.invoiceFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });

    it('applies all six valid sort fields', async () => {
      const fields = ['invoiceNumber', 'total', 'paymentStatus', 'createdAt', 'issueDate', 'dueDate'] as const;
      for (const field of fields) {
        const m = createMocks();
        m.invoiceCount.mockResolvedValue(0);
        m.invoiceFindMany.mockResolvedValue([]);

        await m.service.findAll(ORG_ID, { sortBy: field, sortOrder: 'asc' });

        expect(m.invoiceFindMany).toHaveBeenCalledWith(
          expect.objectContaining({ orderBy: { [field]: 'asc' } }),
        );
      }
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

    it('scopes customer lookup to organization', async () => {
      const m = createMocks();
      m.customerFindFirst.mockResolvedValue({ id: 'cust-1' });
      m.productFindMany.mockResolvedValue([{ id: 'prod-1' }]);
      m.invoiceCreate.mockResolvedValue({ ...mockInvoice(), items: [] });

      await m.service.create(ORG_ID, USER_ID, validDto as never);

      expect(m.customerFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: ORG_ID, deletedAt: null }),
        }),
      );
    });

    it('scopes product lookup to organization', async () => {
      const m = createMocks();
      m.customerFindFirst.mockResolvedValue({ id: 'cust-1' });
      m.productFindMany.mockResolvedValue([{ id: 'prod-1' }]);
      m.invoiceCreate.mockResolvedValue({ ...mockInvoice(), items: [] });

      await m.service.create(ORG_ID, USER_ID, validDto as never);

      expect(m.productFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: ORG_ID }),
        }),
      );
    });

    it('throws InternalServerErrorException after P2002 retry exhaustion', async () => {
      const m = createMocks();
      m.customerFindFirst.mockResolvedValue({ id: 'cust-1' });
      m.productFindMany.mockResolvedValue([{ id: 'prod-1' }]);
      m.invoiceCreate.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: '5.0.0' }),
      );

      await expect(m.service.create(ORG_ID, USER_ID, validDto as never)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(m.invoiceCreate).toHaveBeenCalledTimes(20);
    });

    it('does not retry non-P2002 errors', async () => {
      const m = createMocks();
      m.customerFindFirst.mockResolvedValue({ id: 'cust-1' });
      m.productFindMany.mockResolvedValue([{ id: 'prod-1' }]);
      m.invoiceCreate.mockRejectedValue(new Error('Unexpected DB error'));

      await expect(m.service.create(ORG_ID, USER_ID, validDto as never)).rejects.toThrow('Unexpected DB error');
      expect(m.invoiceCreate).toHaveBeenCalledTimes(1);
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
      m.invoiceFindFirst.mockResolvedValue(mockInvoice({ status: 'ISSUED' }));

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

    it('throws NotFoundException for missing invoice in same org', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue(null);

      await expect(m.service.update(ORG_ID, USER_ID, 'nonexistent', { notes: 'X' } as never)).rejects.toThrow(
        NotFoundException,
      );
      expect(m.invoiceUpdate).not.toHaveBeenCalled();
    });

    it('updates issueDate and dueDate fields', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue(mockInvoice());
      m.invoiceUpdate.mockResolvedValue(mockInvoice());

      await m.service.update(ORG_ID, USER_ID, 'inv-1', {
        issueDate: '2026-06-15',
        dueDate: '2026-07-15',
      } as never);

      expect(m.invoiceUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            issueDate: new Date('2026-06-15'),
            dueDate: new Date('2026-07-15'),
          }),
        }),
      );
    });

    it('sets dueDate to null when explicitly provided as null', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue(mockInvoice({ dueDate: new Date('2026-02-01') }));
      m.invoiceUpdate.mockResolvedValue(mockInvoice({ dueDate: null }));

      await m.service.update(ORG_ID, USER_ID, 'inv-1', { dueDate: null } as never);

      expect(m.invoiceUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ dueDate: null }),
        }),
      );
    });

    it('does not call update when customer validation fails', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue(mockInvoice());
      m.customerFindFirst.mockResolvedValue(null);

      await expect(m.service.update(ORG_ID, USER_ID, 'inv-1', { customerId: 'cust-other' } as never)).rejects.toThrow(
        BadRequestException,
      );
      expect(m.invoiceUpdate).not.toHaveBeenCalled();
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

    it('throws NotFoundException for missing invoice in same org', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue(null);

      await expect(m.service.remove(ORG_ID, USER_ID, 'nonexistent')).rejects.toThrow(NotFoundException);
      expect(m.invoiceDelete).not.toHaveBeenCalled();
    });

    it('passes the correct invoice ID to delete', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue(mockInvoice());
      m.invoiceDelete.mockResolvedValue(undefined);

      await m.service.remove(ORG_ID, USER_ID, 'inv-1');

      expect(m.invoiceDelete).toHaveBeenCalledWith({ where: { id: 'inv-1' } });
    });

    it('rejects ISSUED, SENT, and CANCELLED statuses', async () => {
      for (const status of ['ISSUED', 'SENT', 'CANCELLED']) {
        const m = createMocks();
        m.invoiceFindFirst.mockResolvedValue(mockInvoice({ status }));

        await expect(m.service.remove(ORG_ID, USER_ID, 'inv-1')).rejects.toThrow(BadRequestException);
      }
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

    it('excludes CANCELLED invoices from overdue update', async () => {
      const m = createMocks();
      m.invoiceUpdateMany.mockResolvedValue({ count: 0 });

      await m.service.updateOverdueStatuses(ORG_ID);

      expect(m.invoiceUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: { not: 'CANCELLED' } }),
        }),
      );
    });

    it('only targets PENDING and PARTIALLY_PAID invoices', async () => {
      const m = createMocks();
      m.invoiceUpdateMany.mockResolvedValue({ count: 0 });

      await m.service.updateOverdueStatuses(ORG_ID);

      expect(m.invoiceUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ paymentStatus: { in: ['PENDING', 'PARTIALLY_PAID'] } }),
        }),
      );
    });

    it('only targets invoices with dueDate in the past', async () => {
      const m = createMocks();
      m.invoiceUpdateMany.mockResolvedValue({ count: 0 });

      await m.service.updateOverdueStatuses(ORG_ID);

      const where = m.invoiceUpdateMany.mock.calls[0][0].where;
      expect(where.dueDate.lt).toBeInstanceOf(Date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      expect(where.dueDate.lt.getTime()).toBeLessThanOrEqual(today.getTime());
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
        ...mockInvoice({ status: 'ISSUED' }),
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
        ...mockInvoice({ status: 'ISSUED' }),
        customer: { email: 'test@example.com' },
        organization: { name: 'Test Org' },
      });

      await m.service.emailInvoice(ORG_ID, 'inv-1');

      expect(m.auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'INVOICE_SENT', status: 'SUCCESS' }),
      );
    });

    it('transitions ISSUED to SENT on successful send', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue({
        ...mockInvoice({ status: 'ISSUED' }),
        customer: { email: 'test@example.com' },
        organization: { name: 'Test Org' },
      });
      m.invoiceUpdate.mockResolvedValue({ ...mockInvoice({ status: 'SENT' }) });

      await m.service.emailInvoice(ORG_ID, 'inv-1');

      expect(m.invoiceUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1' },
          data: { status: 'SENT' },
        }),
      );
    });

    it('does not change status when already SENT (resend)', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue({
        ...mockInvoice({ status: 'SENT' }),
        customer: { email: 'test@example.com' },
        organization: { name: 'Test Org' },
      });

      await m.service.emailInvoice(ORG_ID, 'inv-1');

      expect(m.invoiceUpdate).not.toHaveBeenCalled();
    });

    it('rejects DRAFT invoice', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue({
        ...mockInvoice({ status: 'DRAFT' }),
        customer: { email: 'test@example.com' },
        organization: { name: 'Test Org' },
      });

      await expect(m.service.emailInvoice(ORG_ID, 'inv-1')).rejects.toThrow(BadRequestException);
      expect(m.sendOrgEmail).not.toHaveBeenCalled();
    });

    it('records failure audit and throws on send error', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue({
        ...mockInvoice({ status: 'ISSUED' }),
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

    it('SMTP failure does not mutate invoice business state', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue({
        ...mockInvoice({ status: 'ISSUED' }),
        customer: { email: 'test@example.com' },
        organization: { name: 'Test Org' },
      });
      m.sendOrgEmail.mockRejectedValue(new Error('SMTP error'));

      await expect(m.service.emailInvoice(ORG_ID, 'inv-1')).rejects.toThrow(InternalServerErrorException);

      expect(m.invoiceUpdate).not.toHaveBeenCalled();
      expect(m.invoiceCreate).not.toHaveBeenCalled();
    });

    it('passes invoice amount and dueDate to mail service', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue({
        ...mockInvoice({ status: 'ISSUED', total: 500, dueDate: new Date('2026-03-15') }),
        customer: { email: 'test@example.com' },
        organization: { name: 'Test Org' },
      });

      await m.service.emailInvoice(ORG_ID, 'inv-1');

      expect(m.sendOrgEmail).toHaveBeenCalledWith(
        ORG_ID,
        expect.objectContaining({
          data: expect.objectContaining({
            invoice: expect.objectContaining({
              invoiceNumber: 'INV-2026-000001',
              amount: '500.00',
            }),
          }),
        }),
      );
    });

    it('returns success message on successful send', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue({
        ...mockInvoice({ status: 'ISSUED' }),
        customer: { email: 'test@example.com' },
        organization: { name: 'Test Org' },
      });

      const result = await m.service.emailInvoice(ORG_ID, 'inv-1');

      expect(result.message).toBe('Invoice emailed successfully');
    });
  });

  describe('I2. issue', () => {
    it('throws NotFoundException for missing invoice', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue(null);

      await expect(m.service.issue(ORG_ID, USER_ID, 'missing')).rejects.toThrow(NotFoundException);
    });

    it('issues a DRAFT invoice', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue(mockInvoice({ status: 'DRAFT' }));
      m.invoiceUpdate.mockResolvedValue(mockInvoice({ status: 'ISSUED' }));

      const result = await m.service.issue(ORG_ID, USER_ID, 'inv-1');

      expect(result.status).toBe('ISSUED');
      expect(m.invoiceUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'ISSUED' } }),
      );
    });

    it('rejects non-DRAFT invoice', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue(mockInvoice({ status: 'ISSUED' }));

      await expect(m.service.issue(ORG_ID, USER_ID, 'inv-1')).rejects.toThrow(BadRequestException);
    });

    it('records INVOICE_ISSUED audit', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue(mockInvoice({ status: 'DRAFT' }));
      m.invoiceUpdate.mockResolvedValue(mockInvoice({ status: 'ISSUED' }));

      await m.service.issue(ORG_ID, USER_ID, 'inv-1');

      expect(m.auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'INVOICE_ISSUED',
          metadata: expect.objectContaining({ from: 'DRAFT', to: 'ISSUED' }),
        }),
      );
    });

    it('scopes to organization', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue(null);

      await expect(m.service.issue('org-other', USER_ID, 'inv-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('I3. cancel', () => {
    it('throws NotFoundException for missing invoice', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue(null);

      await expect(m.service.cancel(ORG_ID, USER_ID, 'missing')).rejects.toThrow(NotFoundException);
    });

    it('cancels an ISSUED invoice with no payments', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue(mockInvoice({ status: 'ISSUED', paidAmount: 0, paymentStatus: 'PENDING' }));
      m.invoiceUpdate.mockResolvedValue(mockInvoice({ status: 'CANCELLED', paymentStatus: 'CANCELLED' }));

      const result = await m.service.cancel(ORG_ID, USER_ID, 'inv-1');

      expect(result.status).toBe('CANCELLED');
      expect(m.invoiceUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'CANCELLED', paymentStatus: 'CANCELLED' },
        }),
      );
    });

    it('cancels a SENT invoice', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue(mockInvoice({ status: 'SENT', paidAmount: 0, paymentStatus: 'PENDING' }));
      m.invoiceUpdate.mockResolvedValue(mockInvoice({ status: 'CANCELLED' }));

      await m.service.cancel(ORG_ID, USER_ID, 'inv-1');

      expect(m.invoiceUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELLED' }) }),
      );
    });

    it('rejects cancel of DRAFT invoice', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue(mockInvoice({ status: 'DRAFT' }));

      await expect(m.service.cancel(ORG_ID, USER_ID, 'inv-1')).rejects.toThrow(BadRequestException);
    });

    it('rejects cancel when paidAmount > 0', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue(mockInvoice({ status: 'ISSUED', paidAmount: 50, paymentStatus: 'PARTIALLY_PAID' }));

      await expect(m.service.cancel(ORG_ID, USER_ID, 'inv-1')).rejects.toThrow(BadRequestException);
      expect(m.invoiceUpdate).not.toHaveBeenCalled();
    });

    it('rejects cancel when paymentStatus is PAID', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue(mockInvoice({ status: 'ISSUED', paidAmount: 105, paymentStatus: 'PAID' }));

      await expect(m.service.cancel(ORG_ID, USER_ID, 'inv-1')).rejects.toThrow(BadRequestException);
    });

    it('sets paymentStatus CANCELLED when unpaid', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue(mockInvoice({ status: 'ISSUED', paidAmount: 0, paymentStatus: 'OVERDUE' }));
      m.invoiceUpdate.mockResolvedValue(mockInvoice({ status: 'CANCELLED', paymentStatus: 'CANCELLED' }));

      await m.service.cancel(ORG_ID, USER_ID, 'inv-1');

      expect(m.invoiceUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'CANCELLED', paymentStatus: 'CANCELLED' },
        }),
      );
    });

    it('records INVOICE_CANCELLED audit', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue(mockInvoice({ status: 'ISSUED', paidAmount: 0, paymentStatus: 'PENDING' }));
      m.invoiceUpdate.mockResolvedValue(mockInvoice({ status: 'CANCELLED' }));

      await m.service.cancel(ORG_ID, USER_ID, 'inv-1');

      expect(m.auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'INVOICE_CANCELLED',
          metadata: expect.objectContaining({ from: 'ISSUED', to: 'CANCELLED' }),
        }),
      );
    });

    it('scopes to organization', async () => {
      const m = createMocks();
      m.invoiceFindFirst.mockResolvedValue(null);

      await expect(m.service.cancel('org-other', USER_ID, 'inv-1')).rejects.toThrow(NotFoundException);
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

    it('receivable update failure for org A still allows org B to process', async () => {
      const m = createMocks();
      m.orgFindMany.mockResolvedValue([{ id: 'org-1' }, { id: 'org-2' }]);
      m.invoiceUpdateMany.mockResolvedValue({ count: 0 });
      m.updateReceivableOverdueStatuses
        .mockRejectedValueOnce(new Error('Receivable service down'))
        .mockResolvedValueOnce(1);

      await m.service.handleOverdueInvoices();

      expect(m.updateReceivableOverdueStatuses).toHaveBeenCalledTimes(2);
      expect(m.updateReceivableOverdueStatuses).toHaveBeenNthCalledWith(1, 'org-1');
      expect(m.updateReceivableOverdueStatuses).toHaveBeenNthCalledWith(2, 'org-2');
    });

    it('counts failed organizations in summary', async () => {
      const m = createMocks();
      m.orgFindMany.mockResolvedValue([{ id: 'org-1' }, { id: 'org-2' }]);
      m.invoiceUpdateMany
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValueOnce({ count: 2 });
      m.updateReceivableOverdueStatuses.mockResolvedValue(0);

      await m.service.handleOverdueInvoices();

      expect(m.invoiceUpdateMany).toHaveBeenCalledTimes(2);
      expect(m.updateReceivableOverdueStatuses).toHaveBeenCalledTimes(1);
    });

    it('calls updatePayableOverdueStatuses for every organization', async () => {
      const m = createMocks();
      m.orgFindMany.mockResolvedValue([{ id: 'org-1' }, { id: 'org-2' }]);
      m.invoiceUpdateMany.mockResolvedValue({ count: 0 });
      m.updateReceivableOverdueStatuses.mockResolvedValue(0);
      m.updatePayableOverdueStatuses.mockResolvedValue(1);

      await m.service.handleOverdueInvoices();

      expect(m.updatePayableOverdueStatuses).toHaveBeenCalledTimes(2);
      expect(m.updatePayableOverdueStatuses).toHaveBeenNthCalledWith(1, 'org-1');
      expect(m.updatePayableOverdueStatuses).toHaveBeenNthCalledWith(2, 'org-2');
    });

    it('payable failure for org A does not stop org B', async () => {
      const m = createMocks();
      m.orgFindMany.mockResolvedValue([{ id: 'org-1' }, { id: 'org-2' }]);
      m.invoiceUpdateMany.mockResolvedValue({ count: 0 });
      m.updateReceivableOverdueStatuses.mockResolvedValue(0);
      m.updatePayableOverdueStatuses
        .mockRejectedValueOnce(new Error('Payable service down'))
        .mockResolvedValueOnce(1);

      await m.service.handleOverdueInvoices();

      expect(m.updatePayableOverdueStatuses).toHaveBeenCalledTimes(2);
      expect(m.updatePayableOverdueStatuses).toHaveBeenNthCalledWith(1, 'org-1');
      expect(m.updatePayableOverdueStatuses).toHaveBeenNthCalledWith(2, 'org-2');
      expect(m.invoiceUpdateMany).toHaveBeenCalledTimes(2);
      expect(m.updateReceivableOverdueStatuses).toHaveBeenCalledTimes(2);
    });

    it('keeps invoice and receivable behavior intact when payables succeed', async () => {
      const m = createMocks();
      m.orgFindMany.mockResolvedValue([{ id: 'org-1' }]);
      m.invoiceUpdateMany.mockResolvedValue({ count: 3 });
      m.updateReceivableOverdueStatuses.mockResolvedValue(2);
      m.updatePayableOverdueStatuses.mockResolvedValue(1);

      await m.service.handleOverdueInvoices();

      expect(m.invoiceUpdateMany).toHaveBeenCalledTimes(1);
      expect(m.updateReceivableOverdueStatuses).toHaveBeenCalledWith('org-1');
      expect(m.updatePayableOverdueStatuses).toHaveBeenCalledWith('org-1');
    });

    it('does not call updatePayableOverdueStatuses when organization list fails', async () => {
      const m = createMocks();
      m.orgFindMany.mockRejectedValue(new Error('DB connection lost'));

      await expect(m.service.handleOverdueInvoices()).rejects.toThrow('DB connection lost');

      expect(m.updatePayableOverdueStatuses).not.toHaveBeenCalled();
    });

    it('does not call updatePayableOverdueStatuses for zero organizations', async () => {
      const m = createMocks();
      m.orgFindMany.mockResolvedValue([]);

      await m.service.handleOverdueInvoices();

      expect(m.updatePayableOverdueStatuses).not.toHaveBeenCalled();
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

    it('findAll scopes to organization in both count and query', async () => {
      const m = createMocks();
      m.invoiceCount.mockResolvedValue(0);
      m.invoiceFindMany.mockResolvedValue([]);

      await m.service.findAll(ORG_ID, {});

      const countWhere = m.invoiceCount.mock.calls[0][0].where;
      const findManyWhere = m.invoiceFindMany.mock.calls[0][0].where;
      expect(countWhere.organizationId).toBe(ORG_ID);
      expect(findManyWhere.organizationId).toBe(ORG_ID);
    });

    it('create never trusts orgId from DTO', async () => {
      const m = createMocks();
      m.customerFindFirst.mockResolvedValue({ id: 'cust-1' });
      m.productFindMany.mockResolvedValue([{ id: 'prod-1' }]);
      m.invoiceCreate.mockResolvedValue({ ...mockInvoice(), items: [] });

      await m.service.create(ORG_ID, USER_ID, { customerId: 'cust-1', items: [{ productId: 'prod-1', description: 'Item', quantity: 2, unitPrice: 50, taxAmount: 10 }], organizationId: 'hacked-org' } as never);

      const createData = m.invoiceCreate.mock.calls[0][0].data;
      expect(createData.organizationId).toBe(ORG_ID);
      expect(createData.organizationId).not.toBe('hacked-org');
    });

    it('create rejects customer from different org', async () => {
      const m = createMocks();
      m.customerFindFirst.mockResolvedValue(null);

      await expect(
        m.service.create(ORG_ID, USER_ID, { customerId: 'cust-other', items: [{ productId: 'prod-1', description: 'Item', quantity: 1, unitPrice: 50 }] } as never),
      ).rejects.toThrow(BadRequestException);

      expect(m.customerFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: ORG_ID }),
        }),
      );
    });

    it('create rejects products from different org', async () => {
      const m = createMocks();
      m.customerFindFirst.mockResolvedValue({ id: 'cust-1' });
      m.productFindMany.mockResolvedValue([]);

      await expect(
        m.service.create(ORG_ID, USER_ID, { customerId: 'cust-1', items: [{ productId: 'prod-1', description: 'Item', quantity: 1, unitPrice: 50 }] } as never),
      ).rejects.toThrow(BadRequestException);

      expect(m.productFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: ORG_ID }),
        }),
      );
    });
  });
});
