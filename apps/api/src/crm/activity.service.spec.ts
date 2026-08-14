import { NotFoundException } from '@nestjs/common';

import { ActivityService } from './activity.service';
import { PrismaService } from '../prisma/prisma.service';

const ORG_ID = 'org-1';

const mockService = () => {
  const activityFindFirst = jest.fn();
  const activityFindMany = jest.fn();
  const activityCount = jest.fn();
  const activityCreate = jest.fn();
  const activityUpdate = jest.fn();
  const activityUpdateMany = jest.fn();
  const leadFindFirst = jest.fn();
  const createTimelineEvent = jest.fn();

  const service = new ActivityService(
    {
      lead: { findFirst: leadFindFirst },
      activity: {
        findFirst: activityFindFirst,
        findMany: activityFindMany,
        count: activityCount,
        create: activityCreate,
        update: activityUpdate,
        updateMany: activityUpdateMany,
      },
    } as unknown as PrismaService,
    { createTimelineEvent } as never,
  );

  return {
    service,
    activityFindFirst,
    activityFindMany,
    activityCount,
    activityCreate,
    activityUpdate,
    activityUpdateMany,
    leadFindFirst,
    createTimelineEvent,
  };
};

describe('ActivityService query tenant scoping', () => {
  const baseActivity = { id: 'a1', completed: false, leadId: 'lead-1', title: 'Follow up' };

  it('findAll scopes by organization through the lead relation and excludes soft-deleted rows', async () => {
    const { service, activityFindMany, activityCount } = mockService();
    activityCount.mockResolvedValue(1);
    activityFindMany.mockResolvedValue([{ ...baseActivity }]);

    await service.findAll(ORG_ID, { page: 1, limit: 20 });

    expect(activityFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null, lead: { organizationId: ORG_ID } },
      }),
    );
    expect(activityCount).toHaveBeenCalledWith({
      where: { deletedAt: null, lead: { organizationId: ORG_ID } },
    });
  });

  it('findAll filters by completed when provided', async () => {
    const { service, activityFindMany } = mockService();
    activityFindMany.mockResolvedValue([]);

    await service.findAll(ORG_ID, { page: 1, limit: 20, completed: true });

    const call = activityFindMany.mock.calls[0][0];
    expect(call.where.completed).toBe(true);
    expect(call.where.deletedAt).toBeNull();
  });

  it('findById returns an activity from the same organization', async () => {
    const { service, activityFindFirst } = mockService();
    activityFindFirst.mockResolvedValue({ ...baseActivity });

    const result = await service.findById(ORG_ID, 'a1');

    expect(activityFindFirst).toHaveBeenCalledWith({
      where: { id: 'a1', deletedAt: null, lead: { organizationId: ORG_ID } },
      select: expect.any(Object),
    });
    expect(result.id).toBe('a1');
  });

  it('findById rejects an activity from another organization', async () => {
    const { service, activityFindFirst } = mockService();
    activityFindFirst.mockResolvedValue(null);

    await expect(service.findById(ORG_ID, 'a-other')).rejects.toThrow(NotFoundException);
  });

  it('findByLead requires the lead to belong to the organization', async () => {
    const { service, leadFindFirst, activityFindMany } = mockService();
    leadFindFirst.mockResolvedValue(null);

    await expect(service.findByLead(ORG_ID, 'lead-other', {})).rejects.toThrow(NotFoundException);
    expect(activityFindMany).not.toHaveBeenCalled();
  });
});

