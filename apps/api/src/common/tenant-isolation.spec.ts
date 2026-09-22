import { NotFoundException } from '@nestjs/common';

import { InvoicesService } from '../invoices/invoices.service';
import { SalesService } from '../sales/sales.service';
import { ProductsService } from '../products/products.service';
import { CustomersService } from '../customers/customers.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { PrismaService } from '../prisma/prisma.service';

const ORG_A = 'org-a';
const ORG_B = 'org-b';

function buildInvoicesService(overrides: Record<string, jest.Mock> = {}) {
  const invoiceFindFirst = overrides.invoiceFindFirst ?? jest.fn().mockResolvedValue(null);
  const invoiceFindMany = overrides.invoiceFindMany ?? jest.fn().mockResolvedValue([]);
  const invoiceCount = overrides.invoiceCount ?? jest.fn().mockResolvedValue(0);

  const service = new InvoicesService(
    {
      invoice: { findFirst: invoiceFindFirst, findMany: invoiceFindMany, count: invoiceCount },
    } as unknown as PrismaService,
    { record: jest.fn() } as never,
    {} as never,
    {
      updateReceivableOverdueStatuses: jest.fn().mockResolvedValue(0),
      updatePayableOverdueStatuses: jest.fn().mockResolvedValue(0),
    } as never,
  );

  return { service, invoiceFindFirst, invoiceFindMany, invoiceCount };
}

function buildSalesService(overrides: Record<string, jest.Mock> = {}) {
  const salesOrderFindFirst = overrides.salesOrderFindFirst ?? jest.fn().mockResolvedValue(null);
  const salesOrderFindMany = overrides.salesOrderFindMany ?? jest.fn().mockResolvedValue([]);
  const salesOrderCount = overrides.salesOrderCount ?? jest.fn().mockResolvedValue(0);

  const service = new SalesService(
    {
      salesOrder: { findFirst: salesOrderFindFirst, findMany: salesOrderFindMany, count: salesOrderCount },
    } as unknown as PrismaService,
    {} as never,
    { record: jest.fn() } as never,
    {} as never,
  );

  return { service, salesOrderFindFirst, salesOrderFindMany, salesOrderCount };
}

function buildProductsService(overrides: Record<string, jest.Mock> = {}) {
  const productFindFirst = overrides.productFindFirst ?? jest.fn().mockResolvedValue(null);
  const productFindMany = overrides.productFindMany ?? jest.fn().mockResolvedValue([]);
  const productCount = overrides.productCount ?? jest.fn().mockResolvedValue(0);

  const service = new ProductsService(
    {
      product: { findFirst: productFindFirst, findMany: productFindMany, count: productCount },
      category: { findFirst: jest.fn() },
      supplier: { findFirst: jest.fn() },
    } as unknown as PrismaService,
    { record: jest.fn() } as never,
  );

  return { service, productFindFirst, productFindMany, productCount };
}

function buildCustomersService(overrides: Record<string, jest.Mock> = {}) {
  const customerFindFirst = overrides.customerFindFirst ?? jest.fn().mockResolvedValue(null);
  const customerFindMany = overrides.customerFindMany ?? jest.fn().mockResolvedValue([]);
  const customerCount = overrides.customerCount ?? jest.fn().mockResolvedValue(0);

  const service = new CustomersService(
    {
      customer: { findFirst: customerFindFirst, findMany: customerFindMany, count: customerCount },
    } as unknown as PrismaService,
    { record: jest.fn() } as never,
  );

  return { service, customerFindFirst, customerFindMany, customerCount };
}

function buildSuppliersService(overrides: Record<string, jest.Mock> = {}) {
  const supplierFindFirst = overrides.supplierFindFirst ?? jest.fn().mockResolvedValue(null);
  const supplierFindMany = overrides.supplierFindMany ?? jest.fn().mockResolvedValue([]);
  const supplierCount = overrides.supplierCount ?? jest.fn().mockResolvedValue(0);

  const service = new SuppliersService(
    {
      supplier: { findFirst: supplierFindFirst, findMany: supplierFindMany, count: supplierCount },
    } as unknown as PrismaService,
    { record: jest.fn() } as never,
  );

  return { service, supplierFindFirst, supplierFindMany, supplierCount };
}

