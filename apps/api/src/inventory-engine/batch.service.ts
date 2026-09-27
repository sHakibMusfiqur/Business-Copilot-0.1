import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BatchStatus, Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';

import type { BatchRepository } from './interfaces/batch-repository.interface';
import type { CreateBatchDto } from './dto/create-batch.dto';
import type { UpdateBatchDto } from './dto/update-batch.dto';
import type { QueryBatchDto } from './dto/query-batch.dto';

@Injectable()
export class BatchService {
  private readonly logger = new Logger(BatchService.name);

  constructor(
    private readonly batchRepository: BatchRepository,
    private readonly auditService: AuditService,
  ) {}

  async findAll(organizationId: string, query: QueryBatchDto) {
    const rows = await this.batchRepository.findByOrganization(organizationId);

    let items = rows;
    if (query.search) {
      const term = query.search.trim().toLowerCase();
      items = items.filter((row) => row.batchNumber.toLowerCase().includes(term));
    }
    if (query.status) {
      items = items.filter((row) => row.status === query.status);
    }

    const allowedSortFields = ['batchNumber', 'status', 'expiryDate', 'createdAt', 'updatedAt'];
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
    const batch = await this.batchRepository.findById(organizationId, id);

    if (!batch) {
      throw new NotFoundException('Batch not found');
    }

    return batch;
  }

  async create(organizationId: string, currentUserId: string, dto: CreateBatchDto) {
    const data = {
      organizationId,
      productId: dto.productId,
      batchNumber: dto.batchNumber.trim(),
      manufacturingDate: dto.manufacturingDate ? new Date(dto.manufacturingDate) : null,
      expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
      status: dto.status ?? BatchStatus.ACTIVE,
      metadata: dto.metadata ?? {},
      deletedAt: null,
    } as unknown as Parameters<BatchRepository['create']>[0];

    let batch;
    try {
      batch = await this.batchRepository.create(data);
    } catch (err) {
      if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2002') {
        throw new ConflictException('Batch with this batch number already exists for the product');
      }
      throw err;
    }

    this.logger.log(`Batch created: ${batch.batchNumber} (${batch.id}) by ${currentUserId}`);

    await this.auditService.record({
      userId: currentUserId,
      organizationId,
      action: 'BATCH_CREATED',
      entity: 'Batch',
      entityId: batch.id,
      status: 'SUCCESS',
      metadata: { batchNumber: batch.batchNumber },
    });

    return batch;
  }

  async update(organizationId: string, currentUserId: string, id: string, dto: UpdateBatchDto) {
    const data: Partial<Parameters<BatchRepository['update']>[2]> = {};

    if (dto.batchNumber !== undefined) data.batchNumber = dto.batchNumber.trim();
    if (dto.manufacturingDate !== undefined) {
      data.manufacturingDate = dto.manufacturingDate ? new Date(dto.manufacturingDate) : null;
    }
    if (dto.expiryDate !== undefined) {
      data.expiryDate = dto.expiryDate ? new Date(dto.expiryDate) : null;
    }
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.metadata !== undefined) data.metadata = dto.metadata as never;

    let batch;
    try {
      batch = await this.batchRepository.update(organizationId, id, data);
    } catch (err) {
      const code = (err as Prisma.PrismaClientKnownRequestError)?.code;
      if (code === 'P2025') {
        throw new NotFoundException('Batch not found');
      }
      if (code === 'P2002') {
        throw new ConflictException('Batch with this batch number already exists for the product');
      }
      throw err;
    }

    this.logger.log(`Batch updated: ${batch.batchNumber} (${id}) by ${currentUserId}`);

    await this.auditService.record({
      userId: currentUserId,
      organizationId,
      action: 'BATCH_UPDATED',
      entity: 'Batch',
      entityId: id,
      status: 'SUCCESS',
      metadata: { changes: Object.keys(dto) },
    });

    return batch;
  }

  async softDelete(organizationId: string, currentUserId: string, id: string) {
    try {
      await this.batchRepository.delete(organizationId, id);
    } catch (err) {
      if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2025') {
        throw new NotFoundException('Batch not found');
      }
      throw err;
    }

    this.logger.log(`Batch soft-deleted: (${id}) by ${currentUserId}`);

    await this.auditService.record({
      userId: currentUserId,
      organizationId,
      action: 'BATCH_DELETED',
      entity: 'Batch',
      entityId: id,
      status: 'SUCCESS',
    });

    return { message: 'Batch deleted successfully' };
  }
}
