import { plainToInstance } from 'class-transformer';
import { getMetadataStorage, validate } from 'class-validator';
import { ReservationStatus } from '@prisma/client';

import { CreateStockReservationDto } from './create-stock-reservation.dto';
import { UpdateStockReservationDto } from './update-stock-reservation.dto';

type ClassConstructor = abstract new (...args: never[]) => unknown;

const declaredProps = (target: ClassConstructor) =>
  getMetadataStorage()
    .getTargetValidationMetadatas(target, '', false, false)
    .map((meta) => meta.propertyName);

describe('CreateStockReservationDto', () => {
  it('passes with required fields and defaults', async () => {
    const dto = plainToInstance(CreateStockReservationDto, { stockId: 'st1', quantity: 5 });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.status).toBe(ReservationStatus.PENDING);
    expect(dto.reservedQuantity).toBe(0);
  });

  it('fails when stockId is missing', async () => {
    const dto = plainToInstance(CreateStockReservationDto, { quantity: 5 });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'stockId')).toBeDefined();
  });

  it('rejects zero or negative quantity and negative reservedQuantity', async () => {
    const bad = plainToInstance(CreateStockReservationDto, { stockId: 'st1', quantity: 0 });
    const errors = await validate(bad);
    expect(errors.find((e) => e.property === 'quantity')).toBeDefined();

    const badReserved = plainToInstance(CreateStockReservationDto, {
      stockId: 'st1',
      quantity: 1,
      reservedQuantity: -1,
    });
    const reservedErrors = await validate(badReserved);
    expect(reservedErrors.find((e) => e.property === 'reservedQuantity')).toBeDefined();
  });

  it('fails on an invalid ReservationStatus or malformed expiresAt', async () => {
    const badStatus = plainToInstance(CreateStockReservationDto, {
      stockId: 'st1',
      quantity: 1,
      status: 'BOGUS',
    });
    expect((await validate(badStatus)).find((e) => e.property === 'status')).toBeDefined();

    const badDate = plainToInstance(CreateStockReservationDto, {
      stockId: 'st1',
      quantity: 1,
      expiresAt: 'not-a-date',
    });
    expect((await validate(badDate)).find((e) => e.property === 'expiresAt')).toBeDefined();
  });

  it('declares no organizationId or deletedAt properties', () => {
    const props = declaredProps(CreateStockReservationDto);
    expect(props).not.toContain('organizationId');
    expect(props).not.toContain('deletedAt');
  });

  it('accepts an explicit null expiresAt (clearing semantics)', async () => {
    const dto = plainToInstance(CreateStockReservationDto, {
      stockId: 'st1',
      quantity: 1,
      expiresAt: null,
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.expiresAt).toBeNull();
  });
});

describe('UpdateStockReservationDto', () => {
  it('passes with all fields optional', async () => {
    const dto = plainToInstance(UpdateStockReservationDto, {});
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts an explicit null expiresAt (clearing semantics)', async () => {
    const dto = plainToInstance(UpdateStockReservationDto, { expiresAt: null });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.expiresAt).toBeNull();
  });

  it('declares no organizationId or stockId properties', () => {
    const props = declaredProps(UpdateStockReservationDto);
    expect(props).toContain('status');
    expect(props).toContain('expiresAt');
    expect(props).not.toContain('organizationId');
    expect(props).not.toContain('stockId');
  });
});
