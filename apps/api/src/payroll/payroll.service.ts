import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AccountingService } from '../accounting/accounting.service';

import type { CreatePayrollDto, UpdatePayrollDto } from './dto/create-payroll.dto';
import type { MarkAsPaidDto } from './dto/mark-as-paid.dto';
import type { QueryPayrollDto } from './dto/query-payroll.dto';

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['PENDING'],
  PENDING: ['APPROVED', 'REJECTED'],
  APPROVED: ['PAID'],
  REJECTED: [],
  PAID: [],
};

const SELECT_FIELDS = {
  id: true,
  employeeId: true,
  periodStart: true,
  periodEnd: true,
  basicSalary: true,
  allowances: true,
  deductions: true,
  tax: true,
  netSalary: true,
  status: true,
  paymentDate: true,
  approvedBy: true,
  approvedAt: true,
  rejectedBy: true,
  rejectedAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const;

const EMPLOYEE_SELECT = {
  id: true,
  employeeCode: true,
  firstName: true,
  lastName: true,
  email: true,
  department: {
    select: { id: true, name: true, code: true },
  },
} as const;

@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly accountingService: AccountingService,
  ) {}

  async findAll(orgId: string, query: QueryPayrollDto = {}) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const andConditions: Record<string, unknown>[] = [
      { employee: { organizationId: orgId } },
    ];

    if (query.employeeId) {
      andConditions.push({ employeeId: query.employeeId });
    }

    if (query.status) {
      andConditions.push({ status: query.status });
    }

    if (query.periodStart) {
      andConditions.push({ periodStart: { gte: new Date(query.periodStart) } });
    }

    if (query.periodEnd) {
      andConditions.push({ periodEnd: { lte: new Date(query.periodEnd) } });
    }

    if (query.search) {
      andConditions.push({
        OR: [
          { employee: { firstName: { contains: query.search, mode: 'insensitive' } } },
          { employee: { lastName: { contains: query.search, mode: 'insensitive' } } },
          { employee: { employeeCode: { contains: query.search, mode: 'insensitive' } } },
          { employee: { email: { contains: query.search, mode: 'insensitive' } } },
        ],
      });
    }

    const where = { AND: andConditions };

    const orderBy = { [query.sortBy ?? 'periodEnd']: query.sortOrder ?? 'desc' };

    const [data, total] = await Promise.all([
      this.prisma.payroll.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          ...SELECT_FIELDS,
          employee: { select: EMPLOYEE_SELECT },
        },
      }),
      this.prisma.payroll.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(orgId: string, payrollId: string) {
    const payroll = await this.prisma.payroll.findFirst({
      where: { id: payrollId, employee: { organizationId: orgId } },
      select: {
        ...SELECT_FIELDS,
        employee: {
          select: {
            ...EMPLOYEE_SELECT,
            position: true,
            salary: true,
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
        employee: { organizationId: orgId },
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
        status: 'DRAFT',
        paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : null,
        notes: dto.notes?.trim() ?? null,
      },
      select: {
        ...SELECT_FIELDS,
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
      select: { id: true, employeeId: true, periodStart: true, periodEnd: true, basicSalary: true, allowances: true, deductions: true, tax: true, status: true },
    });

    if (!payroll) {
      throw new NotFoundException('Payroll record not found');
    }

    if (payroll.status !== 'DRAFT') {
      throw new BadRequestException(`Cannot edit payroll in ${payroll.status} status. Only DRAFT payroll can be edited.`);
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
          employee: { organizationId: orgId },
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
        ...SELECT_FIELDS,
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
      select: { id: true, employeeId: true, periodStart: true, periodEnd: true, status: true },
    });

    if (!payroll) {
      throw new NotFoundException('Payroll record not found');
    }

    if (payroll.status !== 'DRAFT') {
      throw new BadRequestException(`Cannot delete payroll in ${payroll.status} status. Only DRAFT payroll can be deleted.`);
    }

    await this.prisma.payroll.delete({ where: { id: payrollId, employee: { organizationId: orgId } } });

    await this.auditService.record({
      userId: actorId,
      organizationId: orgId,
      action: 'PAYROLL_DELETED',
      entity: 'Payroll',
      entityId: payrollId,
      status: 'SUCCESS',
      metadata: { period: `${payroll.periodStart} to ${payroll.periodEnd}`, previousStatus: payroll.status },
    });

    return { message: 'Payroll record deleted successfully' };
  }

  async submit(orgId: string, actorId: string, payrollId: string) {
    return this.transitionStatus(orgId, actorId, payrollId, 'PENDING', 'PAYROLL_SUBMITTED');
  }

  async approve(orgId: string, actorId: string, payrollId: string) {
    const payroll = await this.prisma.payroll.findFirst({
      where: { id: payrollId, employee: { organizationId: orgId } },
      select: { id: true, status: true, netSalary: true, employee: { select: { organizationId: true } } },
    });

    if (!payroll) {
      throw new NotFoundException('Payroll record not found');
    }

    if (payroll.status !== 'PENDING') {
      throw new BadRequestException(`Cannot approve payroll in ${payroll.status} status. Only PENDING payroll can be approved.`);
    }

    const result = await this.prisma.payroll.updateMany({
      where: {
        id: payrollId,
        employee: { organizationId: orgId },
        status: 'PENDING',
      },
      data: {
        status: 'APPROVED',
        approvedBy: actorId,
        approvedAt: new Date(),
      },
    });

    if (result.count === 0) {
      throw new BadRequestException('Concurrent modification detected. Please retry.');
    }

    await this.auditService.record({
      userId: actorId,
      organizationId: orgId,
      action: 'PAYROLL_APPROVED',
      entity: 'Payroll',
      entityId: payrollId,
      status: 'SUCCESS',
      metadata: { previousStatus: 'PENDING', newStatus: 'APPROVED' },
    });

    await this.createPayrollApprovalJournalEntry(orgId, actorId, payrollId, Number(payroll.netSalary));

    return this.findOne(orgId, payrollId);
  }

  async reject(orgId: string, actorId: string, payrollId: string) {
    const payroll = await this.prisma.payroll.findFirst({
      where: { id: payrollId, employee: { organizationId: orgId } },
      select: { id: true, status: true },
    });

    if (!payroll) {
      throw new NotFoundException('Payroll record not found');
    }

    if (payroll.status !== 'PENDING') {
      throw new BadRequestException(`Cannot reject payroll in ${payroll.status} status. Only PENDING payroll can be rejected.`);
    }

    const result = await this.prisma.payroll.updateMany({
      where: {
        id: payrollId,
        employee: { organizationId: orgId },
        status: 'PENDING',
      },
      data: {
        status: 'REJECTED',
        rejectedBy: actorId,
        rejectedAt: new Date(),
      },
    });

    if (result.count === 0) {
      throw new BadRequestException('Concurrent modification detected. Please retry.');
    }

    await this.auditService.record({
      userId: actorId,
      organizationId: orgId,
      action: 'PAYROLL_REJECTED',
      entity: 'Payroll',
      entityId: payrollId,
      status: 'SUCCESS',
      metadata: { previousStatus: 'PENDING', newStatus: 'REJECTED' },
    });

    return this.findOne(orgId, payrollId);
  }

  async markAsPaid(orgId: string, actorId: string, payrollId: string, dto: MarkAsPaidDto) {
    const payroll = await this.prisma.payroll.findFirst({
      where: { id: payrollId, employee: { organizationId: orgId } },
      select: { id: true, status: true, netSalary: true, employee: { select: { organizationId: true } } },
    });

    if (!payroll) {
      throw new NotFoundException('Payroll record not found');
    }

    if (payroll.status !== 'APPROVED') {
      throw new BadRequestException(`Cannot mark payroll as paid in ${payroll.status} status. Only APPROVED payroll can be marked as paid.`);
    }

    const paymentDate = dto.paymentDate ? new Date(dto.paymentDate) : new Date();

    const result = await this.prisma.payroll.updateMany({
      where: {
        id: payrollId,
        employee: { organizationId: orgId },
        status: 'APPROVED',
      },
      data: {
        status: 'PAID',
        paymentDate,
        ...(dto.notes !== undefined && { notes: dto.notes?.trim() ?? null }),
      },
    });

    if (result.count === 0) {
      throw new BadRequestException('Concurrent modification detected. Please retry.');
    }

    await this.auditService.record({
      userId: actorId,
      organizationId: orgId,
      action: 'PAYROLL_PAID',
      entity: 'Payroll',
      entityId: payrollId,
      status: 'SUCCESS',
      metadata: { previousStatus: 'APPROVED', newStatus: 'PAID', paymentDate: paymentDate.toISOString() },
    });

    await this.createPayrollPaymentJournalEntry(orgId, actorId, payrollId, Number(payroll.netSalary));

    return this.findOne(orgId, payrollId);
  }

  private async transitionStatus(
    orgId: string,
    actorId: string,
    payrollId: string,
    targetStatus: string,
    auditAction: string,
  ) {
    const payroll = await this.prisma.payroll.findFirst({
      where: { id: payrollId, employee: { organizationId: orgId } },
      select: { id: true, status: true },
    });

    if (!payroll) {
      throw new NotFoundException('Payroll record not found');
    }

    const allowed = VALID_TRANSITIONS[payroll.status] ?? [];
    if (!allowed.includes(targetStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${payroll.status} to ${targetStatus}`,
      );
    }

    const result = await this.prisma.payroll.updateMany({
      where: {
        id: payrollId,
        employee: { organizationId: orgId },
        status: payroll.status,
      },
      data: { status: targetStatus as never },
    });

    if (result.count === 0) {
      throw new BadRequestException('Concurrent modification detected. Please retry.');
    }

    await this.auditService.record({
      userId: actorId,
      organizationId: orgId,
      action: auditAction,
      entity: 'Payroll',
      entityId: payrollId,
      status: 'SUCCESS',
      metadata: { previousStatus: payroll.status, newStatus: targetStatus },
    });

    return this.findOne(orgId, payrollId);
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

  private async createPayrollApprovalJournalEntry(
    orgId: string,
    userId: string,
    payrollId: string,
    amount: number,
  ) {
    const existing = await this.prisma.journalEntry.findFirst({
      where: {
        referenceId: payrollId,
        referenceType: 'PAYROLL_APPROVAL',
        organizationId: orgId,
        deletedAt: null,
      },
    });
    if (existing) return existing;

    const salaryExpense = await this.findAccountByCode(orgId, '6000');
    const salaryPayable = await this.findAccountByCode(orgId, '2100');

    const entryNumber = await this.generateJournalEntryNumber(orgId);

    return this.prisma.journalEntry.create({
      data: {
        entryNumber,
        organizationId: orgId,
        description: `Payroll Approval: ${payrollId}`,
        date: new Date(),
        status: 'POSTED',
        referenceId: payrollId,
        referenceType: 'PAYROLL_APPROVAL',
        createdById: userId,
        lines: {
          create: [
            {
              accountId: salaryExpense.id,
              debit: amount,
              credit: 0,
              description: `Salaries Expense - ${payrollId}`,
            },
            {
              accountId: salaryPayable.id,
              debit: 0,
              credit: amount,
              description: `Salaries Payable - ${payrollId}`,
            },
          ],
        },
      },
      select: {
        id: true,
        entryNumber: true,
        date: true,
        status: true,
        createdAt: true,
      },
    });
  }

  private async createPayrollPaymentJournalEntry(
    orgId: string,
    userId: string,
    payrollId: string,
    amount: number,
  ) {
    const existing = await this.prisma.journalEntry.findFirst({
      where: {
        referenceId: payrollId,
        referenceType: 'PAYROLL_PAYMENT',
        organizationId: orgId,
        deletedAt: null,
      },
    });
    if (existing) return existing;

    const salaryPayable = await this.findAccountByCode(orgId, '2100');
    const cashAccount = await this.findAccountByCode(orgId, '1000');

    const entryNumber = await this.generateJournalEntryNumber(orgId);

    return this.prisma.journalEntry.create({
      data: {
        entryNumber,
        organizationId: orgId,
        description: `Payroll Payment: ${payrollId}`,
        date: new Date(),
        status: 'POSTED',
        referenceId: payrollId,
        referenceType: 'PAYROLL_PAYMENT',
        createdById: userId,
        lines: {
          create: [
            {
              accountId: salaryPayable.id,
              debit: amount,
              credit: 0,
              description: `Salaries Payable - ${payrollId}`,
            },
            {
              accountId: cashAccount.id,
              debit: 0,
              credit: amount,
              description: `Cash - ${payrollId}`,
            },
          ],
        },
      },
      select: {
        id: true,
        entryNumber: true,
        date: true,
        status: true,
        createdAt: true,
      },
    });
  }

  private async findAccountByCode(orgId: string, code: string) {
    const account = await this.prisma.account.findFirst({
      where: { organizationId: orgId, code },
    });

    if (!account) {
      throw new BadRequestException(
        `Account with code "${code}" not found. Please ensure the chart of accounts is seeded.`,
      );
    }

    return account;
  }

  private async generateJournalEntryNumber(orgId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `JE-${year}-`;

    const lastEntry = await this.prisma.journalEntry.findFirst({
      where: {
        organizationId: orgId,
        entryNumber: { startsWith: prefix },
      },
      orderBy: { entryNumber: 'desc' },
      select: { entryNumber: true },
    });

    let nextSeq = 1;
    if (lastEntry) {
      const parts = lastEntry.entryNumber.split('-');
      nextSeq = parseInt(parts[parts.length - 1], 10) + 1;
    }

    return `${prefix}${String(nextSeq).padStart(6, '0')}`;
  }
}
