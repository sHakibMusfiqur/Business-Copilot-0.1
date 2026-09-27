import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ReservationStatus } from '@prisma/client';

import { AuditService } from '../audit/audit.service';

import type { StockReservationRepository } from './interfaces/stock-reservation-repository.interface';
import type { CreateStockReservationDto } from './dto/create-stock-reservation.dto';
import type { UpdateStockReservationDto } from './dto/update-stock-reservation.dto';
import type { QueryStockReservationDto } from './dto/query-stock-reservation.dto';

@Injectable()
export class StockReservationService {
  private readonly logger = new Logger(StockReservationService.name);

  constructor(
    private readonly stockReservationRepository: StockReservationRepository,
    private readonly auditService: AuditService,
  ) {}

  async findAll(organizationId: string, query: QueryStockReservationDto) {
    const rows = await this.stockReservationRepository.findByOrganization(organizationId);

    let items = rows;
    if (query.status) {
      items = items.filter((row) => row.status === query.status);
    }
    if (query.stockId) {
      items = items.filter((row) => row.stockId === query.stockId);
    }

    const allowedSortFields = ['status', 'quantity', 'expiresAt', 'createdAt', 'updatedAt'];
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
    const reservation = await this.stockReservationRepository.findById(organizationId, id);

    if (!reservation) {
      throw new NotFoundException('Stock reservation not found');
    }

    return reservation;
  }

  async create(organizationId: string, currentUserId: string, dto: CreateStockReservationDto) {
    const referencesValid = await this.stockReservationRepository.verifyReferences(organizationId, {
      stockId: dto.stockId,
    });
    if (!referencesValid) {
      throw new BadRequestException('Related record not found');
    }

    const data = {
      organizationId,
      stockId: dto.stockId,
      quantity: dto.quantity,
      reservedQuantity: dto.reservedQuantity ?? 0,
      status: dto.status ?? ReservationStatus.PENDING,
      referenceType: dto.referenceType ?? null,
      referenceId: dto.referenceId ?? null,
      notes: dto.notes ?? null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      metadata: dto.metadata ?? {},
    } as unknown as Parameters<StockReservationRepository['create']>[0];

    let reservation;
    try {
      reservation = await this.stockReservationRepository.create(data);
    } catch (err) {
      if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2002') {
        throw new ConflictException('Stock reservation already exists');
      }
      throw err;
    }

    this.logger.log(`Stock reservation created: ${reservation.id} (${reservation.status}) by ${currentUserId}`);

    await this.auditService.record({
      userId: currentUserId,
      organizationId,
      action: 'STOCK_RESERVATION_CREATED',
      entity: 'StockReservation',
      entityId: reservation.id,
      status: 'SUCCESS',
      metadata: { stockId: reservation.stockId, quantity: reservation.quantity },
    });

    return reservation;
  }

  async update(organizationId: string, currentUserId: string, id: string, dto: UpdateStockReservationDto) {
    const data: Partial<Parameters<StockReservationRepository['update']>[2]> = {};

    if (dto.quantity !== undefined) data.quantity = dto.quantity;
    if (dto.reservedQuantity !== undefined) data.reservedQuantity = dto.reservedQuantity;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.referenceType !== undefined) data.referenceType = dto.referenceType;
    if (dto.referenceId !== undefined) data.referenceId = dto.referenceId;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.expiresAt !== undefined) data.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (dto.metadata !== undefined) data.metadata = dto.metadata as never;

    let reservation;
    try {
      reservation = await this.stockReservationRepository.update(organizationId, id, data);
    } catch (err) {
      const code = (err as Prisma.PrismaClientKnownRequestError)?.code;
      if (code === 'P2025') {
        throw new NotFoundException('Stock reservation not found');
      }
      if (code === 'P2002') {
        throw new ConflictException('Stock reservation already exists');
      }
      throw err;
    }

    this.logger.log(`Stock reservation updated: (${id}) by ${currentUserId}`);

    await this.auditService.record({
      userId: currentUserId,
      organizationId,
      action: 'STOCK_RESERVATION_UPDATED',
      entity: 'StockReservation',
      entityId: id,
      status: 'SUCCESS',
      metadata: { changes: Object.keys(dto) },
    });

    return reservation;
  }
}
