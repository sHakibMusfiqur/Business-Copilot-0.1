import { Module } from '@nestjs/common';
import { TenantScopeService } from './tenant-scope.service';

@Module({
  providers: [TenantScopeService],
  exports: [TenantScopeService],
})
export class TenantScopeModule {}