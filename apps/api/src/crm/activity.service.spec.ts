import { NotFoundException } from '@nestjs/common';

import { ActivityService } from './activity.service';
import { PrismaService } from '../prisma/prisma.service';

const ORG_ID = 'org-1';

const mockService = () => {
  const activityFindFirst = jest.fn();
  const activityFindMany = jest.fn();
  const activityCount = jest.fn();
  const activityCreate = jest.fn();
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
    activityUpdateMany,
    leadFindFirst,
    createTimelineEvent,
  };
};

const scopedWhere = (id: string) => ({
  id,
  deletedAt: null,
  lead: { organizationId: ORG_ID, deletedAt: null },
});

describe('ActivityService query tenant scoping', () => {
  const baseActivity = { id: 'a1', completed: false, leadId: 'lead-1', title: 'Follow up' };

  it('findAll scopes by organization through the live lead relation and excludes soft-deleted rows', async () => {
    const { service, activityFindMany, activityCount } = mockService();
    activityCount.mockResolvedValue(1);
    activityFindMany.mockResolvedValue([{ ...baseActivity }]);

    await service.findAll(ORG_ID, { page: 1, limit: 20 });

    expect(activityFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null, lead: { organizationId: ORG_ID, deletedAt: null } },
      }),
    );
    expect(activityCount).toHaveBeenCalledWith({
      where: { deletedAt: null, lead: { organizationId: ORG_ID, deletedAt: null } },
    });
  });

  it('findAll filters by completed when provided', async () => {
    const { service, activityFindMany } = mockService();
    activityFindMany.mockResolvedValue([]);

    await service.findAll(ORG_ID, { page: 1, limit: 20, completed: true });

    const call = activityFindMany.mock.calls[0][0];
    expect(call.where.completed).toBe(true);
    expect(call.where.deletedAt).toBeNull();
    expect(call.where.lead.deletedAt).toBeNull();
  });

  it('findById returns an activity from the same organization', async () => {
    const { service, activityFindFirst } = mockService();
    activityFindFirst.mockResolvedValue({ ...baseActivity });

    const result = await service.findById(ORG_ID, 'a1');

    expect(activityFindFirst).toHaveBeenCalledWith({
      where: scopedWhere('a1'),
      select: expect.any(Object),
    });
    expect(result.id).toBe('a1');
  });

  it('findById rejects an activity from another organization', async () => {
    const { service, activityFindFirst } = mockService();
    activityFindFirst.mockResolvedValue(null);

    await expect(service.findById(ORG_ID, 'a-other')).rejects.toThrow(NotFoundException);
  });

  it('findById rejects a soft-deleted activity', async () => {
    const { service, activityFindFirst } = mockService();
    activityFindFirst.mockResolvedValue(null);

    await expect(service.findById(ORG_ID, 'a1')).rejects.toThrow(NotFoundException);
  });

  it('findByLead requires the lead to belong to the organization and be live', async () => {
    const { service, leadFindFirst, activityFindMany } = mockService();
    leadFindFirst.mockResolvedValue(null);

    await expect(service.findByLead(ORG_ID, 'lead-other', {})).rejects.toThrow(NotFoundException);
    expect(activityFindMany).not.toHaveBeenCalled();
  });

  it('findByLead returns activities for a live lead in the organization', async () => {
    const { service, leadFindFirst, activityFindMany, activityCount } = mockService();
    leadFindFirst.mockResolvedValue({ id: 'lead-1' });
    activityCount.mockResolvedValue(0);
    activityFindMany.mockResolvedValue([]);

    const result = await service.findByLead(ORG_ID, 'lead-1', { page: 1, limit: 20 });

    expect(activityFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { leadId: 'lead-1', deletedAt: null },
      }),
    );
    expect(result.data).toEqual([]);
  });
});

describe('ActivityService create tenant scoping', () => {
  const dto = { type: 'CALL', title: 'Call back' } as never;

  it('creates an activity for a live lead in the organization', async () => {
    const { service, leadFindFirst, activityCreate, createTimelineEvent } = mockService();
    leadFindFirst.mockResolvedValue({ id: 'lead-1' });
    activityCreate.mockResolvedValue({ id: 'a1', title: 'Call back' });

    await service.create(ORG_ID, 'u1', 'lead-1', dto);

    expect(leadFindFirst).toHaveBeenCalledWith({
      where: { id: 'lead-1', organizationId: ORG_ID, deletedAt: null },
    });
    expect(activityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ leadId: 'lead-1', createdById: 'u1' }),
      }),
    );
    expect(createTimelineEvent).toHaveBeenCalled();
  });

  it('rejects creating an activity for a lead from another organization', async () => {
    const { service, leadFindFirst, activityCreate } = mockService();
    leadFindFirst.mockResolvedValue(null);

    await expect(service.create(ORG_ID, 'u1', 'lead-other', dto)).rejects.toThrow(
      NotFoundException,
    );
    expect(activityCreate).not.toHaveBeenCalled();
  });

  it('rejects creating an activity for a soft-deleted lead', async () => {
    const { service, leadFindFirst, activityCreate } = mockService();
    leadFindFirst.mockResolvedValue(null);

    await expect(service.create(ORG_ID, 'u1', 'lead-deleted', dto)).rejects.toThrow(
      NotFoundException,
    );
    expect(activityCreate).not.toHaveBeenCalled();
  });
});

