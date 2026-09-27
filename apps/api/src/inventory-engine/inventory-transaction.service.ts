import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';

import type { InventoryTransactionRepository } from './interfaces/inventory-transaction-repository.interface';
import type { CreateInventoryTransactionDto } from './dto/create-inventory-transaction.dto';
import type { QueryInventoryTransactionDto } from './dto/query-inventory-transaction.dto';

/**
 * Append-only ledger service: create/read only. No update or delete methods
 * exist by design. Legacy `type` and engine `transactionType` coexist and are
 * never mapped to each other; no backfill is performed. `createdById` is
 * server-derived from the authenticated user, never from the client DTO.
 */
@Injectable()
export class InventoryTransactionService {
  private readonly logger = new Logger(InventoryTransactionService.name);

  constructor(
    private readonly inventoryTransactionRepository: InventoryTransactionRepository,
    private readonly auditService: AuditService,
  ) {}

  async findAll(organizationId: string, query: QueryInventoryTransactionDto) {
    const rows = await this.inventoryTransactionRepository.findByOrganization(organizationId);

    let items = rows;
    if (query.type) {
      items = items.filter((row) => row.type === query.type);
    }
    if (query.transactionType) {
      items = items.filter((row) => row.transactionType === query.transactionType);
    }
    if (query.productId) {
      items = items.filter((row) => row.productId === query.productId);
    }

    const allowedSortFields = ['type', 'transactionType', 'quantity', 'createdAt'];
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
    const transaction = await this.inventoryTransactionRepository.findById(organizationId, id);

    if (!transaction) {
      throw new NotFoundException('Inventory transaction not found');
    }

    return transaction;
  }

  async create(organizationId: string, currentUserId: string, dto: CreateInventoryTransactionDto) {
    const referencesValid = await this.inventoryTransactionRepository.verifyReferences(organizationId, {
      productId: dto.productId,
    });
    if (!referencesValid) {
      throw new BadRequestException('Related record not found');
    }

    const data = {
      organizationId,
      productId: dto.productId,
      type: dto.type,
      quantity: dto.quantity,
      previousQuantity: dto.previousQuantity ?? 0,
      newQuantity: dto.newQuantity ?? 0,
      reference: dto.reference ?? null,
      notes: dto.notes ?? null,
      createdById: currentUserId,
      transactionType: dto.transactionType ?? null,
      referenceType: dto.referenceType ?? null,
      referenceId: dto.referenceId ?? null,
      totalQuantity: dto.totalQuantity ?? null,
      totalValue: dto.totalValue !== undefined ? new Prisma.Decimal(dto.totalValue) : null,
      status: dto.status ?? null,
      metadata: dto.metadata ?? null,
    } as unknown as Parameters<InventoryTransactionRepository['create']>[0];

    let transaction;
    try {
      transaction = await this.inventoryTransactionRepository.create(data);
    } catch (err) {
      if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2002') {
        throw new ConflictException('Inventory transaction already exists');
      }
      throw err;
    }

    this.logger.log(`Inventory transaction created: ${transaction.id} (legacy type=${transaction.type}) by ${currentUserId}`);

    await this.auditService.record({
      userId: currentUserId,
      organizationId,
      action: 'INVENTORY_TRANSACTION_CREATED',
      entity: 'InventoryTransaction',
      entityId: transaction.id,
      status: 'SUCCESS',
      metadata: { type: transaction.type, productId: transaction.productId },
    });

    return transaction;
  }
}
