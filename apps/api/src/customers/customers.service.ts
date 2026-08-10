import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import type { QueryCustomersDto } from './dto/query-customers.dto';
import type { CreateCustomerDto } from './dto/create-customer.dto';
import type { UpdateCustomerDto } from './dto/update-customer.dto';
import type { UpdateCustomerStatusDto } from './dto/update-customer-status.dto';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async findAll(orgId: string, query: QueryCustomersDto) {
    const { page = 1, limit = 10, search, isActive, sortBy = 'createdAt', sortOrder = 'desc' } = query;

    const where: Prisma.CustomerWhereInput = {
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

    const [total, customers] = await Promise.all([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
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
      data: customers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(orgId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId: orgId, deletedAt: null },
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
        notes: true,
        creditLimit: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async create(orgId: string, currentUserId: string, dto: CreateCustomerDto) {
    const data: Prisma.CustomerCreateInput = {
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
      ...(dto.notes !== undefined && { notes: dto.notes.trim() }),
    };

    const customer = await this.prisma.customer.create({ data });

    this.logger.log(`Customer created: ${customer.name} (${customer.id}) by ${currentUserId}`);

    return customer;
  }

  async update(orgId: string, currentUserId: string, customerId: string, dto: UpdateCustomerDto) {
    const updateData: Prisma.CustomerUpdateInput = {};

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
    if (dto.notes !== undefined) { updateData.notes = dto.notes.trim(); }
    if (dto.isActive !== undefined) { updateData.isActive = dto.isActive; }

    let updated;
    try {
      updated = await this.prisma.customer.update({
        where: { id: customerId, organizationId: orgId, deletedAt: null },
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
    } catch (err) {
      if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2025') {
        throw new NotFoundException('Customer not found');
      }
      throw err;
    }

    this.logger.log(`Customer updated: ${updated.name} (${customerId}) by ${currentUserId}`);
    return updated;
  }

  async softDelete(orgId: string, currentUserId: string, customerId: string) {
    const result = await this.prisma.customer.updateMany({
      where: { id: customerId, organizationId: orgId, deletedAt: null },
      data: { deletedAt: new Date(), isActive: false },
    });

    if (result.count === 0) {
      throw new NotFoundException('Customer not found');
    }

    this.logger.log(`Customer soft-deleted: (${customerId}) by ${currentUserId}`);
    return { message: 'Customer deleted successfully' };
  }

  async updateStatus(orgId: string, currentUserId: string, customerId: string, dto: UpdateCustomerStatusDto) {
    let updated;
    try {
      updated = await this.prisma.customer.update({
        where: { id: customerId, organizationId: orgId, deletedAt: null },
        data: { isActive: dto.isActive },
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          updatedAt: true,
        },
      });
    } catch (err) {
      if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2025') {
        throw new NotFoundException('Customer not found');
      }
      throw err;
    }

    this.logger.log(`Customer ${dto.isActive ? 'activated' : 'deactivated'}: ${updated.name} (${customerId}) by ${currentUserId}`);
    return updated;
  }
}
