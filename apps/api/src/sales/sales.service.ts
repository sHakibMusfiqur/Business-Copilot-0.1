import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SalesStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { AccountingService } from '../accounting/accounting.service';

import type { QuerySaleDto } from './dto/query-sale.dto';
import type { CreateSaleDto } from './dto/create-sale.dto';
import type { UpdateSaleDto } from './dto/update-sale.dto';

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingService: AccountingService,
  ) {}

  async findAll(orgId: string, query: QuerySaleDto) {
    const { page = 1, limit = 10, search, customerId, status, dateFrom, dateTo, sortBy = 'createdAt', sortOrder = 'desc' } = query;

    const where: Prisma.SalesOrderWhereInput = {
      organizationId: orgId,
      deletedAt: null,
    };

    if (search) {
      const sanitized = search.trim();
      where.OR = [
        { orderNumber: { contains: sanitized, mode: 'insensitive' } },
        { notes: { contains: sanitized, mode: 'insensitive' } },
        { customer: { name: { contains: sanitized, mode: 'insensitive' } } },
      ];
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (status) {
      where.status = status;
    }

    if (dateFrom || dateTo) {
      where.orderDate = {};
      if (dateFrom) { where.orderDate.gte = new Date(dateFrom); }
      if (dateTo) { where.orderDate.lte = new Date(dateTo); }
    }

    const allowedSortFields = ['orderNumber', 'total', 'status', 'createdAt', 'orderDate'];
    const field = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const order = sortOrder === 'asc' ? 'asc' : 'desc';

    const [total, sales] = await Promise.all([
      this.prisma.salesOrder.count({ where }),
      this.prisma.salesOrder.findMany({
        where,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          subtotal: true,
          discount: true,
          tax: true,
          shippingCost: true,
          total: true,
          notes: true,
          orderDate: true,
          createdAt: true,
          customer: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          items: { select: { id: true, quantity: true, unitPrice: true, lineTotal: true } },
        },
        orderBy: { [field]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const data = sales.map((s) => ({
      ...s,
      itemCount: s.items.length,
    }));

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(orgId: string, saleId: string) {
    const sale = await this.prisma.salesOrder.findFirst({
      where: { id: saleId, organizationId: orgId, deletedAt: null },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        subtotal: true,
        discount: true,
        tax: true,
        shippingCost: true,
        total: true,
        notes: true,
        orderDate: true,
        createdAt: true,
        updatedAt: true,
        customer: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        items: {
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            discount: true,
            tax: true,
            lineTotal: true,
            productId: true,
            product: { select: { id: true, name: true, sku: true } },
          },
        },
      },
    });

    if (!sale) {
      throw new NotFoundException('Sales order not found');
    }

    return sale;
  }

  async create(orgId: string, userId: string, dto: CreateSaleDto) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, organizationId: orgId, deletedAt: null },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const productIds = dto.items.map((item) => item.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, organizationId: orgId, deletedAt: null },
      select: { id: true, name: true, unitPrice: true },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException('One or more products not found');
    }

    const itemsData: Array<{
      productId: string;
      description: string;
      quantity: number;
      unitPrice: number;
      discount: number;
      tax: number;
      lineTotal: number;
    }> = dto.items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      const unitPrice = Number(product?.unitPrice ?? 0);
      const lineTotal = (unitPrice * item.quantity) - (item.discount ?? 0) + (item.tax ?? 0);
      return {
        productId: item.productId,
        description: product?.name ?? '',
        quantity: item.quantity,
        unitPrice,
        discount: item.discount ?? 0,
        tax: item.tax ?? 0,
        lineTotal,
      };
    });

    const subtotal = itemsData.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const totalDiscount = itemsData.reduce((sum, item) => sum + item.discount, 0);
    const totalTax = itemsData.reduce((sum, item) => sum + item.tax, 0);
    const total = subtotal - totalDiscount + totalTax;

    const maxRetries = 5;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const orderNumber = await this.generateOrderNumber();

      try {
        const sale = await this.prisma.salesOrder.create({
          data: {
            orderNumber,
            organizationId: orgId,
            customerId: dto.customerId,
            subtotal,
            discount: totalDiscount,
            tax: totalTax,
            total,
            notes: dto.notes ?? null,
            createdById: userId,
            items: { create: itemsData },
          },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            total: true,
            createdAt: true,
          },
        });

        this.logger.log(`Sales order created: ${sale.orderNumber} (${sale.id}) by ${userId}`);
        return sale;
      } catch (err) {
        if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2002' && attempt < maxRetries) {
          this.logger.warn(`Order number collision for ${orderNumber}, retrying (${attempt}/${maxRetries})`);
          continue;
        }
        throw err;
      }
    }

    throw new InternalServerErrorException('Failed to create sales order due to order number collision. Please try again.');
  }

  async update(orgId: string, userId: string, saleId: string, dto: UpdateSaleDto) {
    const existing = await this.prisma.salesOrder.findFirst({
      where: { id: saleId, organizationId: orgId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Sales order not found');
    }

    if (existing.status !== SalesStatus.DRAFT && existing.status !== SalesStatus.PENDING) {
      throw new ConflictException('Only DRAFT or PENDING sales orders can be updated');
    }

    const updateData: Prisma.SalesOrderUpdateInput = {};

    if (dto.customerId !== undefined) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, organizationId: orgId, deletedAt: null },
      });
      if (!customer) throw new NotFoundException('Customer not found');
      updateData.customer = { connect: { id: dto.customerId } };
    }

    if (dto.notes !== undefined) {
      updateData.notes = dto.notes;
    }

    if (dto.items) {
      const productIds = dto.items.map((item) => item.productId);
      const products = await this.prisma.product.findMany({
        where: { id: { in: productIds }, organizationId: orgId, deletedAt: null },
        select: { id: true, name: true, unitPrice: true },
      });

      if (products.length !== productIds.length) {
        throw new BadRequestException('One or more products not found');
      }

      const itemsData = dto.items.map((item) => {
        const product = products.find((p) => p.id === item.productId);
        const unitPrice = Number(product?.unitPrice ?? 0);
        const lineTotal = (unitPrice * item.quantity) - (item.discount ?? 0) + (item.tax ?? 0);
        return {
          productId: item.productId,
          description: product?.name ?? '',
          quantity: item.quantity,
          unitPrice,
          discount: item.discount ?? 0,
          tax: item.tax ?? 0,
          lineTotal,
        };
      });

      const subtotal = itemsData.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
      const totalDiscount = itemsData.reduce((sum, item) => sum + item.discount, 0);
      const totalTax = itemsData.reduce((sum, item) => sum + item.tax, 0);
      const total = subtotal - totalDiscount + totalTax;

      await this.prisma.$transaction(async (tx) => {
        await tx.salesOrderItem.deleteMany({
          where: { salesOrderId: saleId },
        });

        await tx.salesOrderItem.createMany({
          data: itemsData.map((d) => ({ ...d, salesOrderId: saleId })),
        });

        await tx.salesOrder.update({
          where: { id: saleId },
          data: {
            subtotal,
            discount: totalDiscount,
            tax: totalTax,
            total,
            customerId: dto.customerId ?? undefined,
            notes: dto.notes ?? undefined,
          },
        });
      });

      return { id: saleId, message: 'Sales order updated successfully' };
    }

    const updated = await this.prisma.salesOrder.update({
      where: { id: saleId },
      data: updateData,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        updatedAt: true,
      },
    });

    this.logger.log(`Sales order updated: ${updated.orderNumber} (${saleId}) by ${userId}`);
    return updated;
  }

  async confirm(orgId: string, userId: string, saleId: string) {
    const sale = await this.prisma.salesOrder.findFirst({
      where: { id: saleId, organizationId: orgId, deletedAt: null },
    });

    if (!sale) {
      throw new NotFoundException('Sales order not found');
    }

    if (sale.status !== SalesStatus.PENDING) {
      throw new ConflictException('Only PENDING sales orders can be confirmed');
    }

    const updated = await this.prisma.salesOrder.update({
      where: { id: saleId },
      data: { status: SalesStatus.CONFIRMED },
      select: { id: true, orderNumber: true, status: true },
    });

    this.logger.log(`Sales order confirmed: ${updated.orderNumber} (${saleId}) by ${userId}`);
    return updated;
  }

  async deliver(orgId: string, userId: string, saleId: string, notes?: string) {
    const sale = await this.prisma.salesOrder.findFirst({
      where: { id: saleId, organizationId: orgId, deletedAt: null },
      include: { items: { select: { productId: true, quantity: true } } },
    });

    if (!sale) {
      throw new NotFoundException('Sales order not found');
    }

    if (sale.status !== SalesStatus.CONFIRMED) {
      throw new ConflictException('Only CONFIRMED sales orders can be delivered');
    }

    return this.prisma.$transaction(async (tx) => {
      const gate = await tx.salesOrder.updateMany({
        where: {
          id: saleId,
          organizationId: orgId,
          status: SalesStatus.CONFIRMED,
        },
        data: { status: SalesStatus.DELIVERED },
      });

      if (gate.count === 0) {
        const now = await tx.salesOrder.findUnique({
          where: { id: saleId },
          select: { orderNumber: true },
        });

        if (!now) {
          throw new NotFoundException('Sales order not found');
        }

        throw new ConflictException('Only CONFIRMED sales orders can be delivered');
      }

      for (const item of sale.items) {
        if (!item.productId) continue;

        const inventory = await tx.inventory.findFirst({
          where: { productId: item.productId, warehouseId: null },
        });

        const requestedQuantity = Number(item.quantity);

        if (!inventory) {
          throw new BadRequestException(
            `Insufficient stock for product ${item.productId}. Available: 0, requested: ${requestedQuantity}`,
          );
        }

        const result = await tx.inventory.updateMany({
          where: {
            id: inventory.id,
            quantity: { gte: requestedQuantity },
          },
          data: { quantity: { decrement: requestedQuantity } },
        });

        if (result.count === 0) {
          const current = await tx.inventory.findUnique({ where: { id: inventory.id } });
          const available = current ? Number(current.quantity) : 0;
          throw new BadRequestException(
            `Insufficient stock for product ${item.productId}. Available: ${available}, requested: ${requestedQuantity}`,
          );
        }

        const refreshed = await tx.inventory.findUnique({ where: { id: inventory.id } });
        const newQuantity = Number(refreshed?.quantity ?? 0);
        const previousQuantity = newQuantity + requestedQuantity;

        await tx.inventoryTransaction.create({
          data: {
            organizationId: orgId,
            productId: item.productId,
            type: 'OUT',
            quantity: requestedQuantity,
            previousQuantity,
            newQuantity,
            reference: sale.orderNumber,
            notes: notes ?? `Sales delivered: ${sale.orderNumber}`,
            createdById: userId,
          },
        });
      }

      await this.accountingService.createReceivableForSales(orgId, saleId, tx);
      await this.accountingService.createRevenueJournalEntry(orgId, userId, saleId, tx);
      await this.accountingService.createCOGSJournalEntry(orgId, userId, saleId, tx);

      const updated = await tx.salesOrder.findUnique({
        where: { id: saleId },
        select: { id: true, orderNumber: true, status: true, updatedAt: true },
      });

      if (!updated) {
        throw new NotFoundException('Sales order not found');
      }

      this.logger.log(`Sales order delivered: ${updated.orderNumber} (${saleId}) by ${userId}`);
      return updated;
    });
  }

  async softDelete(orgId: string, userId: string, saleId: string) {
    const sale = await this.prisma.salesOrder.findFirst({
      where: { id: saleId, organizationId: orgId, deletedAt: null },
    });

    if (!sale) {
      throw new NotFoundException('Sales order not found');
    }

    if (sale.status !== SalesStatus.DRAFT) {
      throw new ConflictException('Only DRAFT sales orders can be deleted');
    }

    await this.prisma.salesOrder.update({
      where: { id: saleId },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Sales order deleted: ${sale.orderNumber} (${saleId}) by ${userId}`);
    return { message: 'Sales order deleted successfully' };
  }

  private async generateOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `SO-${year}-`;

    const lastOrder = await this.prisma.salesOrder.findFirst({
      where: { orderNumber: { startsWith: prefix } },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });

    let nextSeq = 1;
    if (lastOrder) {
      const parts = lastOrder.orderNumber.split('-');
      nextSeq = parseInt(parts[parts.length - 1], 10) + 1;
    }

    return `${prefix}${String(nextSeq).padStart(6, '0')}`;
  }
}
