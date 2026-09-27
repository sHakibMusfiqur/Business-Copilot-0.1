import { plainToInstance } from 'class-transformer';
import { getMetadataStorage, validate } from 'class-validator';
import { AdjustmentType } from '@prisma/client';

import { CreateStockAdjustmentDto } from './create-stock-adjustment.dto';
import { QueryStockAdjustmentDto } from './query-stock-adjustment.dto';

const declaredProps = (target: Function) =>
  getMetadataStorage()
    .getTargetValidationMetadatas(target, '', false, false)
    .map((meta) => meta.propertyName);

describe('CreateStockAdjustmentDto', () => {
  it('passes with all required adjustment fields', async () => {
    const dto = plainToInstance(CreateStockAdjustmentDto, {
      stockId: 'st1',
      adjustmentType: AdjustmentType.ADD,
      quantityBefore: 10,
      quantityAfter: 15,
      adjustmentQty: 5,
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('fails when stockId is missing', async () => {
    const dto = plainToInstance(CreateStockAdjustmentDto, {
      adjustmentType: AdjustmentType.ADD,
      quantityBefore: 1,
      quantityAfter: 2,
      adjustmentQty: 1,
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'stockId')).toBeDefined();
  });

  it('fails on an invalid AdjustmentType enum value', async () => {
    const dto = plainToInstance(CreateStockAdjustmentDto, {
      stockId: 'st1',
      adjustmentType: 'BOGUS',
      quantityBefore: 1,
      quantityAfter: 2,
      adjustmentQty: 1,
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'adjustmentType')).toBeDefined();
  });

  it('rejects negative quantityBefore and quantityAfter but allows signed adjustmentQty', async () => {
    const negative = plainToInstance(CreateStockAdjustmentDto, {
      stockId: 'st1',
      adjustmentType: AdjustmentType.ADD,
      quantityBefore: -1,
      quantityAfter: 1,
      adjustmentQty: 2,
    });
    const errors = await validate(negative);
    expect(errors.find((e) => e.property === 'quantityBefore')).toBeDefined();

    const signed = plainToInstance(CreateStockAdjustmentDto, {
      stockId: 'st1',
      adjustmentType: AdjustmentType.SUBTRACT,
      quantityBefore: 10,
      quantityAfter: 7,
      adjustmentQty: -3,
    });
    expect(await validate(signed)).toHaveLength(0);
  });

  it('declares no organizationId, id, or createdAt properties', () => {
    const props = declaredProps(CreateStockAdjustmentDto);
    expect(props).toContain('reason');
    expect(props).not.toContain('organizationId');
    expect(props).not.toContain('id');
    expect(props).not.toContain('createdAt');
  });
});

describe('QueryStockAdjustmentDto', () => {
  it('defaults page and limit and accepts an adjustmentType filter', async () => {
    const dto = plainToInstance(QueryStockAdjustmentDto, { adjustmentType: AdjustmentType.SET });
    expect(dto.page).toBe(1);
    expect(await validate(dto)).toHaveLength(0);
  });

  it('fails on an invalid adjustmentType filter', async () => {
    const dto = plainToInstance(QueryStockAdjustmentDto, { adjustmentType: 'BOGUS' });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'adjustmentType')).toBeDefined();
  });
});
