import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { LeadService } from './lead.service';
import { PrismaService } from '../prisma/prisma.service';

const ORG_ID = 'org-1';

const mockService = () => {
  const leadFindFirst = jest.fn();
  const leadFindMany = jest.fn();
  const leadUpdate = jest.fn();
  const leadCreate = jest.fn();
  const userFindFirst = jest.fn();
  const userFindUnique = jest.fn();
  const timelineEventCreate = jest.fn();
  const leadCount = jest.fn();
  const leadGroupBy = jest.fn();
  const leadAggregate = jest.fn();
  const activityFindMany = jest.fn();

  const service = new LeadService({
    lead: {
      findFirst: leadFindFirst,
      findMany: leadFindMany,
      update: leadUpdate,
      create: leadCreate,
      count: leadCount,
      groupBy: leadGroupBy,
      aggregate: leadAggregate,
    },
    user: { findFirst: userFindFirst, findUnique: userFindUnique },
    timelineEvent: { create: timelineEventCreate },
    activity: { findMany: activityFindMany },
  } as unknown as PrismaService);

  leadFindFirst.mockResolvedValue({ id: 'lead-1', leadNumber: 'LD-2026-000001', organizationId: ORG_ID });
  leadUpdate.mockResolvedValue({ id: 'lead-1', leadNumber: 'LD-2026-000001', assignedToId: 'u-same' });
  leadCreate.mockResolvedValue({ id: 'lead-1', leadNumber: 'LD-2026-000001' });
  leadCount.mockResolvedValue(0);
  leadGroupBy.mockResolvedValue([]);
  leadAggregate.mockResolvedValue({ _sum: { estimatedValue: null } });
  activityFindMany.mockResolvedValue([]);
  leadFindMany.mockResolvedValue([]);

  return {
    service,
    leadFindFirst,
    leadFindMany,
    leadUpdate,
    leadCreate,
    userFindFirst,
    userFindUnique,
    timelineEventCreate,
    leadCount,
    leadGroupBy,
    leadAggregate,
    activityFindMany,
  };
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
      where: { id: 'lead-1', organizationId: ORG_ID, deletedAt: null },
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

describe('LeadService.generateLeadNumber (org-scoped sequencing / FS4)', () => {
  const year = new Date().getFullYear();

  it('generates the next number after an existing lead in the same organization', async () => {
    const { service, leadFindFirst, leadCreate } = mockService();
    // generateLeadNumber lookup (first findFirst call) sees org-1's highest lead.
    leadFindFirst.mockResolvedValueOnce({
      id: 'lead-1',
      organizationId: ORG_ID,
      leadNumber: `LD-${year}-000007`,
    });

    await service.create(ORG_ID, 'actor', { name: 'X' } as never);

    expect(leadCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ leadNumber: `LD-${year}-000008` }),
      }),
    );
  });

  it('scopes the lead-number lookup to the organization', async () => {
    const { service, leadFindFirst } = mockService();
    // Simulate a high-numbered cross-org lead that must be filtered out by the scoped where.
    leadFindFirst.mockResolvedValueOnce({
      id: 'lead-other',
      organizationId: 'org-2',
      leadNumber: `LD-${year}-000099`,
    });

    await service.create(ORG_ID, 'actor', { name: 'X' } as never);

    expect(leadFindFirst).toHaveBeenCalledWith({
      where: {
        organizationId: ORG_ID,
        leadNumber: { startsWith: expect.any(String) },
      },
      orderBy: { leadNumber: 'desc' },
      select: { leadNumber: true },
    });
  });

  it('does not let another organization lead affect the sequence', async () => {
    const { service, leadFindFirst, leadCreate } = mockService();
    // org-1 has no scoped lead (cross-org rows are filtered out) -> next is the first number.
    leadFindFirst.mockResolvedValueOnce(null);

    await service.create(ORG_ID, 'actor', { name: 'X' } as never);

    expect(leadFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: ORG_ID }),
      }),
    );
    expect(leadCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ leadNumber: `LD-${year}-000001` }),
      }),
    );
  });

  });

function prismaError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(`Unique constraint failed (${code})`, {
    code,
    clientVersion: '5.0.0',
    meta: { target: ['organizationId', 'leadNumber'] },
  });
}

