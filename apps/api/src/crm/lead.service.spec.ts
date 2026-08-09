import { NotFoundException } from '@nestjs/common';

import { LeadService } from './lead.service';
import { PrismaService } from '../prisma/prisma.service';

const ORG_ID = 'org-1';

describe('LeadService.assignUser (tenant isolation)', () => {
  let service: LeadService;
  let leadFindFirst: jest.Mock;
  let leadUpdate: jest.Mock;
  let userFindUnique: jest.Mock;
  let timelineEventCreate: jest.Mock;

  beforeEach(() => {
    leadFindFirst = jest.fn();
    leadUpdate = jest.fn();
    userFindUnique = jest.fn();
    timelineEventCreate = jest.fn();

    service = new LeadService({
      lead: { findFirst: leadFindFirst, update: leadUpdate },
      user: { findUnique: userFindUnique },
      timelineEvent: { create: timelineEventCreate },
    } as unknown as PrismaService);

    leadFindFirst.mockResolvedValue({ id: 'lead-1', organizationId: ORG_ID });
    leadUpdate.mockResolvedValue({ id: 'lead-1', leadNumber: 'LD-2026-000001', assignedToId: 'u-same' });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('resolves a user from the same organization and scopes the lookup', async () => {
    userFindUnique.mockResolvedValue({ name: 'Same Org User' });

    const result = await service.assignUser(ORG_ID, 'actor', 'lead-1', 'u-same');

    expect(userFindUnique).toHaveBeenCalledWith({
      where: { id: 'u-same', organizationId: ORG_ID },
      select: { name: true },
    });
    expect(timelineEventCreate).toHaveBeenCalled();
    expect(result.assignedToId).toBe('u-same');
  });

  it('does not resolve a user from another organization', async () => {
    userFindUnique.mockResolvedValue(null);

    await service.assignUser(ORG_ID, 'actor', 'lead-1', 'u-other-org');

    expect(userFindUnique).toHaveBeenCalledWith({
      where: { id: 'u-other-org', organizationId: ORG_ID },
      select: { name: true },
    });
    // No name -> 'Lead unassigned' fallback in the timeline, no resolved user.
    expect(timelineEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          description: 'Lead unassigned',
        }),
      }),
    );
  });

  it('throws NotFound when the lead does not belong to the organization', async () => {
    leadFindFirst.mockResolvedValue(null);

    await expect(service.assignUser(ORG_ID, 'actor', 'lead-other', 'u-same')).rejects.toThrow(
      NotFoundException,
    );
    expect(userFindUnique).not.toHaveBeenCalled();
    expect(leadUpdate).not.toHaveBeenCalled();
  });
});