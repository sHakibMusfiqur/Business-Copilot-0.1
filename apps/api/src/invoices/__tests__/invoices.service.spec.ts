import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { InvoicesService } from '../invoices.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';

const ORG_ID = 'org-test';
const USER_ID = 'user-test';
const ORG_ID_B = 'org-test-b';

const mockAuditService = () => ({
  record: jest.fn().mockResolvedValue(undefined),
});

const mockPrismaService = () => {
  const invoice = {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findUnique: jest.fn(),
  };
  const customer = {
    findFirst: jest.fn(),
  };
  const product = {
    findMany: jest.fn(),
  };
  const salesOrder = {
    findFirst: jest.fn(),
  };

  const $executeRaw = jest.fn().mockResolvedValue(undefined);
  const $transaction = jest.fn().mockImplementation(async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
    const txClient = { invoice, $executeRaw };
    return fn(txClient);
  });

  return {
    prisma: { invoice, customer, product, salesOrder, $transaction, $executeRaw } as unknown as PrismaService,
    invoice,
    customer,
    product,
    salesOrder,
  };
};

const createMockInvoice = (overrides = {}) => ({
  id: 'inv-1',
  invoiceNumber: 'INV-2026-000001',
  type: 'SALES',
  status: 'DRAFT',
  paymentStatus: 'PENDING',
  subtotal: new Prisma.Decimal(100),
  taxTotal: new Prisma.Decimal(10),
  discountTotal: new Prisma.Decimal(0),
  total: new Prisma.Decimal(110),
  paidAmount: new Prisma.Decimal(0),
  notes: null,
  issueDate: new Date(),
  dueDate: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  customer: { id: 'cust-1', name: 'Acme' },
  salesOrder: null,
  createdBy: { id: USER_ID, name: 'Test' },
  items: [],
  ...overrides,
});

const createMockSalesOrder = (overrides = {}) => ({
  id: 'so-1',
  orderNumber: 'SO-2026-000001',
  status: 'DELIVERED',
  customerId: 'cust-1',
  organizationId: ORG_ID,
  orderDate: new Date(),
  subtotal: new Prisma.Decimal(100),
  discount: new Prisma.Decimal(10),
  tax: new Prisma.Decimal(5),
  total: new Prisma.Decimal(95),
  items: [
    {
      id: 'soi-1',
      productId: 'p1',
      description: 'Product 1',
      quantity: new Prisma.Decimal(2),
      unitPrice: new Prisma.Decimal(50),
      discount: new Prisma.Decimal(10),
      tax: new Prisma.Decimal(5),
      lineTotal: new Prisma.Decimal(95),
      product: { id: 'p1', name: 'Product 1', sku: 'SKU-001' },
    },
  ],
  customer: { id: 'cust-1', name: 'Acme' },
  ...overrides,
});

