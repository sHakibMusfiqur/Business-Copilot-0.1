import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { LoginDto } from '../auth/dto/login.dto';
import { ConfigService } from '../config/config.service';
import { Public } from '../common/decorators/public.decorator';
import { AuthThrottleGuard } from '../common/guards/auth-throttle.guard';

import { AdminAuthService } from './admin-auth.service';


@ApiTags('Platform Admin Auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly adminAuthService: AdminAuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @UseGuards(AuthThrottleGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ description: 'Platform admin login successful' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials or not a platform administrator' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
    @Req() request: Request,
  ) {
    const ip = request.ip ?? '';
    const userAgent = request.headers['user-agent'] ?? '';
    const result = await this.adminAuthService.login(dto, ip, userAgent);
    this.setRefreshTokenCookie(response, result.refreshToken);
    this.setAccessTokenCookie(response, result.accessToken);
    return result;
  }

  private setRefreshTokenCookie(response: Response, refreshToken: string): void {
    response.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: this.config.isProduction,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  private setAccessTokenCookie(response: Response, token: string): void {
    response.cookie('access_token', token, {
      httpOnly: true,
      secure: this.config.isProduction,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });
  }
}
