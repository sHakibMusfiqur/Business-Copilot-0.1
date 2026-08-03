import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

import type { CreateDepartmentDto } from './dto/create-department.dto';

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
      },
    });

    return departments.map((department) => ({
      id: department.id,
      name: department.name,
      code: department.code,
      organizationId: department.organizationId,
      managerId: department.managerId,
      shared: department.organizationId === null,
    }));
  }

  async create(orgId: string, actorId: string, dto: CreateDepartmentDto) {
    const department = await this.prisma.department.create({
      data: {
        name: dto.name.trim(),
        code: dto.code.trim().toUpperCase(),
        organizationId: orgId,
        managerId: dto.managerId ?? null,
      },
      select: {
        id: true,
        name: true,
        code: true,
        organizationId: true,
        managerId: true,
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

  async remove(orgId: string, actorId: string, departmentId: string) {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, organizationId: orgId },
      select: { id: true, name: true },
    });
    if (!department) {
      throw new NotFoundException('Department not found');
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