describe('InvoicesService', () => {
  let service: InvoicesService;
  let auditService: ReturnType<typeof mockAuditService>;
  let prismaMocks: ReturnType<typeof mockPrismaService>;

  beforeEach(() => {
    prismaMocks = mockPrismaService();
    auditService = mockAuditService();
    service = new InvoicesService(prismaMocks.prisma, auditService as unknown as AuditService);
  });

  describe('findAll', () => {
    it('returns paginated invoices with balance and itemCount', async () => {
      prismaMocks.invoice.count.mockResolvedValue(2);
      prismaMocks.invoice.findMany.mockResolvedValue([
        createMockInvoice({ paidAmount: new Prisma.Decimal(50) }),
      ]);

      const result = await service.findAll(ORG_ID, {});

      expect(result.meta.total).toBe(2);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].balance).toBe(60);
      expect(result.data[0].itemCount).toBe(0);
    });

    it('filters by customerId', async () => {
      prismaMocks.invoice.count.mockResolvedValue(0);
      prismaMocks.invoice.findMany.mockResolvedValue([]);

      await service.findAll(ORG_ID, { customerId: 'cust-1' });

      expect(prismaMocks.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ customerId: 'cust-1' }),
        }),
      );
    });

    it('filters by salesOrderId', async () => {
      prismaMocks.invoice.count.mockResolvedValue(0);
      prismaMocks.invoice.findMany.mockResolvedValue([]);

      await service.findAll(ORG_ID, { salesOrderId: 'so-1' });

      expect(prismaMocks.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ salesOrderId: 'so-1' }),
        }),
      );
    });

    it('filters by search term across invoiceNumber, notes, and customer name', async () => {
      prismaMocks.invoice.count.mockResolvedValue(0);
      prismaMocks.invoice.findMany.mockResolvedValue([]);

      await service.findAll(ORG_ID, { search: 'INV-2026' });

      expect(prismaMocks.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { invoiceNumber: { contains: 'INV-2026', mode: 'insensitive' } },
              { notes: { contains: 'INV-2026', mode: 'insensitive' } },
              { customer: { name: { contains: 'INV-2026', mode: 'insensitive' } } },
            ],
          }),
        }),
      );
    });

    it('filters by dateFrom and dateTo on issueDate', async () => {
      prismaMocks.invoice.count.mockResolvedValue(0);
      prismaMocks.invoice.findMany.mockResolvedValue([]);

      await service.findAll(ORG_ID, { dateFrom: '2026-01-01', dateTo: '2026-12-31' });

      expect(prismaMocks.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            issueDate: {
              gte: new Date('2026-01-01'),
              lte: new Date('2026-12-31'),
            },
          }),
        }),
      );
    });

    it('filters by paymentStatus', async () => {
      prismaMocks.invoice.count.mockResolvedValue(0);
      prismaMocks.invoice.findMany.mockResolvedValue([]);

      await service.findAll(ORG_ID, { paymentStatus: 'PAID' });

      expect(prismaMocks.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ paymentStatus: 'PAID' }),
        }),
      );
    });

    it('applies sortBy and sortOrder', async () => {
      prismaMocks.invoice.count.mockResolvedValue(0);
      prismaMocks.invoice.findMany.mockResolvedValue([]);

      await service.findAll(ORG_ID, { sortBy: 'total', sortOrder: 'asc' });

      expect(prismaMocks.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { total: 'asc' },
        }),
      );
    });

    it('defaults to createdAt desc for invalid sortBy', async () => {
      prismaMocks.invoice.count.mockResolvedValue(0);
      prismaMocks.invoice.findMany.mockResolvedValue([]);

      await service.findAll(ORG_ID, { sortBy: 'invalidField' as never, sortOrder: 'desc' });

      expect(prismaMocks.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('always scopes queries to organizationId', async () => {
      prismaMocks.invoice.count.mockResolvedValue(0);
      prismaMocks.invoice.findMany.mockResolvedValue([]);

      await service.findAll(ORG_ID, {});

      expect(prismaMocks.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: ORG_ID }),
        }),
      );
    });
  });

  describe('findById', () => {
    it('throws NotFoundException when invoice not found', async () => {
      prismaMocks.invoice.findFirst.mockResolvedValue(null);

      await expect(service.findById(ORG_ID, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns invoice with balance calculated', async () => {
      prismaMocks.invoice.findFirst.mockResolvedValue(
        createMockInvoice({ paidAmount: new Prisma.Decimal(50) }),
      );

      const result = await service.findById(ORG_ID, 'inv-1');

      expect(result.balance).toBe(60);
    });

    it('enforces tenant isolation - does not return invoice from another org', async () => {
      prismaMocks.invoice.findFirst.mockResolvedValue(null);

      await expect(service.findById(ORG_ID_B, 'inv-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createFromOrder', () => {
    it('throws NotFoundException when sales order not found', async () => {
      prismaMocks.salesOrder.findFirst.mockResolvedValue(null);

      await expect(
        service.createFromOrder(ORG_ID, USER_ID, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when order not DELIVERED', async () => {
      prismaMocks.salesOrder.findFirst.mockResolvedValue(
        createMockSalesOrder({ status: 'DRAFT' }),
      );

      await expect(
        service.createFromOrder(ORG_ID, USER_ID, 'so-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for non-DELIVERED statuses (PENDING, CONFIRMED, SHIPPED, CANCELLED)', async () => {
      for (const status of ['PENDING', 'CONFIRMED', 'SHIPPED', 'CANCELLED']) {
        prismaMocks.salesOrder.findFirst.mockResolvedValue(
          createMockSalesOrder({ status }),
        );
        prismaMocks.invoice.findFirst.mockResolvedValue(null);

        await expect(
          service.createFromOrder(ORG_ID, USER_ID, 'so-1'),
        ).rejects.toThrow(BadRequestException);
      }
    });

    it('throws ConflictException when invoice already exists for order', async () => {
      prismaMocks.salesOrder.findFirst.mockResolvedValue(createMockSalesOrder());
      prismaMocks.invoice.findFirst.mockResolvedValue(createMockInvoice());

      await expect(
        service.createFromOrder(ORG_ID, USER_ID, 'so-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('creates invoice with correct data from sales order', async () => {
      const salesOrder = createMockSalesOrder();
      prismaMocks.salesOrder.findFirst.mockResolvedValue(salesOrder);
      prismaMocks.invoice.findFirst.mockResolvedValue(null); // No existing invoice
      prismaMocks.invoice.create.mockResolvedValue({
        ...createMockInvoice(),
        salesOrderId: 'so-1',
        subtotal: new Prisma.Decimal(100),
        taxTotal: new Prisma.Decimal(5),
        discountTotal: new Prisma.Decimal(10),
        total: new Prisma.Decimal(95),
      });

      const result = await service.createFromOrder(ORG_ID, USER_ID, 'so-1');

      expect(result.salesOrderId).toBe('so-1');
      expect(result.subtotal).toEqual(new Prisma.Decimal(100));
      expect(result.taxTotal).toEqual(new Prisma.Decimal(5));
      expect(result.discountTotal).toEqual(new Prisma.Decimal(10));
      expect(result.total).toEqual(new Prisma.Decimal(95));
    });

    it('enforces tenant isolation - cannot create from order in another org', async () => {
      prismaMocks.salesOrder.findFirst.mockResolvedValue(null);

      await expect(
        service.createFromOrder(ORG_ID_B, USER_ID, 'so-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates DRAFT invoice only', async () => {
      prismaMocks.salesOrder.findFirst.mockResolvedValue(createMockSalesOrder());
      prismaMocks.invoice.findFirst.mockResolvedValue(null);
      prismaMocks.invoice.create.mockResolvedValue(createMockInvoice());

      await service.createFromOrder(ORG_ID, USER_ID, 'so-1');

      expect(prismaMocks.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'DRAFT',
          }),
        }),
      );
    });

    it('sets paidAmount to 0', async () => {
      prismaMocks.salesOrder.findFirst.mockResolvedValue(createMockSalesOrder());
      prismaMocks.invoice.findFirst.mockResolvedValue(null);
      prismaMocks.invoice.create.mockResolvedValue(createMockInvoice());

      await service.createFromOrder(ORG_ID, USER_ID, 'so-1');

      expect(prismaMocks.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paidAmount: 0,
          }),
        }),
      );
    });

    it('records audit event on success', async () => {
      prismaMocks.salesOrder.findFirst.mockResolvedValue(createMockSalesOrder());
      prismaMocks.invoice.findFirst.mockResolvedValue(null);
      prismaMocks.invoice.create.mockResolvedValue(createMockInvoice());

      await service.createFromOrder(ORG_ID, USER_ID, 'so-1');

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_ID,
          organizationId: ORG_ID,
          action: 'INVOICE_CREATED',
          entity: 'Invoice',
          entityId: 'inv-1',
          status: 'SUCCESS',
        }),
      );
    });

    it('maps SalesOrder items to InvoiceItems with correct field mapping', async () => {
      const salesOrder = createMockSalesOrder();
      prismaMocks.salesOrder.findFirst.mockResolvedValue(salesOrder);
      prismaMocks.invoice.findFirst.mockResolvedValue(null);
      prismaMocks.invoice.create.mockResolvedValue({
        ...createMockInvoice(),
        salesOrderId: 'so-1',
      });

      await service.createFromOrder(ORG_ID, USER_ID, 'so-1');

      const createCall = prismaMocks.invoice.create.mock.calls[0][0];
      const itemData = createCall.data.items.create;

      expect(itemData).toHaveLength(1);
      expect(itemData[0].productId).toBe('p1');
      expect(itemData[0].description).toBe('Product 1');
      expect(itemData[0].quantity).toBe(2);
      expect(itemData[0].unitPrice).toBe(50);
      expect(itemData[0].discount).toBe(10);
      expect(itemData[0].taxAmount).toBe(5);
      expect(itemData[0].total).toBe(95);
    });

    it('sets due date to order date + 30 days', async () => {
      const orderDate = new Date('2026-06-15T00:00:00Z');
      const salesOrder = createMockSalesOrder({ orderDate });
      prismaMocks.salesOrder.findFirst.mockResolvedValue(salesOrder);
      prismaMocks.invoice.findFirst.mockResolvedValue(null);
      prismaMocks.invoice.create.mockResolvedValue(createMockInvoice());

      await service.createFromOrder(ORG_ID, USER_ID, 'so-1');

      const createCall = prismaMocks.invoice.create.mock.calls[0][0];
      const dueDate = createCall.data.dueDate as Date;

      expect(dueDate).toBeInstanceOf(Date);
      expect(dueDate.toISOString().startsWith('2026-07-15')).toBe(true);
    });

    it('sets organizationId on created invoice', async () => {
      prismaMocks.salesOrder.findFirst.mockResolvedValue(createMockSalesOrder());
      prismaMocks.invoice.findFirst.mockResolvedValue(null);
      prismaMocks.invoice.create.mockResolvedValue(createMockInvoice());

      await service.createFromOrder(ORG_ID, USER_ID, 'so-1');

      const createCall = prismaMocks.invoice.create.mock.calls[0][0];
      expect(createCall.data.organizationId).toBe(ORG_ID);
    });

    it('sets createdById from userId', async () => {
      prismaMocks.salesOrder.findFirst.mockResolvedValue(createMockSalesOrder());
      prismaMocks.invoice.findFirst.mockResolvedValue(null);
      prismaMocks.invoice.create.mockResolvedValue(createMockInvoice());

      await service.createFromOrder(ORG_ID, USER_ID, 'so-1');

      const createCall = prismaMocks.invoice.create.mock.calls[0][0];
      expect(createCall.data.createdById).toBe(USER_ID);
    });

    it('sets paymentStatus to PENDING', async () => {
      prismaMocks.salesOrder.findFirst.mockResolvedValue(createMockSalesOrder());
      prismaMocks.invoice.findFirst.mockResolvedValue(null);
      prismaMocks.invoice.create.mockResolvedValue(createMockInvoice());

      await service.createFromOrder(ORG_ID, USER_ID, 'so-1');

      const createCall = prismaMocks.invoice.create.mock.calls[0][0];
      expect(createCall.data.paymentStatus).toBe('PENDING');
    });

    it('includes notes referencing the sales order number', async () => {
      prismaMocks.salesOrder.findFirst.mockResolvedValue(createMockSalesOrder());
      prismaMocks.invoice.findFirst.mockResolvedValue(null);
      prismaMocks.invoice.create.mockResolvedValue(createMockInvoice());

      await service.createFromOrder(ORG_ID, USER_ID, 'so-1');

      const createCall = prismaMocks.invoice.create.mock.calls[0][0];
      expect(createCall.data.notes).toBe('Invoice for SO-2026-000001');
    });
  });

  describe('update', () => {
    it('throws NotFoundException when invoice not found', async () => {
      prismaMocks.invoice.findFirst.mockResolvedValue(null);

      await expect(
        service.update(ORG_ID, USER_ID, 'nonexistent', { notes: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when invoice is not DRAFT', async () => {
      prismaMocks.invoice.findFirst.mockResolvedValue(
        createMockInvoice({ status: 'SENT' }),
      );

      await expect(
        service.update(ORG_ID, USER_ID, 'inv-1', { notes: 'test' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for non-DRAFT statuses (SENT, PAID, CANCELLED)', async () => {
      for (const status of ['SENT', 'PAID', 'CANCELLED']) {
        prismaMocks.invoice.findFirst.mockResolvedValue(
          createMockInvoice({ status }),
        );

        await expect(
          service.update(ORG_ID, USER_ID, 'inv-1', { notes: 'test' }),
        ).rejects.toThrow(BadRequestException);
      }
    });

    it('allows metadata updates on DRAFT invoice', async () => {
      prismaMocks.invoice.findFirst.mockResolvedValue(createMockInvoice());
      prismaMocks.invoice.update.mockResolvedValue({
        ...createMockInvoice(),
        notes: 'Updated note',
      });

      const result = await service.update(ORG_ID, USER_ID, 'inv-1', {
        notes: 'Updated note',
      });

      expect(result.notes).toBe('Updated note');
    });

    it('does not allow monetary updates', async () => {
      prismaMocks.invoice.findFirst.mockResolvedValue(createMockInvoice());
      prismaMocks.invoice.update.mockResolvedValue(createMockInvoice());

      await service.update(ORG_ID, USER_ID, 'inv-1', {
        notes: 'test',
      });

      // Verify the update call does not include monetary fields
      expect(prismaMocks.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({
            subtotal: expect.anything(),
            taxTotal: expect.anything(),
            discountTotal: expect.anything(),
            total: expect.anything(),
          }),
        }),
      );
    });

    it('enforces tenant isolation - cannot update invoice in another org', async () => {
      prismaMocks.invoice.findFirst.mockResolvedValue(null);

      await expect(
        service.update(ORG_ID_B, USER_ID, 'inv-1', { notes: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects customerId change to cross-org customer', async () => {
      prismaMocks.invoice.findFirst.mockResolvedValue(createMockInvoice());
      prismaMocks.customer.findFirst.mockResolvedValue(null);

      await expect(
        service.update(ORG_ID, USER_ID, 'inv-1', { customerId: 'cust-cross-org' }),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMocks.customer.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'cust-cross-org', organizationId: ORG_ID }),
        }),
      );
      expect(prismaMocks.invoice.update).not.toHaveBeenCalled();
    });

    it('allows customerId change to valid same-org customer', async () => {
      prismaMocks.invoice.findFirst.mockResolvedValue(createMockInvoice());
      prismaMocks.customer.findFirst.mockResolvedValue({ id: 'cust-2', name: 'New Customer' });
      prismaMocks.invoice.update.mockResolvedValue({
        ...createMockInvoice(),
        customerId: 'cust-2',
      });

      const result = await service.update(ORG_ID, USER_ID, 'inv-1', { customerId: 'cust-2' });

      expect(result.customerId).toBe('cust-2');
      expect(prismaMocks.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customer: { connect: { id: 'cust-2' } },
          }),
        }),
      );
    });

    it('does not validate customerId when not changing it', async () => {
      prismaMocks.invoice.findFirst.mockResolvedValue(createMockInvoice());
      prismaMocks.invoice.update.mockResolvedValue(createMockInvoice());

      await service.update(ORG_ID, USER_ID, 'inv-1', { notes: 'unchanged customer' });

      expect(prismaMocks.customer.findFirst).not.toHaveBeenCalled();
    });

    it('records audit event on success', async () => {
      prismaMocks.invoice.findFirst.mockResolvedValue(createMockInvoice());
      prismaMocks.invoice.update.mockResolvedValue(createMockInvoice());

      await service.update(ORG_ID, USER_ID, 'inv-1', { notes: 'test' });

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_ID,
          organizationId: ORG_ID,
          action: 'INVOICE_UPDATED',
          entity: 'Invoice',
          entityId: 'inv-1',
          status: 'SUCCESS',
        }),
      );
    });

    it('audit event includes invoiceNumber in metadata', async () => {
      prismaMocks.invoice.findFirst.mockResolvedValue(createMockInvoice());
      prismaMocks.invoice.update.mockResolvedValue(createMockInvoice());

      await service.update(ORG_ID, USER_ID, 'inv-1', { notes: 'test' });

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            invoiceNumber: 'INV-2026-000001',
          }),
        }),
      );
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when invoice not found', async () => {
      prismaMocks.invoice.findFirst.mockResolvedValue(null);

      await expect(service.remove(ORG_ID, USER_ID, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when invoice is not DRAFT', async () => {
      prismaMocks.invoice.findFirst.mockResolvedValue(
        createMockInvoice({ status: 'SENT' }),
      );

      await expect(service.remove(ORG_ID, USER_ID, 'inv-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException for non-DRAFT statuses (SENT, PAID, CANCELLED)', async () => {
      for (const status of ['SENT', 'PAID', 'CANCELLED']) {
        prismaMocks.invoice.findFirst.mockResolvedValue(
          createMockInvoice({ status }),
        );

        await expect(service.remove(ORG_ID, USER_ID, 'inv-1')).rejects.toThrow(
          BadRequestException,
        );
      }
    });

    it('allows deletion of DRAFT invoice', async () => {
      prismaMocks.invoice.findFirst.mockResolvedValue(createMockInvoice());
      prismaMocks.invoice.delete.mockResolvedValue(createMockInvoice());

      const result = await service.remove(ORG_ID, USER_ID, 'inv-1');

      expect(result.id).toBe('inv-1');
    });

    it('enforces tenant isolation - cannot delete invoice in another org', async () => {
      prismaMocks.invoice.findFirst.mockResolvedValue(null);

      await expect(service.remove(ORG_ID_B, USER_ID, 'inv-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('records audit event on success', async () => {
      prismaMocks.invoice.findFirst.mockResolvedValue(createMockInvoice());
      prismaMocks.invoice.delete.mockResolvedValue(createMockInvoice());

      await service.remove(ORG_ID, USER_ID, 'inv-1');

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_ID,
          organizationId: ORG_ID,
          action: 'INVOICE_DELETED',
          entity: 'Invoice',
          entityId: 'inv-1',
          status: 'SUCCESS',
        }),
      );
    });

    it('audit event includes invoiceNumber in metadata', async () => {
      prismaMocks.invoice.findFirst.mockResolvedValue(createMockInvoice());
      prismaMocks.invoice.delete.mockResolvedValue(createMockInvoice());

      await service.remove(ORG_ID, USER_ID, 'inv-1');

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            invoiceNumber: 'INV-2026-000001',
          }),
        }),
      );
    });
  });
});
