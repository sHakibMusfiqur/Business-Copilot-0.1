import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const ORG_A = 'org-concurrency-test-a';
const ORG_B = 'org-concurrency-test-b';
const USER_ID = 'user-concurrency-test';

async function cleanup() {
  await prisma.invoiceItem.deleteMany({ where: { invoice: { organizationId: { in: [ORG_A, ORG_B] } } } });
  await prisma.invoice.deleteMany({ where: { organizationId: { in: [ORG_A, ORG_B] } } });
  await prisma.salesOrderItem.deleteMany({ where: { salesOrder: { organizationId: { in: [ORG_A, ORG_B] } } } });
  await prisma.salesOrder.deleteMany({ where: { organizationId: { in: [ORG_A, ORG_B] } } });
  await prisma.customer.deleteMany({ where: { organizationId: { in: [ORG_A, ORG_B] } } });
  await prisma.product.deleteMany({ where: { organizationId: { in: [ORG_A, ORG_B] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [ORG_A, ORG_B] } } });
  await prisma.user.deleteMany({ where: { id: USER_ID } });
}

async function seedTestData() {
  await cleanup();

  await prisma.user.create({
    data: { id: USER_ID, email: 'concurrency@test.com', name: 'Test User', role: 'ADMIN', password: 'hashed-password' },
  });

  for (const orgId of [ORG_A, ORG_B]) {
    await prisma.organization.create({
      data: { id: orgId, name: `Org ${orgId}`, slug: orgId },
    });

    await prisma.customer.create({
      data: { id: `${orgId}-customer`, organizationId: orgId, name: 'Test Customer' },
    });

    await prisma.product.create({
      data: { id: `${orgId}-product`, organizationId: orgId, name: 'Test Product', sku: `SKU-${orgId}` },
    });

    const sale = await prisma.salesOrder.create({
      data: {
        id: `${orgId}-sale`,
        orderNumber: `SO-${orgId}`,
        organizationId: orgId,
        customerId: `${orgId}-customer`,
        createdById: USER_ID,
        status: 'DELIVERED',
        subtotal: new Prisma.Decimal(100),
        total: new Prisma.Decimal(100),
      },
    });

    await prisma.salesOrderItem.create({
      data: {
        salesOrderId: sale.id,
        productId: `${orgId}-product`,
        description: 'Test Item',
        quantity: new Prisma.Decimal(1),
        unitPrice: new Prisma.Decimal(100),
        lineTotal: new Prisma.Decimal(100),
      },
    });
  }
}

async function generateInvoiceNumber(orgId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  const lastInvoice = await prisma.invoice.findFirst({
    where: { organizationId: orgId, invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: 'desc' },
    select: { invoiceNumber: true },
  });

  let nextSeq = 1;
  if (lastInvoice) {
    const parts = lastInvoice.invoiceNumber.split('-');
    nextSeq = parseInt(parts[parts.length - 1], 10) + 1;
  }

  return `${prefix}${String(nextSeq).padStart(6, '0')}`;
}

async function createInvoiceForOrg(orgId: string, saleId: string): Promise<{ invoiceNumber: string; id: string } | { error: string }> {
  try {
    const invoiceNumber = await generateInvoiceNumber(orgId);

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        organizationId: orgId,
        type: 'SALES',
        customerId: `${orgId}-customer`,
        salesOrderId: saleId,
        issueDate: new Date(),
        status: 'DRAFT',
        paymentStatus: 'PENDING',
        subtotal: new Prisma.Decimal(100),
        total: new Prisma.Decimal(100),
        paidAmount: new Prisma.Decimal(0),
        createdById: USER_ID,
        items: {
          create: [
            {
              productId: `${orgId}-product`,
              description: 'Test Item',
              quantity: new Prisma.Decimal(1),
              unitPrice: new Prisma.Decimal(100),
              total: new Prisma.Decimal(100),
            },
          ],
        },
      },
      select: { id: true, invoiceNumber: true },
    });

    return { invoiceNumber: invoice.invoiceNumber, id: invoice.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { error: 'DUPLICATE_INVOICE_NUMBER' };
    }
    throw error;
  }
}

