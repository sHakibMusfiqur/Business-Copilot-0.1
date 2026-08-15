import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { ContactService } from './contact.service';

const ORG_ID = 'org-1';
const CONTACT_ID = 'contact-1';

function prismaClientKnownError(
  code: string,
): Prisma.PrismaClientKnownRequestError {
  const err = new Prisma.PrismaClientKnownRequestError('prisma error', {
    code,
    clientVersion: '6.19.3',
  });
  return err;
}

const mockService = () => {
  const contactFindFirst = jest.fn();
  const contactFindMany = jest.fn();
  const contactCount = jest.fn();
  const contactCreate = jest.fn();
  const contactUpdate = jest.fn();
  const leadFindFirst = jest.fn();

  const service = new ContactService({
    contact: {
      findFirst: contactFindFirst,
      findMany: contactFindMany,
      count: contactCount,
      create: contactCreate,
      update: contactUpdate,
    },
    lead: { findFirst: leadFindFirst },
  } as unknown as PrismaService);

  contactFindFirst.mockResolvedValue({ id: CONTACT_ID, organizationId: ORG_ID });
  contactCreate.mockResolvedValue({ id: CONTACT_ID, firstName: 'Jane', lastName: 'Doe' });

  return {
    service,
    contactFindFirst,
    contactFindMany,
    contactCount,
    contactCreate,
    contactUpdate,
    leadFindFirst,
  };
};

describe('ContactService.create (tenant isolation)', () => {
  it('scopes the organization relation and trims/normalizes fields', async () => {
    const { service, contactCreate } = mockService();
    contactCreate.mockResolvedValue({ id: CONTACT_ID, email: 'jane@acme.com' });

    await service.create(ORG_ID, 'actor', {
      firstName: ' Jane ',
      lastName: 'Doe',
      email: ' JANE@ACME.COM ',
      phone: ' 555 ',
    } as never);

    expect(contactCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@acme.com',
        phone: '555',
        organization: { connect: { id: ORG_ID } },
      }),
      select: expect.anything(),
    });
  });

  it('rejects a duplicate email within the organization as a ConflictException', async () => {
    const { service, contactCreate } = mockService();
    contactCreate.mockRejectedValue(prismaClientKnownError('P2002'));

    await expect(
      service.create(ORG_ID, 'actor', { firstName: 'Jane', lastName: 'Doe', email: 'jane@acme.com' } as never),
    ).rejects.toThrow(ConflictException);
  });
});

describe('ContactService.create (lead association)', () => {
  it('associates the contact when the lead belongs to the organization', async () => {
    const { service, leadFindFirst, contactCreate } = mockService();
    leadFindFirst.mockResolvedValue({ id: 'lead-1' });
    contactCreate.mockResolvedValue({ id: CONTACT_ID });

    await service.create(ORG_ID, 'actor', { firstName: 'Jane', lastName: 'Doe', leadId: 'lead-1' } as never);

    expect(leadFindFirst).toHaveBeenCalledWith({
      where: { id: 'lead-1', organizationId: ORG_ID, deletedAt: null },
      select: { id: true },
    });
    expect(contactCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lead: { connect: { id: 'lead-1' } } }) }),
    );
  });

  it('rejects associating a lead from another organization', async () => {
    const { service, leadFindFirst, contactCreate } = mockService();
    leadFindFirst.mockResolvedValue(null);

    await expect(
      service.create(ORG_ID, 'actor', { firstName: 'Jane', lastName: 'Doe', leadId: 'lead-other' } as never),
    ).rejects.toThrow(BadRequestException);
    expect(contactCreate).not.toHaveBeenCalled();
  });
});

describe('ContactService.findAll', () => {
  it('scopes to the organization and excludes soft-deleted contacts', async () => {
    const { service, contactCount, contactFindMany } = mockService();
    contactCount.mockResolvedValue(2);
    contactFindMany.mockResolvedValue([{ id: CONTACT_ID }]);

    const result = await service.findAll(ORG_ID, {} as never);

    expect(contactCount).toHaveBeenCalledWith({
      where: { organizationId: ORG_ID, deletedAt: null },
    });
    expect(contactFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG_ID, deletedAt: null },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
    );
    expect(result.meta).toEqual({ total: 2, page: 1, limit: 10, totalPages: 1 });
  });

  it('searches across name, email and company with insensitive contains', async () => {
    const { service, contactCount, contactFindMany } = mockService();
    contactCount.mockResolvedValue(0);
    contactFindMany.mockResolvedValue([]);

    await service.findAll(ORG_ID, { search: '  acme  ' } as never);

    expect(contactFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { firstName: { contains: 'acme', mode: 'insensitive' } },
            { lastName: { contains: 'acme', mode: 'insensitive' } },
            { email: { contains: 'acme', mode: 'insensitive' } },
            { company: { contains: 'acme', mode: 'insensitive' } },
          ],
        }),
      }),
    );
  });

  it('applies pagination and clamps unknown sort to createdAt desc', async () => {
    const { service, contactCount, contactFindMany } = mockService();
    contactCount.mockResolvedValue(25);
    contactFindMany.mockResolvedValue([]);

    await service.findAll(ORG_ID, { page: 3, limit: 10, sortBy: 'notAField', sortOrder: 'desc' } as never);

    expect(contactFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10, orderBy: { createdAt: 'desc' } }),
    );
  });
});

