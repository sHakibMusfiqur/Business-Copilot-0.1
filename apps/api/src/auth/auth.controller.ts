import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiConflictResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthThrottleGuard } from '../common/guards/auth-throttle.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(AuthThrottleGuard)
  @Post('register')
  @ApiBody({ type: RegisterDto })
  @ApiCreatedResponse({ description: 'User successfully registered' })
  @ApiConflictResponse({ description: 'Email already registered' })
  @ApiTooManyRequestsResponse({ description: 'Too many registration attempts' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
    @Req() request: Request,
  ) {
    this.logger.log(`=== REGISTER CONTROLLER ENTERED: email=${dto.email} name=${dto.name} ip=${request.ip} ===`);
    const ip = request.ip ?? '';
    const userAgent = request.headers['user-agent'] ?? '';
    try {
      const result = await this.authService.register(dto, ip, userAgent);
      this.logger.log(`=== REGISTER CONTROLLER SERVICE RETURNED SUCCESSFULLY ===`);
      this.setRefreshTokenCookie(response, result.refreshToken);
      this.setAccessTokenCookie(response, result.accessToken);
      this.logger.log(`=== REGISTER CONTROLLER COOKIES SET, RETURNING RESPONSE ===`);
      return result;
    } catch (err: unknown) {
      this.logger.error(`=== REGISTER CONTROLLER CAUGHT EXCEPTION ===`);
      this.logger.error(`error=${err instanceof Error ? err.message : String(err)}`);
      if (err instanceof Error) {
        this.logger.error(`stack=${err.stack}`);
      }
      throw err;
    }
  }

  @Public()
  @UseGuards(AuthThrottleGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ description: 'Login successful' })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  @ApiTooManyRequestsResponse({ description: 'Too many login attempts' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
    @Req() request: Request,
  ) {
    const ip = request.ip ?? '';
    const userAgent = request.headers['user-agent'] ?? '';
    const result = await this.authService.login(dto, ip, userAgent);
    this.setRefreshTokenCookie(response, result.refreshToken);
    this.setAccessTokenCookie(response, result.accessToken);
    return result;
  }

  @Public()
  @UseGuards(AuthThrottleGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiBody({
    schema: {
      type: 'object',
      properties: { refreshToken: { type: 'string' } },
    },
  })
  @ApiOkResponse({ description: 'Token refreshed successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired refresh token' })
  @ApiTooManyRequestsResponse({ description: 'Too many refresh attempts' })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = request.cookies?.refresh_token ?? request.body?.refreshToken;
    const ip = request.ip ?? '';
    const userAgent = request.headers['user-agent'] ?? '';

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not provided');
    }

    const result = await this.authService.refreshToken(refreshToken, ip, userAgent);
    this.setRefreshTokenCookie(response, result.refreshToken);
    this.setAccessTokenCookie(response, result.accessToken);
    return result;
  }

  @Public()
  @UseGuards(AuthThrottleGuard)
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiBody({
    schema: {
      type: 'object',
      properties: { email: { type: 'string', format: 'email' } },
    },
  })
  @ApiOkResponse({ description: 'If the email exists, a reset link has been sent' })
  @ApiTooManyRequestsResponse({ description: 'Too many forgot-password attempts' })
  async forgotPassword(
    @Body('email') email: string,
    @Req() request: Request,
  ) {
    const ip = request.ip ?? '';
    const userAgent = request.headers['user-agent'] ?? '';
    await this.authService.forgotPassword(email, ip, userAgent);
    return { message: 'If the email exists, a reset link has been sent' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'Logged out successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  async logout(
    @CurrentUser() user: CurrentUserPayload,
    @Res({ passthrough: true }) response: Response,
    @Req() request: Request,
  ) {
    const ip = request.ip ?? '';
    const userAgent = request.headers['user-agent'] ?? '';
    await this.authService.logout(user.id, ip, userAgent);
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: '/',
    };
    response.clearCookie('refresh_token', cookieOptions);
    response.clearCookie('access_token', cookieOptions);
    return { message: 'Logged out successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'Profile retrieved successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  async getProfile(@CurrentUser() user: CurrentUserPayload) {
    return this.authService.getProfile(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'Current user retrieved successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  async getMe(@CurrentUser() user: CurrentUserPayload) {
    return this.authService.getProfile(user.id);
  }

  private setRefreshTokenCookie(response: Response, refreshToken: string): void {
    response.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  private setAccessTokenCookie(response: Response, token: string): void {
    response.cookie('access_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });
  }
}
