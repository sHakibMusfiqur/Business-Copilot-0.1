import type { Type } from '@nestjs/common';
import { applyDecorators } from '@nestjs/common';
import { ApiOkResponse, ApiCreatedResponse, getSchemaPath } from '@nestjs/swagger';

export function ApiPaginatedResponse<TModel extends Type<object>>(model: TModel) {
  return applyDecorators(
    ApiOkResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(model) },
          {
            properties: {
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
              },
              meta: {
                type: 'object',
                properties: {
                  total: { type: 'number' },
                  page: { type: 'number' },
                  limit: { type: 'number' },
                  totalPages: { type: 'number' },
                },
              },
            },
          },
        ],
      },
    }),
  );
}

export function ApiCreatedResponseWrapper<TModel extends Type<object>>(model: TModel) {
  return applyDecorators(
    ApiCreatedResponse({
      schema: {
        properties: {
          data: { $ref: getSchemaPath(model) },
          message: { type: 'string' },
        },
      },
    }),
  );
}