describe('LeadService.create (number sequence + P2002 retry / FS5)', () => {
  const year = new Date().getFullYear();

  it('A. creates a lead normally, starting at the first sequence number', async () => {
    const { service, leadFindFirst, leadCreate } = mockService();
    leadFindFirst.mockResolvedValueOnce(null);
    leadCreate.mockResolvedValue({
      id: 'lead-1',
      leadNumber: `LD-${year}-000001`,
      name: 'X',
      status: 'NEW',
      createdAt: new Date(),
    });

    const result = await service.create(ORG_ID, 'actor', { name: 'X' } as never);

    expect(leadCreate).toHaveBeenCalledTimes(1);
    expect(leadCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ leadNumber: `LD-${year}-000001` }) }),
    );
    expect(result.name).toBe('X');
  });

  it('B. gives two empty organizations independent sequences that both start at 000001', async () => {
    const { service, leadFindFirst, leadCreate } = mockService();
    leadFindFirst.mockImplementation((args) =>
      args?.where?.leadNumber
        ? Promise.resolve(null)
        : Promise.resolve({ id: 'lead-1', organizationId: ORG_ID, leadNumber: `LD-${year}-000001` }),
    );
    leadCreate.mockResolvedValue({ id: 'lead-1', leadNumber: `LD-${year}-000001` });

    await service.create(ORG_ID, 'actor', { name: 'Org A' } as never);
    await service.create('org-2', 'actor', { name: 'Org B' } as never);

    expect(leadCreate).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: expect.objectContaining({ organizationId: ORG_ID, leadNumber: `LD-${year}-000001` }),
    }));
    expect(leadCreate).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: expect.objectContaining({ organizationId: 'org-2', leadNumber: `LD-${year}-000001` }),
    }));
  });

  it('C. continues an existing same-org sequence (000007 -> 000008)', async () => {
    const { service, leadFindFirst, leadCreate } = mockService();
    leadFindFirst.mockResolvedValueOnce({
      id: 'lead-1',
      organizationId: ORG_ID,
      leadNumber: `LD-${year}-000007`,
    });

    await service.create(ORG_ID, 'actor', { name: 'X' } as never);

    expect(leadCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ leadNumber: `LD-${year}-000008` }) }),
    );
  });

  it('D. retries on a P2002 collision, regenerates the number, and succeeds', async () => {
    const { service, leadFindFirst, leadCreate } = mockService();
    leadFindFirst.mockResolvedValueOnce(null);
    leadFindFirst.mockResolvedValueOnce({
      id: 'lead-2',
      organizationId: ORG_ID,
      leadNumber: `LD-${year}-000001`,
    });
    leadCreate
      .mockRejectedValueOnce(prismaError('P2002'))
      .mockResolvedValueOnce({
        id: 'lead-2',
        leadNumber: `LD-${year}-000002`,
        name: 'X',
        status: 'NEW',
        createdAt: new Date(),
      });

    const result = await service.create(ORG_ID, 'actor', { name: 'X' } as never);

    expect(leadCreate).toHaveBeenCalledTimes(2);
    expect(leadCreate).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: expect.objectContaining({ leadNumber: `LD-${year}-000001` }),
    }));
    expect(leadCreate).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: expect.objectContaining({ leadNumber: `LD-${year}-000002` }),
    }));
    expect(leadFindFirst).toHaveBeenCalledTimes(3);
    expect(result.leadNumber).toBe(`LD-${year}-000002`);
  });

  it('E. bails out to a clean exception after retries are exhausted', async () => {
    const { service, leadCreate } = mockService();
    leadCreate.mockRejectedValue(prismaError('P2002'));

    await expect(service.create(ORG_ID, 'actor', { name: 'X' } as never)).rejects.toThrow(
      InternalServerErrorException,
    );
    expect(leadCreate).toHaveBeenCalledTimes(5);
  });

  it('F. does not retry non-P2002 Prisma errors and propagates them', async () => {
    const { service, leadCreate } = mockService();
    const otherErr = new Prisma.PrismaClientKnownRequestError('Connection interrupted', {
      code: 'P2024',
      clientVersion: '5.0.0',
      meta: {},
    });
    leadCreate.mockRejectedValue(otherErr);

    await expect(service.create(ORG_ID, 'actor', { name: 'X' } as never)).rejects.toThrow(
      'Connection interrupted',
    );
    expect(leadCreate).toHaveBeenCalledTimes(1);
  });
});