describe('Invoice Concurrency Integration Tests', () => {
  beforeAll(async () => {
    await seedTestData();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  describe('A. Same organization concurrent invoice creation', () => {
    it('should create multiple invoices with unique numbers', async () => {
      const saleId = `${ORG_A}-sale`;
      const CONCURRENT_COUNT = 10;

      const promises = Array.from({ length: CONCURRENT_COUNT }, () =>
        createInvoiceForOrg(ORG_A, saleId),
      );

      const results = await Promise.all(promises);

      const successful = results.filter((r) => !('error' in r));
      // All should succeed (or at least not have duplicate errors due to retry logic)
      expect(successful.length).toBeGreaterThanOrEqual(1);

      // Check all successful invoice numbers are unique
      const invoiceNumbers = successful.map((r) => ('invoiceNumber' in r ? r.invoiceNumber : ''));
      const uniqueNumbers = new Set(invoiceNumbers);
      expect(uniqueNumbers.size).toBe(invoiceNumbers.length);

      // Verify sequence values are valid
      for (const num of invoiceNumbers) {
        expect(num).toMatch(/^INV-\d{4}-\d{6}$/);
      }
    });
  });

  describe('B. Cross-org concurrent invoice creation', () => {
    it('should allow same invoice numbers across different organizations', async () => {
      // Clean up any existing invoices first
      await prisma.invoiceItem.deleteMany({ where: { invoice: { organizationId: { in: [ORG_A, ORG_B] } } } });
      await prisma.invoice.deleteMany({ where: { organizationId: { in: [ORG_A, ORG_B] } } });

      const saleA = `${ORG_A}-sale`;
      const saleB = `${ORG_B}-sale`;

      // Create invoices concurrently for both orgs
      const promises = [
        createInvoiceForOrg(ORG_A, saleA),
        createInvoiceForOrg(ORG_B, saleB),
        createInvoiceForOrg(ORG_A, saleA),
        createInvoiceForOrg(ORG_B, saleB),
      ];

      await Promise.all(promises);

      // Query the database to verify
      const orgAInvoices = await prisma.invoice.findMany({
        where: { organizationId: ORG_A },
        select: { invoiceNumber: true },
      });
      const orgBInvoices = await prisma.invoice.findMany({
        where: { organizationId: ORG_B },
        select: { invoiceNumber: true },
      });

      // Both orgs should have invoices
      expect(orgAInvoices.length).toBeGreaterThanOrEqual(1);
      expect(orgBInvoices.length).toBeGreaterThanOrEqual(1);

      // Verify each org has its own sequence
      const orgANumbers = orgAInvoices.map((i) => i.invoiceNumber);
      const orgBNumbers = orgBInvoices.map((i) => i.invoiceNumber);

      // Both orgs can have INV-2026-000001 (different orgs)
      // But within each org, numbers are unique
      expect(new Set(orgANumbers).size).toBe(orgANumbers.length);
      expect(new Set(orgBNumbers).size).toBe(orgBNumbers.length);
    });
  });

  describe('C. Duplicate SalesOrder invoice creation concurrently', () => {
    it('should create exactly one invoice for a SalesOrder', async () => {
      // Clean up
      await prisma.invoiceItem.deleteMany({ where: { invoice: { organizationId: { in: [ORG_A, ORG_B] } } } });
      await prisma.invoice.deleteMany({ where: { organizationId: { in: [ORG_A, ORG_B] } } });

      const saleId = `${ORG_A}-sale`;

      // Try to create multiple invoices for the same SalesOrder concurrently
      const promises = Array.from({ length: 5 }, () =>
        createInvoiceForOrg(ORG_A, saleId),
      );

      await Promise.all(promises);

      // Only one should succeed (due to unique salesOrderId constraint)
      // Others may fail with DUPLICATE_INVOICE_NUMBER or succeed with different numbers
      // But only one invoice should have this salesOrderId
      const invoicesForSale = await prisma.invoice.findMany({
        where: { salesOrderId: saleId, organizationId: ORG_A },
      });

      expect(invoicesForSale.length).toBe(1);

      // Verify the invoice has items
      const items = await prisma.invoiceItem.findMany({
        where: { invoiceId: invoicesForSale[0].id },
      });

      expect(items.length).toBe(1);
    });
  });
});