describe('ActivityService update tenant scoping', () => {
  const baseActivity = { id: 'a1', leadId: 'lead-1', title: 'Follow up' };

  it('update applies the scoped mutation and returns the refreshed record', async () => {
    const { service, activityFindFirst, activityUpdateMany, createTimelineEvent } = mockService();
    activityFindFirst.mockResolvedValue({ ...baseActivity, title: 'Call back' });
    activityUpdateMany.mockResolvedValue({ count: 1 });

    const result = await service.update(ORG_ID, 'u1', 'a1', { title: 'Call back' });

    expect(activityUpdateMany).toHaveBeenCalledWith({
      where: scopedWhere('a1'),
      data: { title: 'Call back' },
    });
    expect(activityFindFirst).toHaveBeenCalledWith({
      where: scopedWhere('a1'),
      select: expect.objectContaining({ leadId: true }),
    });
    expect(createTimelineEvent).toHaveBeenCalled();
    expect(result.title).toBe('Call back');
  });

  it('update trims string fields', async () => {
    const { service, activityFindFirst, activityUpdateMany } = mockService();
    activityFindFirst.mockResolvedValue({ ...baseActivity });
    activityUpdateMany.mockResolvedValue({ count: 1 });

    await service.update(ORG_ID, 'u1', 'a1', { title: '  Call back  ' });

    expect(activityUpdateMany).toHaveBeenCalledWith({
      where: scopedWhere('a1'),
      data: { title: 'Call back' },
    });
  });

  it('update is a no-op read for an empty DTO', async () => {
    const { service, activityFindFirst, activityUpdateMany } = mockService();
    activityFindFirst.mockResolvedValue({ ...baseActivity });
    activityUpdateMany.mockResolvedValue({ count: 0 });

    const result = await service.update(ORG_ID, 'u1', 'a1', {});

    expect(activityUpdateMany).not.toHaveBeenCalled();
    expect(result.id).toBe('a1');
  });

  it('update rejects an activity from another organization', async () => {
    const { service, activityFindFirst, activityUpdateMany } = mockService();
    activityUpdateMany.mockResolvedValue({ count: 0 });

    await expect(service.update(ORG_ID, 'u1', 'a-other', { title: 'x' })).rejects.toThrow(
      NotFoundException,
    );
    expect(activityFindFirst).not.toHaveBeenCalled();
  });

  it('update rejects a soft-deleted activity', async () => {
    const { service, activityFindFirst, activityUpdateMany } = mockService();
    activityUpdateMany.mockResolvedValue({ count: 0 });

    await expect(service.update(ORG_ID, 'u1', 'a1', { title: 'x' })).rejects.toThrow(
      NotFoundException,
    );
    expect(activityFindFirst).not.toHaveBeenCalled();
  });

  it('update rejects when the scoped write matches nothing (concurrent delete)', async () => {
    const { service, activityFindFirst, activityUpdateMany } = mockService();
    activityUpdateMany.mockResolvedValue({ count: 0 });

    await expect(service.update(ORG_ID, 'u1', 'a1', { title: 'x' })).rejects.toThrow(
      NotFoundException,
    );
    expect(activityFindFirst).not.toHaveBeenCalled();
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
      where: scopedWhere('a1'),
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

  it('toggleComplete rejects a soft-deleted activity', async () => {
    const { service, activityFindFirst, activityUpdateMany } = mockService();
    activityFindFirst.mockResolvedValue(null);

    await expect(service.toggleComplete(ORG_ID, 'u1', 'a1')).rejects.toThrow(NotFoundException);
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
      where: scopedWhere('a1'),
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

  it('delete rejects an already-soft-deleted activity', async () => {
    const { service, activityFindFirst, activityUpdateMany } = mockService();
    activityFindFirst.mockResolvedValue(null);

    await expect(service.delete(ORG_ID, 'u1', 'a1')).rejects.toThrow(NotFoundException);
    expect(activityUpdateMany).not.toHaveBeenCalled();
  });

  it('delete is a soft delete and never calls a hard-delete method', async () => {
    const { service, activityFindFirst, activityUpdateMany } = mockService();
    activityFindFirst.mockResolvedValue({ ...baseActivity });
    activityUpdateMany.mockResolvedValue({ count: 1 });

    await service.delete(ORG_ID, 'u1', 'a1');

    expect(activityUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { deletedAt: expect.any(Date) } }),
    );
  });
});