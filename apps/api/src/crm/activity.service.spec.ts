import { BadRequestException, NotFoundException } from '@nestjs/common';

import { ActivityService } from './activity.service';
import { PrismaService } from '../prisma/prisma.service';

const ORG_ID = 'org-1';

const mockService = () => {
  const activityFindFirst = jest.fn();
  const activityFindMany = jest.fn();
  const activityCount = jest.fn();
  const activityCreate = jest.fn();
  const activityUpdate = jest.fn();
  const leadFindFirst = jest.fn();
  const contactFindFirst = jest.fn();
  const dealFindFirst = jest.fn();
  const companyFindFirst = jest.fn();
  const userFindFirst = jest.fn();

  const service = new ActivityService({
    lead: { findFirst: leadFindFirst },
    contact: { findFirst: contactFindFirst },
    deal: { findFirst: dealFindFirst },
    company: { findFirst: companyFindFirst },
    user: { findFirst: userFindFirst },
    activity: {
      findFirst: activityFindFirst,
      findMany: activityFindMany,
      count: activityCount,
      create: activityCreate,
      update: activityUpdate,
    },
  } as unknown as PrismaService);

  return {
    service,
    activityFindFirst,
    activityFindMany,
    activityCount,
    activityCreate,
    activityUpdate,
    leadFindFirst,
    contactFindFirst,
    dealFindFirst,
    companyFindFirst,
    userFindFirst,
  };
};

/** Activities carry organizationId directly; every scoped lookup/write must include it. */
const scopedWhere = (id: string) => ({
  id,
  deletedAt: null,
  organizationId: ORG_ID,
});

/** Prisma P2025 ("record not found") thrown by update when the scoped row vanished concurrently. */
const prismaP2025 = () =>
  Object.assign(new Error('Record to update not found.'), { code: 'P2025' });

describe('ActivityService query tenant scoping', () => {
  const baseActivity = { id: 'a1', completed: false, leadId: 'lead-1', title: 'Follow up' };

  it('findAll scopes by the activity organizationId and excludes soft-deleted rows', async () => {
    const { service, activityFindMany, activityCount } = mockService();
    activityCount.mockResolvedValue(1);
    activityFindMany.mockResolvedValue([{ ...baseActivity }]);

    await service.findAll(ORG_ID, { page: 1, limit: 20 });

    expect(activityFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null, organizationId: ORG_ID },
      }),
    );
    expect(activityCount).toHaveBeenCalledWith({
      where: { deletedAt: null, organizationId: ORG_ID },
    });
  });

  it('findAll filters by completed when provided', async () => {
    const { service, activityFindMany } = mockService();
    activityFindMany.mockResolvedValue([]);

    await service.findAll(ORG_ID, { page: 1, limit: 20, completed: true });

    const call = activityFindMany.mock.calls[0][0];
    expect(call.where.completed).toBe(true);
    expect(call.where.deletedAt).toBeNull();
    expect(call.where.organizationId).toBe(ORG_ID);
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

  it('findByLead authorizes the lead with id, organizationId and deletedAt', async () => {
    const { service, leadFindFirst, activityFindMany, activityCount } = mockService();
    leadFindFirst.mockResolvedValue({ id: 'lead-1' });
    activityCount.mockResolvedValue(0);
    activityFindMany.mockResolvedValue([]);

    await service.findByLead(ORG_ID, 'lead-1', { page: 1, limit: 20 });

    expect(leadFindFirst).toHaveBeenCalledWith({
      where: { id: 'lead-1', organizationId: ORG_ID, deletedAt: null },
    });
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
        where: { leadId: 'lead-1', deletedAt: null, organizationId: ORG_ID },
      }),
    );
    expect(result.data).toEqual([]);
  });

  it('findByLead scopes both the count and the list query to live activities', async () => {
    const { service, leadFindFirst, activityFindMany, activityCount } = mockService();
    leadFindFirst.mockResolvedValue({ id: 'lead-1' });
    activityCount.mockResolvedValue(3);
    activityFindMany.mockResolvedValue([{ id: 'a1' }, { id: 'a2' }]);

    const result = await service.findByLead(ORG_ID, 'lead-1', { page: 1, limit: 20 });

    expect(activityCount).toHaveBeenCalledWith({
      where: { leadId: 'lead-1', deletedAt: null, organizationId: ORG_ID },
    });
    expect(activityFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { leadId: 'lead-1', deletedAt: null, organizationId: ORG_ID },
      }),
    );
    expect(result.meta.total).toBe(3);
  });
});

