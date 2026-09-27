import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TransferStatus } from '@prisma/client';

import { AuditService } from '../audit/audit.service';

import type { WarehouseTransferRepository } from './interfaces/warehouse-transfer-repository.interface';
import type { CreateWarehouseTransferDto } from './dto/create-warehouse-transfer.dto';
import type { UpdateWarehouseTransferDto } from './dto/update-warehouse-transfer.dto';
import type { QueryWarehouseTransferDto } from './dto/query-warehouse-transfer.dto';

@Injectable()
export class WarehouseTransferService {
  private readonly logger = new Logger(WarehouseTransferService.name);

  constructor(
    private readonly warehouseTransferRepository: WarehouseTransferRepository,
    private readonly auditService: AuditService,
  ) {}

  async findAll(organizationId: string, query: QueryWarehouseTransferDto) {
    const rows = await this.warehouseTransferRepository.findByOrganization(organizationId);

    let items = rows;
    if (query.search) {
      const term = query.search.trim().toLowerCase();
      items = items.filter((row) => row.transferNumber.toLowerCase().includes(term));
    }
    if (query.status) {
      items = items.filter((row) => row.status === query.status);
    }

    const allowedSortFields = ['transferNumber', 'status', 'createdAt', 'updatedAt'];
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
    const transfer = await this.warehouseTransferRepository.findById(organizationId, id);

    if (!transfer) {
      throw new NotFoundException('Warehouse transfer not found');
    }

    return transfer;
  }

  async create(organizationId: string, currentUserId: string, dto: CreateWarehouseTransferDto) {
    const data = {
      organizationId,
      sourceWarehouseId: dto.sourceWarehouseId,
      destWarehouseId: dto.destWarehouseId,
      transferNumber: dto.transferNumber.trim(),
      status: dto.status ?? TransferStatus.DRAFT,
      notes: dto.notes ?? null,
      metadata: dto.metadata ?? {},
      deletedAt: null,
    } as unknown as Parameters<WarehouseTransferRepository['create']>[0];

    let transfer;
    try {
      transfer = await this.warehouseTransferRepository.create(data);
    } catch (err) {
      if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2002') {
        throw new ConflictException('Warehouse transfer with this transfer number already exists');
      }
      throw err;
    }

    this.logger.log(`Warehouse transfer created: ${transfer.transferNumber} (${transfer.id}) by ${currentUserId}`);

    await this.auditService.record({
      userId: currentUserId,
      organizationId,
      action: 'WAREHOUSE_TRANSFER_CREATED',
      entity: 'WarehouseTransfer',
      entityId: transfer.id,
      status: 'SUCCESS',
      metadata: { transferNumber: transfer.transferNumber },
    });

    return transfer;
  }

  async update(organizationId: string, currentUserId: string, id: string, dto: UpdateWarehouseTransferDto) {
    const data: Partial<Parameters<WarehouseTransferRepository['update']>[2]> = {};

    if (dto.status !== undefined) data.status = dto.status;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.metadata !== undefined) data.metadata = dto.metadata as never;

    let transfer;
    try {
      transfer = await this.warehouseTransferRepository.update(organizationId, id, data);
    } catch (err) {
      const code = (err as Prisma.PrismaClientKnownRequestError)?.code;
      if (code === 'P2025') {
        throw new NotFoundException('Warehouse transfer not found');
      }
      if (code === 'P2002') {
        throw new ConflictException('Warehouse transfer with this transfer number already exists');
      }
      throw err;
    }

    this.logger.log(`Warehouse transfer updated: ${transfer.transferNumber} (${id}) by ${currentUserId}`);

    await this.auditService.record({
      userId: currentUserId,
      organizationId,
      action: 'WAREHOUSE_TRANSFER_UPDATED',
      entity: 'WarehouseTransfer',
      entityId: id,
      status: 'SUCCESS',
      metadata: { changes: Object.keys(dto) },
    });

    return transfer;
  }

  async softDelete(organizationId: string, currentUserId: string, id: string) {
    try {
      await this.warehouseTransferRepository.delete(organizationId, id);
    } catch (err) {
      if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2025') {
        throw new NotFoundException('Warehouse transfer not found');
      }
      throw err;
    }

    this.logger.log(`Warehouse transfer soft-deleted: (${id}) by ${currentUserId}`);

    await this.auditService.record({
      userId: currentUserId,
      organizationId,
      action: 'WAREHOUSE_TRANSFER_DELETED',
      entity: 'WarehouseTransfer',
      entityId: id,
      status: 'SUCCESS',
    });

    return { message: 'Warehouse transfer deleted successfully' };
  }
}
