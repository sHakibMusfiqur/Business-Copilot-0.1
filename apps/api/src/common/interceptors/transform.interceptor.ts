import type {
  NestInterceptor,
  ExecutionContext,
  CallHandler} from '@nestjs/common';
import {
  Injectable
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface SuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, SuccessResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<SuccessResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === 'object' && 'meta' in (data as Record<string, unknown>)) {
          const { meta, ...rest } = data as { meta?: SuccessResponse<T>['meta'] } & Record<string, unknown>;
          return {
            success: true,
            data: rest.data ?? rest,
            ...(meta ? { meta } : {}),
          } as SuccessResponse<T>;
        }

        return {
          success: true,
          data,
        } as SuccessResponse<T>;
      }),
    );
  }
}
