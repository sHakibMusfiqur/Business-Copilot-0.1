import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, TransactionType } from '@prisma/client';
import * as XLSX from 'xlsx';
import { unlinkSync } from 'fs';

import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

import type { StartImportDto } from './dto/start-import.dto';

const CUSTOMER_COLUMNS: Record<string, string> = {
  name: 'name',
  email: 'email',
  phone: 'phone',
  company: 'company',
  taxid: 'taxId',
  'tax id': 'taxId',
  website: 'website',
  address: 'address',
  city: 'city',
  state: 'state',
  zipcode: 'zipCode',
  'zip code': 'zipCode',
  country: 'country',
  notes: 'notes',
  'credit limit': 'creditLimit',
  creditlimit: 'creditLimit',
};

const SUPPLIER_COLUMNS: Record<string, string> = {
  name: 'name',
  email: 'email',
  phone: 'phone',
  company: 'company',
  taxid: 'taxId',
  'tax id': 'taxId',
  website: 'website',
  address: 'address',
  city: 'city',
  state: 'state',
  zipcode: 'zipCode',
  'zip code': 'zipCode',
  country: 'country',
  paymentterms: 'paymentTerms',
  'payment terms': 'paymentTerms',
  notes: 'notes',
};

const PRODUCT_COLUMNS: Record<string, string> = {
  name: 'name',
  sku: 'sku',
  barcode: 'barcode',
  brand: 'brand',
  description: 'description',
  category: 'categoryName',
  'category name': 'categoryName',
  categoryid: 'categoryId',
  'category id': 'categoryId',
  supplier: 'supplierName',
  'supplier name': 'supplierName',
  supplierid: 'supplierId',
  'supplier id': 'supplierId',
  'unit price': 'unitPrice',
  unitprice: 'unitPrice',
  price: 'unitPrice',
  'cost price': 'costPrice',
  costprice: 'costPrice',
  unit: 'unit',
  'tax rate': 'taxRate',
  taxrate: 'taxRate',
  'minimum stock': 'minimumStock',
  minimumstock: 'minimumStock',
  'max stock': 'maximumStock',
  'maximum stock': 'maximumStock',
  maximumstock: 'maximumStock',
};

const INVENTORY_COLUMNS: Record<string, string> = {
  sku: 'sku',
  'product sku': 'sku',
  'product name': 'productName',
  productname: 'productName',
  name: 'productName',
  quantity: 'quantity',
  qty: 'quantity',
  stock: 'quantity',
  'min stock': 'minStock',
  minstock: 'minStock',
  'max stock': 'maxStock',
  maxstock: 'maxStock',
};

const ACCOUNT_COLUMNS: Record<string, string> = {
  code: 'code',
  'account code': 'code',
  name: 'name',
  'account name': 'name',
  type: 'type',
  'account type': 'type',
  description: 'description',
  parent: 'parentCode',
  'parent code': 'parentCode',
  parentcode: 'parentCode',
  parentid: 'parentId',
  'parent id': 'parentId',
};

const REQUIRED_FIELDS: Record<string, string[]> = {
  customers: ['name'],
  suppliers: ['name'],
  products: ['name', 'sku'],
  inventory: ['sku', 'quantity'],
  'chart-of-accounts': ['code', 'name', 'type'],
};

const VALID_ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];

const DELIMITER_MAP: Record<string, string> = {
  Comma: ',',
  Tab: '\t',
  Semicolon: ';',
};

interface RowError {
  row: number;
  field?: string;
  message: string;
  value?: unknown;
}

