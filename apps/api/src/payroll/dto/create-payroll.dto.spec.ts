import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreatePayrollDto, PeriodStartBeforeEnd } from './create-payroll.dto';

describe('CreatePayrollDto', () => {
  it('should pass validation with valid data', async () => {
    const dto = plainToInstance(CreatePayrollDto, {
      employeeId: 'emp-1',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      basicSalary: 5000,
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail when periodStart is after periodEnd', async () => {
    const dto = plainToInstance(CreatePayrollDto, {
      employeeId: 'emp-1',
      periodStart: '2026-02-01',
      periodEnd: '2026-01-01',
      basicSalary: 5000,
    });

    const errors = await validate(dto);
    const periodStartError = errors.find((e) => e.property === 'periodStart');
    expect(periodStartError).toBeDefined();
    expect(periodStartError?.constraints?.PeriodStartBeforeEnd).toBeDefined();
  });

  it('should fail when basicSalary is negative', async () => {
    const dto = plainToInstance(CreatePayrollDto, {
      employeeId: 'emp-1',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      basicSalary: -1000,
    });

    const errors = await validate(dto);
    const salaryError = errors.find((e) => e.property === 'basicSalary');
    expect(salaryError).toBeDefined();
  });

  it('should fail when employeeId is missing', async () => {
    const dto = plainToInstance(CreatePayrollDto, {
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      basicSalary: 5000,
    });

    const errors = await validate(dto);
    const employeeIdError = errors.find((e) => e.property === 'employeeId');
    expect(employeeIdError).toBeDefined();
  });

  it('should pass when periodStart equals periodEnd', async () => {
    const dto = plainToInstance(CreatePayrollDto, {
      employeeId: 'emp-1',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-01',
      basicSalary: 5000,
    });

    const errors = await validate(dto);
    const periodStartError = errors.find((e) => e.property === 'periodStart');
    expect(periodStartError?.constraints?.PeriodStartBeforeEnd).toBeUndefined();
  });

  it('should accept optional fields as undefined', async () => {
    const dto = plainToInstance(CreatePayrollDto, {
      employeeId: 'emp-1',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      basicSalary: 5000,
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.allowances).toBeUndefined();
    expect(dto.deductions).toBeUndefined();
    expect(dto.tax).toBeUndefined();
  });
});

describe('PeriodStartBeforeEnd validator', () => {
  const validator = new PeriodStartBeforeEnd();

  it('should return true when periodStart is before periodEnd', () => {
    const result = validator.validate('2026-01-01', {
      object: { periodEnd: '2026-01-31' },
      constraints: ['periodEnd'],
      value: '2026-01-01',
      targetName: '',
      property: 'periodStart',
    });
    expect(result).toBe(true);
  });

  it('should return true when periodStart equals periodEnd', () => {
    const result = validator.validate('2026-01-01', {
      object: { periodEnd: '2026-01-01' },
      constraints: ['periodEnd'],
      value: '2026-01-01',
      targetName: '',
      property: 'periodStart',
    });
    expect(result).toBe(true);
  });

  it('should return false when periodStart is after periodEnd', () => {
    const result = validator.validate('2026-02-01', {
      object: { periodEnd: '2026-01-01' },
      constraints: ['periodEnd'],
      value: '2026-02-01',
      targetName: '',
      property: 'periodStart',
    });
    expect(result).toBe(false);
  });

  it('should return true when related value is missing', () => {
    const result = validator.validate('2026-01-01', {
      object: {},
      constraints: ['periodEnd'],
      value: '2026-01-01',
      targetName: '',
      property: 'periodStart',
    });
    expect(result).toBe(true);
  });

  it('should return true when value is missing', () => {
    const result = validator.validate(undefined as unknown as string, {
      object: { periodEnd: '2026-01-31' },
      constraints: ['periodEnd'],
      value: undefined,
      targetName: '',
      property: 'periodStart',
    });
    expect(result).toBe(true);
  });
});