describe('ActivityService create tenant scoping', () => {
  const baseDto = { type: 'CALL', title: 'Call back' };

  it('creates an activity for a live lead in the organization', async () => {
    const { service, leadFindFirst, activityCreate } = mockService();
    leadFindFirst.mockResolvedValue({ id: 'lead-1' });
    activityCreate.mockResolvedValue({ id: 'a1', title: 'Call back' });

    await service.create(ORG_ID, 'u1', { ...baseDto, leadId: 'lead-1' } as never);

    expect(leadFindFirst).toHaveBeenCalledWith({
      where: { id: 'lead-1', organizationId: ORG_ID, deletedAt: null },
      select: { id: true },
    });
    expect(activityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: ORG_ID,
          leadId: 'lead-1',
          createdById: 'u1',
        }),
      }),
    );
  });

  it('rejects creating an activity for a lead from another organization', async () => {
    const { service, leadFindFirst, activityCreate } = mockService();
    leadFindFirst.mockResolvedValue(null);

    await expect(
      service.create(ORG_ID, 'u1', { ...baseDto, leadId: 'lead-other' } as never),
    ).rejects.toThrow(BadRequestException);
    expect(activityCreate).not.toHaveBeenCalled();
  });

  it('rejects creating an activity for a soft-deleted lead', async () => {
    const { service, leadFindFirst, activityCreate } = mockService();
    leadFindFirst.mockResolvedValue(null);

    await expect(
      service.create(ORG_ID, 'u1', { ...baseDto, leadId: 'lead-deleted' } as never),
    ).rejects.toThrow(BadRequestException);
    expect(activityCreate).not.toHaveBeenCalled();
  });

  it('rejects creating an activity without any entity reference', async () => {
    const { service, leadFindFirst, activityCreate } = mockService();

    const attempt = service.create(ORG_ID, 'u1', { ...baseDto } as never);
    await expect(attempt).rejects.toThrow(BadRequestException);
    await expect(attempt).rejects.toThrow(/at least one entity/);
    expect(leadFindFirst).not.toHaveBeenCalled();
    expect(activityCreate).not.toHaveBeenCalled();
  });

  it('rejects creating an activity that references more than one entity', async () => {
    const { service, leadFindFirst, companyFindFirst, activityCreate } = mockService();

    const attempt = service.create(
      ORG_ID,
      'u1',
      { ...baseDto, leadId: 'lead-1', companyId: 'co-1' } as never,
    );
    await expect(attempt).rejects.toThrow(BadRequestException);
    await expect(attempt).rejects.toThrow(/only one primary entity/);
    expect(leadFindFirst).not.toHaveBeenCalled();
    expect(companyFindFirst).not.toHaveBeenCalled();
    expect(activityCreate).not.toHaveBeenCalled();
  });

  it('creates an activity associated to a contact after org-scoping the contact lookup', async () => {
    const { service, leadFindFirst, contactFindFirst, activityCreate } = mockService();
    contactFindFirst.mockResolvedValue({ id: 'c1' });
    activityCreate.mockResolvedValue({ id: 'a2', title: 'Call back' });

    await service.create(ORG_ID, 'u1', { ...baseDto, contactId: 'c1' } as never);

    expect(contactFindFirst).toHaveBeenCalledWith({
      where: { id: 'c1', organizationId: ORG_ID, deletedAt: null },
      select: { id: true },
    });
    expect(leadFindFirst).not.toHaveBeenCalled();
    expect(activityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ contactId: 'c1', leadId: null, organizationId: ORG_ID }),
      }),
    );
  });
});

