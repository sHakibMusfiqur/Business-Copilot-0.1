import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import type { AuditQueryDto } from './dto/audit-query.dto';

export interface AuditRecordParams {
  userId?: string;
  organizationId?: string;
  action: string;
  entity?: string;
  entityId?: string;
  status?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private loggingCrossTenantAccess = false;

  constructor(private readonly prisma: PrismaService) {}

  async record(params: AuditRecordParams): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: params.userId ?? null,
          organizationId: params.organizationId ?? null,
          action: params.action,
          entity: params.entity ?? null,
          entityId: params.entityId ?? null,
          status: params.status ?? 'SUCCESS',
          metadata: this.sanitizeMetadata(params.metadata) as Prisma.InputJsonValue,
          ipAddress: params.ipAddress ?? null,
          userAgent: params.userAgent ?? null,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to record audit log: ${(error as Error).message}`);
    }
  }

  private sanitizeMetadata(metadata?: Record<string, unknown>): Record<string, unknown> {
    if (!metadata) return {};
    const sensitiveKeys = new Set([
      'password', 'passwordhash', 'token', 'accesstoken', 'refreshtoken',
      'secret', 'apikey', 'authorization', 'cookie',
    ]);
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (!sensitiveKeys.has(key.toLowerCase())) {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  private async logCrossTenantAccess(userId: string | undefined): Promise<void> {
    if (this.loggingCrossTenantAccess) return;
    this.loggingCrossTenantAccess = true;
    try {
      await this.record({
        userId,
        action: 'PLATFORM_ADMIN_CROSS_TENANT_AUDIT_ACCESS',
        entity: 'AuditLog',
        status: 'SUCCESS',
        metadata: { scope: 'all_organizations' },
      });
    } finally {
      this.loggingCrossTenantAccess = false;
    }
  }

  async findAll(
    query: AuditQueryDto,
    orgId?: string,
    isPlatformAdmin = false,
    userId?: string,
  ) {
    const where: Prisma.AuditLogWhereInput = {};

    if (!isPlatformAdmin && orgId) {
      where.organizationId = orgId;
    }

    if (isPlatformAdmin && !orgId) {
      await this.logCrossTenantAccess(userId);
    }

    if (query.action) {
      where.action = query.action;
    }

    if (query.entity) {
      where.entity = query.entity;
    }

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.search) {
      where.OR = [
        { action: { contains: query.search, mode: 'insensitive' } },
        { entity: { contains: query.search, mode: 'insensitive' } },
        { entityId: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.AuditLogOrderByWithRelationInput = {};
    orderBy.createdAt = query.sortOrder ?? 'desc';

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy,
        skip: ((query.page ?? 1) - 1) * (query.limit ?? 20),
        take: query.limit ?? 20,
        include: {
          user: { select: { id: true, name: true, email: true } },
          organization: { select: { id: true, name: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      meta: {
        page: query.page ?? 1,
        limit: query.limit ?? 20,
        total,
        totalPages: Math.ceil(total / (query.limit ?? 20)),
      },
    };
  }

  async exportCsv(
    query: AuditQueryDto,
    orgId?: string,
    isPlatformAdmin = false,
    userId?: string,
  ): Promise<string> {
    const where: Prisma.AuditLogWhereInput = {};
    if (!isPlatformAdmin && orgId) where.organizationId = orgId;
    if (isPlatformAdmin && !orgId) {
      await this.logCrossTenantAccess(userId);
    }
    if (query.action) where.action = query.action;
    if (query.entity) where.entity = query.entity;

    const MAX_EXPORT_ROWS = 100_000;

    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: MAX_EXPORT_ROWS,
      select: {
        createdAt: true,
        action: true,
        entity: true,
        entityId: true,
        status: true,
        ipAddress: true,
        userAgent: true,
        organizationId: true,
        user: { select: { name: true, email: true } },
      },
    });

    const header = 'Timestamp,Action,Entity,Entity ID,Status,User,User Email,IP Address,User Agent,Organization ID\n';
    const rows = logs.map((log) => {
      const timestamp = log.createdAt.toISOString();
      const action = this.escapeCsv(log.action);
      const entity = this.escapeCsv(log.entity ?? '');
      const entityId = this.escapeCsv(log.entityId ?? '');
      const status = this.escapeCsv(log.status);
      const userName = this.escapeCsv(log.user?.name ?? '');
      const userEmail = this.escapeCsv(log.user?.email ?? '');
      const ip = this.escapeCsv(log.ipAddress ?? '');
      const ua = this.escapeCsv(log.userAgent ?? '');
      const orgIdField = this.escapeCsv(log.organizationId ?? '');
      return `${timestamp},${action},${entity},${entityId},${status},${userName},${userEmail},${ip},${ua},${orgIdField}`;
    });

    return header + rows.join('\n');
  }

  async getDistinctActions(orgId?: string, isPlatformAdmin = false, userId?: string): Promise<string[]> {
    const where: Prisma.AuditLogWhereInput = {};
    if (!isPlatformAdmin && orgId) where.organizationId = orgId;
    if (isPlatformAdmin && !orgId) {
      await this.logCrossTenantAccess(userId);
    }

    const result = await this.prisma.auditLog.groupBy({
      by: ['action'],
      where,
      _count: { action: true },
      orderBy: { _count: { action: 'desc' } },
    });

    return result.map((r) => r.action);
  }

  private escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
