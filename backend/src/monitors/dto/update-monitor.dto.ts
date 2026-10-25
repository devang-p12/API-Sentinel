import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { HttpMethod } from '@prisma/client';

export class UpdateMonitorDto {
  @IsString({ message: 'Monitor name must be a string' })
  @IsNotEmpty({ message: 'Monitor name cannot be empty' })
  @IsOptional()
  name?: string;

  @IsString({ message: 'Description must be a string' })
  @IsOptional()
  description?: string;

  @IsEnum(HttpMethod, {
    message: 'Method must be one of: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS',
  })
  @IsOptional()
  method?: HttpMethod;

  @IsString({ message: 'Endpoint URL path must be a string' })
  @IsOptional()
  url?: string;

  @IsString({ message: 'Endpoint path must be a string' })
  @IsOptional()
  endpoint?: string;

  @IsUUID('4', { message: 'environmentId must be a valid UUID' })
  @IsOptional()
  environmentId?: string;

  @IsInt({ message: 'Interval must be an integer' })
  @Min(5, { message: 'Interval must be at least 5 seconds' })
  @Max(86400, { message: 'Interval cannot exceed 86400 seconds' })
  @IsOptional()
  intervalSeconds?: number;

  @IsInt({ message: 'Interval must be an integer' })
  @Min(5, { message: 'Interval must be at least 5 seconds' })
  @Max(86400, { message: 'Interval cannot exceed 86400 seconds' })
  @IsOptional()
  interval?: number;

  @IsInt({ message: 'Timeout must be an integer in milliseconds' })
  @Min(500, { message: 'Timeout must be at least 500ms' })
  @Max(60000, { message: 'Timeout cannot exceed 60000ms' })
  @IsOptional()
  timeoutMs?: number;

  @IsInt({ message: 'Timeout must be an integer in seconds' })
  @Min(1, { message: 'Timeout must be at least 1 second' })
  @Max(60, { message: 'Timeout cannot exceed 60 seconds' })
  @IsOptional()
  timeout?: number;

  @IsInt({ message: 'Expected status code must be a valid HTTP status code integer' })
  @Min(100, { message: 'Expected status code must be between 100 and 599' })
  @Max(599, { message: 'Expected status code must be between 100 and 599' })
  @IsOptional()
  expectedStatusCode?: number;

  @IsInt({ message: 'Expected status code must be a valid HTTP status code integer' })
  @Min(100, { message: 'Expected status code must be between 100 and 599' })
  @Max(599, { message: 'Expected status code must be between 100 and 599' })
  @IsOptional()
  expectedStatus?: number;

  @IsBoolean({ message: 'isActive must be a boolean' })
  @IsOptional()
  isActive?: boolean;

  @IsBoolean({ message: 'enabled must be a boolean' })
  @IsOptional()
  enabled?: boolean;

  @IsObject({ message: 'Headers must be an object' })
  @IsOptional()
  headers?: Record<string, string>;

  @IsString({ message: 'Body must be a string' })
  @IsOptional()
  body?: string;

  @IsOptional()
  assertions?: any[];
}
