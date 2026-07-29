import { SetMetadata } from '@nestjs/common';

export const Idempotent = () => SetMetadata('idempotency', true);
