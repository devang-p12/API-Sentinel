import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AlertSeverity, AlertState } from '@prisma/client';

export class QueryAlertsDto {
  @IsString()
  @IsOptional()
  projectId?: string;

  @IsString()
  @IsOptional()
  apiId?: string;

  @IsString()
  @IsOptional()
  environmentId?: string;

  @IsString()
  @IsOptional()
  monitorId?: string;

  @IsString()
  @IsOptional()
  alertRuleId?: string;

  @IsEnum(AlertState)
  @IsOptional()
  status?: AlertState;

  @IsEnum(AlertSeverity)
  @IsOptional()
  severity?: AlertSeverity;

  @IsString()
  @IsOptional()
  from?: string;

  @IsString()
  @IsOptional()
  to?: string;

  @IsString()
  @IsOptional()
  limit?: string;

  @IsString()
  @IsOptional()
  offset?: string;
}
