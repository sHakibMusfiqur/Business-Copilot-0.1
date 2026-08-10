import { BadRequestException, NotFoundException } from '@nestjs/common';

import { LeadService } from './lead.service';
import { PrismaService } from '../prisma/prisma.service';

const ORG_ID = 'org-1';

const mockService = () => {
  const leadFindFirst = jest.fn();
  const leadUpdate = jest.fn();
  const leadCreate = jest.fn();
  const userFindFirst = jest.fn();
  const userFindUnique = jest.fn();
  const timelineEventCreate = jest.fn();

  const service = new LeadService({
    lead: { findFirst: leadFindFirst, update: leadUpdate, create: leadCreate },
    user: { findFirst: userFindFirst, findUnique: userFindUnique },
    timelineEvent: { create: timelineEventCreate },
  } as unknown as PrismaService);

  leadFindFirst.mockResolvedValue({ id: 'lead-1', leadNumber: 'LD-2026-000001', organizationId: ORG_ID });
  leadUpdate.mockResolvedValue({ id: 'lead-1', leadNumber: 'LD-2026-000001', assignedToId: 'u-same' });
  leadCreate.mockResolvedValue({ id: 'lead-1', leadNumber: 'LD-2026-000001' });

  return { service, leadFindFirst, leadUpdate, leadCreate, userFindFirst, userFindUnique, timelineEventCreate };
};

describe('LeadService.assignUser (tenant isolation)', () => {
  let service: LeadService;
  let leadFindFirst: jest.Mock;
  let leadUpdate: jest.Mock;
  let userFindFirst: jest.Mock;
  let userFindUnique: jest.Mock;
  let timelineEventCreate: jest.Mock;

  beforeEach(() => {
    ({ service, leadFindFirst, leadUpdate, userFindFirst, userFindUnique, timelineEventCreate } = mockService());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('resolves a user from the same organization and scopes the lookup', async () => {
    userFindFirst.mockResolvedValue({ id: 'u-same' });
    userFindUnique.mockResolvedValue({ name: 'Same Org User' });

    const result = await service.assignUser(ORG_ID, 'actor', 'lead-1', 'u-same');

    expect(userFindFirst).toHaveBeenCalledWith({
      where: { id: 'u-same', organizationId: ORG_ID, deletedAt: null },
      select: { id: true },
    });
    expect(timelineEventCreate).toHaveBeenCalled();
    expect(result.assignedToId).toBe('u-same');
  });

  it('rejects assigning to a user from another organization', async () => {
    userFindFirst.mockResolvedValue(null);

    await expect(
      service.assignUser(ORG_ID, 'actor', 'lead-1', 'u-other-org'),
    ).rejects.toThrow(BadRequestException);
    expect(leadUpdate).not.toHaveBeenCalled();
    expect(timelineEventCreate).not.toHaveBeenCalled();
  });

  it('rejects assigning to a soft-deleted user', async () => {
    userFindFirst.mockResolvedValue(null);

    await expect(
      service.assignUser(ORG_ID, 'actor', 'lead-1', 'u-deleted'),
    ).rejects.toThrow(BadRequestException);
    expect(leadUpdate).not.toHaveBeenCalled();
  });

it('does not validate when unassigning (assignedToId null)', async () => {
      leadUpdate.mockResolvedValue({ id: 'lead-1', leadNumber: 'LD-2026-000001', assignedToId: null });

      await service.assignUser(ORG_ID, 'actor', 'lead-1', null);

      expect(userFindFirst).not.toHaveBeenCalled();
    expect(leadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ assignedToId: null }) }),
    );
    expect(timelineEventCreate).toHaveBeenCalled();
  });

  it('throws NotFound when the lead does not belong to the organization', async () => {
    leadFindFirst.mockResolvedValue(null);

    await expect(service.assignUser(ORG_ID, 'actor', 'lead-other', 'u-same')).rejects.toThrow(
      NotFoundException,
    );
    expect(userFindFirst).not.toHaveBeenCalled();
    expect(leadUpdate).not.toHaveBeenCalled();
  });
});