describe('ActivityService update tenant scoping', () => {
  it('update scopes by organization via the lead relation before mutating', async () => {
    const { service, activityFindFirst, activityUpdate, createTimelineEvent } = mockService();
    activityFindFirst.mockResolvedValue({ id: 'a1', leadId: 'lead-1' });
    activityUpdate.mockResolvedValue({ id: 'a1', title: 'Call back' });

    const result = await service.update(ORG_ID, 'u1', 'a1', { title: 'Call back' });

    expect(activityFindFirst).toHaveBeenCalledWith({
      where: { id: 'a1', deletedAt: null, lead: { organizationId: ORG_ID } },
      select: expect.anything(),
    });
    expect(activityUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'a1' } }),
    );
    expect(createTimelineEvent).toHaveBeenCalled();
    expect(result.title).toBe('Call back');
  });

  it('update rejects an activity from another organization', async () => {
    const { service, activityFindFirst, activityUpdate } = mockService();
    activityFindFirst.mockResolvedValue(null);

    await expect(service.update(ORG_ID, 'u1', 'a-other', { title: 'x' })).rejects.toThrow(
      NotFoundException,
    );
    expect(activityUpdate).not.toHaveBeenCalled();
  });

  it('update rejects a soft-deleted activity', async () => {
    const { service, activityFindFirst, activityUpdate } = mockService();
    activityFindFirst.mockResolvedValue(null);

    await expect(service.update(ORG_ID, 'u1', 'a1', { title: 'x' })).rejects.toThrow(
      NotFoundException,
    );
    expect(activityUpdate).not.toHaveBeenCalled();
  });
});

describe('ActivityService mutation tenant scoping (FS6-2)', () => {
  const baseActivity = { id: 'a1', completed: false, leadId: 'lead-1', title: 'Follow up' };

  it('toggleComplete succeeds for an activity under the same organization', async () => {
    const { service, activityFindFirst, activityUpdateMany, createTimelineEvent } = mockService();
    activityFindFirst.mockResolvedValue({ ...baseActivity });
    activityUpdateMany.mockResolvedValue({ count: 1 });

    const result = await service.toggleComplete(ORG_ID, 'u1', 'a1');

    expect(activityUpdateMany).toHaveBeenCalledWith({
      where: { id: 'a1', deletedAt: null, lead: { organizationId: ORG_ID } },
      data: { completed: true },
    });
    expect(result.completed).toBe(true);
    expect(createTimelineEvent).toHaveBeenCalled();
  });

  it('toggleComplete rejects an activity from another organization', async () => {
    const { service, activityFindFirst, activityUpdateMany } = mockService();
    activityFindFirst.mockResolvedValue(null);

    await expect(service.toggleComplete(ORG_ID, 'u1', 'a-other')).rejects.toThrow(NotFoundException);
    expect(activityUpdateMany).not.toHaveBeenCalled();
  });

  it('toggleComplete rejects when the scoped write matches nothing', async () => {
    const { service, activityFindFirst, activityUpdateMany } = mockService();
    activityFindFirst.mockResolvedValue({ ...baseActivity });
    activityUpdateMany.mockResolvedValue({ count: 0 });

    await expect(service.toggleComplete(ORG_ID, 'u1', 'a1')).rejects.toThrow(NotFoundException);
  });

  it('delete soft-deletes an activity under the same organization', async () => {
    const { service, activityFindFirst, activityUpdateMany, createTimelineEvent } = mockService();
    activityFindFirst.mockResolvedValue({ ...baseActivity });
    activityUpdateMany.mockResolvedValue({ count: 1 });

    const result = await service.delete(ORG_ID, 'u1', 'a1');

    expect(activityUpdateMany).toHaveBeenCalledWith({
      where: { id: 'a1', deletedAt: null, lead: { organizationId: ORG_ID } },
      data: { deletedAt: expect.any(Date) },
    });
    expect(result.message).toContain('deleted');
    expect(createTimelineEvent).toHaveBeenCalled();
  });

  it('delete rejects an activity from another organization', async () => {
    const { service, activityFindFirst, activityUpdateMany } = mockService();
    activityFindFirst.mockResolvedValue(null);

    await expect(service.delete(ORG_ID, 'u1', 'a-other')).rejects.toThrow(NotFoundException);
    expect(activityUpdateMany).not.toHaveBeenCalled();
  });
});