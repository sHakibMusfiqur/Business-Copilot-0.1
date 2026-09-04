import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

import type { CreateLeaveDto, UpdateLeaveDto } from './dto/create-leave.dto';

const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['CANCELLED'],
  REJECTED: [],
  CANCELLED: [],
};

@Injectable()
export class LeavesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(orgId: string, query?: { employeeId?: string; status?: string; type?: string }) {
    const where: Record<string, unknown> = {
      employee: { organizationId: orgId },
    };

    if (query?.employeeId) {
      where.employeeId = query.employeeId;
    }

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.type) {
      where.type = query.type;
    }

    return this.prisma.leave.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        employeeId: true,
        startDate: true,
        endDate: true,
        type: true,
        reason: true,
        status: true,
        approvedBy: true,
        createdAt: true,
        updatedAt: true,
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeCode: true,
            department: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  async findOne(orgId: string, leaveId: string) {
    const leave = await this.prisma.leave.findFirst({
      where: { id: leaveId, employee: { organizationId: orgId } },
      select: {
        id: true,
        employeeId: true,
        startDate: true,
        endDate: true,
        type: true,
        reason: true,
        status: true,
        approvedBy: true,
        createdAt: true,
        updatedAt: true,
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeCode: true,
            department: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!leave) {
      throw new NotFoundException('Leave request not found');
    }

    return leave;
  }

  async create(orgId: string, actorId: string, dto: CreateLeaveDto) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, organizationId: orgId },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!employee) {
      throw new BadRequestException('Employee does not belong to this organization');
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (endDate < startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    const leave = await this.prisma.leave.create({
      data: {
        employeeId: dto.employeeId,
        startDate,
        endDate,
        type: dto.type ?? 'ANNUAL',
        reason: dto.reason?.trim() ?? null,
        status: 'PENDING',
      },
      select: {
        id: true,
        employeeId: true,
        startDate: true,
        endDate: true,
        type: true,
        reason: true,
        status: true,
        createdAt: true,
        employee: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    await this.auditService.record({
      userId: actorId,
      organizationId: orgId,
      action: 'LEAVE_CREATED',
      entity: 'Leave',
      entityId: leave.id,
      status: 'SUCCESS',
      metadata: {
        employeeName: `${employee.firstName} ${employee.lastName}`,
        type: leave.type,
        startDate: leave.startDate.toISOString(),
        endDate: leave.endDate.toISOString(),
      },
    });

    return leave;
  }

  async update(orgId: string, actorId: string, leaveId: string, dto: UpdateLeaveDto) {
    const leave = await this.prisma.leave.findFirst({
      where: { id: leaveId, employee: { organizationId: orgId } },
      select: { id: true, status: true, employeeId: true },
    });

    if (!leave) {
      throw new NotFoundException('Leave request not found');
    }

    if (leave.status !== 'PENDING') {
      throw new BadRequestException('Only pending leaves can be edited');
    }

    const updateData: Record<string, unknown> = {};
    if (dto.startDate !== undefined) updateData.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) updateData.endDate = new Date(dto.endDate);
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.reason !== undefined) updateData.reason = dto.reason?.trim() ?? null;

    if (updateData.startDate && updateData.endDate) {
      if ((updateData.endDate as Date) < (updateData.startDate as Date)) {
        throw new BadRequestException('End date must be after start date');
      }
    }

    const updated = await this.prisma.leave.update({
      where: { id: leaveId },
      data: updateData,
      select: {
        id: true,
        employeeId: true,
        startDate: true,
        endDate: true,
        type: true,
        reason: true,
        status: true,
        updatedAt: true,
        employee: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    await this.auditService.record({
      userId: actorId,
      organizationId: orgId,
      action: 'LEAVE_UPDATED',
      entity: 'Leave',
      entityId: leaveId,
      status: 'SUCCESS',
      metadata: { changes: Object.keys(dto) },
    });

    return updated;
  }

  async remove(orgId: string, actorId: string, leaveId: string) {
    const leave = await this.prisma.leave.findFirst({
      where: { id: leaveId, employee: { organizationId: orgId } },
      select: { id: true, status: true, employeeId: true },
    });

    if (!leave) {
      throw new NotFoundException('Leave request not found');
    }

    if (leave.status === 'APPROVED') {
      throw new BadRequestException('Cannot delete an approved leave request');
    }

    await this.prisma.leave.delete({ where: { id: leaveId } });

    await this.auditService.record({
      userId: actorId,
      organizationId: orgId,
      action: 'LEAVE_DELETED',
      entity: 'Leave',
      entityId: leaveId,
      status: 'SUCCESS',
      metadata: { previousStatus: leave.status },
    });

    return { message: 'Leave request deleted successfully' };
  }

  async approve(orgId: string, actorId: string, leaveId: string) {
    return this.transitionStatus(orgId, actorId, leaveId, 'APPROVED');
  }

  async reject(orgId: string, actorId: string, leaveId: string) {
    return this.transitionStatus(orgId, actorId, leaveId, 'REJECTED');
  }

  private async transitionStatus(orgId: string, actorId: string, leaveId: string, targetStatus: string) {
    const leave = await this.prisma.leave.findFirst({
      where: { id: leaveId, employee: { organizationId: orgId } },
      select: { id: true, status: true, employeeId: true },
    });

    if (!leave) {
      throw new NotFoundException('Leave request not found');
    }

    const allowed = VALID_TRANSITIONS[leave.status] ?? [];
    if (!allowed.includes(targetStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${leave.status} to ${targetStatus}`,
      );
    }

    const updated = await this.prisma.leave.update({
      where: { id: leaveId },
      data: { status: targetStatus as 'APPROVED' | 'REJECTED', approvedBy: actorId },
      select: {
        id: true,
        employeeId: true,
        startDate: true,
        endDate: true,
        type: true,
        reason: true,
        status: true,
        approvedBy: true,
        updatedAt: true,
      },
    });

    await this.auditService.record({
      userId: actorId,
      organizationId: orgId,
      action: `LEAVE_${targetStatus}`,
      entity: 'Leave',
      entityId: leaveId,
      status: 'SUCCESS',
      metadata: { previousStatus: leave.status, newStatus: targetStatus },
    });

    return updated;
  }

  async getStats(orgId: string) {
    const [total, pending, approved, rejected] = await Promise.all([
      this.prisma.leave.count({ where: { employee: { organizationId: orgId } } }),
      this.prisma.leave.count({ where: { employee: { organizationId: orgId }, status: 'PENDING' } }),
      this.prisma.leave.count({ where: { employee: { organizationId: orgId }, status: 'APPROVED' } }),
      this.prisma.leave.count({ where: { employee: { organizationId: orgId }, status: 'REJECTED' } }),
    ]);

    return { total, pending, approved, rejected };
  }
}
