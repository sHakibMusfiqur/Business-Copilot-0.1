import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { QueryPayrollDto } from './query-payroll.dto';

describe('QueryPayrollDto', () => {
  it('should accept empty query (defaults applied)', async () => {
    const dto = plainToInstance(QueryPayrollDto, {});
    const errors = await validate(dto);
    expect(errors).toEqual([]);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
    expect(dto.sortBy).toBe('periodEnd');
    expect(dto.sortOrder).toBe('desc');
  });

  it('should accept valid full query', async () => {
    const dto = plainToInstance(QueryPayrollDto, {
      page: 2,
      limit: 10,
      search: 'john',
      employeeId: 'emp-1',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      sortBy: 'basicSalary',
      sortOrder: 'asc',
    });
    const errors = await validate(dto);
    expect(errors).toEqual([]);
  });

  it('should accept limit at maximum (100)', async () => {
    const dto = plainToInstance(QueryPayrollDto, { limit: 100 });
    const errors = await validate(dto);
    expect(errors).toEqual([]);
  });

  it('should reject limit above maximum', async () => {
    const dto = plainToInstance(QueryPayrollDto, { limit: 101 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('limit');
  });

  it('should reject zero limit', async () => {
    const dto = plainToInstance(QueryPayrollDto, { limit: 0 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('limit');
  });

  it('should reject negative limit', async () => {
    const dto = plainToInstance(QueryPayrollDto, { limit: -5 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('limit');
  });

  it('should reject zero page', async () => {
    const dto = plainToInstance(QueryPayrollDto, { page: 0 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('page');
  });

  it('should reject negative page', async () => {
    const dto = plainToInstance(QueryPayrollDto, { page: -1 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('page');
  });

  it('should reject invalid sortBy', async () => {
    const dto = plainToInstance(QueryPayrollDto, { sortBy: 'invalidField' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('sortBy');
  });

  it('should accept all valid sortBy values', async () => {
    const fields = [
      'periodStart', 'periodEnd', 'basicSalary', 'allowances',
      'deductions', 'tax', 'netSalary', 'paymentDate', 'createdAt', 'updatedAt',
    ];
    for (const field of fields) {
      const dto = plainToInstance(QueryPayrollDto, { sortBy: field });
      const errors = await validate(dto);
      expect(errors).toEqual([]);
    }
  });

  it('should reject invalid sortOrder', async () => {
    const dto = plainToInstance(QueryPayrollDto, { sortOrder: 'random' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('sortOrder');
  });

  it('should accept valid periodStart as ISO date', async () => {
    const dto = plainToInstance(QueryPayrollDto, { periodStart: '2026-01-01' });
    const errors = await validate(dto);
    expect(errors).toEqual([]);
  });

  it('should reject invalid periodStart date string', async () => {
    const dto = plainToInstance(QueryPayrollDto, { periodStart: 'not-a-date' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('periodStart');
  });

  it('should accept valid periodEnd as ISO date', async () => {
    const dto = plainToInstance(QueryPayrollDto, { periodEnd: '2026-12-31' });
    const errors = await validate(dto);
    expect(errors).toEqual([]);
  });

  it('should reject invalid periodEnd date string', async () => {
    const dto = plainToInstance(QueryPayrollDto, { periodEnd: 'invalid' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('periodEnd');
  });

  it('should accept full ISO 8601 datetime strings', async () => {
    const dto = plainToInstance(QueryPayrollDto, {
      periodStart: '2026-01-01T00:00:00.000Z',
      periodEnd: '2026-01-31T23:59:59.999Z',
    });
    const errors = await validate(dto);
    expect(errors).toEqual([]);
  });
});
