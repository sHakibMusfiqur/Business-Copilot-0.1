import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PurchaseStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { AccountingService } from '../accounting/accounting.service';

import type { QueryPurchaseDto } from './dto/query-purchase.dto';
import type { CreatePurchaseDto } from './dto/create-purchase.dto';
import type { UpdatePurchaseDto } from './dto/update-purchase.dto';

@Injectable()
export class PurchaseService {
  private readonly logger = new Logger(PurchaseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingService: AccountingService,
  ) {}

  async findAll(orgId: string, query: QueryPurchaseDto) {
    const { page = 1, limit = 10, search, supplierId, status, dateFrom, dateTo, sortBy = 'createdAt', sortOrder = 'desc' } = query;

    const where: Prisma.PurchaseOrderWhereInput = {
      organizationId: orgId,
      deletedAt: null,
    };

    if (search) {
      const sanitized = search.trim();
      where.OR = [
        { orderNumber: { contains: sanitized, mode: 'insensitive' } },
        { notes: { contains: sanitized, mode: 'insensitive' } },
        { supplier: { name: { contains: sanitized, mode: 'insensitive' } } },
      ];
    }

    if (supplierId) {
      where.supplierId = supplierId;
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

    const [total, purchases] = await Promise.all([
      this.prisma.purchaseOrder.count({ where }),
      this.prisma.purchaseOrder.findMany({
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
          supplier: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          items: { select: { id: true, quantity: true, unitCost: true, lineTotal: true } },
        },
        orderBy: { [field]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const data = purchases.map((p) => ({
      ...p,
      itemCount: p.items.length,
    }));

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(orgId: string, purchaseId: string) {
    const purchase = await this.prisma.purchaseOrder.findFirst({
      where: { id: purchaseId, organizationId: orgId, deletedAt: null },
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
        supplier: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        items: {
          select: {
            id: true,
            quantity: true,
            unitCost: true,
            discount: true,
            tax: true,
            lineTotal: true,
            productId: true,
            product: { select: { id: true, name: true, sku: true } },
          },
        },
      },
    });

    if (!purchase) {
      throw new NotFoundException('Purchase order not found');
    }

    return purchase;
  }

  async create(orgId: string, userId: string, dto: CreatePurchaseDto) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplierId, organizationId: orgId, deletedAt: null },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    const productIds = dto.items.map((item) => item.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, organizationId: orgId, deletedAt: null },
      select: { id: true, name: true, costPrice: true },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException('One or more products not found');
    }

    const orderNumber = await this.generateOrderNumber();

    const itemsData = this.buildPurchaseItems(dto.items, products);

    const subtotal = itemsData.reduce((sum, item) => sum + (item.unitCost * item.quantity), 0);
    const totalDiscount = itemsData.reduce((sum, item) => sum + item.discount, 0);
    const totalTax = itemsData.reduce((sum, item) => sum + item.tax, 0);
    const total = subtotal - totalDiscount + totalTax;

    if (total < 0) {
      throw new BadRequestException('Purchase order total cannot be negative');
    }

    const purchase = await this.prisma.purchaseOrder.create({
      data: {
        orderNumber,
        organizationId: orgId,
        supplierId: dto.supplierId,
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

    this.logger.log(`Purchase created: ${purchase.orderNumber} (${purchase.id}) by ${userId}`);
    return purchase;
  }

  async update(orgId: string, userId: string, purchaseId: string, dto: UpdatePurchaseDto) {
    const existing = await this.prisma.purchaseOrder.findFirst({
      where: { id: purchaseId, organizationId: orgId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Purchase order not found');
    }

    if (existing.status !== PurchaseStatus.DRAFT && existing.status !== PurchaseStatus.PENDING) {
      throw new ConflictException('Only DRAFT or PENDING purchase orders can be updated');
    }

    const updateData: Prisma.PurchaseOrderUpdateInput = {};

    if (dto.supplierId !== undefined) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: dto.supplierId, organizationId: orgId, deletedAt: null },
      });
      if (!supplier) throw new NotFoundException('Supplier not found');
      updateData.supplier = { connect: { id: dto.supplierId } };
    }

    if (dto.notes !== undefined) {
      updateData.notes = dto.notes;
    }

    if (dto.items) {
      const productIds = dto.items.map((item) => item.productId);
      const products = await this.prisma.product.findMany({
        where: { id: { in: productIds }, organizationId: orgId, deletedAt: null },
        select: { id: true, name: true, costPrice: true },
      });

      if (products.length !== productIds.length) {
        throw new BadRequestException('One or more products not found');
      }

      const itemsData = this.buildPurchaseItems(dto.items, products);

      const subtotal = itemsData.reduce((sum, item) => sum + (item.unitCost * item.quantity), 0);
      const totalDiscount = itemsData.reduce((sum, item) => sum + item.discount, 0);
      const totalTax = itemsData.reduce((sum, item) => sum + item.tax, 0);
      const total = subtotal - totalDiscount + totalTax;

      if (total < 0) {
        throw new BadRequestException('Purchase order total cannot be negative');
      }

      await this.prisma.purchaseOrderItem.deleteMany({
        where: { purchaseOrderId: purchaseId },
      });

      await this.prisma.purchaseOrderItem.createMany({
        data: itemsData.map((d) => ({ ...d, purchaseOrderId: purchaseId })),
      });

      updateData.subtotal = subtotal;
      updateData.discount = totalDiscount;
      updateData.tax = totalTax;
      updateData.total = total;
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id: purchaseId },
      data: updateData,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        updatedAt: true,
      },
    });

    this.logger.log(`Purchase updated: ${updated.orderNumber} (${purchaseId}) by ${userId}`);
    return updated;
  }

