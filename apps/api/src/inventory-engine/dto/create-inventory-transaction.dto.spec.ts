import { plainToInstance } from 'class-transformer';
import { getMetadataStorage, validate } from 'class-validator';
import { InventoryTransactionType, TransactionType } from '@prisma/client';

import { CreateInventoryTransactionDto } from './create-inventory-transaction.dto';
import { QueryInventoryTransactionDto } from './query-inventory-transaction.dto';

type ClassConstructor = abstract new (...args: never[]) => unknown;

const declaredProps = (target: ClassConstructor) =>
  getMetadataStorage()
    .getTargetValidationMetadatas(target, '', false, false)
    .map((meta) => meta.propertyName);

describe('CreateInventoryTransactionDto', () => {
  it('passes with legacy type and engine transactionType together', async () => {
    const dto = plainToInstance(CreateInventoryTransactionDto, {
      productId: 'p1',
      type: TransactionType.OUT,
      quantity: 3,
      transactionType: InventoryTransactionType.SALE,
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.type).toBe(TransactionType.OUT);
    expect(dto.transactionType).toBe(InventoryTransactionType.SALE);
    expect(dto.type).not.toBe(dto.transactionType);
  });

  it('passes with legacy type only (engine fields optional/nullable)', async () => {
    const dto = plainToInstance(CreateInventoryTransactionDto, {
      productId: 'p1',
      type: TransactionType.ADJUSTMENT,
      quantity: 1,
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.transactionType).toBeUndefined();
  });

  it('fails when legacy type is missing or invalid', async () => {
    const missing = plainToInstance(CreateInventoryTransactionDto, { productId: 'p1', quantity: 1 });
    expect((await validate(missing)).find((e) => e.property === 'type')).toBeDefined();

    const invalid = plainToInstance(CreateInventoryTransactionDto, {
      productId: 'p1',
      type: 'BOGUS',
      quantity: 1,
    });
    expect((await validate(invalid)).find((e) => e.property === 'type')).toBeDefined();
  });

  it('fails on an invalid engine transactionType enum value', async () => {
    const dto = plainToInstance(CreateInventoryTransactionDto, {
      productId: 'p1',
      type: TransactionType.IN,
      quantity: 1,
      transactionType: 'BOGUS',
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'transactionType')).toBeDefined();
  });

  it('rejects negative quantity', async () => {
    const dto = plainToInstance(CreateInventoryTransactionDto, {
      productId: 'p1',
      type: TransactionType.IN,
      quantity: -5,
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'quantity')).toBeDefined();
  });

  it('declares no organizationId, createdById, id, or createdAt properties (server-managed)', () => {
    const props = declaredProps(CreateInventoryTransactionDto);
    expect(props).toContain('type');
    expect(props).toContain('transactionType');
    expect(props).not.toContain('organizationId');
    expect(props).not.toContain('createdById');
    expect(props).not.toContain('id');
    expect(props).not.toContain('createdAt');
  });
});

describe('QueryInventoryTransactionDto', () => {
  it('defaults page and limit and accepts both independent type filters', async () => {
    const dto = plainToInstance(QueryInventoryTransactionDto, {
      type: TransactionType.IN,
      transactionType: InventoryTransactionType.PURCHASE,
    });
    expect(dto.page).toBe(1);
    expect(await validate(dto)).toHaveLength(0);
  });

  it('fails on invalid type or transactionType filters', async () => {
    const badLegacy = plainToInstance(QueryInventoryTransactionDto, { type: 'BOGUS' });
    expect((await validate(badLegacy)).find((e) => e.property === 'type')).toBeDefined();

    const badEngine = plainToInstance(QueryInventoryTransactionDto, { transactionType: 'BOGUS' });
    expect((await validate(badEngine)).find((e) => e.property === 'transactionType')).toBeDefined();
  });
});
