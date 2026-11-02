import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { AlertCondition, AlertSeverity } from '@prisma/client';

export class CreateAlertRuleDto {
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  projectId?: string;

  @IsString()
  @IsOptional()
  organizationId?: string;

  @IsString()
  @IsNotEmpty({ message: 'Metric is required' })
  metric: string; // e.g. "error rate", "P95 latency", "availability", "consecutive failures", "API DOWN", "schema change"


  @IsString()
  @IsOptional()
  operator?: string; // e.g. ">", ">=", "<", "<=", "==", "!="

  @IsString()
  @IsOptional()
  apiId?: string;

  @IsString()
  @IsOptional()
  environmentId?: string;

  @IsString()
  @IsOptional()
  monitorId?: string;

  @IsEnum(AlertCondition, {
    message: 'Condition must be GREATER_THAN, GREATER_THAN_OR_EQUAL, LESS_THAN, LESS_THAN_OR_EQUAL, EQUAL, or NOT_EQUAL',
  })
  @IsOptional()
  condition?: AlertCondition;

  @IsNumber({}, { message: 'Threshold must be a valid number' })
  threshold: number;

  @IsNumber()
  @Min(0, { message: 'Duration must be at least 0 seconds' })
  @IsOptional()
  duration?: number; // FOR duration in seconds

  @IsNumber()
  @Min(5, { message: 'Evaluation interval must be at least 5 seconds' })
  @IsOptional()
  evaluationInterval?: number; // In seconds

  @IsEnum(AlertSeverity)
  @IsOptional()
  severity?: AlertSeverity;

  @IsArray()
  @IsOptional()
  notificationChannels?: any[]; // e.g. ["EMAIL", "SLACK", "WEBHOOK"]

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

  @IsString()
  @IsOptional()
  createdBy?: string;
}
