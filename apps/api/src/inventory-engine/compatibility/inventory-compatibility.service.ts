import { Injectable } from '@nestjs/common';

import { InventoryService } from '../../inventory/inventory.service';
import type { CreateStockAdjustmentDto } from '../../inventory/dto/create-stock-adjustment.dto';
import type { QueryInventoryDto } from '../../inventory/dto/query-inventory.dto';

export type LegacyInventoryListResult = Awaited<ReturnType<InventoryService['findAll']>>;
export type LegacyInventoryAdjustResult = Awaited<ReturnType<InventoryService['adjust']>>;
export type LegacyInventorySummaryResult = Awaited<ReturnType<InventoryService['getSummary']>>;
export type LegacyInventoryHistoryResult = Awaited<ReturnType<InventoryService['getHistory']>>;


export type LegacyInventoryAdjustRequest = CreateStockAdjustmentDto;


@Injectable()
export class InventoryCompatibilityService {
  constructor(private readonly legacyInventoryService: InventoryService) {}

 
  list(organizationId: string, query: QueryInventoryDto): Promise<LegacyInventoryListResult> {
    return this.legacyInventoryService.findAll(organizationId, query);
  }

  
  adjust(
    organizationId: string,
    userId: string,
    dto: LegacyInventoryAdjustRequest,
  ): Promise<LegacyInventoryAdjustResult> {
    return this.legacyInventoryService.adjust(organizationId, userId, dto);
  }

  
  summary(organizationId: string): Promise<LegacyInventorySummaryResult> {
    return this.legacyInventoryService.getSummary(organizationId);
  }

  
  history(organizationId: string, productId: string): Promise<LegacyInventoryHistoryResult> {
    return this.legacyInventoryService.getHistory(organizationId, productId);
  }
}
