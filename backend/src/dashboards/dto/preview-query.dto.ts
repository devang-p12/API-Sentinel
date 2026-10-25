import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class PreviewQueryDto {
  @IsString({ message: 'Metric identifier must be a string' })
  @IsNotEmpty({ message: 'Metric is required' })
  metric: string;

  @IsObject()
  @IsOptional()
  filters?: {
    projectId?: string;
    apiId?: string;
    environmentId?: string;
    monitorId?: string;
  };

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
  projectId?: string;

  @IsString()
  @IsOptional()
  organizationId?: string;

  @IsString()
  @IsOptional()
  aggregation?: string;

  @IsString()
  @IsOptional()
  groupBy?: string;

  @IsString()
  @IsOptional()
  timeRange?: string; // "15m", "1h", "6h", "24h", "7d", "30d"

  @IsString()
  @IsOptional()
  from?: string;

  @IsString()
  @IsOptional()
  to?: string;
}
