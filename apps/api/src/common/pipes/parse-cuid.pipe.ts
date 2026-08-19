import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';


const CUID_REGEX = /^c[0-9a-z]{24}$/i;

@Injectable()
export class ParseCuidPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (typeof value !== 'string' || !CUID_REGEX.test(value)) {
      throw new BadRequestException('Invalid resource id: expected a valid identifier');
    }
    return value;
  }
}