describe('LeadService mutation tenant scoping (FS6-2)', () => {
  const baseLead = { id: 'lead-1', organizationId: ORG_ID, status: 'NEW', leadNumber: 'LD-2026-000007' };

  it('update succeeds for a lead in the same organization', async () => {
    const { service, leadFindFirst, leadUpdate } = mockService();
    leadFindFirst.mockResolvedValue({ ...baseLead });
    leadUpdate.mockResolvedValue({ id: 'lead-1', leadNumber: 'LD-2026-000007', name: 'New', status: 'NEW', updatedAt: new Date() });

    const result = await service.update(ORG_ID, 'actor', 'lead-1', { name: 'New' } as never);

    expect(leadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'lead-1', organizationId: ORG_ID, deletedAt: null },
        data: expect.objectContaining({ name: 'New' }),
      }),
    );
    expect(result.name).toBe('New');
  });

  it('update rejects a lead from another organization', async () => {
    const { service, leadFindFirst, leadUpdate } = mockService();
    leadFindFirst.mockResolvedValue(null);

    await expect(service.update(ORG_ID, 'actor', 'lead-other', { name: 'X' } as never)).rejects.toThrow(
      NotFoundException,
    );
    expect(leadUpdate).not.toHaveBeenCalled();
  });

  it('updateStatus succeeds for a lead in the same organization', async () => {
    const { service, leadFindFirst, leadUpdate } = mockService();
    leadFindFirst.mockResolvedValue({ ...baseLead });
    leadUpdate.mockResolvedValue({ id: 'lead-1', leadNumber: 'LD-2026-000007', status: 'QUALIFIED' });

    const result = await service.updateStatus(ORG_ID, 'actor', 'lead-1', 'QUALIFIED');

    expect(leadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'lead-1', organizationId: ORG_ID, deletedAt: null },
        data: { status: 'QUALIFIED' },
      }),
    );
    expect(result.status).toBe('QUALIFIED');
  });

  it('updateStatus rejects a lead from another organization', async () => {
    const { service, leadFindFirst, leadUpdate } = mockService();
    leadFindFirst.mockResolvedValue(null);

    await expect(service.updateStatus(ORG_ID, 'actor', 'lead-other', 'NEW')).rejects.toThrow(NotFoundException);
    expect(leadUpdate).not.toHaveBeenCalled();
  });

  it('assignUser succeeds for a lead in the same organization', async () => {
    const { service, leadFindFirst, leadUpdate, userFindFirst } = mockService();
    leadFindFirst.mockResolvedValue({ ...baseLead });
    userFindFirst.mockResolvedValue({ id: 'u-same' });
    leadUpdate.mockResolvedValue({ id: 'lead-1', leadNumber: 'LD-2026-000007', assignedToId: 'u-same' });

    const result = await service.assignUser(ORG_ID, 'actor', 'lead-1', 'u-same');

    expect(leadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'lead-1', organizationId: ORG_ID, deletedAt: null },
        data: { assignedToId: 'u-same' },
      }),
    );
    expect(result.assignedToId).toBe('u-same');
  });

  it('assignUser rejects a lead from another organization', async () => {
    const { service, leadFindFirst, leadUpdate } = mockService();
    leadFindFirst.mockResolvedValue(null);

    await expect(service.assignUser(ORG_ID, 'actor', 'lead-other', 'u-same')).rejects.toThrow(NotFoundException);
    expect(leadUpdate).not.toHaveBeenCalled();
  });

  it('softDelete succeeds for a lead in the same organization', async () => {
    const { service, leadFindFirst, leadUpdate } = mockService();
    leadFindFirst.mockResolvedValue({ ...baseLead });
    leadUpdate.mockResolvedValue({ id: 'lead-1' });

    const result = await service.softDelete(ORG_ID, 'actor', 'lead-1');

    expect(leadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'lead-1', organizationId: ORG_ID, deletedAt: null },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    );
    expect(result.message).toContain('deleted');
  });

  it('softDelete rejects a lead from another organization', async () => {
    const { service, leadFindFirst, leadUpdate } = mockService();
    leadFindFirst.mockResolvedValue(null);

    await expect(service.softDelete(ORG_ID, 'actor', 'lead-other')).rejects.toThrow(NotFoundException);
    expect(leadUpdate).not.toHaveBeenCalled();
  });
});

