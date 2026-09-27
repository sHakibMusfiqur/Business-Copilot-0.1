import { getMetadataStorage } from 'class-validator';

import { CreateBatchDto } from './create-batch.dto';
import { CreateInventoryTransactionDto } from './create-inventory-transaction.dto';
import { CreateOpeningStockDto } from './create-opening-stock.dto';
import { CreateSerialNumberDto } from './create-serial-number.dto';
import { CreateStockAdjustmentDto } from './create-stock-adjustment.dto';
import { CreateStockMovementDto } from './create-stock-movement.dto';
import { CreateStockReservationDto } from './create-stock-reservation.dto';
import { CreateStockDto } from './create-stock.dto';
import { CreateWarehouseTransferDto } from './create-warehouse-transfer.dto';
import { QueryBatchDto } from './query-batch.dto';
import { QueryInventoryTransactionDto } from './query-inventory-transaction.dto';
import { QueryOpeningStockDto } from './query-opening-stock.dto';
import { QuerySerialNumberDto } from './query-serial-number.dto';
import { QueryStockAdjustmentDto } from './query-stock-adjustment.dto';
import { QueryStockMovementDto } from './query-stock-movement.dto';
import { QueryStockReservationDto } from './query-stock-reservation.dto';
import { QueryStockDto } from './query-stock.dto';
import { QueryWarehouseTransferDto } from './query-warehouse-transfer.dto';
import { UpdateBatchDto } from './update-batch.dto';
import { UpdateOpeningStockDto } from './update-opening-stock.dto';
import { UpdateSerialNumberDto } from './update-serial-number.dto';
import { UpdateStockReservationDto } from './update-stock-reservation.dto';
import { UpdateStockDto } from './update-stock.dto';
import { UpdateWarehouseTransferDto } from './update-warehouse-transfer.dto';

type ClassConstructor = abstract new (...args: never[]) => unknown;

const declaredProps = (target: ClassConstructor) =>
  getMetadataStorage()
    .getTargetValidationMetadatas(target, '', false, false)
    .map((meta) => meta.propertyName);

const SERVER_MANAGED = [
  'organizationId',
  'createdById',
  'updatedById',
  'id',
  'createdAt',
  'updatedAt',
  'deletedAt',
  'createdBy',
  'updatedBy',
] as const;

const createDtos: ClassConstructor[] = [
  CreateBatchDto,
  CreateInventoryTransactionDto,
  CreateOpeningStockDto,
  CreateSerialNumberDto,
  CreateStockAdjustmentDto,
  CreateStockMovementDto,
  CreateStockReservationDto,
  CreateStockDto,
  CreateWarehouseTransferDto,
];

const updateDtos: ClassConstructor[] = [
  UpdateBatchDto,
  UpdateOpeningStockDto,
  UpdateSerialNumberDto,
  UpdateStockReservationDto,
  UpdateStockDto,
  UpdateWarehouseTransferDto,
];

const queryDtos: ClassConstructor[] = [
  QueryBatchDto,
  QueryInventoryTransactionDto,
  QueryOpeningStockDto,
  QuerySerialNumberDto,
  QueryStockAdjustmentDto,
  QueryStockMovementDto,
  QueryStockReservationDto,
  QueryStockDto,
  QueryWarehouseTransferDto,
];

const allDtos: Array<[string, ClassConstructor]> = [
  ...createDtos.map((d) => [d.name, d] as [string, ClassConstructor]),
  ...updateDtos.map((d) => [d.name, d] as [string, ClassConstructor]),
  ...queryDtos.map((d) => [d.name, d] as [string, ClassConstructor]),
];

describe('server-managed fields are never client-settable', () => {
  it('covers all 24 inventory DTOs', () => {
    expect(allDtos).toHaveLength(24);
    expect(new Set(allDtos.map(([name]) => name)).size).toBe(24);
  });

  it.each(allDtos)('%s declares no server-managed properties', (_name, Dto) => {
    const props = declaredProps(Dto);
    for (const field of SERVER_MANAGED) {
      expect(props).not.toContain(field);
    }
  });

  it('all DTOs declare at least one property (sanity against empty metadata)', () => {
    for (const [, Dto] of allDtos) {
      expect(declaredProps(Dto).length).toBeGreaterThan(0);
    }
  });

  it('create and update DTOs declare ownership-bearing input fields (sanity)', () => {
    expect(declaredProps(CreateBatchDto)).toContain('productId');
    expect(declaredProps(CreateStockDto)).toContain('warehouseId');
    expect(declaredProps(CreateWarehouseTransferDto)).toContain('sourceWarehouseId');
    expect(declaredProps(UpdateStockDto).length).toBeGreaterThan(0);
  });

  it('client-supplied organizationId is not part of any DTO shape', () => {
    for (const [, Dto] of allDtos) {
      expect(declaredProps(Dto)).not.toContain('organizationId');
    }
  });
});
