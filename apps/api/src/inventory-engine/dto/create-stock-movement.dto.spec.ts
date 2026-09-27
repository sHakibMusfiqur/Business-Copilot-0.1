import { plainToInstance } from 'class-transformer';
import { getMetadataStorage, validate } from 'class-validator';
import { StockMovementType } from '@prisma/client';

import { CreateStockMovementDto } from './create-stock-movement.dto';
import { QueryStockMovementDto } from './query-stock-movement.dto';

const declaredProps = (target: Function) =>
  getMetadataStorage()
    .getTargetValidationMetadatas(target, '', false, false)
    .map((meta) => meta.propertyName);

describe('CreateStockMovementDto', () => {
  it('passes with required fields and defaults', async () => {
    const dto = plainToInstance(CreateStockMovementDto, {
      stockId: 'st1',
      movementType: StockMovementType.SALE,
      quantity: 5,
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.unitCost).toBe(0);
    expect(dto.totalCost).toBe(0);
  });

  it('fails when stockId is missing', async () => {
    const dto = plainToInstance(CreateStockMovementDto, {
      movementType: StockMovementType.SALE,
      quantity: 1,
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'stockId')).toBeDefined();
  });

  it('fails on an invalid movementType enum value', async () => {
    const dto = plainToInstance(CreateStockMovementDto, {
      stockId: 'st1',
      movementType: 'BOGUS',
      quantity: 1,
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'movementType')).toBeDefined();
  });

  it('rejects zero or negative quantity', async () => {
    const dto = plainToInstance(CreateStockMovementDto, {
      stockId: 'st1',
      movementType: StockMovementType.SALE,
      quantity: 0,
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'quantity')).toBeDefined();
  });

  it('declares no organizationId, id, or createdAt properties', () => {
    const props = declaredProps(CreateStockMovementDto);
    expect(props).toContain('referenceType');
    expect(props).toContain('referenceId');
    expect(props).not.toContain('organizationId');
    expect(props).not.toContain('id');
    expect(props).not.toContain('createdAt');
  });
});

describe('QueryStockMovementDto', () => {
  it('defaults page and limit and accepts a movementType filter', async () => {
    const dto = plainToInstance(QueryStockMovementDto, { movementType: StockMovementType.PURCHASE });
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(10);
    expect(await validate(dto)).toHaveLength(0);
  });

  it('fails on an invalid movementType filter', async () => {
    const dto = plainToInstance(QueryStockMovementDto, { movementType: 'BOGUS' });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'movementType')).toBeDefined();
  });
});
