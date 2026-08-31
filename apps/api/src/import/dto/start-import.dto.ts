import { IsString, IsBoolean, IsNumber, IsIn, Min, Max } from 'class-validator';

const VALID_IMPORT_TYPES = ['customers', 'products', 'suppliers', 'inventory', 'chart-of-accounts'] as const;
const VALID_FILE_FORMATS = ['CSV', 'XLSX', 'XLS'] as const;
const VALID_DELIMITERS = ['Comma', 'Tab', 'Semicolon'] as const;

export class StartImportDto {
  @IsString()
  @IsIn(VALID_IMPORT_TYPES, { message: `importType must be one of: ${VALID_IMPORT_TYPES.join(', ')}` })
  importType!: string;

  @IsString()
  @IsIn(VALID_FILE_FORMATS, { message: `fileFormat must be one of: ${VALID_FILE_FORMATS.join(', ')}` })
  fileFormat!: string;

  @IsString()
  @IsIn(VALID_DELIMITERS, { message: `delimiter must be one of: ${VALID_DELIMITERS.join(', ')}` })
  delimiter!: string;

  @IsBoolean()
  skipFirstRow!: boolean;

  @IsBoolean()
  updateExisting!: boolean;

  @IsString()
  fileName!: string;

  @IsNumber()
  @Min(1)
  @Max(50 * 1024 * 1024, { message: 'File size must not exceed 50MB' })
  fileSize!: number;
}
