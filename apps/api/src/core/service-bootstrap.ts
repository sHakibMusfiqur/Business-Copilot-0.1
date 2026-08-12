import { Injectable } from '@nestjs/common';

import { ConfigService } from '../config/config.service';
import { RedisService } from '../infrastructure/redis/redis.service';

import { KernelService } from './kernel.service';



@Injectable()
export class ServiceBootstrapper {
  constructor(
    private readonly kernel: KernelService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  registerInfrastructureServices(): void {
    if (!this.kernel.hasService('config')) {
      this.kernel.registerService('config', this.config);
    }
    if (!this.kernel.hasService('redis')) {
      this.kernel.registerService('redis', this.redis);
    }
  }
}