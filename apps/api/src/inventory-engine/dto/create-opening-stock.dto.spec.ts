import { plainToInstance } from 'class-transformer';
import { getMetadataStorage, validate } from 'class-validator';

import { CreateOpeningStockDto } from './create-opening-stock.dto';
import { UpdateOpeningStockDto } from './update-opening-stock.dto';

type ClassConstructor = abstract new (...args: never[]) => unknown;

const declaredProps = (target: ClassConstructor) =>
  getMetadataStorage()
    .getTargetValidationMetadatas(target, '', false, false)
    .map((meta) => meta.propertyName);

describe('CreateOpeningStockDto', () => {
  it('passes with required standalone fields', async () => {
    const dto = plainToInstance(CreateOpeningStockDto, {
      warehouseId: 'w1',
      productId: 'p1',
      quantity: 100,
      referenceDate: '2026-01-01',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.unitCost).toBe(0);
  });

  it('fails when quantity is missing or below 1', async () => {
    const missing = plainToInstance(CreateOpeningStockDto, {
      warehouseId: 'w1',
      productId: 'p1',
      referenceDate: '2026-01-01',
    });
    expect((await validate(missing)).find((e) => e.property === 'quantity')).toBeDefined();

    const zero = plainToInstance(CreateOpeningStockDto, {
      warehouseId: 'w1',
      productId: 'p1',
      quantity: 0,
      referenceDate: '2026-01-01',
    });
    expect((await validate(zero)).find((e) => e.property === 'quantity')).toBeDefined();
  });

  it('fails when referenceDate is missing or malformed', async () => {
    const missing = plainToInstance(CreateOpeningStockDto, {
      warehouseId: 'w1',
      productId: 'p1',
      quantity: 1,
    });
    expect((await validate(missing)).find((e) => e.property === 'referenceDate')).toBeDefined();

    const malformed = plainToInstance(CreateOpeningStockDto, {
      warehouseId: 'w1',
      productId: 'p1',
      quantity: 1,
      referenceDate: 'yesterday',
    });
    expect((await validate(malformed)).find((e) => e.property === 'referenceDate')).toBeDefined();
  });

  it('rejects negative unitCost and totalValue', async () => {
    const dto = plainToInstance(CreateOpeningStockDto, {
      warehouseId: 'w1',
      productId: 'p1',
      quantity: 1,
      referenceDate: '2026-01-01',
      unitCost: -1,
      totalValue: -2,
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'unitCost')).toBeDefined();
    expect(errors.find((e) => e.property === 'totalValue')).toBeDefined();
  });

  it('declares no stockId, organizationId, or id properties (standalone entity)', () => {
    const props = declaredProps(CreateOpeningStockDto);
    expect(props).toContain('warehouseId');
    expect(props).toContain('referenceDate');
    expect(props).not.toContain('stockId');
    expect(props).not.toContain('organizationId');
    expect(props).not.toContain('id');
  });
});

describe('UpdateOpeningStockDto', () => {
  it('passes with all fields optional', async () => {
    const dto = plainToInstance(UpdateOpeningStockDto, {});
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects quantity below 1', async () => {
    const dto = plainToInstance(UpdateOpeningStockDto, { quantity: 0 });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'quantity')).toBeDefined();
  });

  it('declares no stockId, warehouseId, or productId properties', () => {
    const props = declaredProps(UpdateOpeningStockDto);
    expect(props).toContain('quantity');
    expect(props).toContain('referenceDate');
    expect(props).not.toContain('stockId');
    expect(props).not.toContain('warehouseId');
    expect(props).not.toContain('productId');
    expect(props).not.toContain('organizationId');
  });
});
