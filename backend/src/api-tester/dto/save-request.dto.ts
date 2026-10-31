import { HttpMethod } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsObject,
  IsArray,
} from 'class-validator';

export class SaveRequestDto {
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @IsOptional()
  @IsString()
  collectionId?: string;

  @IsOptional()
  @IsString()
  apiId?: string;

  @IsOptional()
  @IsString()
  environmentId?: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(HttpMethod)
  @IsNotEmpty()
  method: HttpMethod;

  @IsString()
  @IsNotEmpty()
  url: string;

  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @IsOptional()
  @IsObject()
  queryParams?: Record<string, any>;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  bodyType?: string;

  @IsOptional()
  @IsObject()
  auth?: Record<string, any>;

  @IsOptional()
  @IsArray()
  tests?: any[];

  @IsOptional()
  @IsNumber()
  timeout?: number;
}

export class UpdateSavedRequestDto {
  @IsOptional()
  @IsString()
  collectionId?: string;

  @IsOptional()
  @IsString()
  apiId?: string;

  @IsOptional()
  @IsString()
  environmentId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(HttpMethod)
  method?: HttpMethod;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @IsOptional()
  @IsObject()
  queryParams?: Record<string, any>;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  bodyType?: string;

  @IsOptional()
  @IsObject()
  auth?: Record<string, any>;

  @IsOptional()
  @IsArray()
  tests?: any[];

  @IsOptional()
  @IsNumber()
  timeout?: number;
}