describe('LeadService.update (assignedToId tenant validation)', () => {
  it('rejects connecting to a user from another organization', async () => {
    const { service, leadFindFirst, userFindFirst, leadUpdate } = mockService();
    leadFindFirst.mockResolvedValue({ id: 'lead-1', organizationId: ORG_ID, status: 'NEW' });
    userFindFirst.mockResolvedValue(null);

    await expect(
      service.update(ORG_ID, 'actor', 'lead-1', { assignedToId: 'u-other-org' } as never),
    ).rejects.toThrow(BadRequestException);
    expect(leadUpdate).not.toHaveBeenCalled();
  });

  it('allows connecting to a user from the same organization', async () => {
    const { service, leadFindFirst, userFindFirst, leadUpdate } = mockService();
    leadFindFirst.mockResolvedValue({ id: 'lead-1', organizationId: ORG_ID, status: 'NEW' });
    userFindFirst.mockResolvedValue({ id: 'u-same' });
    leadUpdate.mockResolvedValue({ id: 'lead-1' });

    await service.update(ORG_ID, 'actor', 'lead-1', { assignedToId: 'u-same' } as never);

    expect(userFindFirst).toHaveBeenCalledWith({
      where: { id: 'u-same', organizationId: ORG_ID, deletedAt: null },
      select: { id: true },
    });
    expect(leadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ assignedTo: { connect: { id: 'u-same' } } }),
      }),
    );
  });

  it('rejects assigning to a soft-deleted user via update()', async () => {
    const { service, leadFindFirst, userFindFirst, leadUpdate } = mockService();
    leadFindFirst.mockResolvedValue({ id: 'lead-1', organizationId: ORG_ID, status: 'NEW' });
    userFindFirst.mockResolvedValue(null);

    await expect(
      service.update(ORG_ID, 'actor', 'lead-1', { assignedToId: 'u-deleted' } as never),
    ).rejects.toThrow(BadRequestException);
    expect(leadUpdate).not.toHaveBeenCalled();
  });

  it('allows clearing assignment without validation', async () => {
    const { service, leadFindFirst, userFindFirst, leadUpdate } = mockService();
    leadFindFirst.mockResolvedValue({ id: 'lead-1', organizationId: ORG_ID, status: 'NEW' });
    leadUpdate.mockResolvedValue({ id: 'lead-1' });

    await service.update(ORG_ID, 'actor', 'lead-1', { assignedToId: null } as never);

    expect(userFindFirst).not.toHaveBeenCalled();
    expect(leadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ assignedTo: { disconnect: true } }),
      }),
    );
  });
});

describe('LeadService.update (closed-lead status guard / P3-L2)', () => {
  it('rejects changing the status of a WON lead via generic update()', async () => {
    const { service, leadFindFirst, leadUpdate } = mockService();
    leadFindFirst.mockResolvedValue({ id: 'lead-1', organizationId: ORG_ID, status: 'WON' });

    await expect(
      service.update(ORG_ID, 'actor', 'lead-1', { status: 'NEW' } as never),
    ).rejects.toThrow(BadRequestException);
    expect(leadUpdate).not.toHaveBeenCalled();
  });

  it('rejects changing the status of a LOST lead via generic update()', async () => {
    const { service, leadFindFirst, leadUpdate } = mockService();
    leadFindFirst.mockResolvedValue({ id: 'lead-1', organizationId: ORG_ID, status: 'LOST' });

    await expect(
      service.update(ORG_ID, 'actor', 'lead-1', { status: 'CONTACTED' } as never),
    ).rejects.toThrow(BadRequestException);
    expect(leadUpdate).not.toHaveBeenCalled();
  });

  it('allows changing the status of a non-closed lead via generic update()', async () => {
    const { service, leadFindFirst, leadUpdate } = mockService();
    leadFindFirst.mockResolvedValue({ id: 'lead-1', organizationId: ORG_ID, status: 'NEW' });
    leadUpdate.mockResolvedValue({ id: 'lead-1', leadNumber: 'LD-2026-000001', status: 'QUALIFIED' });

    const result = await service.update(ORG_ID, 'actor', 'lead-1', { status: 'QUALIFIED' } as never);

    expect(leadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'QUALIFIED' }) }),
    );
    expect(result.status).toBe('QUALIFIED');
  });

  it('allows updating non-status fields on a closed lead without triggering the guard', async () => {
    const { service, leadFindFirst, leadUpdate } = mockService();
    leadFindFirst.mockResolvedValue({ id: 'lead-1', organizationId: ORG_ID, status: 'WON' });
    leadUpdate.mockResolvedValue({ id: 'lead-1', leadNumber: 'LD-2026-000001' });

    await service.update(ORG_ID, 'actor', 'lead-1', { notes: 'Follow up on delivery' } as never);

    expect(leadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ notes: 'Follow up on delivery' }) }),
    );
  });

  it('does not trigger the guard when status is unchanged on a closed lead', async () => {
    const { service, leadFindFirst, leadUpdate } = mockService();
    leadFindFirst.mockResolvedValue({ id: 'lead-1', organizationId: ORG_ID, status: 'WON' });
    leadUpdate.mockResolvedValue({ id: 'lead-1', leadNumber: 'LD-2026-000001' });

    await service.update(ORG_ID, 'actor', 'lead-1', { status: 'WON', name: 'New Name' } as never);

    expect(leadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'New Name' }) }),
    );
  });
});

