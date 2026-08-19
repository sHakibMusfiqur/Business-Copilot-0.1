import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/** System-setting keys are short, safe identifiers (e.g. `app.name`, `billing.currency`). */
const KEY_REGEX = /^[A-Za-z0-9_.-]{1,100}$/;

@Injectable()
export class ParseSettingsKeyPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (typeof value !== 'string' || !KEY_REGEX.test(value)) {
      throw new BadRequestException('Invalid settings key');
    }
    return value;
  }
}