describe('ActivityService update tenant scoping', () => {
  const baseActivity = { id: 'a1', leadId: 'lead-1', title: 'Follow up' };

  it('update applies the scoped mutation and returns the refreshed record', async () => {
    const { service, activityFindFirst, activityUpdate } = mockService();
    activityFindFirst.mockResolvedValue({ ...baseActivity });
    activityUpdate.mockResolvedValue({ ...baseActivity, title: 'Call back' });

    const result = await service.update(ORG_ID, 'u1', 'a1', { title: 'Call back' } as never);

    expect(activityFindFirst).toHaveBeenCalledWith({
      where: scopedWhere('a1'),
      select: expect.objectContaining({ leadId: true }),
    });
    expect(activityUpdate).toHaveBeenCalledWith({
      where: scopedWhere('a1'),
      data: { title: 'Call back' },
      select: expect.objectContaining({ leadId: true }),
    });
    expect(result.title).toBe('Call back');
  });

  it('update trims string fields', async () => {
    const { service, activityFindFirst, activityUpdate } = mockService();
    activityFindFirst.mockResolvedValue({ ...baseActivity });
    activityUpdate.mockResolvedValue({ ...baseActivity });

    await service.update(ORG_ID, 'u1', 'a1', { title: '  Call back  ' } as never);

    expect(activityUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: scopedWhere('a1'),
        data: { title: 'Call back' },
      }),
    );
  });

  it('update with an empty DTO applies no field changes and returns the record', async () => {
    const { service, activityFindFirst, activityUpdate } = mockService();
    activityFindFirst.mockResolvedValue({ ...baseActivity });
    activityUpdate.mockResolvedValue({ ...baseActivity });

    const result = await service.update(ORG_ID, 'u1', 'a1', {} as never);

    expect(activityUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: scopedWhere('a1'), data: {} }),
    );
    expect(result.id).toBe('a1');
  });

  it('update rejects an activity from another organization', async () => {
    const { service, activityFindFirst, activityUpdate } = mockService();
    activityFindFirst.mockResolvedValue(null);

    await expect(service.update(ORG_ID, 'u1', 'a-other', { title: 'x' } as never)).rejects.toThrow(
      NotFoundException,
    );
    expect(activityFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: scopedWhere('a-other') }),
    );
    expect(activityUpdate).not.toHaveBeenCalled();
  });

  it('update rejects a soft-deleted activity', async () => {
    const { service, activityFindFirst, activityUpdate } = mockService();
    activityFindFirst.mockResolvedValue(null);

    await expect(service.update(ORG_ID, 'u1', 'a1', { title: 'x' } as never)).rejects.toThrow(
      NotFoundException,
    );
    expect(activityUpdate).not.toHaveBeenCalled();
  });

  it('update rejects when the scoped write matches nothing (concurrent delete)', async () => {
    const { service, activityFindFirst, activityUpdate } = mockService();
    activityFindFirst.mockResolvedValue({ ...baseActivity });
    activityUpdate.mockRejectedValue(prismaP2025());

    await expect(service.update(ORG_ID, 'u1', 'a1', { title: 'x' } as never)).rejects.toThrow(
      NotFoundException,
    );
    expect(activityUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: scopedWhere('a1') }),
    );
  });
});

