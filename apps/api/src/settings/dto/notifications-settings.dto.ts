import { IsBoolean, IsOptional } from 'class-validator';

export class NotificationsSettingsDto {
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  inAppNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  weeklyDigest?: boolean;

  @IsOptional()
  @IsBoolean()
  loginAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  featureAnnouncements?: boolean;

  @IsOptional()
  @IsBoolean()
  securityAlerts?: boolean;
}
