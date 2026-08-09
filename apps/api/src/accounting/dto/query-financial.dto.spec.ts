import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { QueryReceivableDto } from './query-receivable.dto';
import { QueryPayableDto } from './query-payable.dto';
import { QueryPaymentDto } from './query-payment.dto';

describe('Accounting financial query DTOs (pagination bounds)', () => {
  const dtos = [QueryReceivableDto, QueryPayableDto, QueryPaymentDto];

  it.each(dtos)('accepts a normal valid limit for %p', async (Dto) => {
    const dto = plainToInstance(Dto, { page: 2, limit: 25 });
    const errors = await validate(dto);
    expect(errors).toEqual([]);
    expect((dto as QueryReceivableDto).page).toBe(2);
    expect((dto as QueryReceivableDto).limit).toBe(25);
  });

  it.each(dtos)('accepts a limit at the maximum accepted value (100) for %p', async (Dto) => {
    const dto = plainToInstance(Dto, { limit: 100 });
    const errors = await validate(dto);
    expect(errors).toEqual([]);
  });

  it.each(dtos)('rejects a limit above the maximum for %p', async (Dto) => {
    const dto = plainToInstance(Dto, { limit: 1000000000 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('limit');
  });

  it.each(dtos)('rejects a zero limit for %p', async (Dto) => {
    const dto = plainToInstance(Dto, { limit: 0 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('limit');
  });

  it.each(dtos)('rejects a negative limit for %p', async (Dto) => {
    const dto = plainToInstance(Dto, { limit: -5 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('limit');
  });

  it.each(dtos)('rejects a non-numeric limit for %p', async (Dto) => {
    const dto = plainToInstance(Dto, { limit: 'abc' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.map((e) => e.property)).toContain('limit');
  });

  it.each(dtos)('rejects a zero page for %p', async (Dto) => {
    const dto = plainToInstance(Dto, { page: 0 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('page');
  });

  it.each(dtos)('applies sensible defaults when params are omitted for %s', async (Dto) => {
    const dto = plainToInstance(Dto, {});
    const errors = await validate(dto);
    expect(errors).toEqual([]);
  });
});