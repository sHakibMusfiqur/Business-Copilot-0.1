import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import type { QueryProductsDto } from './dto/query-products.dto';
import type { CreateProductDto } from './dto/create-product.dto';
import type { UpdateProductDto } from './dto/update-product.dto';
import type { UpdateProductStatusDto } from './dto/update-product-status.dto';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async findAll(orgId: string, query: QueryProductsDto) {
    const { page = 1, limit = 10, search, isActive, categoryId, sortBy = 'createdAt', sortOrder = 'desc' } = query;

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

    const allowedSortFields = ['name', 'sku', 'unitPrice', 'costPrice', 'isActive', 'createdAt', 'updatedAt'];
    const field = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const order = sortOrder === 'asc' ? 'asc' : 'desc';

    const [total, products] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          sku: true,
          barcode: true,
          brand: true,
          description: true,
          categoryId: true,
          category: { select: { id: true, name: true } },
          supplierId: true,
          supplier: { select: { id: true, name: true } },
          unitPrice: true,
          costPrice: true,
          unit: true,
          taxRate: true,
          minimumStock: true,
          maximumStock: true,
          imageUrl: true,
          isActive: true,
          createdAt: true,
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
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(orgId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId: orgId, deletedAt: null },
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        brand: true,
        description: true,
        categoryId: true,
        category: { select: { id: true, name: true } },
        supplierId: true,
        supplier: { select: { id: true, name: true } },
        unitPrice: true,
        costPrice: true,
        unit: true,
        taxRate: true,
        minimumStock: true,
        maximumStock: true,
        imageUrl: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        inventory: { select: { quantity: true } },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const { inventory, ...data } = product;
    return {
      ...data,
      currentStock: inventory.reduce((sum, inv) => sum + Number(inv.quantity), 0),
    };
  }

  async create(orgId: string, currentUserId: string, dto: CreateProductDto) {
    if (dto.categoryId) {
      await this.assertCategoryAccessible(orgId, dto.categoryId);
    }
    if (dto.supplierId) {
      await this.assertSupplierAccessible(orgId, dto.supplierId);
    }

    const data: Prisma.ProductCreateInput = {
      name: dto.name.trim(),
      sku: dto.sku.trim(),
      isActive: dto.isActive ?? true,
      unit: dto.unit ?? 'pcs',
      costPrice: dto.costPrice ?? 0,
      unitPrice: dto.unitPrice ?? 0,
      taxRate: dto.taxRate ?? 0,
      minimumStock: dto.minimumStock ?? 0,
      maximumStock: dto.maximumStock ?? 0,
      organization: { connect: { id: orgId } },
      ...(dto.barcode !== undefined && { barcode: dto.barcode.trim() }),
      ...(dto.brand !== undefined && { brand: dto.brand.trim() }),
      ...(dto.description !== undefined && { description: dto.description.trim() }),
      ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl.trim() }),
      ...(dto.categoryId !== undefined && { category: { connect: { id: dto.categoryId } } }),
      ...(dto.supplierId !== undefined && { supplier: { connect: { id: dto.supplierId } } }),
    };

    const product = await this.prisma.product.create({ data });

    this.logger.log(`Product created: ${product.name} (${product.id}) by ${currentUserId}`);
    return product;
  }

  async update(orgId: string, currentUserId: string, productId: string, dto: UpdateProductDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId: orgId, deletedAt: null },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (dto.categoryId) {
      await this.assertCategoryAccessible(orgId, dto.categoryId);
    }
    if (dto.supplierId) {
      await this.assertSupplierAccessible(orgId, dto.supplierId);
    }

    const updateData: Prisma.ProductUpdateInput = {};

    if (dto.name !== undefined) { updateData.name = dto.name.trim(); }
    if (dto.sku !== undefined) { updateData.sku = dto.sku.trim(); }
    if (dto.barcode !== undefined) { updateData.barcode = dto.barcode.trim(); }
    if (dto.brand !== undefined) { updateData.brand = dto.brand.trim(); }
    if (dto.description !== undefined) { updateData.description = dto.description.trim(); }
    if (dto.imageUrl !== undefined) { updateData.imageUrl = dto.imageUrl.trim(); }
    if (dto.unit !== undefined) { updateData.unit = dto.unit; }
    if (dto.costPrice !== undefined) { updateData.costPrice = dto.costPrice; }
    if (dto.unitPrice !== undefined) { updateData.unitPrice = dto.unitPrice; }
    if (dto.taxRate !== undefined) { updateData.taxRate = dto.taxRate; }
    if (dto.minimumStock !== undefined) { updateData.minimumStock = dto.minimumStock; }
    if (dto.maximumStock !== undefined) { updateData.maximumStock = dto.maximumStock; }
    if (dto.isActive !== undefined) { updateData.isActive = dto.isActive; }

    if (dto.categoryId !== undefined) {
      updateData.category = dto.categoryId
        ? { connect: { id: dto.categoryId } }
        : { disconnect: true };
    }

    if (dto.supplierId !== undefined) {
      updateData.supplier = dto.supplierId
        ? { connect: { id: dto.supplierId } }
        : { disconnect: true };
    }

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: updateData,
      select: {
        id: true,
        name: true,
        sku: true,
        isActive: true,
        updatedAt: true,
      },
    });

    this.logger.log(`Product updated: ${updated.name} (${productId}) by ${currentUserId}`);
    return updated;
  }

  private async assertCategoryAccessible(orgId: string, categoryId: string): Promise<void> {
    const category = await this.prisma.category.findFirst({
      where: {
        id: categoryId,
        OR: [{ organizationId: orgId }, { organizationId: null }],
      },
      select: { id: true },
    });

    if (!category) {
      throw new BadRequestException('Category not found or not accessible to this organization');
    }
  }

  private async assertSupplierAccessible(orgId: string, supplierId: string): Promise<void> {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, organizationId: orgId },
      select: { id: true },
    });

    if (!supplier) {
      throw new BadRequestException('Supplier not found or not accessible to this organization');
    }
  }

  async softDelete(orgId: string, currentUserId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId: orgId, deletedAt: null },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    await this.prisma.product.update({
      where: { id: productId },
      data: { deletedAt: new Date(), isActive: false },
    });

    this.logger.log(`Product soft-deleted: ${product.name} (${productId}) by ${currentUserId}`);
    return { message: 'Product deleted successfully' };
  }

  async updateStatus(orgId: string, currentUserId: string, productId: string, dto: UpdateProductStatusDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId: orgId, deletedAt: null },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: { isActive: dto.isActive },
      select: {
        id: true,
        name: true,
        sku: true,
        isActive: true,
        updatedAt: true,
      },
    });

    this.logger.log(`Product ${dto.isActive ? 'activated' : 'deactivated'}: ${updated.name} (${productId}) by ${currentUserId}`);
    return updated;
  }
}