describe('Tenant isolation: cross-organization access rejection', () => {
  afterEach(() => jest.clearAllMocks());

  describe('InvoicesService', () => {
    it('should reject cross-organization invoice access via findById', async () => {
      const { service, invoiceFindFirst } = buildInvoicesService();

      invoiceFindFirst.mockResolvedValue(null);

      await expect(
        service.findById(ORG_A, 'inv-from-org-b'),
      ).rejects.toThrow(NotFoundException);

      expect(invoiceFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: ORG_A }),
        }),
      );
    });

    it('should scope findAll to the caller organization only', async () => {
      const { service, invoiceFindMany, invoiceCount } = buildInvoicesService();
      invoiceCount.mockResolvedValue(0);
      invoiceFindMany.mockResolvedValue([]);

      await service.findAll(ORG_A, {});

      expect(invoiceFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: ORG_A }),
        }),
      );
    });

    it('should not return invoices belonging to a different organization', async () => {
      const { service, invoiceFindFirst } = buildInvoicesService();
      const orgBInvoice = { id: 'inv-b', organizationId: ORG_B };

      invoiceFindFirst.mockImplementation(async (args: { where: Record<string, unknown> }) => {
        if (args.where.organizationId === ORG_B) return orgBInvoice;
        return null;
      });

      await expect(
        service.findById(ORG_A, 'inv-b'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('SalesService', () => {
    it('should reject cross-organization sales access via findById', async () => {
      const { service, salesOrderFindFirst } = buildSalesService();

      salesOrderFindFirst.mockResolvedValue(null);

      await expect(
        service.findById(ORG_A, 'sale-from-org-b'),
      ).rejects.toThrow(NotFoundException);

      expect(salesOrderFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: ORG_A }),
        }),
      );
    });

    it('should scope findAll to the caller organization only', async () => {
      const { service, salesOrderFindMany, salesOrderCount } = buildSalesService();
      salesOrderCount.mockResolvedValue(0);
      salesOrderFindMany.mockResolvedValue([]);

      await service.findAll(ORG_A, {});

      expect(salesOrderFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: ORG_A }),
        }),
      );
    });

    it('should not return sales belonging to a different organization', async () => {
      const { service, salesOrderFindFirst } = buildSalesService();
      const orgBSale = { id: 'sale-b', organizationId: ORG_B };

      salesOrderFindFirst.mockImplementation(async (args: { where: Record<string, unknown> }) => {
        if (args.where.organizationId === ORG_B) return orgBSale;
        return null;
      });

      await expect(
        service.findById(ORG_A, 'sale-b'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('ProductsService', () => {
    it('should reject cross-organization product access via findById', async () => {
      const { service, productFindFirst } = buildProductsService();

      productFindFirst.mockResolvedValue(null);

      await expect(
        service.findById(ORG_A, 'prod-from-org-b'),
      ).rejects.toThrow(NotFoundException);

      expect(productFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: ORG_A }),
        }),
      );
    });

    it('should scope findAll to the caller organization only', async () => {
      const { service, productFindMany, productCount } = buildProductsService();
      productCount.mockResolvedValue(0);
      productFindMany.mockResolvedValue([]);

      await service.findAll(ORG_A, {});

      expect(productFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: ORG_A }),
        }),
      );
    });

    it('should not return products belonging to a different organization', async () => {
      const { service, productFindFirst } = buildProductsService();
      const orgBProduct = { id: 'prod-b', organizationId: ORG_B, inventory: [] };

      productFindFirst.mockImplementation(async (args: { where: Record<string, unknown> }) => {
        if (args.where.organizationId === ORG_B) return orgBProduct;
        return null;
      });

      await expect(
        service.findById(ORG_A, 'prod-b'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('CustomersService', () => {
    it('should reject cross-organization customer access via findById', async () => {
      const { service, customerFindFirst } = buildCustomersService();

      customerFindFirst.mockResolvedValue(null);

      await expect(
        service.findById(ORG_A, 'cust-from-org-b'),
      ).rejects.toThrow(NotFoundException);

      expect(customerFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: ORG_A }),
        }),
      );
    });

    it('should scope findAll to the caller organization only', async () => {
      const { service, customerFindMany, customerCount } = buildCustomersService();
      customerCount.mockResolvedValue(0);
      customerFindMany.mockResolvedValue([]);

      await service.findAll(ORG_A, {});

      expect(customerFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: ORG_A }),
        }),
      );
    });

    it('should not return customers belonging to a different organization', async () => {
      const { service, customerFindFirst } = buildCustomersService();
      const orgBCustomer = { id: 'cust-b', organizationId: ORG_B };

      customerFindFirst.mockImplementation(async (args: { where: Record<string, unknown> }) => {
        if (args.where.organizationId === ORG_B) return orgBCustomer;
        return null;
      });

      await expect(
        service.findById(ORG_A, 'cust-b'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('SuppliersService', () => {
    it('should reject cross-organization supplier access via findById', async () => {
      const { service, supplierFindFirst } = buildSuppliersService();

      supplierFindFirst.mockResolvedValue(null);

      await expect(
        service.findById(ORG_A, 'supp-from-org-b'),
      ).rejects.toThrow(NotFoundException);

      expect(supplierFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: ORG_A }),
        }),
      );
    });

    it('should scope findAll to the caller organization only', async () => {
      const { service, supplierFindMany, supplierCount } = buildSuppliersService();
      supplierCount.mockResolvedValue(0);
      supplierFindMany.mockResolvedValue([]);

      await service.findAll(ORG_A, {});

      expect(supplierFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: ORG_A }),
        }),
      );
    });

    it('should not return suppliers belonging to a different organization', async () => {
      const { service, supplierFindFirst } = buildSuppliersService();
      const orgBSupplier = { id: 'supp-b', organizationId: ORG_B };

      supplierFindFirst.mockImplementation(async (args: { where: Record<string, unknown> }) => {
        if (args.where.organizationId === ORG_B) return orgBSupplier;
        return null;
      });

      await expect(
        service.findById(ORG_A, 'supp-b'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
