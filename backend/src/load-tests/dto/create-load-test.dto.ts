import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { HttpMethod, LoadTestMode } from '@prisma/client';

export class CreateLoadTestDto {
  @IsString()
  @IsNotEmpty({ message: 'Load test name is required' })
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty({ message: 'Project ID is required' })
  projectId: string;

  @IsString()
  @IsOptional()
  apiId?: string;

  @IsString()
  @IsOptional()
  environmentId?: string;

  @IsEnum(HttpMethod, {
    message: 'Method must be GET, POST, PUT, PATCH, or DELETE',
  })
  @IsOptional()
  method?: HttpMethod = HttpMethod.GET;

  @IsString()
  @IsNotEmpty({ message: 'Target URL or path is required' })
  url: string;

  @IsObject()
  @IsOptional()
  headers?: Record<string, string>;

  @IsObject()
  @IsOptional()
  queryParams?: Record<string, string>;

  @IsString()
  @IsOptional()
  body?: string;

  @IsObject()
  @IsOptional()
  authentication?: {
    type: 'none' | 'bearer' | 'basic' | 'apiKey';
    token?: string;
    username?: string;
    password?: string;
    key?: string;
    value?: string;
    addTo?: 'header' | 'query';
  };

  @IsNumber()
  @Min(1, { message: 'Virtual users must be at least 1' })
  @Max(500, { message: 'Virtual users cannot exceed 500' })
  @IsOptional()
  virtualUsers?: number = 10;

  @IsEnum(LoadTestMode, {
    message: 'Mode must be DURATION or REQUEST_COUNT',
  })
  @IsOptional()
  mode?: LoadTestMode = LoadTestMode.DURATION;

  @IsNumber()
  @Min(1, { message: 'Duration must be at least 1 second' })
  @Max(3600, { message: 'Duration cannot exceed 3600 seconds' })
  @IsOptional()
  duration?: number = 60;

  @IsNumber()
  @Min(1, { message: 'Request count must be at least 1' })
  @Max(1000000, { message: 'Request count cannot exceed 1,000,000' })
  @IsOptional()
  requestCount?: number;

  @IsNumber()
  @Min(1, { message: 'Timeout must be at least 1 second' })
  @Max(60, { message: 'Timeout cannot exceed 60 seconds' })
  @IsOptional()
  timeout?: number = 5;
}
