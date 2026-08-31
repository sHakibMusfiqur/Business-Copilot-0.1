import { BadRequestException } from '@nestjs/common';

import { ImportService } from './import.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ImportService', () => {
  let service: ImportService;
  let importJobCreate: jest.Mock;
  let importJobFindMany: jest.Mock;
  let importJobFindFirst: jest.Mock;

  beforeEach(() => {
    importJobCreate = jest.fn();
    importJobFindMany = jest.fn();
    importJobFindFirst = jest.fn();

    service = new ImportService({
      importJob: {
        create: importJobCreate,
        findMany: importJobFindMany,
        findFirst: importJobFindFirst,
      },
    } as unknown as PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('startImport', () => {
    const validDto = {
      importType: 'customers',
      fileFormat: 'CSV',
      delimiter: 'Comma',
      skipFirstRow: true,
      updateExisting: false,
      fileName: 'customers.csv',
      fileSize: 1024,
    };

    it('creates an import job with correct data', async () => {
      importJobCreate.mockResolvedValue({
        id: 'job-1',
        status: 'PENDING',
        importType: 'customers',
        fileName: 'customers.csv',
        createdAt: new Date(),
      });

      const result = await service.startImport('org-1', 'user-1', validDto);

      expect(importJobCreate).toHaveBeenCalledWith({
        data: {
          organizationId: 'org-1',
          userId: 'user-1',
          importType: 'customers',
          fileFormat: 'CSV',
          delimiter: 'Comma',
          skipFirstRow: true,
          updateExisting: false,
          fileName: 'customers.csv',
          fileSize: 1024,
          status: 'PENDING',
        },
      });
      expect(result).toMatchObject({
        id: 'job-1',
        status: 'PENDING',
        importType: 'customers',
        fileName: 'customers.csv',
      });
    });

    it('rejects CSV file with .xlsx extension', async () => {
      await expect(
        service.startImport('org-1', 'user-1', {
          ...validDto,
          fileFormat: 'CSV',
          fileName: 'data.xlsx',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(importJobCreate).not.toHaveBeenCalled();
    });

    it('rejects XLSX file with .csv extension', async () => {
      await expect(
        service.startImport('org-1', 'user-1', {
          ...validDto,
          fileFormat: 'XLSX',
          fileName: 'data.csv',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows XLSX file with .xlsx extension', async () => {
      importJobCreate.mockResolvedValue({
        id: 'job-2',
        status: 'PENDING',
        importType: 'products',
        fileName: 'products.xlsx',
        createdAt: new Date(),
      });

      const result = await service.startImport('org-1', 'user-1', {
        ...validDto,
        fileFormat: 'XLSX',
        fileName: 'products.xlsx',
      });

      expect(result.fileName).toBe('products.xlsx');
    });

    it('allows XLS file with .xls extension', async () => {
      importJobCreate.mockResolvedValue({
        id: 'job-3',
        status: 'PENDING',
        importType: 'suppliers',
        fileName: 'suppliers.xls',
        createdAt: new Date(),
      });

      const result = await service.startImport('org-1', 'user-1', {
        ...validDto,
        fileFormat: 'XLS',
        fileName: 'suppliers.xls',
      });

      expect(result.fileName).toBe('suppliers.xls');
    });
  });

  describe('getImportJobs', () => {
    it('returns all import jobs for the organization', async () => {
      importJobFindMany.mockResolvedValue([
        { id: 'job-1', importType: 'customers', status: 'COMPLETED' },
        { id: 'job-2', importType: 'products', status: 'PENDING' },
      ]);

      const result = await service.getImportJobs('org-1');

      expect(importJobFindMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
        orderBy: { createdAt: 'desc' },
        select: expect.any(Object),
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('getImportJob', () => {
    it('returns a single import job', async () => {
      importJobFindFirst.mockResolvedValue({
        id: 'job-1',
        importType: 'customers',
        status: 'COMPLETED',
      });

      const result = await service.getImportJob('org-1', 'job-1');

      expect(importJobFindFirst).toHaveBeenCalledWith({
        where: { id: 'job-1', organizationId: 'org-1' },
        select: expect.any(Object),
      });
      expect(result.id).toBe('job-1');
    });

    it('throws when import job is not found', async () => {
      importJobFindFirst.mockResolvedValue(null);

      await expect(
        service.getImportJob('org-1', 'nonexistent'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects cross-organization access', async () => {
      importJobFindFirst.mockResolvedValue(null);

      await expect(
        service.getImportJob('org-2', 'job-from-org-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
