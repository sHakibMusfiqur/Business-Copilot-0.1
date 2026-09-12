import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { InvoicesService } from '../invoices.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';

const ORG_ID = 'org-test';
const USER_ID = 'user-test';

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

  return {
    prisma: { invoice, customer, product, salesOrder } as unknown as PrismaService,
    invoice,
    customer,
    product,
    salesOrder,
  };
};

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
    it('returns paginated invoices', async () => {
      prismaMocks.invoice.count.mockResolvedValue(2);
      prismaMocks.invoice.findMany.mockResolvedValue([
        {
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
        },
      ]);

      const result = await service.findAll(ORG_ID, {});

      expect(result.meta.total).toBe(2);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].balance).toBe(110);
      expect(result.data[0].itemCount).toBe(0);
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
      prismaMocks.invoice.findFirst.mockResolvedValue({
        id: 'inv-1',
        invoiceNumber: 'INV-2026-000001',
        type: 'SALES',
        status: 'DRAFT',
        paymentStatus: 'PENDING',
        subtotal: new Prisma.Decimal(100),
        taxTotal: new Prisma.Decimal(10),
        discountTotal: new Prisma.Decimal(0),
        total: new Prisma.Decimal(110),
        paidAmount: new Prisma.Decimal(50),
        notes: null,
        issueDate: new Date(),
        dueDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        customer: { id: 'cust-1', name: 'Acme', email: 'acme@test.com', phone: null },
        salesOrder: null,
        createdBy: { id: USER_ID, name: 'Test' },
        items: [],
      });

      const result = await service.findById(ORG_ID, 'inv-1');

      expect(result.balance).toBe(60);
    });
  });

  describe('create', () => {
    it('throws BadRequestException when customer not found', async () => {
      prismaMocks.customer.findFirst.mockResolvedValue(null);

      await expect(
        service.create(ORG_ID, USER_ID, {
          customerId: 'nonexistent',
          items: [{ productId: 'p1', description: 'Test', quantity: 1, unitPrice: 100 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates invoice successfully', async () => {
      prismaMocks.customer.findFirst.mockResolvedValue({ id: 'cust-1', name: 'Acme' });
      prismaMocks.product.findMany.mockResolvedValue([{ id: 'p1', name: 'Product 1' }]);
      prismaMocks.invoice.findFirst.mockResolvedValue(null); // No existing invoice with same number
      prismaMocks.invoice.create.mockResolvedValue({
        id: 'inv-1',
        invoiceNumber: 'INV-2026-000001',
        type: 'SALES',
        status: 'DRAFT',
        paymentStatus: 'PENDING',
        subtotal: new Prisma.Decimal(100),
        taxTotal: new Prisma.Decimal(0),
        discountTotal: new Prisma.Decimal(0),
        total: new Prisma.Decimal(100),
        paidAmount: new Prisma.Decimal(0),
        notes: null,
        issueDate: new Date(),
        dueDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [],
      });

      const result = await service.create(ORG_ID, USER_ID, {
        customerId: 'cust-1',
        items: [{ productId: 'p1', description: 'Product 1', quantity: 1, unitPrice: 100 }],
      });

      expect(result.invoiceNumber).toBe('INV-2026-000001');
      expect(result.total).toEqual(new Prisma.Decimal(100));
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
      prismaMocks.salesOrder.findFirst.mockResolvedValue({
        id: 'so-1',
        orderNumber: 'SO-2026-000001',
        status: 'DRAFT',
        customerId: 'cust-1',
        orderDate: new Date(),
        subtotal: new Prisma.Decimal(100),
        discount: new Prisma.Decimal(0),
        tax: new Prisma.Decimal(0),
        total: new Prisma.Decimal(100),
        items: [],
        customer: { name: 'Acme' },
      });

      await expect(
        service.createFromOrder(ORG_ID, USER_ID, 'so-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
