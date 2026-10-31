import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { LoadTestStatus } from '@prisma/client';

export class QueryLoadTestsDto {
  @IsString()
  @IsOptional()
  projectId?: string;

  @IsString()
  @IsOptional()
  apiId?: string;

  @IsString()
  @IsOptional()
  environmentId?: string;

  @IsEnum(LoadTestStatus)
  @IsOptional()
  status?: LoadTestStatus;

  @IsString()
  @IsOptional()
  search?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  limit?: number = 50;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  offset?: number = 0;
}
