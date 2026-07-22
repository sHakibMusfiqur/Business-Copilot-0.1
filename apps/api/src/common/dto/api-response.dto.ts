import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiSuccessResponse<T = unknown> {
  @ApiProperty({ default: true })
  success!: boolean;

  @ApiProperty()
  data!: T;

  @ApiPropertyOptional()
  message?: string;
}

export class ApiErrorResponse {
  @ApiProperty({ default: false })
  success!: boolean;

  @ApiProperty()
  statusCode!: number;

  @ApiProperty()
  message!: string | string[];

  @ApiProperty()
  error!: string;

  @ApiProperty()
  timestamp!: string;

  @ApiProperty()
  path!: string;
}

export class ApiPaginatedResponseDto<T = unknown> {
  @ApiProperty({ default: true })
  success!: boolean;

  @ApiProperty()
  data!: T[];

  @ApiProperty()
  meta!: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
