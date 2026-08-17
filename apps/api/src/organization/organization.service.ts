import {
  Injectable,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { syncSystemRolesForOrg } from '../rbac/permission-catalog';

import type { CreateOrganizationDto } from './dto/create-organization.dto';

@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  async create(dto: CreateOrganizationDto, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true, email: true, role: true, emailVerified: true },
    });

    if (!user) {
      throw new ConflictException('User not found');
    }

    if (!user.emailVerified) {
      throw new ForbiddenException('Please verify your email address before creating an organization');
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

        const { ownerRole } = await syncSystemRolesForOrg(tx, org.id);

        await tx.userRoleAssignment.createMany({
          data: [{ userId, roleId: ownerRole.id }],
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

  /**
   * Resolves an active organization by slug (subdomain or /company/:slug path)
   * plus its branding for the public org-aware login page.
   */
  async findPublicBySlug(slug: string) {
    const org = await this.prisma.organization.findFirst({
      where: { slug, isActive: true, deletedAt: null, suspendedAt: null },
      select: { id: true, slug: true, name: true },
    });
    if (!org) return null;
    return this.resolvePublicOrg(org);
  }

  /**
   * Resolves the organization a user belongs to from their email address.
   * Returns null when the email is unknown or the organization is not active.
   */
  async findPublicByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { organizationId: true },
    });
    if (!user?.organizationId) return null;

    const org = await this.prisma.organization.findFirst({
      where: {
        id: user.organizationId,
        isActive: true,
        deletedAt: null,
        suspendedAt: null,
      },
      select: { id: true, slug: true, name: true },
    });
    if (!org) return null;
    return this.resolvePublicOrg(org);
  }

  private async resolvePublicOrg(org: { id: string; slug: string; name: string }) {
    const brand = await this.settingsService.getBranding(org.id);
    return { id: org.id, slug: org.slug, name: org.name, brand };
  }
}
