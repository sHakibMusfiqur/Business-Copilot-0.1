import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/** URL-friendly slug: lower-case alphanumeric segments joined by `-`. */
const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SLUG_MAX_LENGTH = 64;

@Injectable()
export class ParseSlugPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (
      typeof value !== 'string' ||
      value.length > SLUG_MAX_LENGTH ||
      !SLUG_REGEX.test(value)
    ) {
      throw new BadRequestException('Invalid slug');
    }
    return value;
  }
}