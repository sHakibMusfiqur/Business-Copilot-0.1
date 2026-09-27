import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';

import type { StockAdjustmentRepository } from './interfaces/stock-adjustment-repository.interface';
import type { CreateStockAdjustmentDto } from './dto/create-stock-adjustment.dto';
import type { QueryStockAdjustmentDto } from './dto/query-stock-adjustment.dto';

/**
 * Append-only ledger service: create/read only. No update or delete methods
 * exist by design; StockAdjustment rows are never mutated after creation.
 */
@Injectable()
export class StockAdjustmentService {
  private readonly logger = new Logger(StockAdjustmentService.name);

  constructor(
    private readonly stockAdjustmentRepository: StockAdjustmentRepository,
    private readonly auditService: AuditService,
  ) {}

  async findAll(organizationId: string, query: QueryStockAdjustmentDto) {
    const rows = await this.stockAdjustmentRepository.findByOrganization(organizationId);

    let items = rows;
    if (query.adjustmentType) {
      items = items.filter((row) => row.adjustmentType === query.adjustmentType);
    }
    if (query.stockId) {
      items = items.filter((row) => row.stockId === query.stockId);
    }

    const allowedSortFields = ['adjustmentType', 'stockId', 'adjustmentQty', 'createdAt'];
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
    const adjustment = await this.stockAdjustmentRepository.findById(organizationId, id);

    if (!adjustment) {
      throw new NotFoundException('Stock adjustment not found');
    }

    return adjustment;
  }

  async create(organizationId: string, currentUserId: string, dto: CreateStockAdjustmentDto) {
    const referencesValid = await this.stockAdjustmentRepository.verifyReferences(organizationId, {
      stockId: dto.stockId,
    });
    if (!referencesValid) {
      throw new BadRequestException('Related record not found');
    }

    const data = {
      organizationId,
      stockId: dto.stockId,
      adjustmentType: dto.adjustmentType,
      quantityBefore: dto.quantityBefore,
      quantityAfter: dto.quantityAfter,
      adjustmentQty: dto.adjustmentQty,
      reason: dto.reason ?? null,
      notes: dto.notes ?? null,
      metadata: dto.metadata ?? {},
    } as unknown as Parameters<StockAdjustmentRepository['create']>[0];

    let adjustment;
    try {
      adjustment = await this.stockAdjustmentRepository.create(data);
    } catch (err) {
      if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2002') {
        throw new ConflictException('Stock adjustment already exists');
      }
      throw err;
    }

    this.logger.log(`Stock adjustment created: ${adjustment.id} (${adjustment.adjustmentType}) by ${currentUserId}`);

    await this.auditService.record({
      userId: currentUserId,
      organizationId,
      action: 'STOCK_ADJUSTMENT_CREATED',
      entity: 'StockAdjustment',
      entityId: adjustment.id,
      status: 'SUCCESS',
      metadata: { stockId: adjustment.stockId, adjustmentType: adjustment.adjustmentType },
    });

    return adjustment;
  }
}
