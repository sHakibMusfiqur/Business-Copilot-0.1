import { plainToInstance } from 'class-transformer';
import { getMetadataStorage, validate } from 'class-validator';
import { SerialStatus } from '@prisma/client';

import { CreateSerialNumberDto } from './create-serial-number.dto';
import { UpdateSerialNumberDto } from './update-serial-number.dto';

type ClassConstructor = abstract new (...args: never[]) => unknown;

const declaredProps = (target: ClassConstructor) =>
  getMetadataStorage()
    .getTargetValidationMetadatas(target, '', false, false)
    .map((meta) => meta.propertyName);

describe('CreateSerialNumberDto', () => {
  it('passes with required fields only (batchId optional)', async () => {
    const dto = plainToInstance(CreateSerialNumberDto, { productId: 'p1', serialNumber: 'SN-1' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('fails when serialNumber is missing', async () => {
    const dto = plainToInstance(CreateSerialNumberDto, { productId: 'p1' });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'serialNumber')).toBeDefined();
  });

  it('fails on an invalid SerialStatus enum value', async () => {
    const dto = plainToInstance(CreateSerialNumberDto, {
      productId: 'p1',
      serialNumber: 'SN-1',
      status: 'BOGUS',
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'status')).toBeDefined();
  });

  it('accepts a valid SerialStatus', async () => {
    const dto = plainToInstance(CreateSerialNumberDto, {
      productId: 'p1',
      serialNumber: 'SN-1',
      status: SerialStatus.RESERVED,
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('declares no organizationId or deletedAt properties', () => {
    const props = declaredProps(CreateSerialNumberDto);
    expect(props).toContain('batchId');
    expect(props).not.toContain('organizationId');
    expect(props).not.toContain('deletedAt');
  });
});

describe('UpdateSerialNumberDto', () => {
  it('passes with all fields optional', async () => {
    const dto = plainToInstance(UpdateSerialNumberDto, {});
    expect(await validate(dto)).toHaveLength(0);
  });

  it('fails on an invalid status', async () => {
    const dto = plainToInstance(UpdateSerialNumberDto, { status: 'NOPE' });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'status')).toBeDefined();
  });

  it('declares no organizationId or deletedAt properties', () => {
    const props = declaredProps(UpdateSerialNumberDto);
    expect(props).not.toContain('organizationId');
    expect(props).not.toContain('deletedAt');
  });
});
