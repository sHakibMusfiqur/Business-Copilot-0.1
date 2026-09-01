import { BadRequestException, Injectable, NotFoundException, ConflictException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

import type { CreateEmployeeDto, UpdateEmployeeDto } from './dto/create-employee.dto';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(orgId: string, query?: { search?: string; departmentId?: string; isActive?: boolean }) {
    const where: Record<string, unknown> = { organizationId: orgId };

    if (query?.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { employeeCode: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query?.departmentId) {
      where.departmentId = query.departmentId;
    }

    if (query?.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    return this.prisma.employee.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        gender: true,
        hireDate: true,
        departmentId: true,
        position: true,
        salary: true,
        isActive: true,
        createdAt: true,
        userId: true,
        department: {
          select: { id: true, name: true, code: true },
        },
        _count: {
          select: { leaves: true, payrolls: true },
        },
      },
    });
  }

  async findOne(orgId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId: orgId },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        gender: true,
        dateOfBirth: true,
        hireDate: true,
        departmentId: true,
        position: true,
        salary: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
        department: {
          select: { id: true, name: true, code: true },
        },
        leaves: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            startDate: true,
            endDate: true,
            type: true,
            status: true,
            reason: true,
            createdAt: true,
          },
        },
        payrolls: {
          orderBy: { periodEnd: 'desc' },
          take: 12,
          select: {
            id: true,
            periodStart: true,
            periodEnd: true,
            basicSalary: true,
            allowances: true,
            deductions: true,
            tax: true,
            netSalary: true,
            paymentDate: true,
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    return employee;
  }

  async create(orgId: string, actorId: string, dto: CreateEmployeeDto) {
    const existingEmployee = await this.prisma.employee.findFirst({
      where: { email: dto.email, organizationId: orgId },
      select: { id: true },
    });

    if (existingEmployee) {
      throw new ConflictException('An employee with this email already exists');
    }

    if (dto.departmentId) {
      const department = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, organizationId: orgId },
        select: { id: true },
      });
      if (!department) {
        throw new BadRequestException('departmentId does not belong to this organization');
      }
    }

    if (dto.userId) {
      const user = await this.prisma.user.findFirst({
        where: { id: dto.userId, organizationId: orgId },
        select: { id: true },
      });
      if (!user) {
        throw new BadRequestException('userId does not belong to this organization');
      }
    }

    const employeeCode = await this.generateUniqueEmployeeCode(orgId);

    const employee = await this.prisma.employee.create({
      data: {
        employeeCode,
        organizationId: orgId,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        email: dto.email.trim().toLowerCase(),
        phone: dto.phone?.trim() ?? null,
        gender: dto.gender as 'MALE' | 'FEMALE' | 'OTHER' | null ?? null,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        hireDate: dto.hireDate ? new Date(dto.hireDate) : new Date(),
        departmentId: dto.departmentId ?? null,
        position: dto.position?.trim() ?? null,
        salary: dto.salary ?? 0,
        userId: dto.userId ?? null,
      },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        email: true,
        isActive: true,
        createdAt: true,
      },
    });

    await this.auditService.record({
      userId: actorId,
      organizationId: orgId,
      action: 'EMPLOYEE_CREATED',
      entity: 'Employee',
      entityId: employee.id,
      status: 'SUCCESS',
      metadata: { employeeCode: employee.employeeCode, name: `${employee.firstName} ${employee.lastName}` },
    });

    return employee;
  }

  async update(orgId: string, actorId: string, employeeId: string, dto: UpdateEmployeeDto) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId: orgId },
      select: { id: true, employeeCode: true, firstName: true, lastName: true },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    if (dto.departmentId) {
      const department = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, organizationId: orgId },
        select: { id: true },
      });
      if (!department) {
        throw new BadRequestException('departmentId does not belong to this organization');
      }
    }

    const updateData: Record<string, unknown> = {};
    if (dto.firstName !== undefined) updateData.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) updateData.lastName = dto.lastName.trim();
    if (dto.phone !== undefined) updateData.phone = dto.phone?.trim() ?? null;
    if (dto.gender !== undefined) updateData.gender = dto.gender;
    if (dto.departmentId !== undefined) updateData.departmentId = dto.departmentId;
    if (dto.position !== undefined) updateData.position = dto.position?.trim() ?? null;
    if (dto.salary !== undefined) updateData.salary = dto.salary;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const updated = await this.prisma.employee.update({
      where: { id: employeeId },
      data: updateData,
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        email: true,
        isActive: true,
        updatedAt: true,
      },
    });

    await this.auditService.record({
      userId: actorId,
      organizationId: orgId,
      action: 'EMPLOYEE_UPDATED',
      entity: 'Employee',
      entityId: employeeId,
      status: 'SUCCESS',
      metadata: { employeeCode: employee.employeeCode, changes: Object.keys(dto) },
    });

    return updated;
  }

  async remove(orgId: string, actorId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId: orgId },
      select: { id: true, employeeCode: true, firstName: true, lastName: true },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    await this.prisma.employee.delete({ where: { id: employeeId } });

    await this.auditService.record({
      userId: actorId,
      organizationId: orgId,
      action: 'EMPLOYEE_DELETED',
      entity: 'Employee',
      entityId: employeeId,
      status: 'SUCCESS',
      metadata: { employeeCode: employee.employeeCode, name: `${employee.firstName} ${employee.lastName}` },
    });

    return { message: 'Employee deleted successfully' };
  }

  private async generateUniqueEmployeeCode(orgId: string): Promise<string> {
    const maxEmployee = await this.prisma.employee.findFirst({
      where: { organizationId: orgId, employeeCode: { startsWith: 'EMP-' } },
      orderBy: { employeeCode: 'desc' },
      select: { employeeCode: true },
    });

    let nextNumber = 1;
    if (maxEmployee) {
      const match = maxEmployee.employeeCode.match(/EMP-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    const maxRetries = 10;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const code = `EMP-${String(nextNumber + attempt).padStart(4, '0')}`;
      const existing = await this.prisma.employee.findFirst({
        where: { employeeCode: code },
        select: { id: true },
      });
      if (!existing) {
        return code;
      }
    }

    const fallbackCode = `EMP-${Date.now()}`;
    return fallbackCode;
  }

  async getStats(orgId: string) {
    const [total, active, byDepartment] = await Promise.all([
      this.prisma.employee.count({ where: { organizationId: orgId } }),
      this.prisma.employee.count({ where: { organizationId: orgId, isActive: true } }),
      this.prisma.employee.groupBy({
        by: ['departmentId'],
        where: { organizationId: orgId, isActive: true },
        _count: { id: true },
      }),
    ]);

    return {
      total,
      active,
      inactive: total - active,
      byDepartment: byDepartment.map((d) => ({
        departmentId: d.departmentId,
        count: d._count.id,
      })),
    };
  }
}
