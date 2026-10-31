import { HttpMethod } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsObject,
  IsArray,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import {
  ApiAuth,
  ApiAssertion,
  BodyType,
} from '../interfaces/api-request-config.interface';

export class ExecuteRequestDto {
  @IsEnum(HttpMethod)
  @IsNotEmpty()
  method: HttpMethod;

  @IsString()
  @IsNotEmpty()
  url: string;

  @IsOptional()
  @IsObject()
  queryParams?: Record<string, string | number | boolean>;

  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  bodyType?: BodyType;

  @IsOptional()
  @IsObject()
  auth?: ApiAuth;

  @IsOptional()
  @IsNumber()
  @Min(500)
  @Max(60000)
  timeout?: number;

  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;

  @IsOptional()
  @IsArray()
  tests?: ApiAssertion[];

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  apiId?: string;

  @IsOptional()
  @IsString()
  environmentId?: string;

  @IsOptional()
  @IsBoolean()
  saveToHistory?: boolean;
}
