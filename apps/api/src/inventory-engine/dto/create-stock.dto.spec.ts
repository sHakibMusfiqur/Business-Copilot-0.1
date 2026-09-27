import { plainToInstance } from 'class-transformer';
import { getMetadataStorage, validate } from 'class-validator';

import { CreateStockDto } from './create-stock.dto';
import { UpdateStockDto } from './update-stock.dto';

type ClassConstructor = abstract new (...args: never[]) => unknown;

const declaredProps = (target: ClassConstructor) =>
  getMetadataStorage()
    .getTargetValidationMetadatas(target, '', false, false)
    .map((meta) => meta.propertyName);

describe('CreateStockDto', () => {
  it('passes with warehouseId and productId only', async () => {
    const dto = plainToInstance(CreateStockDto, { warehouseId: 'w1', productId: 'p1' });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.quantity).toBe(0);
    expect(dto.unitCost).toBe(0);
  });

  it('fails when warehouseId is missing', async () => {
    const dto = plainToInstance(CreateStockDto, { productId: 'p1' });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'warehouseId')).toBeDefined();
  });

  it('rejects negative quantities', async () => {
    const dto = plainToInstance(CreateStockDto, { warehouseId: 'w1', productId: 'p1', quantity: -1 });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'quantity')).toBeDefined();
  });

  it('rejects negative unitCost and totalValue', async () => {
    const dto = plainToInstance(CreateStockDto, {
      warehouseId: 'w1',
      productId: 'p1',
      unitCost: -5,
      totalValue: -10,
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'unitCost')).toBeDefined();
    expect(errors.find((e) => e.property === 'totalValue')).toBeDefined();
  });

  it('fails on an invalid StockStatus enum value', async () => {
    const dto = plainToInstance(CreateStockDto, {
      warehouseId: 'w1',
      productId: 'p1',
      status: 'BOGUS',
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'status')).toBeDefined();
  });

  it('declares no organizationId, id, or deletedAt properties', () => {
    const props = declaredProps(CreateStockDto);
    expect(props).toContain('batchId');
    expect(props).toContain('serialNumberId');
    expect(props).not.toContain('organizationId');
    expect(props).not.toContain('id');
    expect(props).not.toContain('deletedAt');
  });
});

describe('UpdateStockDto', () => {
  it('passes with all fields optional', async () => {
    const dto = plainToInstance(UpdateStockDto, {});
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects negative counters', async () => {
    const dto = plainToInstance(UpdateStockDto, { reservedQuantity: -1 });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'reservedQuantity')).toBeDefined();
  });

  it('declares no organizationId, warehouseId, or productId properties', () => {
    const props = declaredProps(UpdateStockDto);
    expect(props).toContain('quantity');
    expect(props).toContain('status');
    expect(props).not.toContain('organizationId');
    expect(props).not.toContain('warehouseId');
    expect(props).not.toContain('productId');
  });
});
