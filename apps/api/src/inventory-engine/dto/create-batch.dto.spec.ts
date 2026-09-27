import { plainToInstance } from 'class-transformer';
import { getMetadataStorage, validate } from 'class-validator';
import { BatchStatus } from '@prisma/client';

import { CreateBatchDto } from './create-batch.dto';
import { UpdateBatchDto } from './update-batch.dto';
import { QueryBatchDto } from './query-batch.dto';

const declaredProps = (target: Function) =>
  getMetadataStorage()
    .getTargetValidationMetadatas(target, '', false, false)
    .map((meta) => meta.propertyName);

describe('CreateBatchDto', () => {
  it('passes with required fields only', async () => {
    const dto = plainToInstance(CreateBatchDto, { productId: 'p1', batchNumber: 'B-001' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('fails when productId is missing', async () => {
    const dto = plainToInstance(CreateBatchDto, { batchNumber: 'B-001' });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'productId')).toBeDefined();
  });

  it('fails when batchNumber is missing or empty', async () => {
    const dto = plainToInstance(CreateBatchDto, { productId: 'p1', batchNumber: '' });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'batchNumber')).toBeDefined();
  });

  it('fails on an invalid BatchStatus enum value', async () => {
    const dto = plainToInstance(CreateBatchDto, {
      productId: 'p1',
      batchNumber: 'B-001',
      status: 'NOT_A_STATUS',
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'status')).toBeDefined();
  });

  it('accepts a valid BatchStatus and ISO dates', async () => {
    const dto = plainToInstance(CreateBatchDto, {
      productId: 'p1',
      batchNumber: 'B-001',
      status: BatchStatus.EXPIRED,
      manufacturingDate: '2026-01-01',
      expiryDate: '2026-06-01',
      metadata: { origin: 'x' },
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a malformed date string', async () => {
    const dto = plainToInstance(CreateBatchDto, {
      productId: 'p1',
      batchNumber: 'B-001',
      expiryDate: 'not-a-date',
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'expiryDate')).toBeDefined();
  });

  it('declares no organizationId, id, or deletedAt properties', () => {
    const props = declaredProps(CreateBatchDto);
    expect(props).toContain('productId');
    expect(props).not.toContain('organizationId');
    expect(props).not.toContain('id');
    expect(props).not.toContain('deletedAt');
  });
});

describe('UpdateBatchDto', () => {
  it('passes with all fields optional', async () => {
    const dto = plainToInstance(UpdateBatchDto, {});
    expect(await validate(dto)).toHaveLength(0);
  });

  it('fails on an invalid status', async () => {
    const dto = plainToInstance(UpdateBatchDto, { status: 'NOPE' });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'status')).toBeDefined();
  });

  it('declares no organizationId or deletedAt properties', () => {
    const props = declaredProps(UpdateBatchDto);
    expect(props).not.toContain('organizationId');
    expect(props).not.toContain('deletedAt');
  });
});

describe('QueryBatchDto', () => {
  it('defaults page and limit', () => {
    const dto = plainToInstance(QueryBatchDto, {});
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(10);
  });

  it('fails when limit exceeds 100', async () => {
    const dto = plainToInstance(QueryBatchDto, { limit: 500 });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'limit')).toBeDefined();
  });

  it('fails on an invalid status filter', async () => {
    const dto = plainToInstance(QueryBatchDto, { status: 'BOGUS' });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'status')).toBeDefined();
  });
});
