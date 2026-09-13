import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

import type { CreateDepartmentDto } from './dto/create-department.dto';
import type { UpdateDepartmentDto } from './dto/update-department.dto';
import type { QueryDepartmentListDto } from './dto/query-department-list.dto';

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(orgId: string) {
    const departments = await this.prisma.department.findMany({
      where: {
        isActive: true,
        OR: [{ organizationId: orgId }, { organizationId: null }],
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
        organizationId: true,
        managerId: true,
        isActive: true,
      },
    });

    return departments.map((department) => ({
      id: department.id,
      name: department.name,
      code: department.code,
      organizationId: department.organizationId,
      managerId: department.managerId,
      isActive: department.isActive,
      shared: department.organizationId === null,
    }));
  }

  async findAllPaginated(orgId: string, query: QueryDepartmentListDto) {
    const { page = 1, limit = 20, search, sortBy = 'name', sortOrder = 'asc' } = query;
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const tenantScope = { OR: [{ organizationId: orgId }, { organizationId: null }] };

    const where = search
      ? {
          AND: [
            tenantScope,
            {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { code: { contains: search, mode: 'insensitive' as const } },
              ],
            },
          ],
        }
      : tenantScope;

    const orderBy = { [sortBy]: sortOrder } as const;

    const [departments, total] = await Promise.all([
      this.prisma.department.findMany({
        where,
        orderBy,
        skip,
        take: safeLimit,
        select: {
          id: true,
          name: true,
          code: true,
          organizationId: true,
          managerId: true,
          isActive: true,
        },
      }),
      this.prisma.department.count({ where }),
    ]);

    return {
      data: departments.map((dept) => ({
        id: dept.id,
        name: dept.name,
        code: dept.code,
        organizationId: dept.organizationId,
        managerId: dept.managerId,
        isActive: dept.isActive,
        shared: dept.organizationId === null,
      })),
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async create(orgId: string, actorId: string, dto: CreateDepartmentDto) {
    if (dto.managerId) {
      const manager = await this.prisma.user.findFirst({
        where: { id: dto.managerId, organizationId: orgId },
        select: { id: true },
      });
      if (!manager) {
        throw new BadRequestException('managerId does not belong to this organization');
      }
    }

    const normalizedCode = dto.code.trim().toUpperCase();

    const existingByCode = await this.prisma.department.findFirst({
      where: { code: normalizedCode },
      select: { id: true },
    });
    if (existingByCode) {
      throw new BadRequestException(`Department code "${normalizedCode}" is already in use.`);
    }

    const department = await this.prisma.department.create({
      data: {
        name: dto.name.trim(),
        code: normalizedCode,
        organizationId: orgId,
        managerId: dto.managerId ?? null,
      },
      select: {
        id: true,
        name: true,
        code: true,
        organizationId: true,
        managerId: true,
        isActive: true,
      },
    });

    await this.auditService.record({
      userId: actorId,
      organizationId: orgId,
      action: 'DEPARTMENT_CREATED',
      entity: 'Department',
      entityId: department.id,
      status: 'SUCCESS',
      metadata: { name: department.name },
    });

    return { ...department, shared: false };
  }

  async update(orgId: string, actorId: string, departmentId: string, dto: UpdateDepartmentDto) {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, organizationId: orgId },
      select: { id: true, name: true, code: true },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    if (dto.managerId) {
      const manager = await this.prisma.user.findFirst({
        where: { id: dto.managerId, organizationId: orgId },
        select: { id: true },
      });
      if (!manager) {
        throw new BadRequestException('managerId does not belong to this organization');
      }
    }

    if (dto.code !== undefined) {
      const normalizedCode = dto.code.trim().toUpperCase();
      const existingByCode = await this.prisma.department.findFirst({
        where: { code: normalizedCode, id: { not: departmentId } },
        select: { id: true },
      });
      if (existingByCode) {
        throw new BadRequestException(`Department code "${normalizedCode}" is already in use.`);
      }
    }

    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name.trim();
    if (dto.code !== undefined) updateData.code = dto.code.trim().toUpperCase();
    if (dto.managerId !== undefined) updateData.managerId = dto.managerId;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const updated = await this.prisma.department.update({
      where: { id: departmentId },
      data: updateData,
      select: {
        id: true,
        name: true,
        code: true,
        organizationId: true,
        managerId: true,
        isActive: true,
      },
    });

    await this.auditService.record({
      userId: actorId,
      organizationId: orgId,
      action: 'DEPARTMENT_UPDATED',
      entity: 'Department',
      entityId: departmentId,
      status: 'SUCCESS',
      metadata: { name: updated.name, changes: Object.keys(dto) },
    });

    return { ...updated, shared: updated.organizationId === null };
  }

  async remove(orgId: string, actorId: string, departmentId: string) {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, organizationId: orgId },
      select: { id: true, name: true },
    });
    if (!department) {
      throw new NotFoundException('Department not found');
    }

    const [employeeCount, userCount, invitationCount] = await Promise.all([
      this.prisma.employee.count({ where: { departmentId } }),
      this.prisma.user.count({ where: { departmentId } }),
      this.prisma.invitation.count({ where: { departmentId } }),
    ]);

    if (employeeCount > 0 || userCount > 0 || invitationCount > 0) {
      const deps: string[] = [];
      if (employeeCount > 0) deps.push(`${employeeCount} employee(s)`);
      if (userCount > 0) deps.push(`${userCount} user(s)`);
      if (invitationCount > 0) deps.push(`${invitationCount} invitation(s)`);
      throw new BadRequestException(
        `Cannot delete department "${department.name}": it is linked to ${deps.join(', ')}. Reassign or remove them first.`,
      );
    }

    await this.prisma.department.delete({ where: { id: departmentId } });

    await this.auditService.record({
      userId: actorId,
      organizationId: orgId,
      action: 'DEPARTMENT_DELETED',
      entity: 'Department',
      entityId: departmentId,
      status: 'SUCCESS',
      metadata: { name: department.name },
    });

    return { message: 'Department deleted successfully' };
  }
}
