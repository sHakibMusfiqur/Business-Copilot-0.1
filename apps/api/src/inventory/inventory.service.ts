import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { TransactionType } from '@prisma/client';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import type { QueryInventoryDto } from './dto/query-inventory.dto';
import type { CreateStockAdjustmentDto } from './dto/create-stock-adjustment.dto';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async findAll(orgId: string, query: QueryInventoryDto) {
    const { page = 1, limit = 10, search, isActive, lowStock, outOfStock, categoryId, sortBy = 'updatedAt', sortOrder = 'desc' } = query;

    const where: Prisma.ProductWhereInput = {
      organizationId: orgId,
      deletedAt: null,
    };

    if (search) {
      const sanitized = search.trim();
      where.OR = [
        { name: { contains: sanitized, mode: 'insensitive' } },
        { sku: { contains: sanitized, mode: 'insensitive' } },
        { barcode: { contains: sanitized, mode: 'insensitive' } },
        { brand: { contains: sanitized, mode: 'insensitive' } },
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    const allowedSortFields = ['name', 'sku', 'updatedAt'];
    const field = allowedSortFields.includes(sortBy) ? sortBy : 'updatedAt';
    const order = sortOrder === 'asc' ? 'asc' : 'desc';

    const hasStockFilter = lowStock || outOfStock;

    if (!hasStockFilter) {
      const [total, products] = await Promise.all([
        this.prisma.product.count({ where }),
        this.prisma.product.findMany({
          where,
          select: {
            id: true,
            name: true,
            sku: true,
            categoryId: true,
            category: { select: { id: true, name: true } },
            supplierId: true,
            supplier: { select: { id: true, name: true } },
            unitPrice: true,
            costPrice: true,
            minimumStock: true,
            maximumStock: true,
            isActive: true,
            updatedAt: true,
            inventory: { select: { quantity: true } },
          },
          orderBy: { [field]: order },
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);

      const data = products.map(({ inventory, ...product }) => ({
        ...product,
        currentStock: inventory.reduce((sum, inv) => sum + Number(inv.quantity), 0),
      }));

      return {
        data,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      };
    }

    const allProducts = await this.prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        sku: true,
        categoryId: true,
        category: { select: { id: true, name: true } },
        supplierId: true,
        supplier: { select: { id: true, name: true } },
        unitPrice: true,
        costPrice: true,
        minimumStock: true,
        maximumStock: true,
        isActive: true,
        updatedAt: true,
        inventory: { select: { quantity: true } },
      },
    });

    let filtered = allProducts.map(({ inventory, ...product }) => ({
      ...product,
      currentStock: inventory.reduce((sum, inv) => sum + Number(inv.quantity), 0),
    }));

    if (lowStock) {
      filtered = filtered.filter((p) => p.minimumStock > 0 && p.currentStock > 0 && p.currentStock <= p.minimumStock);
    }

    if (outOfStock) {
      filtered = filtered.filter((p) => p.currentStock <= 0);
    }

    const sorted = [...filtered].sort((a, b) => {
      const aVal = a[field as keyof typeof a];
      const bVal = b[field as keyof typeof b];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return order === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return 0;
    });

    const total = sorted.length;
    const paged = sorted.slice((page - 1) * limit, page * limit);

    return {
      data: paged,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async adjust(orgId: string, userId: string, dto: CreateStockAdjustmentDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, organizationId: orgId, deletedAt: null },
      select: { id: true, name: true, sku: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.findFirst({
        where: { productId: product.id, warehouseId: null },
      });

      const previousQuantity = inventory ? Number(inventory.quantity) : 0;
      let newQuantity: number;

      switch (dto.type) {
        case TransactionType.IN:
          newQuantity = previousQuantity + dto.quantity;
          break;
        case TransactionType.OUT:
          newQuantity = previousQuantity - dto.quantity;
          if (newQuantity < 0) {
            throw new BadRequestException(
              `Insufficient stock. Available: ${previousQuantity}, requested: ${dto.quantity}`,
            );
          }
          break;
        case TransactionType.ADJUSTMENT:
          newQuantity = dto.quantity;
          break;
        default:
          throw new BadRequestException(`Invalid transaction type: ${dto.type}`);
      }

      const existingInventory = await tx.inventory.findFirst({
        where: { productId: product.id, warehouseId: null },
      });

      if (existingInventory) {
        await tx.inventory.update({
          where: { id: existingInventory.id },
          data: { quantity: newQuantity },
        });
      } else {
        await tx.inventory.create({
          data: {
            productId: product.id,
            quantity: newQuantity,
          },
        });
      }

      await tx.inventoryTransaction.create({
        data: {
          organizationId: orgId,
          productId: product.id,
          type: dto.type,
          quantity: dto.quantity,
          previousQuantity,
          newQuantity,
          notes: dto.notes ?? null,
          createdById: userId,
        },
      });

      const actionLabel = dto.type === TransactionType.IN ? 'Stock Added'
        : dto.type === TransactionType.OUT ? 'Stock Removed'
        : 'Stock Adjusted';

      this.logger.log(
        `${actionLabel}: ${product.name} (${product.sku}) — qty: ${dto.quantity}, prev: ${previousQuantity}, new: ${newQuantity} by ${userId}`,
      );

      return {
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        type: dto.type,
        quantity: dto.quantity,
        previousQuantity,
        newQuantity,
      };
    });
  }

  async getHistory(orgId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId: orgId, deletedAt: null },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const transactions = await this.prisma.inventoryTransaction.findMany({
      where: { productId, organizationId: orgId },
      select: {
        id: true,
        type: true,
        quantity: true,
        previousQuantity: true,
        newQuantity: true,
        reference: true,
        notes: true,
        createdAt: true,
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return transactions;
  }

  async getSummary(orgId: string) {
    const products = await this.prisma.product.findMany({
      where: { organizationId: orgId, deletedAt: null },
      select: {
        id: true,
        costPrice: true,
        minimumStock: true,
        inventory: { select: { quantity: true } },
      },
    });

    let totalStockUnits = 0;
    let totalInventoryValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const product of products) {
      const currentStock = product.inventory.reduce((sum, inv) => sum + Number(inv.quantity), 0);
      totalStockUnits += currentStock;
      totalInventoryValue += currentStock * Number(product.costPrice);

      if (currentStock <= 0) {
        outOfStockCount++;
      } else if (product.minimumStock > 0 && currentStock <= product.minimumStock) {
        lowStockCount++;
      }
    }

    const averageProductValue = products.length > 0
      ? totalInventoryValue / products.length
      : 0;

    return {
      totalProducts: products.length,
      totalStockUnits,
      inventoryValue: totalInventoryValue,
      lowStockCount,
      outOfStockCount,
      averageProductValue,
    };
  }
}
