import { PrismaClient, Prisma } from '@prisma/client';
import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';

import { InvoicesService } from '../invoices.service';
import { AuditService } from '../../audit/audit.service';

const prisma = new PrismaClient();

// Use unique suffix per run to prevent stale-data collisions from crashed prior runs
const SUFFIX = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const ORG_A = `org-integ-a-${SUFFIX}`;
const ORG_B = `org-integ-b-${SUFFIX}`;
const USER_A = `user-integ-a-${SUFFIX}`;
const USER_B = `user-integ-b-${SUFFIX}`;

const CUSTOMER_A = `customer-integ-a-${SUFFIX}`;
const CUSTOMER_B = `customer-integ-b-${SUFFIX}`;
const PRODUCT_A = `product-integ-a-${SUFFIX}`;
const PRODUCT_B = `product-integ-b-${SUFFIX}`;

let invoicesServiceA: InvoicesService;
let invoicesServiceB: InvoicesService;

function createPrismaService(): PrismaService {
  return prisma as unknown as PrismaService;
}

function createAuditService(): AuditService {
  return new AuditService(createPrismaService());
}

function formatError(reason: unknown): { constructor: string; message: string; prismaCode: string | null } {
  if (reason instanceof Error) {
    return {
      constructor: reason.constructor.name,
      message: reason.message,
      prismaCode:
        reason instanceof Prisma.PrismaClientKnownRequestError
          ? (reason as { code: string }).code
          : null,
    };
  }
  return { constructor: String(reason), message: String(reason), prismaCode: null };
}

async function cleanup() {
  await prisma.auditLog.deleteMany({
    where: { organizationId: { in: [ORG_A, ORG_B] } },
  });
  await prisma.invoiceItem.deleteMany({
    where: { invoice: { organizationId: { in: [ORG_A, ORG_B] } } },
  });
  await prisma.invoice.deleteMany({
    where: { organizationId: { in: [ORG_A, ORG_B] } },
  });
  await prisma.salesOrderItem.deleteMany({
    where: { salesOrder: { organizationId: { in: [ORG_A, ORG_B] } } },
  });
  await prisma.salesOrder.deleteMany({
    where: { organizationId: { in: [ORG_A, ORG_B] } },
  });
  await prisma.customer.deleteMany({
    where: { id: { in: [CUSTOMER_A, CUSTOMER_B] } },
  });
  await prisma.product.deleteMany({
    where: { id: { in: [PRODUCT_A, PRODUCT_B] } },
  });
  await prisma.organization.deleteMany({
    where: { id: { in: [ORG_A, ORG_B] } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [USER_A, USER_B] } },
  });
}

async function seedBase() {
  await cleanup();

  await prisma.user.create({
    data: {
      id: USER_A,
      email: 'integ-a@test.com',
      name: 'Test User A',
      role: 'ADMIN',
      password: 'hashed',
    },
  });

  await prisma.user.create({
    data: {
      id: USER_B,
      email: 'integ-b@test.com',
      name: 'Test User B',
      role: 'ADMIN',
      password: 'hashed',
    },
  });

  await prisma.organization.create({
    data: { id: ORG_A, name: 'Org A', slug: 'org-a-integ' },
  });

  await prisma.organization.create({
    data: { id: ORG_B, name: 'Org B', slug: 'org-b-integ' },
  });

  await prisma.customer.create({
    data: { id: CUSTOMER_A, organizationId: ORG_A, name: 'Customer A' },
  });

  await prisma.customer.create({
    data: { id: CUSTOMER_B, organizationId: ORG_B, name: 'Customer B' },
  });

  await prisma.product.create({
    data: { id: PRODUCT_A, organizationId: ORG_A, name: 'Product A', sku: 'SKU-A' },
  });

  await prisma.product.create({
    data: { id: PRODUCT_B, organizationId: ORG_B, name: 'Product B', sku: 'SKU-B' },
  });

  const auditService = createAuditService();
  invoicesServiceA = new InvoicesService(createPrismaService(), auditService);
  invoicesServiceB = new InvoicesService(createPrismaService(), auditService);
}

