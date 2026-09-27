import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';

import type { OpeningStockRepository } from './interfaces/opening-stock-repository.interface';
import type { CreateOpeningStockDto } from './dto/create-opening-stock.dto';
import type { UpdateOpeningStockDto } from './dto/update-opening-stock.dto';
import type { QueryOpeningStockDto } from './dto/query-opening-stock.dto';

/**
 * OpeningStock is a standalone entity: there is no Stock relation, no
 * `stockId` anywhere in create/update payloads, and the repository contract
 * exposes no delete operation.
 */
@Injectable()
export class OpeningStockService {
  private readonly logger = new Logger(OpeningStockService.name);

  constructor(
    private readonly openingStockRepository: OpeningStockRepository,
    private readonly auditService: AuditService,
  ) {}

  async findAll(organizationId: string, query: QueryOpeningStockDto) {
    const rows = await this.openingStockRepository.findByOrganization(organizationId);

    let items = query.warehouseId
      ? rows.filter((row) => row.warehouseId === query.warehouseId)
      : rows;

    const allowedSortFields = ['referenceDate', 'quantity', 'createdAt'];
    const field = query.sortBy && allowedSortFields.includes(query.sortBy) ? query.sortBy : 'createdAt';
    const dir = query.sortOrder === 'asc' ? 1 : -1;
    items = [...items].sort((a, b) => {
      const rawA = (a as unknown as Record<string, unknown>)[field];
      const rawB = (b as unknown as Record<string, unknown>)[field];
      const av = rawA instanceof Date ? rawA.getTime() : (rawA as number);
      const bv = rawB instanceof Date ? rawB.getTime() : (rawB as number);
      if (av === bv) return 0;
      return (av < bv ? -1 : 1) * dir;
    });

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const total = items.length;

    return {
      data: items.slice((page - 1) * limit, page * limit),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(organizationId: string, id: string) {
    const openingStock = await this.openingStockRepository.findById(organizationId, id);

    if (!openingStock) {
      throw new NotFoundException('Opening stock not found');
    }

    return openingStock;
  }

  async create(organizationId: string, currentUserId: string, dto: CreateOpeningStockDto) {
    const referencesValid = await this.openingStockRepository.verifyReferences(organizationId, {
      warehouseId: dto.warehouseId,
      productId: dto.productId,
      batchId: dto.batchId,
      serialNumberId: dto.serialNumberId,
    });
    if (!referencesValid) {
      throw new BadRequestException('Related record not found');
    }

    const data = {
      organizationId,
      warehouseId: dto.warehouseId,
      productId: dto.productId,
      batchId: dto.batchId ?? null,
      serialNumberId: dto.serialNumberId ?? null,
      quantity: dto.quantity,
      unitCost: new Prisma.Decimal(dto.unitCost ?? 0),
      totalValue: new Prisma.Decimal(dto.totalValue ?? 0),
      referenceDate: new Date(dto.referenceDate),
      notes: dto.notes ?? null,
      metadata: dto.metadata ?? {},
    } as unknown as Parameters<OpeningStockRepository['create']>[0];

    let openingStock;
    try {
      openingStock = await this.openingStockRepository.create(data);
    } catch (err) {
      if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2002') {
        throw new ConflictException('Opening stock record already exists');
      }
      throw err;
    }

    this.logger.log(`Opening stock created: ${openingStock.id} (${openingStock.warehouseId}/${openingStock.productId}) by ${currentUserId}`);

    await this.auditService.record({
      userId: currentUserId,
      organizationId,
      action: 'OPENING_STOCK_CREATED',
      entity: 'OpeningStock',
      entityId: openingStock.id,
      status: 'SUCCESS',
      metadata: { warehouseId: openingStock.warehouseId, productId: openingStock.productId },
    });

    return openingStock;
  }

  async update(organizationId: string, currentUserId: string, id: string, dto: UpdateOpeningStockDto) {
    const data: Partial<Parameters<OpeningStockRepository['update']>[2]> = {};

    if (dto.quantity !== undefined) data.quantity = dto.quantity;
    if (dto.unitCost !== undefined) data.unitCost = new Prisma.Decimal(dto.unitCost);
    if (dto.totalValue !== undefined) data.totalValue = new Prisma.Decimal(dto.totalValue);
    if (dto.referenceDate !== undefined) data.referenceDate = new Date(dto.referenceDate);
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.metadata !== undefined) data.metadata = dto.metadata as never;

    let openingStock;
    try {
      openingStock = await this.openingStockRepository.update(organizationId, id, data);
    } catch (err) {
      const code = (err as Prisma.PrismaClientKnownRequestError)?.code;
      if (code === 'P2025') {
        throw new NotFoundException('Opening stock not found');
      }
      if (code === 'P2002') {
        throw new ConflictException('Opening stock record already exists');
      }
      throw err;
    }

    this.logger.log(`Opening stock updated: (${id}) by ${currentUserId}`);

    await this.auditService.record({
      userId: currentUserId,
      organizationId,
      action: 'OPENING_STOCK_UPDATED',
      entity: 'OpeningStock',
      entityId: id,
      status: 'SUCCESS',
      metadata: { changes: Object.keys(dto) },
    });

    return openingStock;
  }
}
