import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { isEmail } from 'class-validator';

const EMAIL_MAX_LENGTH = 254;

@Injectable()
export class ParseEmailParamPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (typeof value !== 'string' || value.length > EMAIL_MAX_LENGTH || !isEmail(value)) {
      throw new BadRequestException('Invalid email address');
    }
    return value;
  }
}