  async submit(orgId: string, userId: string, purchaseId: string) {
    const purchase = await this.prisma.purchaseOrder.findFirst({
      where: { id: purchaseId, organizationId: orgId, deletedAt: null },
    });

    if (!purchase) {
      throw new NotFoundException('Purchase order not found');
    }

    if (purchase.status !== PurchaseStatus.DRAFT) {
      throw new ConflictException('Only DRAFT purchase orders can be submitted');
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id: purchaseId },
      data: { status: PurchaseStatus.PENDING },
      select: { id: true, orderNumber: true, status: true },
    });

    this.logger.log(`Purchase submitted: ${updated.orderNumber} (${purchaseId}) by ${userId}`);
    return updated;
  }

  async approve(orgId: string, userId: string, purchaseId: string) {
    const purchase = await this.prisma.purchaseOrder.findFirst({
      where: { id: purchaseId, organizationId: orgId, deletedAt: null },
    });

    if (!purchase) {
      throw new NotFoundException('Purchase order not found');
    }

    if (purchase.status !== PurchaseStatus.PENDING) {
      throw new ConflictException('Only PENDING purchase orders can be approved');
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id: purchaseId },
      data: { status: PurchaseStatus.APPROVED },
      select: { id: true, orderNumber: true, status: true },
    });

    this.logger.log(`Purchase approved: ${updated.orderNumber} (${purchaseId}) by ${userId}`);
    return updated;
  }

  async receive(orgId: string, userId: string, purchaseId: string, notes?: string) {
    const purchase = await this.prisma.purchaseOrder.findFirst({
      where: { id: purchaseId, organizationId: orgId, deletedAt: null },
      include: { items: { select: { productId: true, quantity: true } } },
    });

    if (!purchase) {
      throw new NotFoundException('Purchase order not found');
    }

    if (purchase.status !== PurchaseStatus.APPROVED) {
      throw new ConflictException('Only APPROVED purchase orders can be received');
    }

    return this.prisma.$transaction(async (tx) => {
      const gate = await tx.purchaseOrder.updateMany({
        where: {
          id: purchaseId,
          organizationId: orgId,
          status: PurchaseStatus.APPROVED,
        },
        data: { status: PurchaseStatus.RECEIVED },
      });

      if (gate.count === 0) {
        const now = await tx.purchaseOrder.findUnique({
          where: { id: purchaseId },
          select: { orderNumber: true },
        });

        if (!now) {
          throw new NotFoundException('Purchase order not found');
        }

        throw new ConflictException('Only APPROVED purchase orders can be received');
      }

      for (const item of purchase.items) {
        if (!item.productId) continue;

        const inventory = await tx.inventory.findFirst({
          where: { productId: item.productId, warehouseId: null, product: { organizationId: orgId } },
        });

        const receivedQuantity = Number(item.quantity);

        if (inventory) {
          const result = await tx.inventory.updateMany({
            where: { id: inventory.id },
            data: { quantity: { increment: receivedQuantity } },
          });

          if (result.count === 0) {
            throw new NotFoundException('Inventory record not found');
          }

          const refreshed = await tx.inventory.findUnique({ where: { id: inventory.id } });
          const newQuantity = Number(refreshed?.quantity ?? 0);
          const previousQuantity = newQuantity - receivedQuantity;

          await tx.inventoryTransaction.create({
            data: {
              organizationId: orgId,
              productId: item.productId,
              type: 'IN',
              quantity: receivedQuantity,
              previousQuantity,
              newQuantity,
              reference: purchase.orderNumber,
              notes: notes ?? `Purchase received: ${purchase.orderNumber}`,
              createdById: userId,
            },
          });
        } else {
          await tx.inventory.create({
            data: {
              organizationId: orgId,
              productId: item.productId,
              quantity: receivedQuantity,
            },
          });

          await tx.inventoryTransaction.create({
            data: {
              organizationId: orgId,
              productId: item.productId,
              type: 'IN',
              quantity: receivedQuantity,
              previousQuantity: 0,
              newQuantity: receivedQuantity,
              reference: purchase.orderNumber,
              notes: notes ?? `Purchase received: ${purchase.orderNumber}`,
              createdById: userId,
            },
          });
        }
      }

      await this.accountingService.createPayableForPurchase(orgId, purchaseId, tx);
      await this.accountingService.createJournalForPurchaseReceive(orgId, userId, purchaseId, tx);

      const updated = await tx.purchaseOrder.findUnique({
        where: { id: purchaseId },
        select: { id: true, orderNumber: true, status: true, updatedAt: true },
      });

      if (!updated) {
        throw new NotFoundException('Purchase order not found');
      }

      this.logger.log(`Purchase received: ${updated.orderNumber} (${purchaseId}) by ${userId}`);
      return updated;
    });
  }

  async softDelete(orgId: string, userId: string, purchaseId: string) {
    const purchase = await this.prisma.purchaseOrder.findFirst({
      where: { id: purchaseId, organizationId: orgId, deletedAt: null },
    });

    if (!purchase) {
      throw new NotFoundException('Purchase order not found');
    }

    if (purchase.status !== PurchaseStatus.DRAFT) {
      throw new ConflictException('Only DRAFT purchase orders can be deleted');
    }

    await this.prisma.purchaseOrder.update({
      where: { id: purchaseId },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Purchase deleted: ${purchase.orderNumber} (${purchaseId}) by ${userId}`);
    return { message: 'Purchase order deleted successfully' };
  }

  private buildPurchaseItems(
    dtoItems: Array<{ productId: string; quantity: number; discount?: number; tax?: number }>,
    products: Array<{ id: string; name: string; costPrice: unknown }>,
  ): Array<{
    productId: string;
    description: string;
    quantity: number;
    unitCost: number;
    discount: number;
    tax: number;
    lineTotal: number;
  }> {
    return dtoItems.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      const unitCost = Number(product?.costPrice ?? 0);
      const quantity = Number(item.quantity);
      const discount = Number(item.discount ?? 0);
      const tax = Number(item.tax ?? 0);
      const lineSubtotal = unitCost * quantity;

      if (!Number.isFinite(discount) || discount < 0) {
        throw new BadRequestException('Discount must be a non-negative number');
      }

      if (discount > lineSubtotal) {
        throw new BadRequestException('Discount cannot exceed the line subtotal');
      }

      if (!Number.isFinite(tax) || tax < 0) {
        throw new BadRequestException('Tax must be a non-negative number');
      }

      const lineTotal = lineSubtotal - discount + tax;

      if (lineTotal < 0) {
        throw new BadRequestException('Line total cannot be negative');
      }

      return {
        productId: item.productId,
        description: product?.name ?? '',
        quantity,
        unitCost,
        discount,
        tax,
        lineTotal,
      };
    });
  }

  private async generateOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `PO-${year}-`;

    const lastOrder = await this.prisma.purchaseOrder.findFirst({
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
