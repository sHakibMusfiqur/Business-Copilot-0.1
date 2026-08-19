import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const SUPPORTED_GATEWAYS = new Set([
  'stripe',
  'card',
  'sslcommerz',
  'bkash',
  'nagad',
  'paypal',
]);

@Injectable()
export class ParseGatewayPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (typeof value !== 'string' || !SUPPORTED_GATEWAYS.has(value)) {
      throw new BadRequestException(`Unsupported payment gateway "${value}"`);
    }
    return value;
  }
}