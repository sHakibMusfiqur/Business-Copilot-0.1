import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import type { CreateCompanyDto } from './dto/create-company.dto';
import type { UpdateCompanyDto } from './dto/update-company.dto';
import type { QueryCompaniesDto } from './dto/query-companies.dto';

const OWNER_SELECT = { id: true, name: true, email: true } as const;

const COMPANY_SELECT = {
  id: true,
  name: true,
  domain: true,
  industry: true,
  phone: true,
  email: true,
  website: true,
  address: true,
  city: true,
  state: true,
  zipCode: true,
  country: true,
  ownerId: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  owner: { select: OWNER_SELECT },
} as const;

@Injectable()
export class CompanyService {
  private readonly logger = new Logger(CompanyService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(orgId: string, query: QueryCompaniesDto) {
    const { page = 1, limit = 20, search, ownerId, sortBy = 'createdAt', sortOrder = 'desc' } = query;

    const where: Prisma.CompanyWhereInput = { organizationId: orgId, deletedAt: null };

    if (search) {
      const sanitized = search.trim();
      where.OR = [
        { name: { contains: sanitized, mode: 'insensitive' } },
        { domain: { contains: sanitized, mode: 'insensitive' } },
        { email: { contains: sanitized, mode: 'insensitive' } },
        { industry: { contains: sanitized, mode: 'insensitive' } },
      ];
    }
    if (ownerId) where.ownerId = ownerId;

    const allowedSortFields = ['name', 'industry', 'createdAt', 'updatedAt'];
    const field = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const order = sortOrder === 'asc' ? 'asc' : 'desc';

    const [total, companies] = await Promise.all([
      this.prisma.company.count({ where }),
      this.prisma.company.findMany({
        where,
        select: {
          ...COMPANY_SELECT,
          _count: { select: { contacts: { where: { deletedAt: null } }, deals: { where: { deletedAt: null } } } },
        },
        orderBy: { [field]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: companies.map(({ _count, ...company }) => ({
        ...company,
        contactCount: _count.contacts,
        dealCount: _count.deals,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(orgId: string, companyId: string) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, organizationId: orgId, deletedAt: null },
      select: {
        ...COMPANY_SELECT,
        contacts: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 25,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            jobTitle: true,
            status: true,
            owner: { select: OWNER_SELECT },
          },
        },
        deals: {
          where: { deletedAt: null },
          orderBy: { updatedAt: 'desc' },
          take: 25,
          select: {
            id: true,
            title: true,
            value: true,
            probability: true,
            expectedCloseDate: true,
            wonAt: true,
            lostAt: true,
            stage: { select: { id: true, name: true, isWon: true, isLost: true } },
            owner: { select: OWNER_SELECT },
          },
        },
        activities: {
          where: { deletedAt: null },
          orderBy: [{ dueDate: 'desc' }, { createdAt: 'desc' }],
          take: 25,
          select: {
            id: true,
            type: true,
            title: true,
            dueDate: true,
            completed: true,
            assignedTo: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!company) throw new NotFoundException('Company not found');

    const [openAgg, wonAgg] = await Promise.all([
      this.prisma.deal.aggregate({
        where: {
          organizationId: orgId,
          companyId,
          deletedAt: null,
          OR: [{ stage: null }, { stage: { isWon: false, isLost: false } }],
        },
        _sum: { value: true },
        _count: { id: true },
      }),
      this.prisma.deal.aggregate({
        where: { organizationId: orgId, companyId, deletedAt: null, wonAt: { not: null } },
        _sum: { value: true },
        _count: { id: true },
      }),
    ]);

    return {
      ...company,
      deals: company.deals.map((deal) => ({ ...deal, value: Number(deal.value) })),
      stats: {
        openDealCount: openAgg._count.id,
        openPipelineValue: Number(openAgg._sum.value ?? 0),
        wonDealCount: wonAgg._count.id,
        wonValue: Number(wonAgg._sum.value ?? 0),
      },
    };
  }

  async create(orgId: string, userId: string, dto: CreateCompanyDto) {
    const name = dto.name.trim();
    await this.assertNameAvailable(orgId, name);
    if (dto.ownerId) await this.assertOwnerAccessible(orgId, dto.ownerId);

    const company = await this.prisma.company
      .create({
        data: {
          organizationId: orgId,
          name,
          ...(dto.domain !== undefined && { domain: dto.domain }),
          ...(dto.industry !== undefined && { industry: dto.industry }),
          ...(dto.phone !== undefined && { phone: dto.phone }),
          ...(dto.email !== undefined && { email: dto.email }),
          ...(dto.website !== undefined && { website: dto.website }),
          ...(dto.address !== undefined && { address: dto.address }),
          ...(dto.city !== undefined && { city: dto.city }),
          ...(dto.state !== undefined && { state: dto.state }),
          ...(dto.zipCode !== undefined && { zipCode: dto.zipCode }),
          ...(dto.country !== undefined && { country: dto.country }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
          ownerId: dto.ownerId ?? null,
        },
        select: COMPANY_SELECT,
      })
      .catch((err: unknown) => {
        if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2002') {
          throw new ConflictException('A company with this name already exists in this organization');
        }
        throw err;
      });

    this.logger.log(`Company created: ${company.id} by ${userId}`);
    return company;
  }

  async update(orgId: string, userId: string, companyId: string, dto: UpdateCompanyDto) {
    const existing = await this.prisma.company.findFirst({
      where: { id: companyId, organizationId: orgId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Company not found');

    if (dto.name !== undefined) await this.assertNameAvailable(orgId, dto.name.trim(), companyId);
    if (dto.ownerId) await this.assertOwnerAccessible(orgId, dto.ownerId);

    const updateData: Prisma.CompanyUpdateInput = {};
    if (dto.name !== undefined) updateData.name = dto.name.trim();
    if (dto.domain !== undefined) updateData.domain = dto.domain;
    if (dto.industry !== undefined) updateData.industry = dto.industry;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.website !== undefined) updateData.website = dto.website;
    if (dto.address !== undefined) updateData.address = dto.address;
    if (dto.city !== undefined) updateData.city = dto.city;
    if (dto.state !== undefined) updateData.state = dto.state;
    if (dto.zipCode !== undefined) updateData.zipCode = dto.zipCode;
    if (dto.country !== undefined) updateData.country = dto.country;
    if (dto.notes !== undefined) updateData.notes = dto.notes;
    if (dto.ownerId !== undefined) {
      updateData.owner = dto.ownerId ? { connect: { id: dto.ownerId } } : { disconnect: true };
    }

    const updated = await this.prisma.company
      .update({
        where: { id: companyId, organizationId: orgId, deletedAt: null },
        data: updateData,
        select: COMPANY_SELECT,
      })
      .catch((err: unknown) => {
        if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2025') {
          throw new NotFoundException('Company not found');
        }
        if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2002') {
          throw new ConflictException('A company with this name already exists in this organization');
        }
        throw err;
      });

    this.logger.log(`Company updated: ${companyId} by ${userId}`);
    return updated;
  }

  async softDelete(orgId: string, userId: string, companyId: string) {
    const result = await this.prisma.company.updateMany({
      where: { id: companyId, organizationId: orgId, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    if (result.count === 0) throw new NotFoundException('Company not found');

    this.logger.log(`Company deleted: ${companyId} by ${userId}`);
    return { message: 'Company deleted successfully' };
  }

  async findByCompany(orgId: string, companyId: string) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, organizationId: orgId, deletedAt: null },
      select: { id: true },
    });
    if (!company) throw new NotFoundException('Company not found');
    return this.findById(orgId, companyId);
  }

  /** Ensures a company belongs to the organization before linking records to it. */
  async assertAccessible(orgId: string, companyId: string): Promise<void> {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, organizationId: orgId, deletedAt: null },
      select: { id: true },
    });
    if (!company) {
      throw new BadRequestException('Company not found or not accessible to this organization');
    }
  }

  private async assertNameAvailable(orgId: string, name: string, excludeId?: string): Promise<void> {
    const duplicate = await this.prisma.company.findFirst({
      where: {
        organizationId: orgId,
        deletedAt: null,
        name: { equals: name, mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException('A company with this name already exists in this organization');
    }
  }

  private async assertOwnerAccessible(orgId: string, ownerId: string): Promise<void> {
    const owner = await this.prisma.user.findFirst({
      where: { id: ownerId, organizationId: orgId, deletedAt: null },
      select: { id: true },
    });
    if (!owner) {
      throw new BadRequestException('Owner not found or not accessible to this organization');
    }
  }
}
