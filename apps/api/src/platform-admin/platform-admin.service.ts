import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';

import { PrismaService } from '../prisma/prisma.service';

import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { TransferOwnershipDto } from './dto/transfer-ownership.dto';
import { DashboardCacheService } from './dashboard-cache.service';

const PKG_VERSION = process.env.APP_VERSION ?? '0.1.0';

export interface PlatformDashboardData {
  organizations: {
    total: number;
    active: number;
    suspended: number;
    archived: number;
    deleted: number;
    newToday: number;
    newThisWeek: number;
    newThisMonth: number;
  };
  users: {
    total: number;
    dailyActive: number;
    monthlyActive: number;
    growthRate: number;
  };
  subscriptions: {
    trialing: number;
    active: number;
    expired: number;
    cancelled: number;
    topPlans: { name: string; count: number }[];
  };
  revenue: {
    today: number;
    thisMonth: number;
    lifetime: number;
  };
  topOrganizations: { id: string; name: string; userCount: number; revenue: number }[];
  platform: {
    version: string;
    uptimeMs: number;
  };
  recentActivities: { id: string; action: string; createdAt: Date; user: { name: string; email: string } | null }[];
  recentErrors: { id: string; action: string; createdAt: Date; user: { name: string; email: string } | null }[];
}

@Injectable()
export class PlatformAdminService {
  private readonly logger = new Logger(PlatformAdminService.name);
  private readonly startTime = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: DashboardCacheService,
  ) {}

  private invalidateOrgCache(types: string[] = ['dashboard']): void {
    for (const type of types) {
      this.cache.invalidate(type);
    }
  }

  async getDashboard(): Promise<PlatformDashboardData> {
    const cached = this.cache.get<PlatformDashboardData>('dashboard');
    if (cached) return cached;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalOrgs,
      activeOrgs,
      suspendedOrgs,
      archivedOrgs,
      deletedOrgs,
      newToday,
      newThisWeek,
      newThisMonth,
      totalUsers,
      dailyActiveUsers,
      monthlyActiveUsers,
      subscriptionGroups,
      revenueToday,
      revenueThisMonth,
      revenueLifetime,
      recentActivities,
      recentErrors,
    ] = await Promise.all([
      this.prisma.organization.count(),
      this.prisma.organization.count({ where: { archivedAt: null, deletedAt: null, suspendedAt: null, isActive: true } }),
      this.prisma.organization.count({ where: { archivedAt: null, deletedAt: null, suspendedAt: { not: null } } }),
      this.prisma.organization.count({ where: { archivedAt: { not: null }, deletedAt: null } }),
      this.prisma.organization.count({ where: { deletedAt: { not: null } } }),
      this.prisma.organization.count({ where: { createdAt: { gte: startOfToday } } }),
      this.prisma.organization.count({ where: { createdAt: { gte: startOfWeek } } }),
      this.prisma.organization.count({ where: { createdAt: { gte: startOfMonth } } }),
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { lastLoginAt: { gte: startOfToday }, deletedAt: null } }),
      this.prisma.user.count({ where: { lastLoginAt: { gte: startOfMonth }, deletedAt: null } }),
      this.prisma.subscription.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      this.prisma.invoice.aggregate({
        where: { type: 'SALES', paymentStatus: 'PAID', issueDate: { gte: startOfToday } },
        _sum: { total: true },
      }),
      this.prisma.invoice.aggregate({
        where: { type: 'SALES', paymentStatus: 'PAID', issueDate: { gte: startOfMonth } },
        _sum: { total: true },
      }),
      this.prisma.invoice.aggregate({
        where: { type: 'SALES', paymentStatus: 'PAID' },
        _sum: { total: true },
      }),
      this.prisma.auditLog.findMany({
        where: { createdAt: { gte: startOfToday } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { user: { select: { name: true, email: true } } },
      }),
      this.prisma.auditLog.findMany({
        where: { status: 'FAILURE', createdAt: { gte: startOfToday } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { user: { select: { name: true, email: true } } },
      }),
    ]);

    const subscriptionMap = new Map(subscriptionGroups.map((s) => [s.status, s._count.status]));
    const lastMonthTotal = await this.prisma.user.count({
      where: {
        lastLoginAt: {
          gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
          lt: startOfMonth,
        },
        deletedAt: null,
      },
    });
    const growthRate = lastMonthTotal > 0
      ? Math.round(((monthlyActiveUsers - lastMonthTotal) / lastMonthTotal) * 100)
      : 0;

    const topOrgs = await this.prisma.organization.findMany({
      where: { deletedAt: null },
      orderBy: { users: { _count: 'desc' } },
      take: 5,
      select: {
        id: true,
        name: true,
        _count: { select: { users: true } },
      },
    });
    const topOrgIds = topOrgs.map((o) => o.id);
    const orgRevenue = topOrgIds.length > 0
      ? await this.prisma.invoice.groupBy({
          by: ['organizationId'],
          where: { organizationId: { in: topOrgIds }, type: 'SALES', paymentStatus: 'PAID' },
          _sum: { total: true },
        })
      : [];
    const revenueMap = new Map(orgRevenue.map((r) => [r.organizationId, Number(r._sum.total ?? 0)]));
    const topOrganizations = topOrgs.map((o) => ({
      id: o.id,
      name: o.name,
      userCount: o._count.users,
      revenue: revenueMap.get(o.id) ?? 0,
    }));

    const topPlans = await this.prisma.subscription.groupBy({
      by: ['planId'],
      _count: { planId: true },
      orderBy: { _count: { planId: 'desc' } },
      take: 5,
    });
    const planIds = topPlans.map((p) => p.planId);
    const plans = planIds.length > 0
      ? await this.prisma.subscriptionPlan.findMany({
          where: { id: { in: planIds } },
          select: { id: true, name: true },
        })
      : [];
    const planMap = new Map(plans.map((p) => [p.id, p.name]));

    const result: PlatformDashboardData = {
      organizations: {
        total: totalOrgs,
        active: activeOrgs,
        suspended: suspendedOrgs,
        archived: archivedOrgs,
        deleted: deletedOrgs,
        newToday,
        newThisWeek,
        newThisMonth,
      },
      users: {
        total: totalUsers,
        dailyActive: dailyActiveUsers,
        monthlyActive: monthlyActiveUsers,
        growthRate,
      },
      subscriptions: {
        trialing: subscriptionMap.get('TRIALING') ?? 0,
        active: subscriptionMap.get('ACTIVE') ?? 0,
        expired: subscriptionMap.get('EXPIRED') ?? 0,
        cancelled: subscriptionMap.get('CANCELLED') ?? 0,
        topPlans: topPlans.map((p) => ({ name: planMap.get(p.planId) ?? 'Unknown', count: p._count.planId })),
      },
      revenue: {
        today: Number(revenueToday._sum.total ?? 0),
        thisMonth: Number(revenueThisMonth._sum.total ?? 0),
        lifetime: Number(revenueLifetime._sum.total ?? 0),
      },
      topOrganizations,
      platform: {
        version: PKG_VERSION,
        uptimeMs: Date.now() - this.startTime,
      },
      recentActivities: recentActivities.map((a) => ({
        id: a.id,
        action: a.action,
        createdAt: a.createdAt,
        user: a.user,
      })),
      recentErrors: recentErrors.map((a) => ({
        id: a.id,
        action: a.action,
        createdAt: a.createdAt,
        user: a.user,
      })),
    };

    this.cache.set('dashboard', result);
    return result;
  }

  async listOrganizations(page = 1, limit = 20, search?: string, status?: string, includeDeleted = false) {
    const where: Prisma.OrganizationWhereInput = {};

    if (!includeDeleted) {
      where.deletedAt = null;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status === 'active') {
      where.archivedAt = null;
      where.suspendedAt = null;
      where.deletedAt = null;
      where.isActive = true;
    } else if (status === 'suspended') {
      where.archivedAt = null;
      where.suspendedAt = { not: null };
    } else if (status === 'archived') {
      where.archivedAt = { not: null };
      where.deletedAt = null;
    } else if (status === 'deleted') {
      where.deletedAt = { not: null };
    }

    const [data, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { users: true, members: true } },
          subscription: { include: { plan: { select: { name: true, slug: true } } } },
        },
      }),
      this.prisma.organization.count({ where }),
    ]);

    const orgIds = data.map((o) => o.id);
    const owners = orgIds.length > 0
      ? await this.prisma.organizationMember.findMany({
          where: { organizationId: { in: orgIds }, role: 'OWNER' },
          include: { user: { select: { id: true, name: true, email: true } } },
        })
      : [];

    const ownerMap = new Map(owners.map((o) => [o.organizationId, o.user]));

    const result = data.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      email: org.email,
      logo: org.logo,
      isActive: org.isActive,
      suspendedAt: org.suspendedAt,
      deletedAt: org.deletedAt,
      deletedBy: org.deletedBy,
      deletedReason: org.deletedReason,
      archivedAt: org.archivedAt,
      archivedBy: org.archivedBy,
      archiveReason: org.archiveReason,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
      userCount: org._count.users,
      memberCount: org._count.members,
      owner: ownerMap.get(org.id) ?? null,
      plan: org.subscription?.plan ?? null,
      subscriptionStatus: org.subscription?.status ?? null,
    }));

    return {
      data: result,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getOrganization(id: string, includeDeleted = false) {
    const where: Prisma.OrganizationWhereInput = { id };
    if (!includeDeleted) where.deletedAt = null;

    const org = await this.prisma.organization.findFirst({
      where,
      include: {
        _count: { select: { users: true, members: true, customers: true, products: true, suppliers: true, invoices: true } },
        subscription: { include: { plan: true } },
        settings: true,
      },
    });

    if (!org) throw new NotFoundException('Organization not found');

    const owner = await this.prisma.organizationMember.findFirst({
      where: { organizationId: id, role: 'OWNER' },
      include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
    });

    return { ...org, owner: owner?.user ?? null };
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'org';
    const existing = await this.prisma.organization.findMany({
      where: { slug: { startsWith: base } },
      select: { slug: true },
    });
    const existingSlugs = new Set(existing.map((o) => o.slug));
    if (!existingSlugs.has(base)) return base;
    let i = 2;
    while (existingSlugs.has(`${base}-${i}`)) { i++; }
    return `${base}-${i}`;
  }

  async createOrganization(dto: CreateOrganizationDto) {
    const { name, ownerEmail, ownerName, ownerPassword, planSlug } = dto;

    const existing = await this.prisma.user.findUnique({ where: { email: ownerEmail } });
    if (existing) throw new BadRequestException('Owner email already registered');

    const slug = await this.generateUniqueSlug(name);

    let planId: string | null = null;
    if (planSlug) {
      const plan = await this.prisma.subscriptionPlan.findUnique({ where: { slug: planSlug } });
      if (!plan) throw new BadRequestException('Subscription plan not found');
      planId = plan.id;
    }

    const hashedPassword = await argon2.hash(ownerPassword);

    const org = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name, slug, email: ownerEmail },
      });

      const user = await tx.user.create({
        data: {
          email: ownerEmail,
          name: ownerName,
          password: hashedPassword,
          organizationId: organization.id,
        },
      });

      await tx.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          role: 'OWNER',
        },
      });

      let ownerRole = await tx.role.findFirst({
        where: { organizationId: organization.id, name: 'Owner', isSystem: true },
      });

      if (!ownerRole) {
        ownerRole = await tx.role.create({
          data: {
            name: 'Owner',
            description: 'Organization owner with full access',
            isSystem: true,
            organizationId: organization.id,
          },
        });
      }

      await tx.userRoleAssignment.create({
        data: { userId: user.id, roleId: ownerRole.id },
      });

      await tx.organizationSettings.create({
        data: { organizationId: organization.id, settings: {} },
      });

      if (planId) {
        const periodEnd = new Date();
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        await tx.subscription.create({
          data: {
            organizationId: organization.id,
            planId,
            currentPeriodEnd: periodEnd,
          },
        });
      }

      return organization;
    });

    this.invalidateOrgCache();
    return { id: org.id, name: org.name, slug: org.slug };
  }

  async updateOrganization(id: string, dto: UpdateOrganizationDto) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('Organization not found');

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.state !== undefined) data.state = dto.state;
    if (dto.country !== undefined) data.country = dto.country;
    if (dto.timezone !== undefined) data.timezone = dto.timezone;
    if (dto.locale !== undefined) data.locale = dto.locale;
    if (dto.logo !== undefined) data.logo = dto.logo;

    const result = this.prisma.organization.update({ where: { id }, data });
    this.invalidateOrgCache();
    return result;
  }

  async suspendOrganization(id: string) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('Organization not found');
    if (org.deletedAt) throw new BadRequestException('Cannot suspend a deleted organization');
    if (org.archivedAt) throw new BadRequestException('Cannot suspend an archived organization');
    if (org.suspendedAt) throw new BadRequestException('Organization is already suspended');

    const result = this.prisma.organization.update({
      where: { id },
      data: { isActive: false, suspendedAt: new Date() },
    });
    this.invalidateOrgCache();
    return result;
  }

  async activateOrganization(id: string) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('Organization not found');
    if (org.deletedAt) throw new BadRequestException('Cannot activate a deleted organization');
    if (org.archivedAt) throw new BadRequestException('Cannot activate an archived organization');
    if (!org.suspendedAt) throw new BadRequestException('Organization is not suspended');

    const result = this.prisma.organization.update({
      where: { id },
      data: { isActive: true, suspendedAt: null },
    });
    this.invalidateOrgCache();
    return result;
  }

  async deleteOrganization(id: string, deletedBy: string, reason?: string) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('Organization not found');
    if (org.deletedAt) throw new BadRequestException('Organization is already deleted');

    const result = this.prisma.organization.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy, deletedReason: reason ?? null },
    });
    this.invalidateOrgCache();
    return result;
  }

  async restoreOrganization(id: string, _reason?: string) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('Organization not found');
    if (!org.deletedAt) throw new BadRequestException('Organization is not deleted');

    const result = this.prisma.organization.update({
      where: { id },
      data: { deletedAt: null, deletedBy: null, deletedReason: null },
    });
    this.invalidateOrgCache();
    return result;
  }

  async transferOwnership(id: string, dto: TransferOwnershipDto) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('Organization not found');

    const newOwner = await this.prisma.organizationMember.findFirst({
      where: { organizationId: id, userId: dto.newOwnerUserId },
    });
    if (!newOwner) throw new BadRequestException('User is not a member of this organization');

    await this.prisma.$transaction(async (tx) => {
      const ownerRole = await tx.role.findFirst({
        where: { organizationId: id, name: 'Owner', isSystem: true },
      });

      const previousOwners = await tx.organizationMember.findMany({
        where: { organizationId: id, role: 'OWNER' },
      });

      for (const prev of previousOwners) {
        await tx.organizationMember.update({
          where: { id: prev.id },
          data: { role: 'ADMIN' },
        });

        if (ownerRole) {
          await tx.userRoleAssignment.deleteMany({
            where: { userId: prev.userId, roleId: ownerRole.id },
          });
        }
      }

      await tx.organizationMember.update({
        where: { organizationId_userId: { organizationId: id, userId: dto.newOwnerUserId } },
        data: { role: 'OWNER' },
      });

      if (ownerRole) {
        await tx.userRoleAssignment.upsert({
          where: {
            userId_roleId: { userId: dto.newOwnerUserId, roleId: ownerRole.id },
          },
          create: { userId: dto.newOwnerUserId, roleId: ownerRole.id },
          update: {},
        });
      }
    });

    this.invalidateOrgCache(['dashboard', 'organization-statistics']);
    return { message: 'Ownership transferred successfully' };
  }

  async listUsers(page = 1, limit = 20, search?: string, orgId?: string, role?: string) {
    const where: Prisma.UserWhereInput = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (orgId) where.organizationId = orgId;
    if (role) where.role = role as 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER' | 'VIEWER' | undefined;
    where.deletedAt = null;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          avatar: true,
          organizationId: true,
          lastLoginAt: true,
          createdAt: true,
          organization: { select: { id: true, name: true } },
          memberOf: { select: { role: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getSystemSettings() {
    const settings = await this.prisma.systemSettings.findMany();
    const result: Record<string, unknown> = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }
    return result;
  }

  async updateSystemSettings(key: string, value: unknown, changedById?: string, reason?: string) {
    const [setting] = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.systemSettings.findUnique({ where: { key } });

      const s = await tx.systemSettings.upsert({
        where: { key },
        create: { key, value: value as Prisma.InputJsonValue },
        update: { value: value as Prisma.InputJsonValue },
      });

      const last = await tx.systemSettingVersion.findFirst({
        where: { settingKey: key },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      const nextVersion = (last?.version ?? 0) + 1;

      await tx.systemSettingVersion.create({
        data: {
          settingKey: key,
          oldValue: (existing?.value ?? null) as Prisma.InputJsonValue | undefined,
          newValue: value as Prisma.InputJsonValue,
          changedById: changedById ?? null,
          reason: reason ?? null,
          version: nextVersion,
        },
      });

      return [s];
    });

    this.cache.invalidate('dashboard');
    this.cache.invalidate('settings');
    return setting;
  }

  async getSettingHistory(key: string) {
    const versions = await this.prisma.systemSettingVersion.findMany({
      where: { settingKey: key },
      orderBy: { version: 'desc' },
      include: {
        changedBy: { select: { id: true, name: true, email: true } },
      },
    });
    return versions;
  }

  async rollbackSetting(key: string, targetVersion: number, changedById?: string, reason?: string) {
    const [setting] = await this.prisma.$transaction(async (tx) => {
      const target = await tx.systemSettingVersion.findFirst({
        where: { settingKey: key, version: targetVersion },
      });
      if (!target) throw new NotFoundException(`Version ${targetVersion} not found for ${key}`);

      const current = await tx.systemSettings.findUnique({ where: { key } });

      const s = await tx.systemSettings.update({
        where: { key },
        data: { value: target.newValue as Prisma.InputJsonValue },
      });

      const last = await tx.systemSettingVersion.findFirst({
        where: { settingKey: key },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      const nextVersion = (last?.version ?? 0) + 1;

      await tx.systemSettingVersion.create({
        data: {
          settingKey: key,
          oldValue: (current?.value ?? null) as Prisma.InputJsonValue,
          newValue: target.newValue as Prisma.InputJsonValue,
          changedById: changedById ?? null,
          reason: reason ?? `Rollback to version ${targetVersion}`,
          version: nextVersion,
        },
      });

      return [s];
    });

    this.cache.invalidate('dashboard');
    this.cache.invalidate('settings');
    return setting;
  }

  async getOrganizationStatistics(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        subscription: { include: { plan: true } },
        settings: true,
        _count: { select: { users: true, members: true, customers: true, products: true, suppliers: true, invoices: true, auditLogs: true } },
      },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      activeUsers,
      inactiveUsers,
      totalLogins,
      monthlyLogins,
      monthlyRevenue,
      recentAuditLogs,
      lastActivity,
    ] = await Promise.all([
      this.prisma.user.count({ where: { organizationId: id, isActive: true, deletedAt: null } }),
      this.prisma.user.count({ where: { organizationId: id, isActive: false, deletedAt: null } }),
      this.prisma.user.count({ where: { organizationId: id, lastLoginAt: { not: null } } }),
      this.prisma.user.count({ where: { organizationId: id, lastLoginAt: { gte: startOfMonth } } }),
      this.prisma.invoice.aggregate({
        where: { organizationId: id, type: 'SALES', paymentStatus: 'PAID' },
        _sum: { total: true },
      }),
      this.prisma.auditLog.findMany({
        where: { organizationId: id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.auditLog.findFirst({
        where: { organizationId: id },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    const owner = await this.prisma.organizationMember.findFirst({
      where: { organizationId: id, role: 'OWNER' },
      include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
    });

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      email: org.email,
      isActive: org.isActive,
      status: org.deletedAt ? 'DELETED' : org.archivedAt ? 'ARCHIVED' : org.suspendedAt ? 'SUSPENDED' : 'ACTIVE',
      createdAt: org.createdAt,
      lastActivity: lastActivity?.createdAt ?? null,
      owner: owner?.user ?? null,
      subscription: org.subscription
        ? {
            plan: org.subscription.plan?.name ?? null,
            status: org.subscription.status,
            currentPeriodEnd: org.subscription.currentPeriodEnd,
          }
        : null,
      users: {
        total: org._count.users,
        active: activeUsers,
        inactive: inactiveUsers,
        totalLogins,
        monthlyLogins,
      },
      revenue: {
        total: Number(monthlyRevenue._sum.total ?? 0),
      },
      usage: {
        customers: org._count.customers,
        products: org._count.products,
        suppliers: org._count.suppliers,
        invoices: org._count.invoices,
        auditEvents: org._count.auditLogs,
      },
      recentActivities: recentAuditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        entity: log.entity,
        createdAt: log.createdAt,
        user: log.user,
      })),
    };
  }

  async getSubscriptionPlans() {
    return this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    });
  }
}
