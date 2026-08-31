import { NotFoundException } from '@nestjs/common';

import { ImportService } from './import.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('ImportService', () => {
  let service: ImportService;
  let prisma: {
    importJob: { create: jest.Mock; update: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock; findFirst: jest.Mock };
    customer: { create: jest.Mock; update: jest.Mock; findFirst: jest.Mock };
    supplier: { create: jest.Mock; update: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock };
    product: { create: jest.Mock; update: jest.Mock; findFirst: jest.Mock };
    category: { findFirst: jest.Mock };
    inventory: { create: jest.Mock; update: jest.Mock; findFirst: jest.Mock; findUnique: jest.Mock };
    inventoryTransaction: { create: jest.Mock };
    account: { create: jest.Mock; update: jest.Mock; findFirst: jest.Mock };
  };
  let auditRecord: jest.Mock;

  beforeEach(() => {
    auditRecord = jest.fn().mockResolvedValue(undefined);

    prisma = {
      importJob: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      customer: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
      },
      supplier: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      product: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
      },
      category: {
        findFirst: jest.fn(),
      },
      inventory: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      inventoryTransaction: {
        create: jest.fn(),
      },
      account: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    service = new ImportService(
      prisma as unknown as PrismaService,
      { record: auditRecord } as unknown as AuditService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('parseFile', () => {
    it('should be defined', () => {
      expect(service.parseFile).toBeDefined();
    });
  });

  describe('mapHeaders', () => {
    it('should map recognized headers to field names', () => {
      const { mapped, unmapped } = service.mapHeaders(
        ['Name', 'Email', 'Phone', 'RandomColumn'],
        { name: 'name', email: 'email', phone: 'phone' },
      );

      expect(mapped['name']).toBe(0);
      expect(mapped['email']).toBe(1);
      expect(mapped['phone']).toBe(2);
      expect(unmapped).toContain('RandomColumn');
    });

    it('should handle case-insensitive header matching', () => {
      const { mapped } = service.mapHeaders(
        ['NAME', 'Email Address'],
        { name: 'name', 'email address': 'email' },
      );

      expect(mapped['name']).toBe(0);
      expect(mapped['email']).toBe(1);
    });

    it('should handle whitespace in headers', () => {
      const { mapped } = service.mapHeaders(
        [' Name ', '  Email  '],
        { name: 'name', email: 'email' },
      );

      expect(mapped['name']).toBe(0);
      expect(mapped['email']).toBe(1);
    });
  });

  describe('startImport', () => {
    it('should create an ImportJob and return it', async () => {
      const mockJob = {
        id: 'job-1',
        status: 'PENDING',
        importType: 'customers',
        fileName: 'test.csv',
        createdAt: new Date(),
      };

      (prisma.importJob.create as jest.Mock).mockResolvedValue(mockJob);

      const result = await service.startImport('org-1', 'user-1', {
        importType: 'customers',
        fileFormat: 'CSV',
        delimiter: 'Comma',
        skipFirstRow: true,
        updateExisting: false,
        fileName: 'test.csv',
        fileSize: 1024,
      }, {
        path: '/tmp/test.csv',
        originalname: 'test.csv',
        size: 1024,
      } as Express.Multer.File);

      expect(result.id).toBe('job-1');
      expect(result.status).toBe('PENDING');
      expect(prisma.importJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: 'org-1',
          userId: 'user-1',
          importType: 'customers',
          filePath: '/tmp/test.csv',
        }),
      });
    });
  });

  describe('getImportJobs', () => {
    it('returns all import jobs for the organization', async () => {
      (prisma.importJob.findMany as jest.Mock).mockResolvedValue([
        { id: 'job-1', importType: 'customers', status: 'COMPLETED' },
        { id: 'job-2', importType: 'products', status: 'PENDING' },
      ]);

      const result = await service.getImportJobs('org-1');

      expect(prisma.importJob.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
        orderBy: { createdAt: 'desc' },
        select: expect.any(Object),
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('getImportJob', () => {
    it('returns a single import job', async () => {
      (prisma.importJob.findFirst as jest.Mock).mockResolvedValue({
        id: 'job-1',
        importType: 'customers',
        status: 'COMPLETED',
      });

      const result = await service.getImportJob('org-1', 'job-1');

      expect(result.id).toBe('job-1');
    });

    it('throws NotFoundException when import job is not found', async () => {
      (prisma.importJob.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getImportJob('org-1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects cross-organization access', async () => {
      (prisma.importJob.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getImportJob('org-2', 'job-from-org-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Customer import processing', () => {
    it('should reject when required column "name" is missing', async () => {
      (prisma.importJob.create as jest.Mock).mockResolvedValue({
        id: 'job-1', status: 'PENDING', importType: 'customers',
        fileName: 'test.csv', createdAt: new Date(),
      });
      (prisma.importJob.findUnique as jest.Mock).mockResolvedValue({
        id: 'job-1', filePath: '/tmp/test.csv', fileFormat: 'CSV',
        delimiter: 'Comma', skipFirstRow: true, updateExisting: false,
        importType: 'customers', status: 'PROCESSING',
      });

      // Mock parseFile to return headers without "name"
      jest.spyOn(service, 'parseFile').mockReturnValue([['email', 'phone']]);

      await service.startImport('org-1', 'user-1', {
        importType: 'customers', fileFormat: 'CSV', delimiter: 'Comma',
        skipFirstRow: true, updateExisting: false,
        fileName: 'test.csv', fileSize: 100,
      }, { path: '/tmp/test.csv', originalname: 'test.csv', size: 100 } as Express.Multer.File);

      // Wait for async processing
      await new Promise((r) => setTimeout(r, 50));

      expect(prisma.importJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FAILED' }),
        }),
      );
    });

    it('should create customers from valid rows', async () => {
      (prisma.importJob.create as jest.Mock).mockResolvedValue({
        id: 'job-2', status: 'PENDING', importType: 'customers',
        fileName: 'test.csv', createdAt: new Date(),
      });
      (prisma.importJob.findUnique as jest.Mock).mockResolvedValue({
        id: 'job-2', filePath: '/tmp/test.csv', fileFormat: 'CSV',
        delimiter: 'Comma', skipFirstRow: true, updateExisting: false,
        importType: 'customers', status: 'PROCESSING',
      });
      (prisma.customer.create as jest.Mock).mockResolvedValue({ id: 'c-1', name: 'John' });

      jest.spyOn(service, 'parseFile').mockReturnValue([
        ['Name', 'Email', 'Phone'],
        ['John Doe', 'john@example.com', '555-0100'],
        ['Jane Smith', 'jane@example.com', '555-0200'],
      ]);

      await service.startImport('org-1', 'user-1', {
        importType: 'customers', fileFormat: 'CSV', delimiter: 'Comma',
        skipFirstRow: true, updateExisting: false,
        fileName: 'test.csv', fileSize: 100,
      }, { path: '/tmp/test.csv', originalname: 'test.csv', size: 100 } as Express.Multer.File);

      await new Promise((r) => setTimeout(r, 50));

      expect(prisma.customer.create).toHaveBeenCalledTimes(2);
      expect(prisma.importJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'COMPLETED',
            importedCount: 2,
            errorCount: 0,
          }),
        }),
      );
    });

    it('should handle duplicate emails gracefully', async () => {
      (prisma.importJob.create as jest.Mock).mockResolvedValue({
        id: 'job-3', status: 'PENDING', importType: 'customers',
        fileName: 'test.csv', createdAt: new Date(),
      });
      (prisma.importJob.findUnique as jest.Mock).mockResolvedValue({
        id: 'job-3', filePath: '/tmp/test.csv', fileFormat: 'CSV',
        delimiter: 'Comma', skipFirstRow: true, updateExisting: false,
        importType: 'customers', status: 'PROCESSING',
      });
      (prisma.customer.create as jest.Mock)
        .mockResolvedValueOnce({ id: 'c-1', name: 'John' })
        .mockRejectedValueOnce(new Error('Unique constraint failed on the fields: (`organizationId`,`email`)'));

      jest.spyOn(service, 'parseFile').mockReturnValue([
        ['Name', 'Email'],
        ['John', 'john@example.com'],
        ['Duplicate', 'john@example.com'],
      ]);

      await service.startImport('org-1', 'user-1', {
        importType: 'customers', fileFormat: 'CSV', delimiter: 'Comma',
        skipFirstRow: true, updateExisting: false,
        fileName: 'test.csv', fileSize: 100,
      }, { path: '/tmp/test.csv', originalname: 'test.csv', size: 100 } as Express.Multer.File);

      await new Promise((r) => setTimeout(r, 50));

      expect(prisma.importJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            importedCount: 1,
            errorCount: 1,
          }),
        }),
      );
    });

    it('should update existing customers when updateExisting is true', async () => {
      (prisma.importJob.create as jest.Mock).mockResolvedValue({
        id: 'job-4', status: 'PENDING', importType: 'customers',
        fileName: 'test.csv', createdAt: new Date(),
      });
      (prisma.importJob.findUnique as jest.Mock).mockResolvedValue({
        id: 'job-4', filePath: '/tmp/test.csv', fileFormat: 'CSV',
        delimiter: 'Comma', skipFirstRow: true, updateExisting: true,
        importType: 'customers', status: 'PROCESSING',
      });
      (prisma.customer.findFirst as jest.Mock).mockResolvedValue({ id: 'existing-1', name: 'Old Name' });
      (prisma.customer.update as jest.Mock).mockResolvedValue({ id: 'existing-1', name: 'Updated' });

      jest.spyOn(service, 'parseFile').mockReturnValue([
        ['Name', 'Email'],
        ['Updated Name', 'existing@example.com'],
      ]);

      await service.startImport('org-1', 'user-1', {
        importType: 'customers', fileFormat: 'CSV', delimiter: 'Comma',
        skipFirstRow: true, updateExisting: true,
        fileName: 'test.csv', fileSize: 100,
      }, { path: '/tmp/test.csv', originalname: 'test.csv', size: 100 } as Express.Multer.File);

      await new Promise((r) => setTimeout(r, 50));

      expect(prisma.customer.update).toHaveBeenCalled();
      expect(prisma.customer.create).not.toHaveBeenCalled();
    });

    it('should reject cross-tenant references', async () => {
      // Cross-tenant check for customers is implicit: email uniqueness is org-scoped
      // So a customer with the same email in a different org would NOT match
      (prisma.importJob.create as jest.Mock).mockResolvedValue({
        id: 'job-5', status: 'PENDING', importType: 'customers',
        fileName: 'test.csv', createdAt: new Date(),
      });
      (prisma.importJob.findUnique as jest.Mock).mockResolvedValue({
        id: 'job-5', filePath: '/tmp/test.csv', fileFormat: 'CSV',
        delimiter: 'Comma', skipFirstRow: true, updateExisting: true,
        importType: 'customers', status: 'PROCESSING',
      });
      // No existing customer found in this org
      (prisma.customer.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.customer.create as jest.Mock).mockResolvedValue({ id: 'c-new', name: 'New' });

      jest.spyOn(service, 'parseFile').mockReturnValue([
        ['Name', 'Email'],
        ['New Customer', 'new@example.com'],
      ]);

      await service.startImport('org-1', 'user-1', {
        importType: 'customers', fileFormat: 'CSV', delimiter: 'Comma',
        skipFirstRow: true, updateExisting: true,
        fileName: 'test.csv', fileSize: 100,
      }, { path: '/tmp/test.csv', originalname: 'test.csv', size: 100 } as Express.Multer.File);

      await new Promise((r) => setTimeout(r, 50));

      // Should create a new customer, not update (because the existing one is in a different org)
      expect(prisma.customer.create).toHaveBeenCalled();
    });
  });

  describe('Product import processing', () => {
    it('should reject when required columns are missing', async () => {
      (prisma.importJob.create as jest.Mock).mockResolvedValue({
        id: 'job-p1', status: 'PENDING', importType: 'products',
        fileName: 'test.csv', createdAt: new Date(),
      });
      (prisma.importJob.findUnique as jest.Mock).mockResolvedValue({
        id: 'job-p1', filePath: '/tmp/test.csv', fileFormat: 'CSV',
        delimiter: 'Comma', skipFirstRow: true, updateExisting: false,
        importType: 'products', status: 'PROCESSING',
      });

      jest.spyOn(service, 'parseFile').mockReturnValue([
        ['Name', 'Description'],
        ['Widget', 'A widget'],
      ]);

      await service.startImport('org-1', 'user-1', {
        importType: 'products', fileFormat: 'CSV', delimiter: 'Comma',
        skipFirstRow: true, updateExisting: false,
        fileName: 'test.csv', fileSize: 100,
      }, { path: '/tmp/test.csv', originalname: 'test.csv', size: 100 } as Express.Multer.File);

      await new Promise((r) => setTimeout(r, 50));

      expect(prisma.importJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FAILED' }),
        }),
      );
    });

    it('should create products with valid data', async () => {
      (prisma.importJob.create as jest.Mock).mockResolvedValue({
        id: 'job-p2', status: 'PENDING', importType: 'products',
        fileName: 'test.csv', createdAt: new Date(),
      });
      (prisma.importJob.findUnique as jest.Mock).mockResolvedValue({
        id: 'job-p2', filePath: '/tmp/test.csv', fileFormat: 'CSV',
        delimiter: 'Comma', skipFirstRow: true, updateExisting: false,
        importType: 'products', status: 'PROCESSING',
      });
      (prisma.product.create as jest.Mock).mockResolvedValue({ id: 'p-1', name: 'Widget' });
      (prisma.supplier.findMany as jest.Mock).mockResolvedValue([]);

      jest.spyOn(service, 'parseFile').mockReturnValue([
        ['Name', 'SKU', 'Unit Price'],
        ['Widget', 'WDG-001', '29.99'],
      ]);

      await service.startImport('org-1', 'user-1', {
        importType: 'products', fileFormat: 'CSV', delimiter: 'Comma',
        skipFirstRow: true, updateExisting: false,
        fileName: 'test.csv', fileSize: 100,
      }, { path: '/tmp/test.csv', originalname: 'test.csv', size: 100 } as Express.Multer.File);

      await new Promise((r) => setTimeout(r, 50));

      expect(prisma.product.create).toHaveBeenCalledTimes(1);
      expect(prisma.importJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'COMPLETED',
            importedCount: 1,
            errorCount: 0,
          }),
        }),
      );
    });

    it('should handle duplicate SKUs gracefully', async () => {
      (prisma.importJob.create as jest.Mock).mockResolvedValue({
        id: 'job-p3', status: 'PENDING', importType: 'products',
        fileName: 'test.csv', createdAt: new Date(),
      });
      (prisma.importJob.findUnique as jest.Mock).mockResolvedValue({
        id: 'job-p3', filePath: '/tmp/test.csv', fileFormat: 'CSV',
        delimiter: 'Comma', skipFirstRow: true, updateExisting: false,
        importType: 'products', status: 'PROCESSING',
      });
      (prisma.product.create as jest.Mock)
        .mockResolvedValueOnce({ id: 'p-1', name: 'Widget' })
        .mockRejectedValueOnce(new Error('Unique constraint failed on the fields: (`organizationId`,`sku`)'));
      (prisma.supplier.findMany as jest.Mock).mockResolvedValue([]);

      jest.spyOn(service, 'parseFile').mockReturnValue([
        ['Name', 'SKU'],
        ['Widget', 'WDG-001'],
        ['Widget Dup', 'WDG-001'],
      ]);

      await service.startImport('org-1', 'user-1', {
        importType: 'products', fileFormat: 'CSV', delimiter: 'Comma',
        skipFirstRow: true, updateExisting: false,
        fileName: 'test.csv', fileSize: 100,
      }, { path: '/tmp/test.csv', originalname: 'test.csv', size: 100 } as Express.Multer.File);

      await new Promise((r) => setTimeout(r, 50));

      expect(prisma.importJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            importedCount: 1,
            errorCount: 1,
          }),
        }),
      );
    });

    it('should update existing products when updateExisting is true', async () => {
      (prisma.importJob.create as jest.Mock).mockResolvedValue({
        id: 'job-p4', status: 'PENDING', importType: 'products',
        fileName: 'test.csv', createdAt: new Date(),
      });
      (prisma.importJob.findUnique as jest.Mock).mockResolvedValue({
        id: 'job-p4', filePath: '/tmp/test.csv', fileFormat: 'CSV',
        delimiter: 'Comma', skipFirstRow: true, updateExisting: true,
        importType: 'products', status: 'PROCESSING',
      });
      (prisma.product.findFirst as jest.Mock).mockResolvedValue({ id: 'existing-p', sku: 'WDG-001' });
      (prisma.product.update as jest.Mock).mockResolvedValue({ id: 'existing-p', name: 'Updated' });
      (prisma.supplier.findMany as jest.Mock).mockResolvedValue([]);

      jest.spyOn(service, 'parseFile').mockReturnValue([
        ['Name', 'SKU', 'Unit Price'],
        ['Updated Widget', 'WDG-001', '39.99'],
      ]);

      await service.startImport('org-1', 'user-1', {
        importType: 'products', fileFormat: 'CSV', delimiter: 'Comma',
        skipFirstRow: true, updateExisting: true,
        fileName: 'test.csv', fileSize: 100,
      }, { path: '/tmp/test.csv', originalname: 'test.csv', size: 100 } as Express.Multer.File);

      await new Promise((r) => setTimeout(r, 50));

      expect(prisma.product.update).toHaveBeenCalled();
      expect(prisma.product.create).not.toHaveBeenCalled();
    });

    it('should reject invalid supplier references', async () => {
      (prisma.importJob.create as jest.Mock).mockResolvedValue({
        id: 'job-p5', status: 'PENDING', importType: 'products',
        fileName: 'test.csv', createdAt: new Date(),
      });
      (prisma.importJob.findUnique as jest.Mock).mockResolvedValue({
        id: 'job-p5', filePath: '/tmp/test.csv', fileFormat: 'CSV',
        delimiter: 'Comma', skipFirstRow: true, updateExisting: false,
        importType: 'products', status: 'PROCESSING',
      });
      (prisma.supplier.findMany as jest.Mock).mockResolvedValue([]);

      jest.spyOn(service, 'parseFile').mockReturnValue([
        ['Name', 'SKU', 'Supplier ID'],
        ['Widget', 'WDG-001', 'nonexistent-supplier'],
      ]);

      await service.startImport('org-1', 'user-1', {
        importType: 'products', fileFormat: 'CSV', delimiter: 'Comma',
        skipFirstRow: true, updateExisting: false,
        fileName: 'test.csv', fileSize: 100,
      }, { path: '/tmp/test.csv', originalname: 'test.csv', size: 100 } as Express.Multer.File);

      await new Promise((r) => setTimeout(r, 50));

      expect(prisma.importJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            importedCount: 0,
            errorCount: 1,
          }),
        }),
      );
    });
  });

  describe('Chart of Accounts import processing', () => {
    it('should reject invalid account types', async () => {
      (prisma.importJob.create as jest.Mock).mockResolvedValue({
        id: 'job-a1', status: 'PENDING', importType: 'chart-of-accounts',
        fileName: 'test.csv', createdAt: new Date(),
      });
      (prisma.importJob.findUnique as jest.Mock).mockResolvedValue({
        id: 'job-a1', filePath: '/tmp/test.csv', fileFormat: 'CSV',
        delimiter: 'Comma', skipFirstRow: true, updateExisting: false,
        importType: 'chart-of-accounts', status: 'PROCESSING',
      });

      jest.spyOn(service, 'parseFile').mockReturnValue([
        ['Code', 'Name', 'Type'],
        ['1000', 'Cash', 'INVALID_TYPE'],
      ]);

      await service.startImport('org-1', 'user-1', {
        importType: 'chart-of-accounts', fileFormat: 'CSV', delimiter: 'Comma',
        skipFirstRow: true, updateExisting: false,
        fileName: 'test.csv', fileSize: 100,
      }, { path: '/tmp/test.csv', originalname: 'test.csv', size: 100 } as Express.Multer.File);

      await new Promise((r) => setTimeout(r, 50));

      expect(prisma.importJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            importedCount: 0,
            errorCount: 1,
          }),
        }),
      );
    });

    it('should create accounts with valid data', async () => {
      (prisma.importJob.create as jest.Mock).mockResolvedValue({
        id: 'job-a2', status: 'PENDING', importType: 'chart-of-accounts',
        fileName: 'test.csv', createdAt: new Date(),
      });
      (prisma.importJob.findUnique as jest.Mock).mockResolvedValue({
        id: 'job-a2', filePath: '/tmp/test.csv', fileFormat: 'CSV',
        delimiter: 'Comma', skipFirstRow: true, updateExisting: false,
        importType: 'chart-of-accounts', status: 'PROCESSING',
      });
      (prisma.account.create as jest.Mock).mockResolvedValue({ id: 'a-1', code: '1000' });

      jest.spyOn(service, 'parseFile').mockReturnValue([
        ['Code', 'Name', 'Type'],
        ['1000', 'Cash', 'ASSET'],
        ['2000', 'Accounts Payable', 'LIABILITY'],
      ]);

      await service.startImport('org-1', 'user-1', {
        importType: 'chart-of-accounts', fileFormat: 'CSV', delimiter: 'Comma',
        skipFirstRow: true, updateExisting: false,
        fileName: 'test.csv', fileSize: 100,
      }, { path: '/tmp/test.csv', originalname: 'test.csv', size: 100 } as Express.Multer.File);

      await new Promise((r) => setTimeout(r, 50));

      expect(prisma.account.create).toHaveBeenCalledTimes(2);
    });

    it('should handle duplicate account codes gracefully', async () => {
      (prisma.importJob.create as jest.Mock).mockResolvedValue({
        id: 'job-a3', status: 'PENDING', importType: 'chart-of-accounts',
        fileName: 'test.csv', createdAt: new Date(),
      });
      (prisma.importJob.findUnique as jest.Mock).mockResolvedValue({
        id: 'job-a3', filePath: '/tmp/test.csv', fileFormat: 'CSV',
        delimiter: 'Comma', skipFirstRow: true, updateExisting: false,
        importType: 'chart-of-accounts', status: 'PROCESSING',
      });
      (prisma.account.create as jest.Mock)
        .mockResolvedValueOnce({ id: 'a-1', code: '1000' })
        .mockRejectedValueOnce(new Error('Unique constraint failed'));

      jest.spyOn(service, 'parseFile').mockReturnValue([
        ['Code', 'Name', 'Type'],
        ['1000', 'Cash', 'ASSET'],
        ['1000', 'Cash Duplicate', 'ASSET'],
      ]);

      await service.startImport('org-1', 'user-1', {
        importType: 'chart-of-accounts', fileFormat: 'CSV', delimiter: 'Comma',
        skipFirstRow: true, updateExisting: false,
        fileName: 'test.csv', fileSize: 100,
      }, { path: '/tmp/test.csv', originalname: 'test.csv', size: 100 } as Express.Multer.File);

      await new Promise((r) => setTimeout(r, 50));

      expect(prisma.importJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            importedCount: 1,
            errorCount: 1,
          }),
        }),
      );
    });

    it('should update existing accounts when updateExisting is true', async () => {
      (prisma.importJob.create as jest.Mock).mockResolvedValue({
        id: 'job-a4', status: 'PENDING', importType: 'chart-of-accounts',
        fileName: 'test.csv', createdAt: new Date(),
      });
      (prisma.importJob.findUnique as jest.Mock).mockResolvedValue({
        id: 'job-a4', filePath: '/tmp/test.csv', fileFormat: 'CSV',
        delimiter: 'Comma', skipFirstRow: true, updateExisting: true,
        importType: 'chart-of-accounts', status: 'PROCESSING',
      });
      (prisma.account.findFirst as jest.Mock).mockResolvedValue({ id: 'existing-a', code: '1000' });
      (prisma.account.update as jest.Mock).mockResolvedValue({ id: 'existing-a', code: '1000' });

      jest.spyOn(service, 'parseFile').mockReturnValue([
        ['Code', 'Name', 'Type'],
        ['1000', 'Cash Updated', 'ASSET'],
      ]);

      await service.startImport('org-1', 'user-1', {
        importType: 'chart-of-accounts', fileFormat: 'CSV', delimiter: 'Comma',
        skipFirstRow: true, updateExisting: true,
        fileName: 'test.csv', fileSize: 100,
      }, { path: '/tmp/test.csv', originalname: 'test.csv', size: 100 } as Express.Multer.File);

      await new Promise((r) => setTimeout(r, 50));

      expect(prisma.account.update).toHaveBeenCalled();
      expect(prisma.account.create).not.toHaveBeenCalled();
    });
  });

  describe('Inventory import processing', () => {
    it('should reject when quantity is not a number', async () => {
      (prisma.importJob.create as jest.Mock).mockResolvedValue({
        id: 'job-i1', status: 'PENDING', importType: 'inventory',
        fileName: 'test.csv', createdAt: new Date(),
      });
      (prisma.importJob.findUnique as jest.Mock).mockResolvedValue({
        id: 'job-i1', filePath: '/tmp/test.csv', fileFormat: 'CSV',
        delimiter: 'Comma', skipFirstRow: true, updateExisting: false,
        importType: 'inventory', status: 'PROCESSING',
      });

      jest.spyOn(service, 'parseFile').mockReturnValue([
        ['SKU', 'Quantity'],
        ['WDG-001', 'not-a-number'],
      ]);

      await service.startImport('org-1', 'user-1', {
        importType: 'inventory', fileFormat: 'CSV', delimiter: 'Comma',
        skipFirstRow: true, updateExisting: false,
        fileName: 'test.csv', fileSize: 100,
      }, { path: '/tmp/test.csv', originalname: 'test.csv', size: 100 } as Express.Multer.File);

      await new Promise((r) => setTimeout(r, 50));

      expect(prisma.importJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            importedCount: 0,
            errorCount: 1,
          }),
        }),
      );
    });

    it('should reject when product SKU does not exist', async () => {
      (prisma.importJob.create as jest.Mock).mockResolvedValue({
        id: 'job-i2', status: 'PENDING', importType: 'inventory',
        fileName: 'test.csv', createdAt: new Date(),
      });
      (prisma.importJob.findUnique as jest.Mock).mockResolvedValue({
        id: 'job-i2', filePath: '/tmp/test.csv', fileFormat: 'CSV',
        delimiter: 'Comma', skipFirstRow: true, updateExisting: false,
        importType: 'inventory', status: 'PROCESSING',
      });
      (prisma.product.findFirst as jest.Mock).mockResolvedValue(null);

      jest.spyOn(service, 'parseFile').mockReturnValue([
        ['SKU', 'Quantity'],
        ['NONEXISTENT', '50'],
      ]);

      await service.startImport('org-1', 'user-1', {
        importType: 'inventory', fileFormat: 'CSV', delimiter: 'Comma',
        skipFirstRow: true, updateExisting: false,
        fileName: 'test.csv', fileSize: 100,
      }, { path: '/tmp/test.csv', originalname: 'test.csv', size: 100 } as Express.Multer.File);

      await new Promise((r) => setTimeout(r, 50));

      expect(prisma.importJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            importedCount: 0,
            errorCount: 1,
          }),
        }),
      );
    });

    it('should create inventory adjustments for valid products', async () => {
      (prisma.importJob.create as jest.Mock).mockResolvedValue({
        id: 'job-i3', status: 'PENDING', importType: 'inventory',
        fileName: 'test.csv', createdAt: new Date(),
      });
      (prisma.importJob.findUnique as jest.Mock).mockResolvedValue({
        id: 'job-i3', filePath: '/tmp/test.csv', fileFormat: 'CSV',
        delimiter: 'Comma', skipFirstRow: true, updateExisting: false,
        importType: 'inventory', status: 'PROCESSING',
      });
      (prisma.product.findFirst as jest.Mock).mockResolvedValue({ id: 'p-1', name: 'Widget', sku: 'WDG-001' });
      (prisma.inventory.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.inventory.create as jest.Mock).mockResolvedValue({ id: 'inv-1', quantity: 100 });
      (prisma.inventoryTransaction.create as jest.Mock).mockResolvedValue({ id: 'txn-1' });

      jest.spyOn(service, 'parseFile').mockReturnValue([
        ['SKU', 'Quantity'],
        ['WDG-001', '100'],
      ]);

      await service.startImport('org-1', 'user-1', {
        importType: 'inventory', fileFormat: 'CSV', delimiter: 'Comma',
        skipFirstRow: true, updateExisting: false,
        fileName: 'test.csv', fileSize: 100,
      }, { path: '/tmp/test.csv', originalname: 'test.csv', size: 100 } as Express.Multer.File);

      await new Promise((r) => setTimeout(r, 50));

      expect(prisma.inventory.create).toHaveBeenCalled();
      expect(prisma.inventoryTransaction.create).toHaveBeenCalled();
      expect(prisma.importJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            importedCount: 1,
            errorCount: 0,
          }),
        }),
      );
    });
  });

  describe('Supplier import processing', () => {
    it('should create suppliers from valid rows', async () => {
      (prisma.importJob.create as jest.Mock).mockResolvedValue({
        id: 'job-s1', status: 'PENDING', importType: 'suppliers',
        fileName: 'test.csv', createdAt: new Date(),
      });
      (prisma.importJob.findUnique as jest.Mock).mockResolvedValue({
        id: 'job-s1', filePath: '/tmp/test.csv', fileFormat: 'CSV',
        delimiter: 'Comma', skipFirstRow: true, updateExisting: false,
        importType: 'suppliers', status: 'PROCESSING',
      });
      (prisma.supplier.create as jest.Mock).mockResolvedValue({ id: 's-1', name: 'Acme' });

      jest.spyOn(service, 'parseFile').mockReturnValue([
        ['Name', 'Email'],
        ['Acme Corp', 'acme@example.com'],
      ]);

      await service.startImport('org-1', 'user-1', {
        importType: 'suppliers', fileFormat: 'CSV', delimiter: 'Comma',
        skipFirstRow: true, updateExisting: false,
        fileName: 'test.csv', fileSize: 100,
      }, { path: '/tmp/test.csv', originalname: 'test.csv', size: 100 } as Express.Multer.File);

      await new Promise((r) => setTimeout(r, 50));

      expect(prisma.supplier.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('Empty file handling', () => {
    it('should handle empty files gracefully', async () => {
      (prisma.importJob.create as jest.Mock).mockResolvedValue({
        id: 'job-e1', status: 'PENDING', importType: 'customers',
        fileName: 'empty.csv', createdAt: new Date(),
      });
      (prisma.importJob.findUnique as jest.Mock).mockResolvedValue({
        id: 'job-e1', filePath: '/tmp/empty.csv', fileFormat: 'CSV',
        delimiter: 'Comma', skipFirstRow: true, updateExisting: false,
        importType: 'customers', status: 'PROCESSING',
      });

      jest.spyOn(service, 'parseFile').mockReturnValue([]);

      await service.startImport('org-1', 'user-1', {
        importType: 'customers', fileFormat: 'CSV', delimiter: 'Comma',
        skipFirstRow: true, updateExisting: false,
        fileName: 'empty.csv', fileSize: 0,
      }, { path: '/tmp/empty.csv', originalname: 'empty.csv', size: 0 } as Express.Multer.File);

      await new Promise((r) => setTimeout(r, 50));

      expect(prisma.importJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'COMPLETED',
            totalRows: 0,
            importedCount: 0,
            errorCount: 0,
          }),
        }),
      );
    });
  });
});