describe('LeadService.getSummary (Activity soft-delete isolation)', () => {
  it('excludes soft-deleted activities and activities of soft-deleted leads', async () => {
    const { service, activityFindMany, leadCount, leadGroupBy, leadAggregate } = mockService();
    leadCount.mockResolvedValue(2);
    leadGroupBy.mockResolvedValue([
      { status: 'WON', _count: { id: 1 } },
      { status: 'LOST', _count: { id: 1 } },
    ]);
    leadAggregate.mockResolvedValue({ _sum: { estimatedValue: 1000 } });
    activityFindMany.mockResolvedValue([{ id: 'a1', title: 'Follow up' }]);

    const result = await service.getSummary(ORG_ID);

    expect(activityFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          lead: { organizationId: ORG_ID, deletedAt: null },
          completed: false,
          dueDate: { not: null },
        },
        take: 10,
      }),
    );
    expect(result.upcomingActivities).toEqual([{ id: 'a1', title: 'Follow up' }]);
    expect(result.totalLeads).toBe(2);
  });

  it('returns an empty upcoming activities list when none match', async () => {
    const { service, activityFindMany } = mockService();
    activityFindMany.mockResolvedValue([]);

    const result = await service.getSummary(ORG_ID);

    expect(activityFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    );
    expect(result.upcomingActivities).toEqual([]);
  });

  it('scopes all lead aggregations to the org and excludes soft-deleted leads', async () => {
    const { service, leadCount, leadGroupBy, leadAggregate } = mockService();
    leadCount.mockResolvedValue(5);
    leadGroupBy.mockResolvedValue([{ status: 'NEW', _count: { id: 5 } }]);
    leadAggregate.mockResolvedValue({ _sum: { estimatedValue: 5000 } });

    const result = await service.getSummary(ORG_ID);

    expect(leadCount).toHaveBeenCalledWith({
      where: { organizationId: ORG_ID, deletedAt: null },
    });
    expect(leadGroupBy).toHaveBeenCalledWith({
      by: ['status'],
      where: { organizationId: ORG_ID, deletedAt: null },
      _count: { id: true },
    });
    expect(leadAggregate).toHaveBeenCalledWith({
      where: { organizationId: ORG_ID, deletedAt: null },
      _sum: { estimatedValue: true },
    });
    expect(result.totalLeads).toBe(5);
  });
});

describe('LeadService.findById (tenant isolation + soft-delete exclusion / FS7)', () => {
  it('scopes the read to the organization and excludes soft-deleted leads', async () => {
    const { service, leadFindFirst } = mockService();
    leadFindFirst.mockResolvedValue({
      id: 'lead-1',
      leadNumber: 'LD-2026-000001',
      name: 'Acme',
      organizationId: ORG_ID,
    });

    const result = await service.findById(ORG_ID, 'lead-1');

    expect(leadFindFirst).toHaveBeenCalledWith({
      where: { id: 'lead-1', organizationId: ORG_ID, deletedAt: null },
      select: expect.any(Object),
    });
    expect(result.id).toBe('lead-1');
  });

  it('rejects a lead from another organization with NotFound', async () => {
    const { service, leadFindFirst } = mockService();
    leadFindFirst.mockResolvedValue(null);

    await expect(service.findById(ORG_ID, 'lead-other')).rejects.toThrow(NotFoundException);
  });

  it('rejects a soft-deleted lead with NotFound', async () => {
    const { service, leadFindFirst } = mockService();
    leadFindFirst.mockResolvedValue(null);

    await expect(service.findById(ORG_ID, 'lead-deleted')).rejects.toThrow(NotFoundException);
  });
});

describe('LeadService.findAll (tenant isolation + soft-delete exclusion / FS7)', () => {
  it('scopes both count and findMany to the organization and excludes soft-deleted leads', async () => {
    const { service, leadCount, leadFindMany } = mockService();
    leadCount.mockResolvedValue(1);
    leadFindMany.mockResolvedValue([
      { id: 'lead-1', leadNumber: 'LD-2026-000001', name: 'Acme', activities: [] },
    ]);

    const result = await service.findAll(ORG_ID, {});

    expect(leadCount).toHaveBeenCalledWith({
      where: { organizationId: ORG_ID, deletedAt: null },
    });
    expect(leadFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG_ID, deletedAt: null },
      }),
    );
    expect(result.data).toHaveLength(1);
  });

  it('never returns leads from another organization even if they exist', async () => {
    const { service, leadFindMany } = mockService();
    leadFindMany.mockResolvedValue([
      { id: 'lead-other', leadNumber: 'LD-2026-000001', name: 'Other Org', activities: [] },
    ]);

    const result = await service.findAll(ORG_ID, {});

    expect(leadFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: ORG_ID }),
      }),
    );
    expect(leadFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    );
    expect(result.data[0].id).toBe('lead-other');
  });
});