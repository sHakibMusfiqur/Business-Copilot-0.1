import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

import type { CreatePayrollDto, UpdatePayrollDto } from './dto/create-payroll.dto';

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(orgId: string, query?: { employeeId?: string; periodStart?: string; periodEnd?: string }) {
    const where: Record<string, unknown> = {
      employee: { organizationId: orgId },
    };

    if (query?.employeeId) {
      where.employeeId = query.employeeId;
    }

    if (query?.periodStart) {
      where.periodStart = { gte: new Date(query.periodStart) };
    }

    if (query?.periodEnd) {
      where.periodEnd = { lte: new Date(query.periodEnd) };
    }

    return this.prisma.payroll.findMany({
      where,
      orderBy: { periodEnd: 'desc' },
      select: {
        id: true,
        employeeId: true,
        periodStart: true,
        periodEnd: true,
        basicSalary: true,
        allowances: true,
        deductions: true,
        tax: true,
        netSalary: true,
        paymentDate: true,
        notes: true,
        createdAt: true,
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
            department: {
              select: { id: true, name: true, code: true },
            },
          },
        },
      },
    });
  }

  async findOne(orgId: string, payrollId: string) {
    const payroll = await this.prisma.payroll.findFirst({
      where: { id: payrollId, employee: { organizationId: orgId } },
      select: {
        id: true,
        employeeId: true,
        periodStart: true,
        periodEnd: true,
        basicSalary: true,
        allowances: true,
        deductions: true,
        tax: true,
        netSalary: true,
        paymentDate: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
            position: true,
            salary: true,
            department: {
              select: { id: true, name: true, code: true },
            },
          },
        },
      },
    });

    if (!payroll) {
      throw new NotFoundException('Payroll record not found');
    }

    return payroll;
  }

  async create(orgId: string, actorId: string, dto: CreatePayrollDto) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, organizationId: orgId },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!employee) {
      throw new BadRequestException('employeeId does not belong to this organization');
    }

    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);

    if (periodStart > periodEnd) {
      throw new BadRequestException('periodStart must not be after periodEnd');
    }

    if (dto.basicSalary < 0 || (dto.allowances !== undefined && dto.allowances < 0) ||
        (dto.deductions !== undefined && dto.deductions < 0) || (dto.tax !== undefined && dto.tax < 0)) {
      throw new BadRequestException('Salary components must be non-negative');
    }

    const overlapping = await this.prisma.payroll.findFirst({
      where: {
        employeeId: dto.employeeId,
        periodStart: { lte: periodEnd },
        periodEnd: { gte: periodStart },
      },
      select: { id: true },
    });

    if (overlapping) {
      throw new BadRequestException('Payroll period overlaps with an existing record for this employee');
    }

    const netSalary = dto.basicSalary + (dto.allowances ?? 0) - (dto.deductions ?? 0) - (dto.tax ?? 0);

    const payroll = await this.prisma.payroll.create({
      data: {
        employeeId: dto.employeeId,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        basicSalary: dto.basicSalary,
        allowances: dto.allowances ?? 0,
        deductions: dto.deductions ?? 0,
        tax: dto.tax ?? 0,
        netSalary,
        paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : null,
        notes: dto.notes?.trim() ?? null,
      },
      select: {
        id: true,
        employeeId: true,
        periodStart: true,
        periodEnd: true,
        basicSalary: true,
        allowances: true,
        deductions: true,
        tax: true,
        netSalary: true,
        paymentDate: true,
        createdAt: true,
      },
    });

    await this.auditService.record({
      userId: actorId,
      organizationId: orgId,
      action: 'PAYROLL_CREATED',
      entity: 'Payroll',
      entityId: payroll.id,
      status: 'SUCCESS',
      metadata: {
        employeeName: `${employee.firstName} ${employee.lastName}`,
        period: `${dto.periodStart} to ${dto.periodEnd}`,
        netSalary,
      },
    });

    return payroll;
  }

  async update(orgId: string, actorId: string, payrollId: string, dto: UpdatePayrollDto) {
    const payroll = await this.prisma.payroll.findFirst({
      where: { id: payrollId, employee: { organizationId: orgId } },
      select: { id: true, employeeId: true, periodStart: true, periodEnd: true, basicSalary: true, allowances: true, deductions: true, tax: true },
    });

    if (!payroll) {
      throw new NotFoundException('Payroll record not found');
    }

    const periodStart = dto.periodStart ? new Date(dto.periodStart) : payroll.periodStart;
    const periodEnd = dto.periodEnd ? new Date(dto.periodEnd) : payroll.periodEnd;

    if (periodStart > periodEnd) {
      throw new BadRequestException('periodStart must not be after periodEnd');
    }

    if ((dto.basicSalary !== undefined && dto.basicSalary < 0) ||
        (dto.allowances !== undefined && dto.allowances < 0) ||
        (dto.deductions !== undefined && dto.deductions < 0) ||
        (dto.tax !== undefined && dto.tax < 0)) {
      throw new BadRequestException('Salary components must be non-negative');
    }

    if (dto.periodStart || dto.periodEnd) {
      const overlapping = await this.prisma.payroll.findFirst({
        where: {
          id: { not: payrollId },
          employeeId: payroll.employeeId,
          periodStart: { lte: periodEnd },
          periodEnd: { gte: periodStart },
        },
        select: { id: true },
      });

      if (overlapping) {
        throw new BadRequestException('Payroll period overlaps with an existing record for this employee');
      }
    }

    const basicSalary = dto.basicSalary ?? Number(payroll.basicSalary);
    const allowances = dto.allowances ?? Number(payroll.allowances);
    const deductions = dto.deductions ?? Number(payroll.deductions);
    const tax = dto.tax ?? Number(payroll.tax);
    const netSalary = basicSalary + allowances - deductions - tax;

    const updated = await this.prisma.payroll.update({
      where: { id: payrollId, employee: { organizationId: orgId } },
      data: {
        ...(dto.basicSalary !== undefined && { basicSalary: dto.basicSalary }),
        ...(dto.allowances !== undefined && { allowances: dto.allowances }),
        ...(dto.deductions !== undefined && { deductions: dto.deductions }),
        ...(dto.tax !== undefined && { tax: dto.tax }),
        netSalary,
        ...(dto.paymentDate !== undefined && { paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : null }),
        ...(dto.notes !== undefined && { notes: dto.notes?.trim() ?? null }),
      },
      select: {
        id: true,
        employeeId: true,
        periodStart: true,
        periodEnd: true,
        basicSalary: true,
        allowances: true,
        deductions: true,
        tax: true,
        netSalary: true,
        paymentDate: true,
        updatedAt: true,
      },
    });

    await this.auditService.record({
      userId: actorId,
      organizationId: orgId,
      action: 'PAYROLL_UPDATED',
      entity: 'Payroll',
      entityId: payrollId,
      status: 'SUCCESS',
      metadata: { changes: Object.keys(dto), netSalary },
    });

    return updated;
  }

  async remove(orgId: string, actorId: string, payrollId: string) {
    const payroll = await this.prisma.payroll.findFirst({
      where: { id: payrollId, employee: { organizationId: orgId } },
      select: { id: true, employeeId: true, periodStart: true, periodEnd: true },
    });

    if (!payroll) {
      throw new NotFoundException('Payroll record not found');
    }

    await this.prisma.payroll.delete({ where: { id: payrollId, employee: { organizationId: orgId } } });

    await this.auditService.record({
      userId: actorId,
      organizationId: orgId,
      action: 'PAYROLL_DELETED',
      entity: 'Payroll',
      entityId: payrollId,
      status: 'SUCCESS',
      metadata: { period: `${payroll.periodStart} to ${payroll.periodEnd}` },
    });

    return { message: 'Payroll record deleted successfully' };
  }

  async getStats(orgId: string) {
    const where = { employee: { organizationId: orgId } };

    const [total, totalNetSalary, byMonth] = await Promise.all([
      this.prisma.payroll.count({ where }),
      this.prisma.payroll.aggregate({ where, _sum: { netSalary: true, basicSalary: true, allowances: true, deductions: true, tax: true } }),
      this.prisma.payroll.groupBy({
        by: ['periodStart'],
        where,
        _sum: { netSalary: true },
        _count: { id: true },
        orderBy: { periodStart: 'desc' },
        take: 12,
      }),
    ]);

    return {
      total,
      totalNetSalary: Number(totalNetSalary._sum.netSalary ?? 0),
      totalBasicSalary: Number(totalNetSalary._sum.basicSalary ?? 0),
      totalAllowances: Number(totalNetSalary._sum.allowances ?? 0),
      totalDeductions: Number(totalNetSalary._sum.deductions ?? 0),
      totalTax: Number(totalNetSalary._sum.tax ?? 0),
      byMonth: byMonth.map((m) => ({
        periodStart: m.periodStart,
        totalNetSalary: Number(m._sum.netSalary ?? 0),
        count: m._count.id,
      })),
    };
  }
}
