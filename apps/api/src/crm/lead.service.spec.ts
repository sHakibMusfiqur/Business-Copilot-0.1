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
      where: { id: 'u-same', organizationId: ORG_ID },
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
      where: { id: 'u-same', organizationId: ORG_ID },
      select: { id: true },
    });
    expect(leadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ assignedTo: { connect: { id: 'u-same' } } }),
      }),
    );
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
      where: { id: 'u-same', organizationId: ORG_ID },
      select: { id: true },
    });
  });
});