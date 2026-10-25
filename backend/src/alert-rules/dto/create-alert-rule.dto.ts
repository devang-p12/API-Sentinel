import {
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
  @IsNotEmpty({ message: 'Project ID is required' })
  projectId: string;

  @IsString()
  @IsNotEmpty({ message: 'Metric is required' })
  metric: string; // e.g. "p95_latency", "error_rate", "availability"

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
  condition: AlertCondition;

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

  @IsObject()
  @IsOptional()
  labels?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsString()
  @IsOptional()
  createdBy?: string;
}