async function createDeliveredSalesOrder(
  orgId: string,
  customerId: string,
  userId: string,
  suffix: string,
  itemOverrides?: { discount?: number; tax?: number },
) {
  const orderNumber = `SO-${orgId}-${suffix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const discount = itemOverrides?.discount ?? 10;
  const tax = itemOverrides?.tax ?? 5;
  const subtotal = new Prisma.Decimal(200);
  const total = new Prisma.Decimal(200 - discount + tax);

  const sale = await prisma.salesOrder.create({
    data: {
      orderNumber,
      organizationId: orgId,
      customerId,
      createdById: userId,
      status: 'DELIVERED',
      subtotal,
      discount: new Prisma.Decimal(discount),
      tax: new Prisma.Decimal(tax),
      total,
    },
  });

  await prisma.salesOrderItem.create({
    data: {
      salesOrderId: sale.id,
      productId: orgId === ORG_A ? PRODUCT_A : PRODUCT_B,
      description: `Item ${suffix}`,
      quantity: new Prisma.Decimal(2),
      unitPrice: new Prisma.Decimal(100),
      discount: new Prisma.Decimal(discount),
      tax: new Prisma.Decimal(tax),
      lineTotal: new Prisma.Decimal(200 - discount + tax),
    },
  });

  return sale;
}

function parseInvoiceNumber(invoiceNumber: string): number {
  const parts = invoiceNumber.split('-');
  return parseInt(parts[parts.length - 1], 10);
}

describe('Invoice Concurrency Integration — Real Service', () => {
  beforeAll(async () => {
    await seedBase();
  }, 60_000);

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  describe('A. Same-org numbering (10 SalesOrders, concurrent)', () => {
    it('should create 10 invoices with unique sequential numbers via real service', async () => {
      const CONCURRENT_COUNT = 10;

      const salesOrders = await Promise.all(
        Array.from({ length: CONCURRENT_COUNT }, (_, i) =>
          createDeliveredSalesOrder(ORG_A, CUSTOMER_A, USER_A, `sameorg-${i}`),
        ),
      );

      const results = await Promise.allSettled(
        salesOrders.map((so) =>
          invoicesServiceA.createFromOrder(ORG_A, USER_A, so.id),
        ),
      );

      const successes = results.filter((r) => r.status === 'fulfilled');
      const failures = results.filter((r) => r.status === 'rejected');

      expect(successes.length).toBe(CONCURRENT_COUNT);
      expect(failures.length).toBe(0);

      const invoices = successes.map((r) => r.value);

      const numbers = invoices.map((inv) => inv.invoiceNumber);
      const uniqueNumbers = new Set(numbers);
      expect(uniqueNumbers.size).toBe(CONCURRENT_COUNT);

      for (const num of numbers) {
        expect(num).toMatch(/^INV-\d{4}-\d{6}$/);
      }

      const parsed = numbers.map(parseInvoiceNumber).sort((a, b) => a - b);
      for (let i = 1; i < parsed.length; i++) {
        expect(parsed[i]).toBeGreaterThan(parsed[i - 1]);
      }

      for (const inv of invoices) {
        expect(inv.organizationId).toBe(ORG_A);
        expect(inv.status).toBe('DRAFT');
        expect(Number(inv.paidAmount)).toBe(0);
        expect(inv.items.length).toBe(1);
      }
    }, 60_000);
  });

  describe('B. Cross-org numbering (5+5 SalesOrders, concurrent)', () => {
    it('should allow same invoice numbers across orgs but unique within each', async () => {
      const COUNT_PER_ORG = 5;

      const salesA = await Promise.all(
        Array.from({ length: COUNT_PER_ORG }, (_, i) =>
          createDeliveredSalesOrder(ORG_A, CUSTOMER_A, USER_A, `crossorg-a-${i}`),
        ),
      );

      const salesB = await Promise.all(
        Array.from({ length: COUNT_PER_ORG }, (_, i) =>
          createDeliveredSalesOrder(ORG_B, CUSTOMER_B, USER_B, `crossorg-b-${i}`),
        ),
      );

      const allSales = [...salesA, ...salesB];
      const results = await Promise.allSettled(
        allSales.map((so) => {
          const service = so.organizationId === ORG_A ? invoicesServiceA : invoicesServiceB;
          const user = so.organizationId === ORG_A ? USER_A : USER_B;
          return service.createFromOrder(so.organizationId, user, so.id);
        }),
      );

      const successes = results.filter((r) => r.status === 'fulfilled');
      expect(successes.length).toBe(COUNT_PER_ORG * 2);

      const orgAInvoices = await prisma.invoice.findMany({
        where: { organizationId: ORG_A },
        select: { invoiceNumber: true },
      });
      const orgBInvoices = await prisma.invoice.findMany({
        where: { organizationId: ORG_B },
        select: { invoiceNumber: true },
      });

      const numsA = orgAInvoices.map((i) => i.invoiceNumber);
      const numsB = orgBInvoices.map((i) => i.invoiceNumber);

      expect(new Set(numsA).size).toBe(numsA.length);
      expect(new Set(numsB).size).toBe(numsB.length);

      const parsedA = numsA.map(parseInvoiceNumber).sort((a, b) => a - b);
      const parsedB = numsB.map(parseInvoiceNumber).sort((a, b) => a - b);

      for (let i = 1; i < parsedA.length; i++) {
        expect(parsedA[i]).toBeGreaterThan(parsedA[i - 1]);
      }
      for (let i = 1; i < parsedB.length; i++) {
        expect(parsedB[i]).toBeGreaterThan(parsedB[i - 1]);
      }

      for (const num of numsA) {
        expect(num).toMatch(/^INV-\d{4}-\d{6}$/);
      }
      for (const num of numsB) {
        expect(num).toMatch(/^INV-\d{4}-\d{6}$/);
      }
    }, 60_000);
  });

  describe('C. Same-SalesOrder idempotency (5 concurrent)', () => {
    it('should create exactly 1 invoice with exactly 4 ConflictExceptions', async () => {
      const sale = await createDeliveredSalesOrder(
        ORG_A,
        CUSTOMER_A,
        USER_A,
        'idempotent',
      );

      const CONCURRENT_COUNT = 5;

      const results = await Promise.allSettled(
        Array.from({ length: CONCURRENT_COUNT }, () =>
          invoicesServiceA.createFromOrder(ORG_A, USER_A, sale.id),
        ),
      );

      const successes = results.filter(
        (r): r is PromiseFulfilledResult<Awaited<ReturnType<InvoicesService['createFromOrder']>>> => r.status === 'fulfilled',
      );
      const rejections = results.filter(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      );

      expect(successes.length).toBe(1);
      expect(rejections.length).toBe(4);

      for (const rej of rejections) {
        const err = rej.reason;
        expect(err).toBeInstanceOf(ConflictException);
      }

      const invoicesForSale = await prisma.invoice.findMany({
        where: { salesOrderId: sale.id, organizationId: ORG_A },
      });
      expect(invoicesForSale.length).toBe(1);

      const items = await prisma.invoiceItem.findMany({
        where: { invoiceId: invoicesForSale[0].id },
      });
      expect(items.length).toBe(1);

      const auditEvents = await prisma.auditLog.findMany({
        where: {
          organizationId: ORG_A,
          action: 'INVOICE_CREATED',
          entity: 'Invoice',
          entityId: invoicesForSale[0].id,
        },
      });
      expect(auditEvents.length).toBe(1);
      expect(auditEvents[0].status).toBe('SUCCESS');
    }, 60_000);
  });

  describe('D. Business integrity verification', () => {
    it('should copy all SalesOrder fields correctly to Invoice', async () => {
      const sale = await createDeliveredSalesOrder(
        ORG_A,
        CUSTOMER_A,
        USER_A,
        'integrity',
        { discount: 20, tax: 15 },
      );

      const saleWithItems = await prisma.salesOrder.findUnique({
        where: { id: sale.id },
        include: { items: true },
      });

      const invoice = await invoicesServiceA.createFromOrder(ORG_A, USER_A, sale.id);

      expect(saleWithItems).not.toBeNull();
      if (!saleWithItems) return;

      expect(invoice.customerId).toBe(saleWithItems.customerId);
      expect(Number(invoice.subtotal)).toBe(Number(saleWithItems.subtotal));
      expect(Number(invoice.discountTotal)).toBe(Number(saleWithItems.discount));
      expect(Number(invoice.taxTotal)).toBe(Number(saleWithItems.tax));
      expect(Number(invoice.total)).toBe(Number(saleWithItems.total));
      expect(invoice.status).toBe('DRAFT');
      expect(Number(invoice.paidAmount)).toBe(0);

      const saleItems = saleWithItems.items;
      expect(invoice.items.length).toBe(saleItems.length);

      for (let i = 0; i < saleItems.length; i++) {
        const si = saleItems[i];
        const ii = invoice.items[i];

        expect(ii.productId).toBe(si.productId);
        expect(Number(ii.quantity)).toBe(Number(si.quantity));
        expect(Number(ii.unitPrice)).toBe(Number(si.unitPrice));
        expect(Number(ii.discount)).toBe(Number(si.discount));
        expect(Number(ii.taxAmount)).toBe(Number(si.tax));
        expect(Number(ii.total)).toBe(Number(si.lineTotal));
      }
    }, 30_000);
  });

  describe('E. Invoice numbering sequence assertion', () => {
    it('should have contiguous numbers within org with no gaps from race conditions', async () => {
      const freshOrg = `org-seq-test-${Date.now()}`;
      const freshUser = `user-seq-test-${Date.now()}`;
      const freshCustomer = `customer-seq-${Date.now()}`;

      await prisma.user.create({
        data: {
          id: freshUser,
          email: `seq-${Date.now()}@test.com`,
          name: 'Seq Test User',
          role: 'ADMIN',
          password: 'hashed',
        },
      });
      await prisma.organization.create({
        data: { id: freshOrg, name: `Seq Org ${freshOrg}`, slug: `seq-${Date.now()}` },
      });
      await prisma.customer.create({
        data: { id: freshCustomer, organizationId: freshOrg, name: 'Seq Customer' },
      });
      const seqProductId = `product-seq-${Date.now()}`;
      await prisma.product.create({
        data: {
          id: seqProductId,
          organizationId: freshOrg,
          name: 'Seq Product',
          sku: `SKU-SEQ-${Date.now()}`,
        },
      });

      const auditService = createAuditService();
      const freshService = new InvoicesService(createPrismaService(), auditService);

      const COUNT = 8;

      const salesOrders = await Promise.all(
        Array.from({ length: COUNT }, (_, i) =>
          createDeliveredSalesOrder(
            freshOrg,
            freshCustomer,
            freshUser,
            `seq-${i}`,
          ),
        ),
      );

      const results = await Promise.allSettled(
        salesOrders.map((so) =>
          freshService.createFromOrder(freshOrg, freshUser, so.id),
        ),
      );

      const successes = results.filter((r) => r.status === 'fulfilled');
      expect(successes.length).toBe(COUNT);

      const invoiceNumbers = successes
        .map((r) => r.value.invoiceNumber)
        .map(parseInvoiceNumber)
        .sort((a, b) => a - b);

      for (let i = 0; i < invoiceNumbers.length; i++) {
        expect(invoiceNumbers[i]).toBe(i + 1);
      }

      for (const inv of successes.map((r) => r.value)) {
        expect(inv.invoiceNumber).toMatch(/^INV-\d{4}-\d{6}$/);
      }

      await prisma.auditLog.deleteMany({ where: { organizationId: freshOrg } });
      await prisma.invoiceItem.deleteMany({ where: { invoice: { organizationId: freshOrg } } });
      await prisma.invoice.deleteMany({ where: { organizationId: freshOrg } });
      await prisma.salesOrderItem.deleteMany({ where: { salesOrder: { organizationId: freshOrg } } });
      await prisma.salesOrder.deleteMany({ where: { organizationId: freshOrg } });
      await prisma.product.deleteMany({ where: { id: seqProductId } });
      await prisma.customer.deleteMany({ where: { id: freshCustomer } });
      await prisma.organization.deleteMany({ where: { id: freshOrg } });
      await prisma.user.deleteMany({ where: { id: freshUser } });
    }, 60_000);
  });

  describe('F. Stress: 20 concurrent same-org', () => {
    it('should create 20 invoices with contiguous numbers via advisory lock', async () => {
      const stressOrg = `org-stress-${Date.now()}`;
      const stressUser = `user-stress-${Date.now()}`;
      const stressCustomer = `customer-stress-${Date.now()}`;
      const stressProduct = `product-stress-${Date.now()}`;

      await prisma.user.create({
        data: { id: stressUser, email: `stress-${Date.now()}@test.com`, name: 'Stress User', role: 'ADMIN', password: 'hashed' },
      });
      await prisma.organization.create({ data: { id: stressOrg, name: `Stress Org`, slug: `stress-${Date.now()}` } });
      await prisma.customer.create({ data: { id: stressCustomer, organizationId: stressOrg, name: 'Stress Customer' } });
      await prisma.product.create({ data: { id: stressProduct, organizationId: stressOrg, name: 'Stress Product', sku: `SKU-STRESS-${Date.now()}` } });

      const auditService = createAuditService();
      const stressService = new InvoicesService(createPrismaService(), auditService);

      const COUNT = 20;
      const salesOrders = await Promise.all(
        Array.from({ length: COUNT }, (_, i) =>
          createDeliveredSalesOrder(stressOrg, stressCustomer, stressUser, `stress-${i}`),
        ),
      );

      const results = await Promise.allSettled(
        salesOrders.map((so) => stressService.createFromOrder(stressOrg, stressUser, so.id)),
      );

      const successes = results.filter((r) => r.status === 'fulfilled');
      const failures = results.filter((r) => r.status === 'rejected');

      if (failures.length > 0) {
        console.log('\n══════════════════════════════════════════════════════════════');
        console.log('STRESS TEST F DIAGNOSTIC — 20 same-org concurrent');
        console.log('══════════════════════════════════════════════════════════════');
        for (let i = 0; i < results.length; i++) {
          const r = results[i];
          if (r.status === 'rejected') {
            const err = formatError(r.reason);
            console.log(`  [${i}] REJECTED: ${err.constructor} — ${err.message} (prismaCode: ${err.prismaCode})`);
          }
        }
        console.log(`  successes: ${successes.length}/${COUNT}`);
        console.log('══════════════════════════════════════════════════════════════\n');
      }

      expect(successes.length).toBe(COUNT);

      const invoiceNumbers = successes
        .map((r) => r.value.invoiceNumber)
        .map(parseInvoiceNumber)
        .sort((a, b) => a - b);

      for (let i = 0; i < invoiceNumbers.length; i++) {
        expect(invoiceNumbers[i]).toBe(i + 1);
      }

      await prisma.auditLog.deleteMany({ where: { organizationId: stressOrg } });
      await prisma.invoiceItem.deleteMany({ where: { invoice: { organizationId: stressOrg } } });
      await prisma.invoice.deleteMany({ where: { organizationId: stressOrg } });
      await prisma.salesOrderItem.deleteMany({ where: { salesOrder: { organizationId: stressOrg } } });
      await prisma.salesOrder.deleteMany({ where: { organizationId: stressOrg } });
      await prisma.product.deleteMany({ where: { id: stressProduct } });
      await prisma.customer.deleteMany({ where: { id: stressCustomer } });
      await prisma.organization.deleteMany({ where: { id: stressOrg } });
      await prisma.user.deleteMany({ where: { id: stressUser } });
    }, 120_000);
  });

  describe('G. Stress: 40 concurrent (2 orgs x 20)', () => {
    it('should create 40 invoices across 2 orgs with independent numbering', async () => {
      const stressOrgX = `org-stress-x-${Date.now()}`;
      const stressOrgY = `org-stress-y-${Date.now()}`;
      const stressUserX = `user-stress-x-${Date.now()}`;
      const stressUserY = `user-stress-y-${Date.now()}`;
      const stressCustomerX = `customer-stress-x-${Date.now()}`;
      const stressCustomerY = `customer-stress-y-${Date.now()}`;
      const stressProductX = `product-stress-x-${Date.now()}`;
      const stressProductY = `product-stress-y-${Date.now()}`;

      await prisma.user.create({ data: { id: stressUserX, email: `stress-x-${Date.now()}@test.com`, name: 'Stress X', role: 'ADMIN', password: 'hashed' } });
      await prisma.user.create({ data: { id: stressUserY, email: `stress-y-${Date.now()}@test.com`, name: 'Stress Y', role: 'ADMIN', password: 'hashed' } });
      await prisma.organization.create({ data: { id: stressOrgX, name: 'Stress X', slug: `stress-x-${Date.now()}` } });
      await prisma.organization.create({ data: { id: stressOrgY, name: 'Stress Y', slug: `stress-y-${Date.now()}` } });
      await prisma.customer.create({ data: { id: stressCustomerX, organizationId: stressOrgX, name: 'Cust X' } });
      await prisma.customer.create({ data: { id: stressCustomerY, organizationId: stressOrgY, name: 'Cust Y' } });
      await prisma.product.create({ data: { id: stressProductX, organizationId: stressOrgX, name: 'Prod X', sku: `SKU-SX-${Date.now()}` } });
      await prisma.product.create({ data: { id: stressProductY, organizationId: stressOrgY, name: 'Prod Y', sku: `SKU-SY-${Date.now()}` } });

      const auditService = createAuditService();
      const stressServiceX = new InvoicesService(createPrismaService(), auditService);
      const stressServiceY = new InvoicesService(createPrismaService(), auditService);

      const COUNT_PER_ORG = 20;

      const salesX = await Promise.all(
        Array.from({ length: COUNT_PER_ORG }, (_, i) =>
          createDeliveredSalesOrder(stressOrgX, stressCustomerX, stressUserX, `sx-${i}`),
        ),
      );
      const salesY = await Promise.all(
        Array.from({ length: COUNT_PER_ORG }, (_, i) =>
          createDeliveredSalesOrder(stressOrgY, stressCustomerY, stressUserY, `sy-${i}`),
        ),
      );

      const allSales = [...salesX, ...salesY];
      const results = await Promise.allSettled(
        allSales.map((so) => {
          const isX = so.organizationId === stressOrgX;
          const svc = isX ? stressServiceX : stressServiceY;
          const usr = isX ? stressUserX : stressUserY;
          return svc.createFromOrder(so.organizationId, usr, so.id);
        }),
      );

      const successes = results.filter((r) => r.status === 'fulfilled');
      const failures = results.filter((r) => r.status === 'rejected');

      if (failures.length > 0) {
        console.log('\n══════════════════════════════════════════════════════════════');
        console.log('STRESS TEST G DIAGNOSTIC — 40 concurrent (2 orgs x 20)');
        console.log('══════════════════════════════════════════════════════════════');
        for (let i = 0; i < results.length; i++) {
          const r = results[i];
          if (r.status === 'rejected') {
            const err = formatError(r.reason);
            const orgLabel = allSales[i].organizationId === stressOrgX ? 'ORG_X' : 'ORG_Y';
            console.log(`  [${i}] ${orgLabel} REJECTED: ${err.constructor} — ${err.message} (prismaCode: ${err.prismaCode})`);
          }
        }
        console.log(`  successes: ${successes.length}/${COUNT_PER_ORG * 2}`);
        console.log('══════════════════════════════════════════════════════════════\n');
      }

      expect(successes.length).toBe(COUNT_PER_ORG * 2);

      const dbX = await prisma.invoice.findMany({ where: { organizationId: stressOrgX }, select: { invoiceNumber: true } });
      const dbY = await prisma.invoice.findMany({ where: { organizationId: stressOrgY }, select: { invoiceNumber: true } });

      expect(dbX.length).toBe(COUNT_PER_ORG);
      expect(dbY.length).toBe(COUNT_PER_ORG);

      const numsX = dbX.map((i) => parseInvoiceNumber(i.invoiceNumber)).sort((a, b) => a - b);
      const numsY = dbY.map((i) => parseInvoiceNumber(i.invoiceNumber)).sort((a, b) => a - b);

      for (let i = 0; i < numsX.length; i++) expect(numsX[i]).toBe(i + 1);
      for (let i = 0; i < numsY.length; i++) expect(numsY[i]).toBe(i + 1);

      for (const c of [stressOrgX, stressOrgY, stressUserX, stressUserY, stressCustomerX, stressCustomerY, stressProductX, stressProductY]) {
        await prisma.auditLog.deleteMany({ where: { organizationId: c } });
      }
      await prisma.invoiceItem.deleteMany({ where: { invoice: { organizationId: { in: [stressOrgX, stressOrgY] } } } });
      await prisma.invoice.deleteMany({ where: { organizationId: { in: [stressOrgX, stressOrgY] } } });
      await prisma.salesOrderItem.deleteMany({ where: { salesOrder: { organizationId: { in: [stressOrgX, stressOrgY] } } } });
      await prisma.salesOrder.deleteMany({ where: { organizationId: { in: [stressOrgX, stressOrgY] } } });
      await prisma.product.deleteMany({ where: { id: { in: [stressProductX, stressProductY] } } });
      await prisma.customer.deleteMany({ where: { id: { in: [stressCustomerX, stressCustomerY] } } });
      await prisma.organization.deleteMany({ where: { id: { in: [stressOrgX, stressOrgY] } } });
      await prisma.user.deleteMany({ where: { id: { in: [stressUserX, stressUserY] } } });
    }, 120_000);
  });
});
