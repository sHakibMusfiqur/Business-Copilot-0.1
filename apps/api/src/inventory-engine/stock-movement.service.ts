import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';

import type { StockMovementRepository } from './interfaces/stock-movement-repository.interface';
import type { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import type { QueryStockMovementDto } from './dto/query-stock-movement.dto';


@Injectable()
export class StockMovementService {
  private readonly logger = new Logger(StockMovementService.name);

  constructor(
    private readonly stockMovementRepository: StockMovementRepository,
    private readonly auditService: AuditService,
  ) {}

  async findAll(organizationId: string, query: QueryStockMovementDto) {
    const rows = await this.stockMovementRepository.findByOrganization(organizationId);

    let items = rows;
    if (query.movementType) {
      items = items.filter((row) => row.movementType === query.movementType);
    }
    if (query.stockId) {
      items = items.filter((row) => row.stockId === query.stockId);
    }

    const allowedSortFields = ['movementType', 'stockId', 'quantity', 'createdAt'];
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
    const movement = await this.stockMovementRepository.findById(organizationId, id);

    if (!movement) {
      throw new NotFoundException('Stock movement not found');
    }

    return movement;
  }

  async create(organizationId: string, currentUserId: string, dto: CreateStockMovementDto) {
    const referencesValid = await this.stockMovementRepository.verifyReferences(organizationId, {
      stockId: dto.stockId,
    });
    if (!referencesValid) {
      throw new BadRequestException('Related record not found');
    }

    const data = {
      organizationId,
      stockId: dto.stockId,
      movementType: dto.movementType,
      quantity: dto.quantity,
      unitCost: new Prisma.Decimal(dto.unitCost ?? 0),
      totalCost: new Prisma.Decimal(dto.totalCost ?? 0),
      referenceType: dto.referenceType ?? null,
      referenceId: dto.referenceId ?? null,
      notes: dto.notes ?? null,
      metadata: dto.metadata ?? {},
    } as unknown as Parameters<StockMovementRepository['create']>[0];

    let movement;
    try {
      movement = await this.stockMovementRepository.create(data);
    } catch (err) {
      if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2002') {
        throw new ConflictException('Stock movement already exists');
      }
      throw err;
    }

    this.logger.log(`Stock movement created: ${movement.id} (${movement.movementType}) by ${currentUserId}`);

    await this.auditService.record({
      userId: currentUserId,
      organizationId,
      action: 'STOCK_MOVEMENT_CREATED',
      entity: 'StockMovement',
      entityId: movement.id,
      status: 'SUCCESS',
      metadata: { movementType: movement.movementType, stockId: movement.stockId },
    });

    return movement;
  }
}
