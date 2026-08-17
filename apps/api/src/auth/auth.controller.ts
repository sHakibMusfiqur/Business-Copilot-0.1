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

import { ConfigService } from '../config/config.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthThrottleGuard } from '../common/guards/auth-throttle.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerifyEmailCodeDto } from './dto/verify-email-code.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @UseGuards(AuthThrottleGuard)
  @Post('register')
  @ApiBody({ type: RegisterDto })
  @ApiCreatedResponse({ description: 'User successfully registered' })
  @ApiConflictResponse({ description: 'Email already registered' })
  @ApiTooManyRequestsResponse({ description: 'Too many registration attempts' })
  async register(
    @Body() dto: RegisterDto,
    @Req() request: Request,
  ) {
    const ip = request.ip ?? '';
    const userAgent = request.headers['user-agent'] ?? '';
    // Registration never issues tokens or creates an authenticated session: the
    // new account is unverified until it proves email ownership.
    return this.authService.register(dto, ip, userAgent);
  }

  @Public()
  @UseGuards(AuthThrottleGuard)
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiBody({
    schema: {
      type: 'object',
      properties: { token: { type: 'string' } },
    },
  })
  @ApiOkResponse({ description: 'Email verified successfully' })
  @ApiTooManyRequestsResponse({ description: 'Too many verification attempts' })
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Req() request: Request,
  ) {
    const ip = request.ip ?? '';
    const userAgent = request.headers['user-agent'] ?? '';
    return this.authService.verifyEmail(dto.token, ip, userAgent);
  }

  @Public()
  @UseGuards(AuthThrottleGuard)
  @Post('verify-email/code')
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: VerifyEmailCodeDto })
  @ApiOkResponse({ description: 'Email verified; authenticated session established' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired verification code' })
  @ApiTooManyRequestsResponse({ description: 'Too many verification attempts' })
  async verifyEmailByCode(
    @Body() dto: VerifyEmailCodeDto,
    @Res({ passthrough: true }) response: Response,
    @Req() request: Request,
  ) {
    const ip = request.ip ?? '';
    const userAgent = request.headers['user-agent'] ?? '';
    // A correct code proves email ownership, so this is the first legitimate
    // point to mint an authenticated session (tokens only exist AFTER the email
    // is verified — never at registration). Cookies are set so onboarding can
    // continue seamlessly to the next step.
    const result = await this.authService.verifyEmailByCode(dto, ip, userAgent);
    this.setRefreshTokenCookie(response, result.refreshToken);
    this.setAccessTokenCookie(response, result.accessToken);
    return result;
  }

  @Public()
  @UseGuards(AuthThrottleGuard)
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: ResendVerificationDto })
  @ApiOkResponse({ description: 'If the email exists, a verification link has been sent' })
  @ApiTooManyRequestsResponse({ description: 'Too many resend attempts' })
  async resendVerification(
    @Body() dto: ResendVerificationDto,
    @Req() request: Request,
  ) {
    const ip = request.ip ?? '';
    const userAgent = request.headers['user-agent'] ?? '';
    return this.authService.resendVerificationEmail(dto.email, ip, userAgent);
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
  @ApiBody({ type: ForgotPasswordDto })
  @ApiOkResponse({ description: 'If the email exists, a reset link has been sent' })
  @ApiTooManyRequestsResponse({ description: 'Too many forgot-password attempts' })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() request: Request,
  ) {
    const ip = request.ip ?? '';
    const userAgent = request.headers['user-agent'] ?? '';
    await this.authService.forgotPassword(dto.email, ip, userAgent);
    return { message: 'If the email exists, a reset link has been sent' };
  }

  @Public()
  @UseGuards(AuthThrottleGuard)
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: ResetPasswordDto })
  @ApiOkResponse({ description: 'Password reset successfully' })
  @ApiTooManyRequestsResponse({ description: 'Too many reset attempts' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() request: Request,
  ) {
    const ip = request.ip ?? '';
    const userAgent = request.headers['user-agent'] ?? '';
    return this.authService.resetPassword(dto.token, dto.password, ip, userAgent);
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
      secure: this.config.isProduction,
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
