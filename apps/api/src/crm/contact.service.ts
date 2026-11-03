import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import type { CreateContactDto } from './dto/create-contact.dto';
import type { UpdateContactDto } from './dto/update-contact.dto';
import type { QueryContactsDto } from './dto/query-contacts.dto';

const CONTACT_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  company: true,
  companyId: true,
  jobTitle: true,
  status: true,
  source: true,
  ownerId: true,
  leadId: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  owner: { select: { id: true, name: true, email: true } },
  companyRecord: { select: { id: true, name: true } },
} as const;

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(orgId: string, query: QueryContactsDto) {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      ownerId,
      companyId,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Prisma.ContactWhereInput = {
      organizationId: orgId,
      deletedAt: null,
    };

    if (search) {
      const sanitized = search.trim();
      where.OR = [
        { firstName: { contains: sanitized, mode: 'insensitive' } },
        { lastName: { contains: sanitized, mode: 'insensitive' } },
        { email: { contains: sanitized, mode: 'insensitive' } },
        { company: { contains: sanitized, mode: 'insensitive' } },
      ];
    }
    if (status) where.status = status;
    if (ownerId) where.ownerId = ownerId;
    if (companyId) where.companyId = companyId;

    const allowedSortFields = ['firstName', 'lastName', 'email', 'company', 'createdAt', 'updatedAt'];
    const field = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const order = sortOrder === 'asc' ? 'asc' : 'desc';

    const [total, contacts] = await Promise.all([
      this.prisma.contact.count({ where }),
      this.prisma.contact.findMany({
        where,
        select: CONTACT_SELECT,
        orderBy: { [field]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: contacts,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(orgId: string, contactId: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, organizationId: orgId, deletedAt: null },
      select: {
        ...CONTACT_SELECT,
        lead: { select: { id: true, leadNumber: true, name: true, status: true } },
      },
    });

    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  async create(orgId: string, currentUserId: string, dto: CreateContactDto) {
    if (dto.leadId) {
      await this.assertLeadAccessible(orgId, dto.leadId);
    }
    if (dto.companyId) await this.assertCompanyAccessible(orgId, dto.companyId);
    if (dto.ownerId) await this.assertOwnerAccessible(orgId, dto.ownerId);

    const data: Prisma.ContactUncheckedCreateInput = {
      organizationId: orgId,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      ...(dto.email !== undefined && { email: dto.email.toLowerCase().trim() }),
      ...(dto.phone !== undefined && { phone: dto.phone.trim() }),
      ...(dto.company !== undefined && { company: dto.company.trim() }),
      ...(dto.jobTitle !== undefined && { jobTitle: dto.jobTitle.trim() }),
      ...(dto.notes !== undefined && { notes: dto.notes.trim() }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.source !== undefined && { source: dto.source.trim() }),
      ...(dto.companyId !== undefined && { companyId: dto.companyId }),
      ...(dto.ownerId !== undefined && { ownerId: dto.ownerId }),
      ...(dto.leadId ? { leadId: dto.leadId } : {}),
    };

    const contact = await this.prisma.contact
      .create({
        data,
        select: CONTACT_SELECT,
      })
      .catch((err: unknown) => {
        if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2002') {
          throw new ConflictException('A contact with this email already exists in this organization');
        }
        throw err;
      });

    this.logger.log(`Contact created: ${contact.id} by ${currentUserId}`);
    return contact;
  }

  async update(orgId: string, currentUserId: string, contactId: string, dto: UpdateContactDto) {
    if (dto.leadId) {
      await this.assertLeadAccessible(orgId, dto.leadId);
    }
    if (dto.companyId) await this.assertCompanyAccessible(orgId, dto.companyId);
    if (dto.ownerId) await this.assertOwnerAccessible(orgId, dto.ownerId);

    const updateData: Prisma.ContactUpdateInput = {};
    if (dto.firstName !== undefined) updateData.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) updateData.lastName = dto.lastName.trim();
    if (dto.email !== undefined) updateData.email = dto.email.toLowerCase().trim();
    if (dto.phone !== undefined) updateData.phone = dto.phone.trim();
    if (dto.company !== undefined) updateData.company = dto.company.trim();
    if (dto.jobTitle !== undefined) updateData.jobTitle = dto.jobTitle.trim();
    if (dto.notes !== undefined) updateData.notes = dto.notes.trim();
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.source !== undefined) updateData.source = dto.source.trim();
    if (dto.companyId !== undefined) {
      updateData.companyRecord = dto.companyId ? { connect: { id: dto.companyId } } : { disconnect: true };
    }
    if (dto.ownerId !== undefined) {
      updateData.owner = dto.ownerId ? { connect: { id: dto.ownerId } } : { disconnect: true };
    }
    if (dto.leadId !== undefined) {
      updateData.lead = dto.leadId ? { connect: { id: dto.leadId } } : { disconnect: true };
    }

    const updated = await this.prisma.contact
      .update({
        where: { id: contactId, organizationId: orgId, deletedAt: null },
        data: updateData,
        select: CONTACT_SELECT,
      })
      .catch((err: unknown) => {
        if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2025') {
          throw new NotFoundException('Contact not found');
        }
        if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2002') {
          throw new ConflictException('A contact with this email already exists in this organization');
        }
        throw err;
      });

    this.logger.log(`Contact updated: ${contactId} by ${currentUserId}`);
    return updated;
  }

  async softDelete(orgId: string, currentUserId: string, contactId: string) {
    const existing = await this.prisma.contact.findFirst({
      where: { id: contactId, organizationId: orgId, deletedAt: null },
      select: { id: true },
    });

    if (!existing) throw new NotFoundException('Contact not found');

    await this.prisma.contact.update({
      where: { id: contactId, organizationId: orgId, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Contact soft-deleted: ${contactId} by ${currentUserId}`);
    return { message: 'Contact deleted successfully' };
  }

  /** Ensures a lead belongs to the organization before linking a contact to it. */
  private async assertLeadAccessible(orgId: string, leadId: string): Promise<void> {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId: orgId, deletedAt: null },
      select: { id: true },
    });

    if (!lead) {
      throw new BadRequestException('Lead not found or not accessible to this organization');
    }
  }

  /** Ensures a company belongs to the organization before linking a contact to it. */
  private async assertCompanyAccessible(orgId: string, companyId: string): Promise<void> {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, organizationId: orgId, deletedAt: null },
      select: { id: true },
    });

    if (!company) {
      throw new BadRequestException('Company not found or not accessible to this organization');
    }
  }

  /** Ensures an owner belongs to the organization before assigning a contact to them. */
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