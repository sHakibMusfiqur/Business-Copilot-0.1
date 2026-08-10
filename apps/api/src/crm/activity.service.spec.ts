import { NotFoundException } from '@nestjs/common';

import { ActivityService } from './activity.service';
import { PrismaService } from '../prisma/prisma.service';

const ORG_ID = 'org-1';

const mockService = () => {
  const activityFindFirst = jest.fn();
  const activityUpdateMany = jest.fn();
  const activityDeleteMany = jest.fn();
  const createTimelineEvent = jest.fn();

  const service = new ActivityService(
    {
      activity: {
        findFirst: activityFindFirst,
        updateMany: activityUpdateMany,
        deleteMany: activityDeleteMany,
      },
    } as unknown as PrismaService,
    { createTimelineEvent } as never,
  );

  return { service, activityFindFirst, activityUpdateMany, activityDeleteMany, createTimelineEvent };
};

describe('ActivityService mutation tenant scoping (FS6-2)', () => {
  const baseActivity = { id: 'a1', completed: false, leadId: 'lead-1', title: 'Follow up' };

  it('toggleComplete succeeds for an activity under the same organization', async () => {
    const { service, activityFindFirst, activityUpdateMany, createTimelineEvent } = mockService();
    activityFindFirst.mockResolvedValue({ ...baseActivity });
    activityUpdateMany.mockResolvedValue({ count: 1 });

    const result = await service.toggleComplete(ORG_ID, 'u1', 'a1');

    expect(activityUpdateMany).toHaveBeenCalledWith({
      where: { id: 'a1', lead: { organizationId: ORG_ID } },
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

  it('delete succeeds for an activity under the same organization', async () => {
    const { service, activityFindFirst, activityDeleteMany } = mockService();
    activityFindFirst.mockResolvedValue({ ...baseActivity });
    activityDeleteMany.mockResolvedValue({ count: 1 });

    const result = await service.delete(ORG_ID, 'u1', 'a1');

    expect(activityDeleteMany).toHaveBeenCalledWith({
      where: { id: 'a1', lead: { organizationId: ORG_ID } },
    });
    expect(result.message).toContain('deleted');
  });

  it('delete rejects an activity from another organization', async () => {
    const { service, activityFindFirst, activityDeleteMany } = mockService();
    activityFindFirst.mockResolvedValue(null);

    await expect(service.delete(ORG_ID, 'u1', 'a-other')).rejects.toThrow(NotFoundException);
    expect(activityDeleteMany).not.toHaveBeenCalled();
  });
});