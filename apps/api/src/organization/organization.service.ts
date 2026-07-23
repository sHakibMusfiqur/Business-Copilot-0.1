import {
  Injectable,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

import { PrismaService } from '../prisma/prisma.service';

import type { CreateOrganizationDto } from './dto/create-organization.dto';

@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOrganizationDto, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true, email: true, role: true },
    });

    if (!user) {
      throw new ConflictException('User not found');
    }

    if (user.organizationId) {
      throw new ConflictException('User already belongs to an organization');
    }

    const baseSlug = dto.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    let slug = baseSlug;
    let suffix = 2;
    while (await this.prisma.organization.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${suffix}`;
      suffix++;
    }

    const existingOrg = await this.prisma.organization.findUnique({
      where: { name: dto.name },
    });

    if (existingOrg) {
      throw new ConflictException('Organization name already exists');
    }

    try {
      const organization = await this.prisma.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: { name: dto.name, slug },
        });

        await tx.organizationMember.create({
          data: {
            organizationId: org.id,
            userId,
            role: 'OWNER',
          },
        });

        await tx.user.update({
          where: { id: userId },
          data: { organizationId: org.id },
        });

        return org;
      });

      this.logger.log(`Organization created: ${organization.name} (${organization.id}) by user ${userId}`);
      return { organization, userEmail: user.email, userRole: user.role };
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = (error.meta as { target?: string[] } | undefined)?.target;
        if (target?.includes('slug')) {
          throw new ConflictException('Organization slug already exists');
        }
        throw new ConflictException('Organization name already exists');
      }
      throw error;
    }
  }
}
