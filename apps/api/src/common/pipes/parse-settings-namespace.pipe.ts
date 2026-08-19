import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const VALID_NAMESPACES = new Set([
  'branding',
  'tax',
  'email',
  'billing',
  'preferences',
  'notifications',
]);

@Injectable()
export class ParseSettingsNamespacePipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (typeof value !== 'string' || !VALID_NAMESPACES.has(value)) {
      throw new BadRequestException(`Unknown settings namespace "${value}"`);
    }
    return value;
  }
}