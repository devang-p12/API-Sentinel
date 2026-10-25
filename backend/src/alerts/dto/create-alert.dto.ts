import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { AlertSeverity } from '@prisma/client';

export class CreateAlertDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsUUID()
  @IsNotEmpty()
  monitorId: string;

  @IsEnum(AlertSeverity)
  @IsOptional()
  severity?: AlertSeverity = AlertSeverity.WARNING;

  @IsInt()
  @Min(1)
  @IsOptional()
  consecutiveFailures?: number = 2;

  @IsInt()
  @Min(100)
  @IsOptional()
  latencyThresholdMs?: number;

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean = true;
}