interface ImportResult {
  totalRows: number;
  importedCount: number;
  errorCount: number;
  errors: RowError[];
}

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  parseFile(filePath: string, fileFormat: string, delimiter: string): string[][] {
    const workbook = XLSX.readFile(filePath, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new BadRequestException('File contains no sheets');
    }
    const sheet = workbook.Sheets[sheetName];

    if (fileFormat === 'CSV') {
      const delim = DELIMITER_MAP[delimiter] ?? ',';
      const csvStr = XLSX.utils.sheet_to_csv(sheet, { FS: delim, blankrows: false });
      return this.parseCsvString(csvStr);
    }

    const data: string[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      raw: false,
      blankrows: false,
    }) as string[][];
    return data.filter((row) => row.some((cell) => cell !== ''));
  }

  private parseCsvString(csv: string): string[][] {
    const lines: string[][] = [];
    let current: string[] = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < csv.length; i++) {
      const ch = csv[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < csv.length && csv[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',' || ch === '\t' || ch === ';') {
          current.push(field.trim());
          field = '';
        } else if (ch === '\n' || ch === '\r') {
          if (ch === '\r' && i + 1 < csv.length && csv[i + 1] === '\n') i++;
          current.push(field.trim());
          if (current.length > 0 && current.some((c) => c !== '')) {
            lines.push(current);
          }
          current = [];
          field = '';
        } else {
          field += ch;
        }
      }
    }
    current.push(field.trim());
    if (current.length > 0 && current.some((c) => c !== '')) {
      lines.push(current);
    }
    return lines;
  }

  mapHeaders(rawHeaders: string[], columnMap: Record<string, string>): { mapped: Record<string, number>; unmapped: string[] } {
    const mapped: Record<string, number> = {};
    const unmapped: string[] = [];

    rawHeaders.forEach((header, idx) => {
      const normalized = header.toLowerCase().trim();
      const field = columnMap[normalized];
      if (field) {
        mapped[field] = idx;
      } else {
        unmapped.push(header);
      }
    });

    return { mapped, unmapped };
  }

  async startImport(
    orgId: string,
    userId: string,
    dto: StartImportDto,
    file: Express.Multer.File,
  ): Promise<{ id: string; status: string }> {
    const job = await this.prisma.importJob.create({
      data: {
        organizationId: orgId,
        userId,
        importType: dto.importType,
        fileFormat: dto.fileFormat,
        delimiter: dto.delimiter,
        skipFirstRow: dto.skipFirstRow,
        updateExisting: dto.updateExisting,
        fileName: file.originalname,
        fileSize: file.size,
        filePath: file.path,
        status: 'PENDING',
      },
    });

    this.logger.log(`Import job created: ${job.id} (${dto.importType}, ${file.originalname})`);

    this.processImport(job.id, orgId, userId).catch((err) => {
      this.logger.error(`Import job ${job.id} failed: ${(err as Error).message}`);
    });

    return { id: job.id, status: 'PENDING' };
  }

  private async processImport(jobId: string, orgId: string, userId: string): Promise<void> {
    await this.prisma.importJob.update({
      where: { id: jobId },
      data: { status: 'PROCESSING', startedAt: new Date() },
    });

    const job = await this.prisma.importJob.findUnique({ where: { id: jobId } });
    if (!job) {
      this.logger.error(`Import job ${jobId} not found during processing`);
      return;
    }

    try {
      const rows = this.parseFile(job.filePath, job.fileFormat, job.delimiter);
      if (rows.length === 0) {
        await this.completeJob(jobId, { totalRows: 0, importedCount: 0, errorCount: 0, errors: [] });
        return;
      }

      const dataStartIdx = job.skipFirstRow ? 1 : 0;
      const dataRows = rows.slice(dataStartIdx);
      const headers = job.skipFirstRow ? rows[0] : rows[0].map((_: string, i: number) => `Column ${i + 1}`);

      let result: ImportResult;

      switch (job.importType) {
        case 'customers':
          result = await this.processCustomers(orgId, userId, headers, dataRows, job.updateExisting);
          break;
        case 'suppliers':
          result = await this.processSuppliers(orgId, userId, headers, dataRows, job.updateExisting);
          break;
        case 'products':
          result = await this.processProducts(orgId, userId, headers, dataRows, job.updateExisting);
          break;
        case 'inventory':
          result = await this.processInventory(orgId, userId, headers, dataRows);
          break;
        case 'chart-of-accounts':
          result = await this.processChartOfAccounts(orgId, headers, dataRows, job.updateExisting);
          break;
        default:
          throw new BadRequestException(`Unknown import type: ${job.importType}`);
      }

      await this.completeJob(jobId, result);

      await this.auditService.record({
        userId,
        organizationId: orgId,
        action: 'IMPORT_COMPLETED',
        entity: 'ImportJob',
        entityId: jobId,
        status: 'SUCCESS',
        metadata: {
          importType: job.importType,
          fileName: job.fileName,
          totalRows: result.totalRows,
          importedCount: result.importedCount,
          errorCount: result.errorCount,
        },
      });
    } catch (err) {
      this.logger.error(`Import job ${jobId} processing failed: ${(err as Error).message}`);
      await this.prisma.importJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errors: [{ row: 0, message: (err as Error).message }] as unknown as Prisma.InputJsonValue,
        },
      });

      await this.auditService.record({
        userId,
        organizationId: orgId,
        action: 'IMPORT_FAILED',
        entity: 'ImportJob',
        entityId: jobId,
        status: 'FAILURE',
        metadata: { importType: job.importType, error: (err as Error).message },
      });
    } finally {
      try { unlinkSync(job.filePath); } catch { /* best-effort */ }
    }
  }

  private async completeJob(jobId: string, result: ImportResult): Promise<void> {
    await this.prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        totalRows: result.totalRows,
        importedCount: result.importedCount,
        errorCount: result.errorCount,
        errors: result.errors.length > 0 ? (result.errors as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
        completedAt: new Date(),
      },
    });
  }

  private async processCustomers(
    orgId: string,
    _userId: string,
    headers: string[],
    rows: string[][],
    updateExisting: boolean,
  ): Promise<ImportResult> {
    const { mapped } = this.mapHeaders(headers, CUSTOMER_COLUMNS);
    const required = REQUIRED_FIELDS['customers'];
    const errors: RowError[] = [];
    let importedCount = 0;

    for (const field of required) {
      if (mapped[field] === undefined) {
        throw new BadRequestException(`Missing required column: "${field}". Found columns: ${headers.join(', ')}`);
      }
    }

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2;
      const row = rows[i];
      const name = this.getCell(row, mapped['name']);

      if (!name) {
        errors.push({ row: rowNum, field: 'name', message: 'Name is required', value: name });
        continue;
      }

      const email = this.getCell(row, mapped['email'])?.toLowerCase() || null;

      try {
        const data: Prisma.CustomerCreateInput = {
          name: name.trim(),
          organization: { connect: { id: orgId } },
          isActive: true,
        };

        if (email) data.email = email.trim();
        if (mapped['phone'] !== undefined) { const v = this.getCell(row, mapped['phone']); if (v) data.phone = v.trim(); }
        if (mapped['company'] !== undefined) { const v = this.getCell(row, mapped['company']); if (v) data.company = v.trim(); }
        if (mapped['taxId'] !== undefined) { const v = this.getCell(row, mapped['taxId']); if (v) data.taxId = v.trim(); }
        if (mapped['website'] !== undefined) { const v = this.getCell(row, mapped['website']); if (v) data.website = v.trim(); }
        if (mapped['address'] !== undefined) { const v = this.getCell(row, mapped['address']); if (v) data.address = v.trim(); }
        if (mapped['city'] !== undefined) { const v = this.getCell(row, mapped['city']); if (v) data.city = v.trim(); }
        if (mapped['state'] !== undefined) { const v = this.getCell(row, mapped['state']); if (v) data.state = v.trim(); }
        if (mapped['zipCode'] !== undefined) { const v = this.getCell(row, mapped['zipCode']); if (v) data.zipCode = v.trim(); }
        if (mapped['country'] !== undefined) { const v = this.getCell(row, mapped['country']); if (v) data.country = v.trim(); }
        if (mapped['notes'] !== undefined) { const v = this.getCell(row, mapped['notes']); if (v) data.notes = v.trim(); }
        if (mapped['creditLimit'] !== undefined) {
          const v = this.getCell(row, mapped['creditLimit']);
          if (v) data.creditLimit = this.parseDecimal(v);
        }

        if (updateExisting && email) {
          const existing = await this.prisma.customer.findFirst({
            where: { organizationId: orgId, email, deletedAt: null },
          });
          if (existing) {
            await this.prisma.customer.update({
              where: { id: existing.id },
              data: {
                name: data.name,
                ...(data.phone && { phone: data.phone }),
                ...(data.company && { company: data.company }),
                ...(data.taxId && { taxId: data.taxId }),
                ...(data.website && { website: data.website }),
                ...(data.address && { address: data.address }),
                ...(data.city && { city: data.city }),
                ...(data.state && { state: data.state }),
                ...(data.zipCode && { zipCode: data.zipCode }),
                ...(data.country && { country: data.country }),
                ...(data.notes && { notes: data.notes }),
                ...(data.creditLimit !== undefined && { creditLimit: data.creditLimit }),
              },
            });
            importedCount++;
            continue;
          }
        }

        await this.prisma.customer.create({ data });
        importedCount++;
      } catch (err) {
        const msg = (err as Error).message;
        if (msg.includes('Unique constraint')) {
          errors.push({ row: rowNum, field: 'email', message: `Duplicate email "${email}" in organization`, value: email });
        } else {
          errors.push({ row: rowNum, message: msg });
        }
      }
    }

    return { totalRows: rows.length, importedCount, errorCount: errors.length, errors };
  }

  private async processSuppliers(
    orgId: string,
    _userId: string,
    headers: string[],
    rows: string[][],
    updateExisting: boolean,
  ): Promise<ImportResult> {
    const { mapped } = this.mapHeaders(headers, SUPPLIER_COLUMNS);
    const required = REQUIRED_FIELDS['suppliers'];
    const errors: RowError[] = [];
    let importedCount = 0;

    for (const field of required) {
      if (mapped[field] === undefined) {
        throw new BadRequestException(`Missing required column: "${field}". Found columns: ${headers.join(', ')}`);
      }
    }

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2;
      const row = rows[i];
      const name = this.getCell(row, mapped['name']);

      if (!name) {
        errors.push({ row: rowNum, field: 'name', message: 'Name is required', value: name });
        continue;
      }

      const email = this.getCell(row, mapped['email'])?.toLowerCase() || null;

      try {
        const data: Prisma.SupplierCreateInput = {
          name: name.trim(),
          organization: { connect: { id: orgId } },
          isActive: true,
        };

        if (email) data.email = email.trim();
        if (mapped['phone'] !== undefined) { const v = this.getCell(row, mapped['phone']); if (v) data.phone = v.trim(); }
        if (mapped['company'] !== undefined) { const v = this.getCell(row, mapped['company']); if (v) data.company = v.trim(); }
        if (mapped['taxId'] !== undefined) { const v = this.getCell(row, mapped['taxId']); if (v) data.taxId = v.trim(); }
        if (mapped['website'] !== undefined) { const v = this.getCell(row, mapped['website']); if (v) data.website = v.trim(); }
        if (mapped['address'] !== undefined) { const v = this.getCell(row, mapped['address']); if (v) data.address = v.trim(); }
        if (mapped['city'] !== undefined) { const v = this.getCell(row, mapped['city']); if (v) data.city = v.trim(); }
        if (mapped['state'] !== undefined) { const v = this.getCell(row, mapped['state']); if (v) data.state = v.trim(); }
        if (mapped['zipCode'] !== undefined) { const v = this.getCell(row, mapped['zipCode']); if (v) data.zipCode = v.trim(); }
        if (mapped['country'] !== undefined) { const v = this.getCell(row, mapped['country']); if (v) data.country = v.trim(); }
        if (mapped['paymentTerms'] !== undefined) { const v = this.getCell(row, mapped['paymentTerms']); if (v) data.paymentTerms = v.trim(); }
        if (mapped['notes'] !== undefined) { const v = this.getCell(row, mapped['notes']); if (v) data.notes = v.trim(); }

        if (updateExisting && email) {
          const existing = await this.prisma.supplier.findFirst({
            where: { organizationId: orgId, email, deletedAt: null },
          });
          if (existing) {
            await this.prisma.supplier.update({
              where: { id: existing.id },
              data: {
                name: data.name,
                ...(data.phone && { phone: data.phone }),
                ...(data.company && { company: data.company }),
                ...(data.taxId && { taxId: data.taxId }),
                ...(data.website && { website: data.website }),
                ...(data.address && { address: data.address }),
                ...(data.city && { city: data.city }),
                ...(data.state && { state: data.state }),
                ...(data.zipCode && { zipCode: data.zipCode }),
                ...(data.country && { country: data.country }),
                ...(data.paymentTerms && { paymentTerms: data.paymentTerms }),
                ...(data.notes && { notes: data.notes }),
              },
            });
            importedCount++;
            continue;
          }
        }

        await this.prisma.supplier.create({ data });
        importedCount++;
      } catch (err) {
        const msg = (err as Error).message;
        if (msg.includes('Unique constraint')) {
          errors.push({ row: rowNum, field: 'email', message: `Duplicate email "${email}" in organization`, value: email });
        } else {
          errors.push({ row: rowNum, message: msg });
        }
      }
    }

    return { totalRows: rows.length, importedCount, errorCount: errors.length, errors };
  }

  private async processProducts(
    orgId: string,
    _userId: string,
    headers: string[],
    rows: string[][],
    updateExisting: boolean,
  ): Promise<ImportResult> {
    const { mapped } = this.mapHeaders(headers, PRODUCT_COLUMNS);
    const required = REQUIRED_FIELDS['products'];
    const errors: RowError[] = [];
    let importedCount = 0;

    for (const field of required) {
      if (mapped[field] === undefined) {
        throw new BadRequestException(`Missing required column: "${field}". Found columns: ${headers.join(', ')}`);
      }
    }

    const supplierMap = await this.buildSupplierNameMap(orgId);

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2;
      const row = rows[i];
      const name = this.getCell(row, mapped['name']);
      const sku = this.getCell(row, mapped['sku']);

      if (!name) {
        errors.push({ row: rowNum, field: 'name', message: 'Name is required', value: name });
        continue;
      }
      if (!sku) {
        errors.push({ row: rowNum, field: 'sku', message: 'SKU is required', value: sku });
        continue;
      }

      try {
        const data: Prisma.ProductCreateInput = {
          name: name.trim(),
          sku: sku.trim(),
          organization: { connect: { id: orgId } },
          isActive: true,
          unit: 'pcs',
        };

        if (mapped['barcode'] !== undefined) { const v = this.getCell(row, mapped['barcode']); if (v) data.barcode = v.trim(); }
        if (mapped['brand'] !== undefined) { const v = this.getCell(row, mapped['brand']); if (v) data.brand = v.trim(); }
        if (mapped['description'] !== undefined) { const v = this.getCell(row, mapped['description']); if (v) data.description = v.trim(); }
        if (mapped['unitPrice'] !== undefined) { const v = this.getCell(row, mapped['unitPrice']); if (v) data.unitPrice = this.parseDecimal(v); }
        if (mapped['costPrice'] !== undefined) { const v = this.getCell(row, mapped['costPrice']); if (v) data.costPrice = this.parseDecimal(v); }
        if (mapped['unit'] !== undefined) { const v = this.getCell(row, mapped['unit']); if (v) data.unit = v.trim(); }
        if (mapped['taxRate'] !== undefined) { const v = this.getCell(row, mapped['taxRate']); if (v) data.taxRate = this.parseDecimal(v); }
        if (mapped['minimumStock'] !== undefined) { const v = this.getCell(row, mapped['minimumStock']); if (v) data.minimumStock = parseInt(v, 10) || 0; }
        if (mapped['maximumStock'] !== undefined) { const v = this.getCell(row, mapped['maximumStock']); if (v) data.maximumStock = parseInt(v, 10) || 0; }

        if (mapped['supplierName'] !== undefined) {
          const supplierName = this.getCell(row, mapped['supplierName']);
          if (supplierName) {
            const supplierId = supplierMap.get(supplierName.trim().toLowerCase());
            if (supplierId) {
              data.supplier = { connect: { id: supplierId } };
            } else {
              errors.push({ row: rowNum, field: 'supplier', message: `Supplier "${supplierName}" not found`, value: supplierName });
              continue;
            }
          }
        }
        if (mapped['supplierId'] !== undefined) {
          const supplierId = this.getCell(row, mapped['supplierId']);
          if (supplierId) {
            const exists = await this.prisma.supplier.findFirst({
              where: { id: supplierId.trim(), organizationId: orgId, deletedAt: null },
              select: { id: true },
            });
            if (exists) {
              data.supplier = { connect: { id: supplierId.trim() } };
            } else {
              errors.push({ row: rowNum, field: 'supplierId', message: `Supplier ID "${supplierId}" not found`, value: supplierId });
              continue;
            }
          }
        }

        if (mapped['categoryName'] !== undefined) {
          const catName = this.getCell(row, mapped['categoryName']);
          if (catName) {
            const cat = await this.prisma.category.findFirst({
              where: {
                name: { equals: catName.trim(), mode: 'insensitive' },
                OR: [{ organizationId: orgId }, { organizationId: null }],
              },
              select: { id: true },
            });
            if (cat) {
              data.category = { connect: { id: cat.id } };
            } else {
              errors.push({ row: rowNum, field: 'category', message: `Category "${catName}" not found`, value: catName });
              continue;
            }
          }
        }
        if (mapped['categoryId'] !== undefined) {
          const catId = this.getCell(row, mapped['categoryId']);
          if (catId) {
            const cat = await this.prisma.category.findFirst({
              where: {
                id: catId.trim(),
                OR: [{ organizationId: orgId }, { organizationId: null }],
              },
              select: { id: true },
            });
            if (cat) {
              data.category = { connect: { id: catId.trim() } };
            } else {
              errors.push({ row: rowNum, field: 'categoryId', message: `Category ID "${catId}" not found`, value: catId });
              continue;
            }
          }
        }

        if (updateExisting) {
          const existing = await this.prisma.product.findFirst({
            where: { organizationId: orgId, sku: sku.trim(), deletedAt: null },
          });
          if (existing) {
            await this.prisma.product.update({
              where: { id: existing.id },
              data: {
                name: data.name,
                ...(data.barcode && { barcode: data.barcode }),
                ...(data.brand && { brand: data.brand }),
                ...(data.description && { description: data.description }),
                ...(data.unitPrice !== undefined && { unitPrice: data.unitPrice }),
                ...(data.costPrice !== undefined && { costPrice: data.costPrice }),
                ...(data.unit && { unit: data.unit }),
                ...(data.taxRate !== undefined && { taxRate: data.taxRate }),
                ...(data.minimumStock !== undefined && { minimumStock: data.minimumStock }),
                ...(data.maximumStock !== undefined && { maximumStock: data.maximumStock }),
                ...(data.supplier && { supplier: data.supplier }),
                ...(data.category && { category: data.category }),
              },
            });
            importedCount++;
            continue;
          }
        }

        await this.prisma.product.create({ data });
        importedCount++;
      } catch (err) {
        const msg = (err as Error).message;
        if (msg.includes('Unique constraint')) {
          errors.push({ row: rowNum, field: 'sku', message: `Duplicate SKU "${sku}" in organization`, value: sku });
        } else {
          errors.push({ row: rowNum, message: msg });
        }
      }
    }

    return { totalRows: rows.length, importedCount, errorCount: errors.length, errors };
  }

  private async processInventory(
    orgId: string,
    userId: string,
    headers: string[],
    rows: string[][],
  ): Promise<ImportResult> {
    const { mapped } = this.mapHeaders(headers, INVENTORY_COLUMNS);
    const required = REQUIRED_FIELDS['inventory'];
    const errors: RowError[] = [];
    let importedCount = 0;

    for (const field of required) {
      if (mapped[field] === undefined) {
        throw new BadRequestException(`Missing required column: "${field}". Found columns: ${headers.join(', ')}`);
      }
    }

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2;
      const row = rows[i];
      const sku = this.getCell(row, mapped['sku']);
      const qtyStr = this.getCell(row, mapped['quantity']);

      if (!sku) {
        errors.push({ row: rowNum, field: 'sku', message: 'SKU is required', value: sku });
        continue;
      }
      if (!qtyStr || isNaN(Number(qtyStr))) {
        errors.push({ row: rowNum, field: 'quantity', message: 'Quantity must be a number', value: qtyStr });
        continue;
      }

      const quantity = parseInt(qtyStr, 10);

      try {
        const product = await this.prisma.product.findFirst({
          where: { organizationId: orgId, sku: sku.trim(), deletedAt: null },
          select: { id: true, name: true, sku: true },
        });

        if (!product) {
          errors.push({ row: rowNum, field: 'sku', message: `Product with SKU "${sku}" not found`, value: sku });
          continue;
        }

        const existingInventory = await this.prisma.inventory.findFirst({
          where: { productId: product.id, warehouseId: null },
          select: { id: true },
        });

        const previousQuantity = existingInventory
          ? Number((await this.prisma.inventory.findUnique({ where: { id: existingInventory.id } }))?.quantity ?? 0)
          : 0;

        if (existingInventory) {
          await this.prisma.inventory.update({
            where: { id: existingInventory.id },
            data: { quantity },
          });
        } else {
          await this.prisma.inventory.create({
            data: { organizationId: orgId, productId: product.id, quantity },
          });
        }

        await this.prisma.inventoryTransaction.create({
          data: {
            organizationId: orgId,
            productId: product.id,
            type: TransactionType.ADJUSTMENT,
            quantity,
            previousQuantity,
            newQuantity: quantity,
            notes: 'Imported via data import',
            createdById: userId,
          },
        });

        importedCount++;
      } catch (err) {
        errors.push({ row: rowNum, message: (err as Error).message });
      }
    }

    return { totalRows: rows.length, importedCount, errorCount: errors.length, errors };
  }

  private async processChartOfAccounts(
    orgId: string,
    headers: string[],
    rows: string[][],
    updateExisting: boolean,
  ): Promise<ImportResult> {
    const { mapped } = this.mapHeaders(headers, ACCOUNT_COLUMNS);
    const required = REQUIRED_FIELDS['chart-of-accounts'];
    const errors: RowError[] = [];
    let importedCount = 0;

    for (const field of required) {
      if (mapped[field] === undefined) {
        throw new BadRequestException(`Missing required column: "${field}". Found columns: ${headers.join(', ')}`);
      }
    }

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2;
      const row = rows[i];
      const code = this.getCell(row, mapped['code']);
      const name = this.getCell(row, mapped['name']);
      const typeStr = this.getCell(row, mapped['type'])?.toUpperCase();

      if (!code) {
        errors.push({ row: rowNum, field: 'code', message: 'Account code is required', value: code });
        continue;
      }
      if (!name) {
        errors.push({ row: rowNum, field: 'name', message: 'Account name is required', value: name });
        continue;
      }
      if (!typeStr || !VALID_ACCOUNT_TYPES.includes(typeStr)) {
        errors.push({ row: rowNum, field: 'type', message: `Invalid account type "${typeStr}". Must be: ${VALID_ACCOUNT_TYPES.join(', ')}`, value: typeStr });
        continue;
      }

      try {
        let parentId: string | undefined;

        if (mapped['parentCode'] !== undefined) {
          const parentCode = this.getCell(row, mapped['parentCode']);
          if (parentCode) {
            const parent = await this.prisma.account.findFirst({
              where: { organizationId: orgId, code: parentCode.trim() },
              select: { id: true },
            });
            if (parent) {
              parentId = parent.id;
            } else {
              errors.push({ row: rowNum, field: 'parentCode', message: `Parent account code "${parentCode}" not found`, value: parentCode });
              continue;
            }
          }
        }

        const description = mapped['description'] !== undefined
          ? this.getCell(row, mapped['description']) || null
          : null;

        if (updateExisting) {
          const existing = await this.prisma.account.findFirst({
            where: { organizationId: orgId, code: code.trim() },
          });
          if (existing) {
            await this.prisma.account.update({
              where: { id: existing.id },
              data: {
                name: name.trim(),
                type: typeStr as 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE',
                ...(parentId && { parentId }),
                ...(description && { description }),
              },
            });
            importedCount++;
            continue;
          }
        }

        await this.prisma.account.create({
          data: {
            code: code.trim(),
            name: name.trim(),
            type: typeStr as 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE',
            organizationId: orgId,
            parentId: parentId ?? null,
            description,
          },
        });
        importedCount++;
      } catch (err) {
        const msg = (err as Error).message;
        if (msg.includes('Unique constraint') || msg.includes('already exists')) {
          errors.push({ row: rowNum, field: 'code', message: `Duplicate account code "${code}" in organization`, value: code });
        } else {
          errors.push({ row: rowNum, message: msg });
        }
      }
    }

    return { totalRows: rows.length, importedCount, errorCount: errors.length, errors };
  }

  private getCell(row: string[], idx: number | undefined): string | undefined {
    if (idx === undefined || idx >= row.length) return undefined;
    const val = row[idx];
    return val !== undefined && val !== '' ? String(val).trim() : undefined;
  }

  private parseDecimal(value: string): number {
    const cleaned = value.replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  private async buildSupplierNameMap(orgId: string): Promise<Map<string, string>> {
    const suppliers = await this.prisma.supplier.findMany({
      where: { organizationId: orgId, deletedAt: null },
      select: { id: true, name: true },
    });
    const map = new Map<string, string>();
    for (const s of suppliers) {
      map.set(s.name.toLowerCase().trim(), s.id);
    }
    return map;
  }

  async getImportJobs(orgId: string) {
    return this.prisma.importJob.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        importType: true,
        fileFormat: true,
        fileName: true,
        fileSize: true,
        status: true,
        totalRows: true,
        importedCount: true,
        errorCount: true,
        errors: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getImportJob(orgId: string, jobId: string) {
    const job = await this.prisma.importJob.findFirst({
      where: { id: jobId, organizationId: orgId },
      select: {
        id: true,
        importType: true,
        fileFormat: true,
        delimiter: true,
        skipFirstRow: true,
        updateExisting: true,
        fileName: true,
        fileSize: true,
        status: true,
        totalRows: true,
        importedCount: true,
        errorCount: true,
        errors: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!job) {
      throw new NotFoundException('Import job not found');
    }

    return job;
  }
}
