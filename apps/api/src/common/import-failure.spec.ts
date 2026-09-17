import { ImportService } from '../import/import.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

function createPrisma() {
  return {
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
      findMany: jest.fn(),
    },
    category: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    inventory: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    inventoryTransaction: {
      create: jest.fn(),
    },
    account: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  };
}

function createAudit() {
  return { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;
}

function lastJobUpdateData(prisma: ReturnType<typeof createPrisma>): Record<string, unknown> | null {
  const calls = (prisma.importJob.update as jest.Mock).mock.calls;
  if (calls.length === 0) return null;
  return calls[calls.length - 1][0].data as Record<string, unknown>;
}

describe('Import Failure Tests', () => {
  describe('A. Malformed CSV — invalid file format should fail gracefully', () => {
    it('should mark import job as FAILED when parseFile throws on malformed data', async () => {
      const prisma = createPrisma();
      const service = new ImportService(
        prisma as unknown as PrismaService,
        createAudit(),
      );

      (prisma.importJob.create as jest.Mock).mockResolvedValue({
        id: 'job-malformed', status: 'PENDING', importType: 'customers',
        fileName: 'bad.csv', createdAt: new Date(),
      });
      (prisma.importJob.findUnique as jest.Mock).mockResolvedValue({
        id: 'job-malformed', filePath: '/tmp/bad.csv', fileFormat: 'CSV',
        delimiter: 'Comma', skipFirstRow: true, updateExisting: false,
        importType: 'customers', status: 'PROCESSING',
      });

      jest.spyOn(service, 'parseFile').mockImplementation(() => {
        throw new Error('File contains no sheets');
      });

      await service.startImport('org-1', 'user-1', {
        importType: 'customers', fileFormat: 'CSV', delimiter: 'Comma',
        skipFirstRow: true, updateExisting: false,
        fileName: 'bad.csv', fileSize: 100,
      }, { path: '/tmp/bad.csv', originalname: 'bad.csv', size: 100 } as Express.Multer.File);

      await new Promise((r) => setTimeout(r, 50));

      const data = lastJobUpdateData(prisma);
      expect(data).not.toBeNull();
      expect(data?.status).toBe('FAILED');
      expect(data?.completedAt).toBeDefined();
      expect(data?.errors).toBeDefined();
    });

    it('should record the error message in the job errors field', async () => {
      const prisma = createPrisma();
      const service = new ImportService(
        prisma as unknown as PrismaService,
        createAudit(),
      );

      (prisma.importJob.create as jest.Mock).mockResolvedValue({
        id: 'job-malformed-2', status: 'PENDING', importType: 'products',
        fileName: 'bad.xlsx', createdAt: new Date(),
      });
      (prisma.importJob.findUnique as jest.Mock).mockResolvedValue({
        id: 'job-malformed-2', filePath: '/tmp/bad.xlsx', fileFormat: 'CSV',
        delimiter: 'Comma', skipFirstRow: true, updateExisting: false,
        importType: 'products', status: 'PROCESSING',
      });

      jest.spyOn(service, 'parseFile').mockImplementation(() => {
        throw new Error('Corrupted file content');
      });

      await service.startImport('org-1', 'user-1', {
        importType: 'products', fileFormat: 'CSV', delimiter: 'Comma',
        skipFirstRow: true, updateExisting: false,
        fileName: 'bad.xlsx', fileSize: 500,
      }, { path: '/tmp/bad.xlsx', originalname: 'bad.xlsx', size: 500 } as Express.Multer.File);

      await new Promise((r) => setTimeout(r, 50));

      const data = lastJobUpdateData(prisma);
      expect(data).not.toBeNull();
      const errors = data?.errors as Array<{ row: number; message: string }>;
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('Corrupted file content');
      expect(errors[0].row).toBe(0);
    });
  });

  describe('B. Duplicate data — duplicate unique fields should handle conflicts', () => {
    it('should report errors for duplicate emails without crashing', async () => {
      const prisma = createPrisma();
      const service = new ImportService(
        prisma as unknown as PrismaService,
        createAudit(),
      );

      (prisma.importJob.create as jest.Mock).mockResolvedValue({
        id: 'job-dup', status: 'PENDING', importType: 'customers',
        fileName: 'dup.csv', createdAt: new Date(),
      });
      (prisma.importJob.findUnique as jest.Mock).mockResolvedValue({
        id: 'job-dup', filePath: '/tmp/dup.csv', fileFormat: 'CSV',
        delimiter: 'Comma', skipFirstRow: true, updateExisting: false,
        importType: 'customers', status: 'PROCESSING',
      });
      (prisma.customer.create as jest.Mock)
        .mockResolvedValueOnce({ id: 'c-1', name: 'First' })
        .mockRejectedValueOnce(new Error('Unique constraint failed on the fields: (`organizationId`,`email`)'))
        .mockRejectedValueOnce(new Error('Unique constraint failed on the fields: (`organizationId`,`email`)'));

      jest.spyOn(service, 'parseFile').mockReturnValue([
        ['Name', 'Email'],
        ['First', 'dup@example.com'],
        ['Second', 'dup@example.com'],
        ['Third', 'dup@example.com'],
      ]);

      await service.startImport('org-1', 'user-1', {
        importType: 'customers', fileFormat: 'CSV', delimiter: 'Comma',
        skipFirstRow: true, updateExisting: false,
        fileName: 'dup.csv', fileSize: 100,
      }, { path: '/tmp/dup.csv', originalname: 'dup.csv', size: 100 } as Express.Multer.File);

      await new Promise((r) => setTimeout(r, 50));

      const data = lastJobUpdateData(prisma);
      expect(data).not.toBeNull();
      expect(data?.importedCount).toBe(1);
      expect(data?.errorCount).toBe(2);
      const errors = data?.errors as Array<{ field: string; message: string }>;
      expect(errors.every((e) => e.field === 'email')).toBe(true);
    });

    it('should report errors for duplicate SKUs without crashing', async () => {
      const prisma = createPrisma();
      const service = new ImportService(
        prisma as unknown as PrismaService,
        createAudit(),
      );

      (prisma.importJob.create as jest.Mock).mockResolvedValue({
        id: 'job-dup-sku', status: 'PENDING', importType: 'products',
        fileName: 'dup.csv', createdAt: new Date(),
      });
      (prisma.importJob.findUnique as jest.Mock).mockResolvedValue({
        id: 'job-dup-sku', filePath: '/tmp/dup.csv', fileFormat: 'CSV',
        delimiter: 'Comma', skipFirstRow: true, updateExisting: false,
        importType: 'products', status: 'PROCESSING',
      });
      (prisma.supplier.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.product.create as jest.Mock)
        .mockResolvedValueOnce({ id: 'p-1', name: 'Widget', sku: 'SKU-1' })
        .mockRejectedValueOnce(new Error('Unique constraint failed on the fields: (`organizationId`,`sku`)'));

      jest.spyOn(service, 'parseFile').mockReturnValue([
        ['Name', 'SKU'],
        ['Widget', 'SKU-1'],
        ['Widget Dup', 'SKU-1'],
      ]);

      await service.startImport('org-1', 'user-1', {
        importType: 'products', fileFormat: 'CSV', delimiter: 'Comma',
        skipFirstRow: true, updateExisting: false,
        fileName: 'dup.csv', fileSize: 100,
      }, { path: '/tmp/dup.csv', originalname: 'dup.csv', size: 100 } as Express.Multer.File);

      await new Promise((r) => setTimeout(r, 50));

      const data = lastJobUpdateData(prisma);
      expect(data).not.toBeNull();
      expect(data?.importedCount).toBe(1);
      expect(data?.errorCount).toBe(1);
    });
  });

  describe('C. Partial validation failure — mix of valid and invalid rows', () => {
    it('should import valid rows and report errors for invalid rows', async () => {
      const prisma = createPrisma();
      const service = new ImportService(
        prisma as unknown as PrismaService,
        createAudit(),
      );

      (prisma.importJob.create as jest.Mock).mockResolvedValue({
        id: 'job-partial', status: 'PENDING', importType: 'customers',
        fileName: 'partial.csv', createdAt: new Date(),
      });
      (prisma.importJob.findUnique as jest.Mock).mockResolvedValue({
        id: 'job-partial', filePath: '/tmp/partial.csv', fileFormat: 'CSV',
        delimiter: 'Comma', skipFirstRow: true, updateExisting: false,
        importType: 'customers', status: 'PROCESSING',
      });
      (prisma.customer.create as jest.Mock)
        .mockResolvedValueOnce({ id: 'c-1', name: 'Valid' })
        .mockResolvedValueOnce({ id: 'c-2', name: 'Also Valid' });

      jest.spyOn(service, 'parseFile').mockReturnValue([
        ['Name', 'Email'],
        ['Valid User', 'valid@example.com'],
        ['', 'no-name@example.com'],
        ['Also Valid', 'also@example.com'],
        ['', ''],
      ]);

      await service.startImport('org-1', 'user-1', {
        importType: 'customers', fileFormat: 'CSV', delimiter: 'Comma',
        skipFirstRow: true, updateExisting: false,
        fileName: 'partial.csv', fileSize: 100,
      }, { path: '/tmp/partial.csv', originalname: 'partial.csv', size: 100 } as Express.Multer.File);

      await new Promise((r) => setTimeout(r, 50));

      const data = lastJobUpdateData(prisma);
      expect(data).not.toBeNull();
      expect(data?.status).toBe('COMPLETED');
      expect(data?.importedCount).toBe(2);
      expect(data?.errorCount).toBe(2);
      const errors = data?.errors as Array<{ row: number; message: string }>;
      expect(errors).toHaveLength(2);
    });

    it('should handle product import with missing SKU and valid rows', async () => {
      const prisma = createPrisma();
      const service = new ImportService(
        prisma as unknown as PrismaService,
        createAudit(),
      );

      (prisma.importJob.create as jest.Mock).mockResolvedValue({
        id: 'job-partial-prod', status: 'PENDING', importType: 'products',
        fileName: 'partial.csv', createdAt: new Date(),
      });
      (prisma.importJob.findUnique as jest.Mock).mockResolvedValue({
        id: 'job-partial-prod', filePath: '/tmp/partial.csv', fileFormat: 'CSV',
        delimiter: 'Comma', skipFirstRow: true, updateExisting: false,
        importType: 'products', status: 'PROCESSING',
      });
      (prisma.supplier.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.product.create as jest.Mock)
        .mockResolvedValueOnce({ id: 'p-1', name: 'Good Product', sku: 'GOOD-001' });

      jest.spyOn(service, 'parseFile').mockReturnValue([
        ['Name', 'SKU'],
        ['Good Product', 'GOOD-001'],
        ['Missing SKU Product', ''],
        ['Also Good', 'GOOD-002'],
      ]);

      await service.startImport('org-1', 'user-1', {
        importType: 'products', fileFormat: 'CSV', delimiter: 'Comma',
        skipFirstRow: true, updateExisting: false,
        fileName: 'partial.csv', fileSize: 100,
      }, { path: '/tmp/partial.csv', originalname: 'partial.csv', size: 100 } as Express.Multer.File);

      await new Promise((r) => setTimeout(r, 50));

      const data = lastJobUpdateData(prisma);
      expect(data).not.toBeNull();
      expect(data?.status).toBe('COMPLETED');
      expect(data?.importedCount).toBe(2);
      expect(data?.errorCount).toBe(1);
    });
  });

  describe('D. PROCESSING stuck state — processing error should set FAILED', () => {
    it('should mark import job as FAILED on processing error', async () => {
      const prisma = createPrisma();
      const service = new ImportService(
        prisma as unknown as PrismaService,
        createAudit(),
      );

      (prisma.importJob.create as jest.Mock).mockResolvedValue({
        id: 'job-stuck', status: 'PENDING', importType: 'customers',
        fileName: 'stuck.csv', createdAt: new Date(),
      });
      (prisma.importJob.findUnique as jest.Mock).mockResolvedValue({
        id: 'job-stuck', filePath: '/tmp/stuck.csv', fileFormat: 'CSV',
        delimiter: 'Comma', skipFirstRow: true, updateExisting: false,
        importType: 'customers', status: 'PROCESSING',
      });

      jest.spyOn(service, 'parseFile').mockImplementation(() => {
        throw new Error('Unexpected parse failure');
      });

      await service.startImport('org-1', 'user-1', {
        importType: 'customers', fileFormat: 'CSV', delimiter: 'Comma',
        skipFirstRow: true, updateExisting: false,
        fileName: 'stuck.csv', fileSize: 100,
      }, { path: '/tmp/stuck.csv', originalname: 'stuck.csv', size: 100 } as Express.Multer.File);

      await new Promise((r) => setTimeout(r, 50));

      const data = lastJobUpdateData(prisma);
      expect(data).not.toBeNull();
      expect(data?.status).toBe('FAILED');
      expect(data?.completedAt).toBeDefined();
    });

    it('should never leave job in PROCESSING state when Prisma throws', async () => {
      const prisma = createPrisma();
      const service = new ImportService(
        prisma as unknown as PrismaService,
        createAudit(),
      );

      (prisma.importJob.create as jest.Mock).mockResolvedValue({
        id: 'job-stuck-2', status: 'PENDING', importType: 'inventory',
        fileName: 'stuck.csv', createdAt: new Date(),
      });
      (prisma.importJob.findUnique as jest.Mock).mockResolvedValue({
        id: 'job-stuck-2', filePath: '/tmp/stuck.csv', fileFormat: 'CSV',
        delimiter: 'Comma', skipFirstRow: true, updateExisting: false,
        importType: 'inventory', status: 'PROCESSING',
      });

      jest.spyOn(service, 'parseFile').mockReturnValue([
        ['SKU', 'Quantity'],
        ['WDG-001', '100'],
      ]);
      (prisma.product.findMany as jest.Mock).mockRejectedValue(
        new Error('Connection refused'),
      );

      await service.startImport('org-1', 'user-1', {
        importType: 'inventory', fileFormat: 'CSV', delimiter: 'Comma',
        skipFirstRow: true, updateExisting: false,
        fileName: 'stuck.csv', fileSize: 100,
      }, { path: '/tmp/stuck.csv', originalname: 'stuck.csv', size: 100 } as Express.Multer.File);

      await new Promise((r) => setTimeout(r, 50));

      const allStatuses = (prisma.importJob.update as jest.Mock).mock.calls.map(
        (c: [{ data: Record<string, unknown> }]) => c[0].data.status,
      );
      const lastStatus = allStatuses[allStatuses.length - 1];
      expect(lastStatus).toBe('FAILED');
    });

    it('should record audit log on processing failure', async () => {
      const prisma = createPrisma();
      const auditRecord = jest.fn().mockResolvedValue(undefined);
      const audit = { record: auditRecord } as unknown as AuditService;
      const service = new ImportService(prisma as unknown as PrismaService, audit);

      (prisma.importJob.create as jest.Mock).mockResolvedValue({
        id: 'job-audit-fail', status: 'PENDING', importType: 'products',
        fileName: 'fail.csv', createdAt: new Date(),
      });
      (prisma.importJob.findUnique as jest.Mock).mockResolvedValue({
        id: 'job-audit-fail', filePath: '/tmp/fail.csv', fileFormat: 'CSV',
        delimiter: 'Comma', skipFirstRow: true, updateExisting: false,
        importType: 'products', status: 'PROCESSING',
      });

      jest.spyOn(service, 'parseFile').mockImplementation(() => {
        throw new Error('DB connection lost');
      });

      await service.startImport('org-1', 'user-1', {
        importType: 'products', fileFormat: 'CSV', delimiter: 'Comma',
        skipFirstRow: true, updateExisting: false,
        fileName: 'fail.csv', fileSize: 100,
      }, { path: '/tmp/fail.csv', originalname: 'fail.csv', size: 100 } as Express.Multer.File);

      await new Promise((r) => setTimeout(r, 50));

      expect(auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'IMPORT_FAILED',
          status: 'FAILURE',
          entityId: 'job-audit-fail',
        }),
      );
    });
  });
});