describe('LeadService.updateStatus (closed-lead guard intact / P3-L2)', () => {
  it('rejects changing the status of a WON lead via updateStatus()', async () => {
    const { service, leadFindFirst, leadUpdate } = mockService();
    leadFindFirst.mockResolvedValue({ id: 'lead-1', organizationId: ORG_ID, status: 'WON' });

    await expect(service.updateStatus(ORG_ID, 'actor', 'lead-1', 'NEW')).rejects.toThrow(
      BadRequestException,
    );
    expect(leadUpdate).not.toHaveBeenCalled();
  });

  it('rejects changing the status of a LOST lead via updateStatus()', async () => {
    const { service, leadFindFirst, leadUpdate } = mockService();
    leadFindFirst.mockResolvedValue({ id: 'lead-1', organizationId: ORG_ID, status: 'LOST' });

    await expect(service.updateStatus(ORG_ID, 'actor', 'lead-1', 'NEW')).rejects.toThrow(
      BadRequestException,
    );
    expect(leadUpdate).not.toHaveBeenCalled();
  });

  it('allows changing the status of a non-closed lead via updateStatus()', async () => {
    const { service, leadFindFirst, leadUpdate } = mockService();
    leadFindFirst.mockResolvedValue({ id: 'lead-1', organizationId: ORG_ID, status: 'NEW' });
    leadUpdate.mockResolvedValue({ id: 'lead-1', leadNumber: 'LD-2026-000001', status: 'QUALIFIED' });

    const result = await service.updateStatus(ORG_ID, 'actor', 'lead-1', 'QUALIFIED');

    expect(leadUpdate).toHaveBeenCalledWith({
      where: { id: 'lead-1' },
      data: { status: 'QUALIFIED' },
      select: { id: true, leadNumber: true, status: true },
    });
    expect(result.status).toBe('QUALIFIED');
  });
});

describe('LeadService.create (assignedToId tenant validation)', () => {
  it('rejects creating a lead assigned to a user from another organization', async () => {
    const { service, userFindFirst } = mockService();
    userFindFirst.mockResolvedValue(null);

    await expect(
      service.create(ORG_ID, 'actor', { name: 'X', assignedToId: 'u-other-org' } as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('allows creating a lead assigned to a user from the same organization', async () => {
    const { service, userFindFirst } = mockService();
    userFindFirst.mockResolvedValue({ id: 'u-same' });

    await expect(
      service.create(ORG_ID, 'actor', { name: 'X', assignedToId: 'u-same' } as never),
    ).resolves.toBeDefined();
    expect(userFindFirst).toHaveBeenCalledWith({
      where: { id: 'u-same', organizationId: ORG_ID, deletedAt: null },
      select: { id: true },
    });
  });

  it('rejects creating a lead assigned to a soft-deleted user', async () => {
    const { service, userFindFirst } = mockService();
    userFindFirst.mockResolvedValue(null);

    await expect(
      service.create(ORG_ID, 'actor', { name: 'X', assignedToId: 'u-deleted' } as never),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('LeadService.createTimelineEvent (tenant isolation / FS2)', () => {
  it('creates a timeline event for a lead in the same organization, scoping the lead lookup', async () => {
    const { service, leadFindFirst, timelineEventCreate } = mockService();
    leadFindFirst.mockResolvedValue({ id: 'lead-1', organizationId: ORG_ID });
    timelineEventCreate.mockResolvedValue({ id: 'event-1' });

    await service.createTimelineEvent(ORG_ID, 'lead-1', 'actor', 'CREATED', 'Lead created: LD-2026-000001');

    expect(leadFindFirst).toHaveBeenCalledWith({
      where: { id: 'lead-1', organizationId: ORG_ID, deletedAt: null },
      select: { id: true },
    });
    expect(timelineEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        leadId: 'lead-1',
        type: 'CREATED',
        description: 'Lead created: LD-2026-000001',
        createdById: 'actor',
      }),
    });
  });

  it('rejects a leadId belonging to another organization', async () => {
    const { service, leadFindFirst, timelineEventCreate } = mockService();
    leadFindFirst.mockResolvedValue(null);

    await expect(
      service.createTimelineEvent(ORG_ID, 'lead-other', 'actor', 'CREATED', 'Cross-org'),
    ).rejects.toThrow(NotFoundException);
    expect(timelineEventCreate).not.toHaveBeenCalled();
  });

  it('rejects when the lead does not exist', async () => {
    const { service, leadFindFirst, timelineEventCreate } = mockService();
    leadFindFirst.mockResolvedValue(null);

    await expect(
      service.createTimelineEvent(ORG_ID, 'lead-missing', 'actor', 'CREATED', 'Missing lead'),
    ).rejects.toThrow(NotFoundException);
    expect(timelineEventCreate).not.toHaveBeenCalled();
  });

  it('keeps existing same-org callers working (update still creates a timeline event)', async () => {
    const { service, leadFindFirst, leadUpdate, timelineEventCreate } = mockService();
    leadFindFirst.mockResolvedValue({ id: 'lead-1', organizationId: ORG_ID, status: 'NEW' });
    leadUpdate.mockResolvedValue({ id: 'lead-1', leadNumber: 'LD-2026-000001', status: 'QUALIFIED' });
    timelineEventCreate.mockResolvedValue({ id: 'event-2' });

    await service.update(ORG_ID, 'actor', 'lead-1', { notes: 'Follow up' } as never);

    expect(leadUpdate).toHaveBeenCalled();
    expect(timelineEventCreate).toHaveBeenCalled();
  });
});