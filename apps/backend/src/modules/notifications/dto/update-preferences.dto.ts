import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  inAppEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  meetingAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  agreementAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  minutesAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  generalAlerts?: boolean;
}

