import { IsBooleanString, IsOptional, IsString } from 'class-validator';

export class QueryAlertRulesDto {
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
  metric?: string;

  @IsBooleanString()
  @IsOptional()
  enabled?: string;
}
