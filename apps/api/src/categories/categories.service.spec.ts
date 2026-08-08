import { ForbiddenException } from '@nestjs/common';

import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { PrismaService } from '../prisma/prisma.service';

const SAME_ORG_ID = 'org-1';
const OTHER_ORG_ID = 'org-2';

describe('CategoriesService (tenant isolation)', () => {
  let service: CategoriesService;
  let categoryFindMany: jest.Mock;

  beforeEach(() => {
    categoryFindMany = jest.fn();
    service = new CategoriesService({ category: { findMany: categoryFindMany } } as unknown as PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns same-organization categories', async () => {
    categoryFindMany.mockResolvedValue([
      { id: 'c1', name: 'Widgets' },
      { id: 'c2', name: 'Gadgets' },
    ]);

    const result = await service.findAll(SAME_ORG_ID);

    expect(categoryFindMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        OR: [{ organizationId: SAME_ORG_ID }, { organizationId: null }],
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    expect(result).toHaveLength(2);
  });

  it('returns globally shared categories (organizationId null)', async () => {
    categoryFindMany.mockResolvedValue([
      { id: 'shared-1', name: 'Shared' },
      { id: 'org-cat', name: 'Org Only' },
    ]);

    const result = await service.findAll(SAME_ORG_ID);

    expect(categoryFindMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        OR: [{ organizationId: SAME_ORG_ID }, { organizationId: null }],
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    expect(result).toHaveLength(2);
  });

  it('excludes categories belonging to other organizations', async () => {
    categoryFindMany.mockResolvedValue([
      { id: 'mine', name: 'Mine' },
      { id: 'theirs', name: 'Theirs' },
    ]);

    const result = await service.findAll(SAME_ORG_ID);

    expect(categoryFindMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        OR: [{ organizationId: SAME_ORG_ID }, { organizationId: null }],
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    expect(categoryFindMany.mock.calls[0][0].where).toEqual({
      isActive: true,
      OR: [{ organizationId: SAME_ORG_ID }, { organizationId: null }],
    });
    expect(categoryFindMany.mock.calls[0][0].where).not.toEqual(
      expect.objectContaining({ organizationId: OTHER_ORG_ID }),
    );
    expect(result).toHaveLength(2);
  });
});

describe('CategoriesController (org boundary)', () => {
  let controller: CategoriesController;
  let categoriesService: { findAll: jest.Mock };

  beforeEach(() => {
    categoriesService = { findAll: jest.fn().mockResolvedValue([]) };
    controller = new CategoriesController(categoriesService as unknown as CategoriesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a user without an organizationId', async () => {
    const user = { id: 'u1', email: 'a@a.com', role: 'USER' };

    await expect(controller.findAll(user as never)).rejects.toThrow(ForbiddenException);
    expect(categoriesService.findAll).not.toHaveBeenCalled();
  });

  it('passes the authenticated user organizationId to the service', async () => {
    const user = { id: 'u1', email: 'a@a.com', role: 'USER', organizationId: SAME_ORG_ID };

    await controller.findAll(user as never);

    expect(categoriesService.findAll).toHaveBeenCalledWith(SAME_ORG_ID);
  });
});