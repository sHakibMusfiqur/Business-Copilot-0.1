import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SerialStatus } from '@prisma/client';

import { AuditService } from '../audit/audit.service';

import type { SerialNumberRepository } from './interfaces/serial-number-repository.interface';
import type { CreateSerialNumberDto } from './dto/create-serial-number.dto';
import type { UpdateSerialNumberDto } from './dto/update-serial-number.dto';
import type { QuerySerialNumberDto } from './dto/query-serial-number.dto';

@Injectable()
export class SerialNumberService {
  private readonly logger = new Logger(SerialNumberService.name);

  constructor(
    private readonly serialNumberRepository: SerialNumberRepository,
    private readonly auditService: AuditService,
  ) {}

  async findAll(organizationId: string, query: QuerySerialNumberDto) {
    const rows = await this.serialNumberRepository.findByOrganization(organizationId);

    let items = rows;
    if (query.search) {
      const term = query.search.trim().toLowerCase();
      items = items.filter((row) => row.serialNumber.toLowerCase().includes(term));
    }
    if (query.status) {
      items = items.filter((row) => row.status === query.status);
    }

    const allowedSortFields = ['serialNumber', 'status', 'createdAt', 'updatedAt'];
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
    const serialNumber = await this.serialNumberRepository.findById(organizationId, id);

    if (!serialNumber) {
      throw new NotFoundException('Serial number not found');
    }

    return serialNumber;
  }

  async create(organizationId: string, currentUserId: string, dto: CreateSerialNumberDto) {
    const data = {
      organizationId,
      productId: dto.productId,
      batchId: dto.batchId ?? null,
      serialNumber: dto.serialNumber.trim(),
      status: dto.status ?? SerialStatus.AVAILABLE,
      metadata: dto.metadata ?? {},
      deletedAt: null,
    } as unknown as Parameters<SerialNumberRepository['create']>[0];

    let serialNumber;
    try {
      serialNumber = await this.serialNumberRepository.create(data);
    } catch (err) {
      if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2002') {
        throw new ConflictException('Serial number already exists for the product');
      }
      throw err;
    }

    this.logger.log(`Serial number created: ${serialNumber.serialNumber} (${serialNumber.id}) by ${currentUserId}`);

    await this.auditService.record({
      userId: currentUserId,
      organizationId,
      action: 'SERIAL_NUMBER_CREATED',
      entity: 'SerialNumber',
      entityId: serialNumber.id,
      status: 'SUCCESS',
      metadata: { serialNumber: serialNumber.serialNumber },
    });

    return serialNumber;
  }

  async update(organizationId: string, currentUserId: string, id: string, dto: UpdateSerialNumberDto) {
    const data: Partial<Parameters<SerialNumberRepository['update']>[2]> = {};

    if (dto.serialNumber !== undefined) data.serialNumber = dto.serialNumber.trim();
    if (dto.batchId !== undefined) data.batchId = dto.batchId;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.metadata !== undefined) data.metadata = dto.metadata as never;

    let serialNumber;
    try {
      serialNumber = await this.serialNumberRepository.update(organizationId, id, data);
    } catch (err) {
      const code = (err as Prisma.PrismaClientKnownRequestError)?.code;
      if (code === 'P2025') {
        throw new NotFoundException('Serial number not found');
      }
      if (code === 'P2002') {
        throw new ConflictException('Serial number already exists for the product');
      }
      throw err;
    }

    this.logger.log(`Serial number updated: ${serialNumber.serialNumber} (${id}) by ${currentUserId}`);

    await this.auditService.record({
      userId: currentUserId,
      organizationId,
      action: 'SERIAL_NUMBER_UPDATED',
      entity: 'SerialNumber',
      entityId: id,
      status: 'SUCCESS',
      metadata: { changes: Object.keys(dto) },
    });

    return serialNumber;
  }

  async softDelete(organizationId: string, currentUserId: string, id: string) {
    try {
      await this.serialNumberRepository.delete(organizationId, id);
    } catch (err) {
      if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2025') {
        throw new NotFoundException('Serial number not found');
      }
      throw err;
    }

    this.logger.log(`Serial number soft-deleted: (${id}) by ${currentUserId}`);

    await this.auditService.record({
      userId: currentUserId,
      organizationId,
      action: 'SERIAL_NUMBER_DELETED',
      entity: 'SerialNumber',
      entityId: id,
      status: 'SUCCESS',
    });

    return { message: 'Serial number deleted successfully' };
  }
}
