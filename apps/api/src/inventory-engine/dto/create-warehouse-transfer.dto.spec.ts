import { plainToInstance } from 'class-transformer';
import { getMetadataStorage, validate } from 'class-validator';
import { TransferStatus } from '@prisma/client';

import { CreateWarehouseTransferDto } from './create-warehouse-transfer.dto';
import { UpdateWarehouseTransferDto } from './update-warehouse-transfer.dto';

type ClassConstructor = abstract new (...args: never[]) => unknown;

const declaredProps = (target: ClassConstructor) =>
  getMetadataStorage()
    .getTargetValidationMetadatas(target, '', false, false)
    .map((meta) => meta.propertyName);

describe('CreateWarehouseTransferDto', () => {
  it('passes with required fields and defaults to DRAFT status validation-wise', async () => {
    const dto = plainToInstance(CreateWarehouseTransferDto, {
      sourceWarehouseId: 'w1',
      destWarehouseId: 'w2',
      transferNumber: 'TR-001',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.status).toBe(TransferStatus.DRAFT);
  });

  it('fails when sourceWarehouseId, destWarehouseId, or transferNumber is missing', async () => {
    const dto = plainToInstance(CreateWarehouseTransferDto, {});
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'sourceWarehouseId')).toBeDefined();
    expect(errors.find((e) => e.property === 'destWarehouseId')).toBeDefined();
    expect(errors.find((e) => e.property === 'transferNumber')).toBeDefined();
  });

  it('fails on an invalid TransferStatus enum value', async () => {
    const dto = plainToInstance(CreateWarehouseTransferDto, {
      sourceWarehouseId: 'w1',
      destWarehouseId: 'w2',
      transferNumber: 'TR-001',
      status: 'BOGUS',
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'status')).toBeDefined();
  });

  it('declares no organizationId or deletedAt properties', () => {
    const props = declaredProps(CreateWarehouseTransferDto);
    expect(props).not.toContain('organizationId');
    expect(props).not.toContain('deletedAt');
  });
});

describe('UpdateWarehouseTransferDto', () => {
  it('passes with all fields optional', async () => {
    const dto = plainToInstance(UpdateWarehouseTransferDto, {});
    expect(await validate(dto)).toHaveLength(0);
  });

  it('fails on an invalid status', async () => {
    const dto = plainToInstance(UpdateWarehouseTransferDto, { status: 'BOGUS' });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'status')).toBeDefined();
  });

  it('declares only status, notes, and metadata (no identity fields)', () => {
    const props = declaredProps(UpdateWarehouseTransferDto);
    expect(props).toEqual(expect.arrayContaining(['status', 'notes', 'metadata']));
    expect(props).not.toContain('transferNumber');
    expect(props).not.toContain('sourceWarehouseId');
    expect(props).not.toContain('destWarehouseId');
    expect(props).not.toContain('organizationId');
  });
});
