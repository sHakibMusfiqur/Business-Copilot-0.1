import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { SAFE_JSON_MAX_BYTES, SAFE_JSON_MAX_DEPTH } from '../../common/validators/safe-json.validator';
import { CreateBatchDto } from './create-batch.dto';
import { CreateInventoryTransactionDto } from './create-inventory-transaction.dto';
import { CreateOpeningStockDto } from './create-opening-stock.dto';
import { CreateSerialNumberDto } from './create-serial-number.dto';
import { CreateStockAdjustmentDto } from './create-stock-adjustment.dto';
import { CreateStockMovementDto } from './create-stock-movement.dto';
import { CreateStockReservationDto } from './create-stock-reservation.dto';
import { CreateStockDto } from './create-stock.dto';
import { CreateWarehouseTransferDto } from './create-warehouse-transfer.dto';
import { UpdateBatchDto } from './update-batch.dto';
import { UpdateOpeningStockDto } from './update-opening-stock.dto';
import { UpdateSerialNumberDto } from './update-serial-number.dto';
import { UpdateStockReservationDto } from './update-stock-reservation.dto';
import { UpdateStockDto } from './update-stock.dto';
import { UpdateWarehouseTransferDto } from './update-warehouse-transfer.dto';

type ClassConstructor = new (...args: unknown[]) => object;

const metadataDtos: ClassConstructor[] = [
  CreateBatchDto,
  CreateInventoryTransactionDto,
  CreateOpeningStockDto,
  CreateSerialNumberDto,
  CreateStockAdjustmentDto,
  CreateStockMovementDto,
  CreateStockReservationDto,
  CreateStockDto,
  CreateWarehouseTransferDto,
  UpdateBatchDto,
  UpdateOpeningStockDto,
  UpdateSerialNumberDto,
  UpdateStockReservationDto,
  UpdateStockDto,
  UpdateWarehouseTransferDto,
];

const nest = (containers: number): Record<string, unknown> => {
  let value: Record<string, unknown> = { leaf: true };
  for (let i = 1; i < containers; i += 1) {
    value = { level: value };
  }
  return value;
};

const metadataError = async (Dto: ClassConstructor, metadata: unknown) => {
  const dto = plainToInstance(Dto, {}) as { metadata?: Record<string, unknown> };
  dto.metadata = metadata as Record<string, unknown>;
  const errors = await validate(dto);
  return errors.find((e) => e.property === 'metadata');
};

describe.each(metadataDtos.map((dto) => [dto.name, dto]))('%s safe metadata validation', (_name, Dto) => {
  it('accepts a plain JSON object', async () => {
    const error = await metadataError(Dto, { origin: 'plant-1', nested: { list: [1, 'x'] } });
    expect(error).toBeUndefined();
  });

  it('accepts an absent metadata field', async () => {
    const dto = plainToInstance(Dto, {});
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'metadata')).toBeUndefined();
  });

  it('rejects arrays at the top level', async () => {
    expect(await metadataError(Dto, [1, 2, 3])).toBeDefined();
    expect(await metadataError(Dto, ['nested'])).toBeDefined();
  });

  it('rejects non-object primitives', async () => {
    expect(await metadataError(Dto, 'not-an-object')).toBeDefined();
    expect(await metadataError(Dto, 42)).toBeDefined();
    expect(await metadataError(Dto, true)).toBeDefined();
    expect(await metadataError(Dto, undefined)).toBeUndefined();
  });

  it('accepts null metadata (IsOptional semantics, unchanged from the @IsObject baseline)', async () => {
    expect(await metadataError(Dto, null)).toBeUndefined();
  });

  it('rejects prototype-pollution payloads', async () => {
    expect(await metadataError(Dto, JSON.parse('{"__proto__": {"polluted": true}}'))).toBeDefined();
    expect(await metadataError(Dto, JSON.parse('{"constructor": {"prototype": {}}}'))).toBeDefined();
    expect(await metadataError(Dto, JSON.parse('{"prototype": 1}'))).toBeDefined();
  });

  it('rejects non-plain nested objects (Map/Date/Set/Error)', async () => {
    expect(await metadataError(Dto, { nested: new Map([['k', 'v']]) })).toBeDefined();
    expect(await metadataError(Dto, { nested: new Date() })).toBeDefined();
    expect(await metadataError(Dto, { nested: new Set([1]) })).toBeDefined();
    expect(await metadataError(Dto, { nested: new Error('x') })).toBeDefined();
  });

  it('accepts plain nested objects', async () => {
    expect(await metadataError(Dto, { nested: { a: 1, b: { c: [true, null] } } })).toBeUndefined();
  });

  it('rejects payloads deeper than the documented depth limit', async () => {
    expect(await metadataError(Dto, nest(SAFE_JSON_MAX_DEPTH + 1))).toBeDefined();
  });

  it('accepts payloads within the documented depth limit', async () => {
    expect(await metadataError(Dto, nest(SAFE_JSON_MAX_DEPTH))).toBeUndefined();
  });

  it('rejects payloads larger than the documented size limit', async () => {
    const error = await metadataError(Dto, { blob: 'x'.repeat(SAFE_JSON_MAX_BYTES + 1) });
    expect(error).toBeDefined();
  });

  it('rejects JSON-unrepresentable values', async () => {
    expect(await metadataError(Dto, { fn: () => undefined })).toBeDefined();
    expect(await metadataError(Dto, { n: Number.NaN })).toBeDefined();
    expect(await metadataError(Dto, { b: BigInt(1) })).toBeDefined();
  });
});
