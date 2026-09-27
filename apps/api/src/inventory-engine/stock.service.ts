import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StockStatus } from '@prisma/client';

import { AuditService } from '../audit/audit.service';

import type { StockRepository } from './interfaces/stock-repository.interface';
import type { CreateStockDto } from './dto/create-stock.dto';
import type { UpdateStockDto } from './dto/update-stock.dto';
import type { QueryStockDto } from './dto/query-stock.dto';

@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  constructor(
    private readonly stockRepository: StockRepository,
    private readonly auditService: AuditService,
  ) {}

  async findAll(organizationId: string, query: QueryStockDto) {
    const rows = await this.stockRepository.findByOrganization(organizationId);

    let items = query.status ? rows.filter((row) => row.status === query.status) : rows;

    const allowedSortFields = ['status', 'quantity', 'totalValue', 'createdAt', 'updatedAt'];
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
    const stock = await this.stockRepository.findById(organizationId, id);

    if (!stock) {
      throw new NotFoundException('Stock not found');
    }

    return stock;
  }

  async create(organizationId: string, currentUserId: string, dto: CreateStockDto) {
    const data = {
      organizationId,
      warehouseId: dto.warehouseId,
      productId: dto.productId,
      batchId: dto.batchId ?? null,
      serialNumberId: dto.serialNumberId ?? null,
      quantity: dto.quantity ?? 0,
      reservedQuantity: dto.reservedQuantity ?? 0,
      damagedQuantity: dto.damagedQuantity ?? 0,
      returnedQuantity: dto.returnedQuantity ?? 0,
      inTransitQuantity: dto.inTransitQuantity ?? 0,
      safetyStock: dto.safetyStock ?? 0,
      reorderLevel: dto.reorderLevel ?? 0,
      unitCost: new Prisma.Decimal(dto.unitCost ?? 0),
      totalValue: new Prisma.Decimal(dto.totalValue ?? 0),
      status: dto.status ?? StockStatus.ACTIVE,
      metadata: dto.metadata ?? {},
    } as unknown as Parameters<StockRepository['create']>[0];

    let stock;
    try {
      stock = await this.stockRepository.create(data);
    } catch (err) {
      if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2002') {
        throw new ConflictException('Stock already exists for this warehouse, product, batch and serial combination');
      }
      throw err;
    }

    this.logger.log(`Stock created: ${stock.id} (${stock.warehouseId}/${stock.productId}) by ${currentUserId}`);

    await this.auditService.record({
      userId: currentUserId,
      organizationId,
      action: 'STOCK_CREATED',
      entity: 'Stock',
      entityId: stock.id,
      status: 'SUCCESS',
      metadata: { warehouseId: stock.warehouseId, productId: stock.productId },
    });

    return stock;
  }

  async update(organizationId: string, currentUserId: string, id: string, dto: UpdateStockDto) {
    const data: Partial<Parameters<StockRepository['update']>[2]> = {};

    if (dto.batchId !== undefined) data.batchId = dto.batchId;
    if (dto.serialNumberId !== undefined) data.serialNumberId = dto.serialNumberId;
    if (dto.quantity !== undefined) data.quantity = dto.quantity;
    if (dto.reservedQuantity !== undefined) data.reservedQuantity = dto.reservedQuantity;
    if (dto.damagedQuantity !== undefined) data.damagedQuantity = dto.damagedQuantity;
    if (dto.returnedQuantity !== undefined) data.returnedQuantity = dto.returnedQuantity;
    if (dto.inTransitQuantity !== undefined) data.inTransitQuantity = dto.inTransitQuantity;
    if (dto.safetyStock !== undefined) data.safetyStock = dto.safetyStock;
    if (dto.reorderLevel !== undefined) data.reorderLevel = dto.reorderLevel;
    if (dto.unitCost !== undefined) data.unitCost = new Prisma.Decimal(dto.unitCost);
    if (dto.totalValue !== undefined) data.totalValue = new Prisma.Decimal(dto.totalValue);
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.metadata !== undefined) data.metadata = dto.metadata as never;

    let stock;
    try {
      stock = await this.stockRepository.update(organizationId, id, data);
    } catch (err) {
      const code = (err as Prisma.PrismaClientKnownRequestError)?.code;
      if (code === 'P2025') {
        throw new NotFoundException('Stock not found');
      }
      if (code === 'P2002') {
        throw new ConflictException('Stock already exists for this warehouse, product, batch and serial combination');
      }
      throw err;
    }

    this.logger.log(`Stock updated: (${id}) by ${currentUserId}`);

    await this.auditService.record({
      userId: currentUserId,
      organizationId,
      action: 'STOCK_UPDATED',
      entity: 'Stock',
      entityId: id,
      status: 'SUCCESS',
      metadata: { changes: Object.keys(dto) },
    });

    return stock;
  }
}
