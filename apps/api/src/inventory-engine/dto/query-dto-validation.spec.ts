import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { QueryBatchDto } from './query-batch.dto';
import { QueryInventoryTransactionDto } from './query-inventory-transaction.dto';
import { QueryOpeningStockDto } from './query-opening-stock.dto';
import { QuerySerialNumberDto } from './query-serial-number.dto';
import { QueryStockAdjustmentDto } from './query-stock-adjustment.dto';
import { QueryStockMovementDto } from './query-stock-movement.dto';
import { QueryStockReservationDto } from './query-stock-reservation.dto';
import { QueryStockDto } from './query-stock.dto';
import { QueryWarehouseTransferDto } from './query-warehouse-transfer.dto';

type ClassConstructor = new (...args: unknown[]) => object;

const queryDtos: Array<{
  name: string;
  dto: ClassConstructor;
  longFilters: Array<{ field: string; max: number }>;
}> = [
  { name: 'QueryBatchDto', dto: QueryBatchDto, longFilters: [{ field: 'search', max: 100 }] },
  {
    name: 'QueryInventoryTransactionDto',
    dto: QueryInventoryTransactionDto,
    longFilters: [{ field: 'productId', max: 40 }],
  },
  {
    name: 'QueryOpeningStockDto',
    dto: QueryOpeningStockDto,
    longFilters: [{ field: 'warehouseId', max: 40 }],
  },
  { name: 'QuerySerialNumberDto', dto: QuerySerialNumberDto, longFilters: [{ field: 'search', max: 100 }] },
  {
    name: 'QueryStockAdjustmentDto',
    dto: QueryStockAdjustmentDto,
    longFilters: [{ field: 'stockId', max: 40 }],
  },
  {
    name: 'QueryStockMovementDto',
    dto: QueryStockMovementDto,
    longFilters: [{ field: 'stockId', max: 40 }],
  },
  {
    name: 'QueryStockReservationDto',
    dto: QueryStockReservationDto,
    longFilters: [{ field: 'stockId', max: 40 }],
  },
  { name: 'QueryStockDto', dto: QueryStockDto, longFilters: [] },
  {
    name: 'QueryWarehouseTransferDto',
    dto: QueryWarehouseTransferDto,
    longFilters: [{ field: 'search', max: 100 }],
  },
];

describe.each(queryDtos)('$name strict validation', ({ dto, longFilters }) => {
  it('accepts sortOrder asc', async () => {
    const errors = await validate(plainToInstance(dto, { sortOrder: 'asc' }));
    expect(errors.find((e) => e.property === 'sortOrder')).toBeUndefined();
  });

  it('accepts sortOrder desc', async () => {
    const errors = await validate(plainToInstance(dto, { sortOrder: 'desc' }));
    expect(errors.find((e) => e.property === 'sortOrder')).toBeUndefined();
  });

  it('rejects an arbitrary sortOrder value at runtime', async () => {
    const errors = await validate(plainToInstance(dto, { sortOrder: 'HACK' }));
    expect(errors.find((e) => e.property === 'sortOrder')).toBeDefined();
  });

  it('still defaults sortOrder to desc when absent', () => {
    const instance = plainToInstance(dto, {}) as { sortOrder?: string };
    expect(instance.sortOrder).toBe('desc');
  });

  if (longFilters.length === 0) {
    it('has no string identifier filters to bound', () => {
      expect(longFilters).toHaveLength(0);
    });
  }
});

const lengthCases = queryDtos.flatMap(({ name, dto, longFilters }) =>
  longFilters.map((filter) => ({ name, dto, ...filter })),
);

describe('query string filter length hardening', () => {
  it.each(lengthCases)('$name rejects $field longer than $max characters', async ({ dto, field, max }) => {
    const errors = await validate(plainToInstance(dto, { [field]: 'a'.repeat(max + 1) }));
    expect(errors.find((e) => e.property === field)).toBeDefined();
  });

  it.each(lengthCases)('$name accepts $field exactly at the $max character boundary', async ({
    dto,
    field,
    max,
  }) => {
    const errors = await validate(plainToInstance(dto, { [field]: 'a'.repeat(max) }));
    expect(errors.find((e) => e.property === field)).toBeUndefined();
  });

  it.each(lengthCases)('$name still rejects a non-string $field', async ({ dto, field }) => {
    const errors = await validate(plainToInstance(dto, { [field]: 12345 }));
    expect(errors.find((e) => e.property === field)).toBeDefined();
  });
});
