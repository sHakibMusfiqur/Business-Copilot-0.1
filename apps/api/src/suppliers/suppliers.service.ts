import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import type { QuerySuppliersDto } from './dto/query-suppliers.dto';
import type { CreateSupplierDto } from './dto/create-supplier.dto';
import type { UpdateSupplierDto } from './dto/update-supplier.dto';
import type { UpdateSupplierStatusDto } from './dto/update-supplier-status.dto';

@Injectable()
export class SuppliersService {
  private readonly logger = new Logger(SuppliersService.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async findAll(orgId: string, query: QuerySuppliersDto) {
    const { page = 1, limit = 10, search, isActive, sortBy = 'createdAt', sortOrder = 'desc' } = query;

    const where: Prisma.SupplierWhereInput = {
      organizationId: orgId,
      deletedAt: null,
    };

    if (search) {
      const sanitized = search.trim();
      where.OR = [
        { name: { contains: sanitized, mode: 'insensitive' } },
        { email: { contains: sanitized, mode: 'insensitive' } },
        { phone: { contains: sanitized, mode: 'insensitive' } },
        { company: { contains: sanitized, mode: 'insensitive' } },
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const allowedSortFields = ['name', 'email', 'company', 'isActive', 'createdAt', 'updatedAt'];
    const field = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const order = sortOrder === 'asc' ? 'asc' : 'desc';

    const [total, suppliers] = await Promise.all([
      this.prisma.supplier.count({ where }),
      this.prisma.supplier.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          company: true,
          taxId: true,
          address: true,
          city: true,
          state: true,
          zipCode: true,
          country: true,
          paymentTerms: true,
          notes: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { [field]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: suppliers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(orgId: string, supplierId: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, organizationId: orgId, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        company: true,
        taxId: true,
        website: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
        paymentTerms: true,
        notes: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    return supplier;
  }

  async create(orgId: string, currentUserId: string, dto: CreateSupplierDto) {
    const data: Prisma.SupplierCreateInput = {
      name: dto.name.trim(),
      isActive: dto.isActive ?? true,
      organization: { connect: { id: orgId } },
      ...(dto.email !== undefined && { email: dto.email.toLowerCase().trim() }),
      ...(dto.phone !== undefined && { phone: dto.phone.trim() }),
      ...(dto.company !== undefined && { company: dto.company.trim() }),
      ...(dto.taxId !== undefined && { taxId: dto.taxId.trim() }),
      ...(dto.address !== undefined && { address: dto.address.trim() }),
      ...(dto.city !== undefined && { city: dto.city.trim() }),
      ...(dto.state !== undefined && { state: dto.state.trim() }),
      ...(dto.zipCode !== undefined && { zipCode: dto.zipCode.trim() }),
      ...(dto.country !== undefined && { country: dto.country.trim() }),
      ...(dto.paymentTerms !== undefined && { paymentTerms: dto.paymentTerms.trim() }),
      ...(dto.notes !== undefined && { notes: dto.notes.trim() }),
    };

    const supplier = await this.prisma.supplier.create({ data });

    this.logger.log(`Supplier created: ${supplier.name} (${supplier.id}) by ${currentUserId}`);
    return supplier;
  }

  async update(orgId: string, currentUserId: string, supplierId: string, dto: UpdateSupplierDto) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, organizationId: orgId, deletedAt: null },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    const updateData: Prisma.SupplierUpdateInput = {};

    if (dto.name !== undefined) { updateData.name = dto.name.trim(); }
    if (dto.email !== undefined) { updateData.email = dto.email.toLowerCase().trim(); }
    if (dto.phone !== undefined) { updateData.phone = dto.phone.trim(); }
    if (dto.company !== undefined) { updateData.company = dto.company.trim(); }
    if (dto.taxId !== undefined) { updateData.taxId = dto.taxId.trim(); }
    if (dto.address !== undefined) { updateData.address = dto.address.trim(); }
    if (dto.city !== undefined) { updateData.city = dto.city.trim(); }
    if (dto.state !== undefined) { updateData.state = dto.state.trim(); }
    if (dto.zipCode !== undefined) { updateData.zipCode = dto.zipCode.trim(); }
    if (dto.country !== undefined) { updateData.country = dto.country.trim(); }
    if (dto.paymentTerms !== undefined) { updateData.paymentTerms = dto.paymentTerms.trim(); }
    if (dto.notes !== undefined) { updateData.notes = dto.notes.trim(); }
    if (dto.isActive !== undefined) { updateData.isActive = dto.isActive; }

    const updated = await this.prisma.supplier.update({
      where: { id: supplierId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        company: true,
        taxId: true,
        isActive: true,
        updatedAt: true,
      },
    });

    this.logger.log(`Supplier updated: ${updated.name} (${supplierId}) by ${currentUserId}`);
    return updated;
  }

  async softDelete(orgId: string, currentUserId: string, supplierId: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, organizationId: orgId, deletedAt: null },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    await this.prisma.supplier.update({
      where: { id: supplierId },
      data: { deletedAt: new Date(), isActive: false },
    });

    this.logger.log(`Supplier soft-deleted: ${supplier.name} (${supplierId}) by ${currentUserId}`);
    return { message: 'Supplier deleted successfully' };
  }

  async updateStatus(orgId: string, currentUserId: string, supplierId: string, dto: UpdateSupplierStatusDto) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, organizationId: orgId, deletedAt: null },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    const updated = await this.prisma.supplier.update({
      where: { id: supplierId },
      data: { isActive: dto.isActive },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        updatedAt: true,
      },
    });

    this.logger.log(`Supplier ${dto.isActive ? 'activated' : 'deactivated'}: ${updated.name} (${supplierId}) by ${currentUserId}`);
    return updated;
  }
}
