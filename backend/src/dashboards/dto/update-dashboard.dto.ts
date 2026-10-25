import { IsOptional, IsString } from 'class-validator';

export class UpdateDashboardDto {
  @IsString({ message: 'Dashboard name must be a string' })
  @IsOptional()
  name?: string;

  @IsString({ message: 'Description must be a string' })
  @IsOptional()
  description?: string;

  @IsOptional()
  layout?: any;
}