describe('ActivityService mutation tenant scoping (FS6-2)', () => {
  const baseActivity = { id: 'a1', completed: false, leadId: 'lead-1', title: 'Follow up' };

  it('toggleComplete succeeds for an activity under the same organization', async () => {
    const { service, activityFindFirst, activityUpdate } = mockService();
    activityFindFirst.mockResolvedValue({ ...baseActivity });
    activityUpdate.mockResolvedValue({ ...baseActivity, completed: true });

    const result = await service.toggleComplete(ORG_ID, 'u1', 'a1');

    expect(activityFindFirst).toHaveBeenCalledWith({
      where: scopedWhere('a1'),
      select: expect.any(Object),
    });
    expect(activityUpdate).toHaveBeenCalledWith({
      where: scopedWhere('a1'),
      data: { completed: true, completedAt: expect.any(Date) },
    });
    expect(result.completed).toBe(true);
  });

  it('toggleComplete rejects an activity from another organization', async () => {
    const { service, activityFindFirst, activityUpdate } = mockService();
    activityFindFirst.mockResolvedValue(null);

    await expect(service.toggleComplete(ORG_ID, 'u1', 'a-other')).rejects.toThrow(NotFoundException);
    expect(activityFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: scopedWhere('a-other') }),
    );
    expect(activityUpdate).not.toHaveBeenCalled();
  });

  it('toggleComplete rejects a soft-deleted activity', async () => {
    const { service, activityFindFirst, activityUpdate } = mockService();
    activityFindFirst.mockResolvedValue(null);

    await expect(service.toggleComplete(ORG_ID, 'u1', 'a1')).rejects.toThrow(NotFoundException);
    expect(activityUpdate).not.toHaveBeenCalled();
  });

  it('toggleComplete rejects when the scoped write matches nothing', async () => {
    const { service, activityFindFirst, activityUpdate } = mockService();
    activityFindFirst.mockResolvedValue({ ...baseActivity });
    activityUpdate.mockRejectedValue(prismaP2025());

    await expect(service.toggleComplete(ORG_ID, 'u1', 'a1')).rejects.toThrow(NotFoundException);
    expect(activityUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: scopedWhere('a1') }),
    );
  });

  it('delete soft-deletes an activity under the same organization', async () => {
    const { service, activityFindFirst, activityUpdate } = mockService();
    activityFindFirst.mockResolvedValue({ ...baseActivity });
    activityUpdate.mockResolvedValue({ ...baseActivity, deletedAt: new Date() });

    const result = await service.delete(ORG_ID, 'u1', 'a1');

    expect(activityFindFirst).toHaveBeenCalledWith({
      where: scopedWhere('a1'),
      select: expect.any(Object),
    });
    expect(activityUpdate).toHaveBeenCalledWith({
      where: scopedWhere('a1'),
      data: { deletedAt: expect.any(Date) },
    });
    expect(result.message).toContain('deleted');
  });

  it('delete rejects an activity from another organization', async () => {
    const { service, activityFindFirst, activityUpdate } = mockService();
    activityFindFirst.mockResolvedValue(null);

    await expect(service.delete(ORG_ID, 'u1', 'a-other')).rejects.toThrow(NotFoundException);
    expect(activityFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: scopedWhere('a-other') }),
    );
    expect(activityUpdate).not.toHaveBeenCalled();
  });

  it('delete rejects an already-soft-deleted activity', async () => {
    const { service, activityFindFirst, activityUpdate } = mockService();
    activityFindFirst.mockResolvedValue(null);

    await expect(service.delete(ORG_ID, 'u1', 'a1')).rejects.toThrow(NotFoundException);
    expect(activityUpdate).not.toHaveBeenCalled();
  });

  it('delete is a soft delete and never calls a hard-delete method', async () => {
    const { service, activityFindFirst, activityUpdate } = mockService();
    activityFindFirst.mockResolvedValue({ ...baseActivity });
    activityUpdate.mockResolvedValue({ ...baseActivity, deletedAt: new Date() });

    await service.delete(ORG_ID, 'u1', 'a1');

    expect(activityUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { deletedAt: expect.any(Date) } }),
    );
  });
});