describe('ContactService.findById', () => {
  it('returns the contact when it belongs to the organization', async () => {
    const { service, contactFindFirst } = mockService();
    const expected = { id: CONTACT_ID, firstName: 'Jane' };
    contactFindFirst.mockResolvedValue(expected);

    const result = await service.findById(ORG_ID, CONTACT_ID);

    expect(contactFindFirst).toHaveBeenCalledWith({
      where: { id: CONTACT_ID, organizationId: ORG_ID, deletedAt: null },
      select: expect.anything(),
    });
    expect(result).toBe(expected);
  });

  it('throws NotFound when the contact is in another organization or deleted', async () => {
    const { service, contactFindFirst } = mockService();
    contactFindFirst.mockResolvedValue(null);

    await expect(service.findById(ORG_ID, 'contact-other')).rejects.toThrow(NotFoundException);
  });
});

describe('ContactService.update', () => {
  it('scopes tenant fields and normalizes the email on update', async () => {
    const { service, contactUpdate } = mockService();
    contactUpdate.mockResolvedValue({ id: CONTACT_ID, email: 'new@acme.com' });

    await service.update(ORG_ID, 'actor', CONTACT_ID, {
      email: ' NEW@ACME.COM ',
      notes: ' hi ',
      leadId: null,
    } as never);

    expect(contactUpdate).toHaveBeenCalledWith({
      where: { id: CONTACT_ID, organizationId: ORG_ID, deletedAt: null },
      data: expect.objectContaining({
        email: 'new@acme.com',
        notes: 'hi',
        lead: { disconnect: true },
      }),
      select: expect.anything(),
    });
  });

  it('converts a missing record into NotFound', async () => {
    const { service, contactUpdate } = mockService();
    contactUpdate.mockRejectedValue(prismaClientKnownError('P2025'));

    await expect(
      service.update(ORG_ID, 'actor', CONTACT_ID, { notes: 'x' } as never),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects a duplicate email as ConflictException', async () => {
    const { service, contactUpdate } = mockService();
    contactUpdate.mockRejectedValue(prismaClientKnownError('P2002'));

    await expect(
      service.update(ORG_ID, 'actor', CONTACT_ID, { email: 'dup@acme.com' } as never),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects connecting to a lead from another organization', async () => {
    const { service, leadFindFirst, contactUpdate } = mockService();
    leadFindFirst.mockResolvedValue(null);

    await expect(
      service.update(ORG_ID, 'actor', CONTACT_ID, { leadId: 'lead-other' } as never),
    ).rejects.toThrow(BadRequestException);
    expect(contactUpdate).not.toHaveBeenCalled();
  });
});

describe('ContactService.softDelete', () => {
  it('soft-deletes a contact that belongs to the organization', async () => {
    const { service, contactFindFirst, contactUpdate } = mockService();

    await service.softDelete(ORG_ID, 'actor', CONTACT_ID);

    expect(contactFindFirst).toHaveBeenCalledWith({
      where: { id: CONTACT_ID, organizationId: ORG_ID, deletedAt: null },
      select: { id: true },
    });
    expect(contactUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CONTACT_ID, organizationId: ORG_ID, deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      }),
    );
  });

  it('throws NotFound if the contact does not belong to the organization', async () => {
    const { service, contactFindFirst, contactUpdate } = mockService();
    contactFindFirst.mockResolvedValue(null);

    await expect(service.softDelete(ORG_ID, 'actor', 'contact-other')).rejects.toThrow(NotFoundException);
    expect(contactUpdate).not.toHaveBeenCalled();
  });

  it('throws NotFound when the contact is already soft-deleted', async () => {
    const { service, contactFindFirst, contactUpdate } = mockService();
    contactFindFirst.mockResolvedValue(null);

    await expect(service.softDelete(ORG_ID, 'actor', CONTACT_ID)).rejects.toThrow(NotFoundException);
    expect(contactFindFirst).toHaveBeenCalledWith({
      where: { id: CONTACT_ID, organizationId: ORG_ID, deletedAt: null },
      select: { id: true },
    });
    expect(contactUpdate).not.toHaveBeenCalled();
  });
});