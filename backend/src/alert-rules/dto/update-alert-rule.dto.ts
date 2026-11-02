import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { AlertCondition, AlertSeverity } from '@prisma/client';

export class UpdateAlertRuleDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  projectId?: string;

  @IsString()
  @IsOptional()
  metric?: string;

  @IsString()
  @IsOptional()
  operator?: string;

  @IsString()
  @IsOptional()
  apiId?: string;

  @IsString()
  @IsOptional()
  environmentId?: string;

  @IsString()
  @IsOptional()
  monitorId?: string;

  @IsEnum(AlertCondition)
  @IsOptional()
  condition?: AlertCondition;

  @IsNumber()
  @IsOptional()
  threshold?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  duration?: number;

  @IsNumber()
  @Min(5)
  @IsOptional()
  evaluationInterval?: number;

  @IsEnum(AlertSeverity)
  @IsOptional()
  severity?: AlertSeverity;

  @IsArray()
  @IsOptional()
  notificationChannels?: any[];

  @IsNumber()
  @Min(0)
  @IsOptional()
  cooldownSeconds?: number;

  @IsObject()
  @IsOptional()
  labels?: Record<string, any>;

  @IsObject()
  @IsOptional()
  notificationConfig?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}
