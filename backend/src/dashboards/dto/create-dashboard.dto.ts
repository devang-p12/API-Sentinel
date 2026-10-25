import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateDashboardDto {
  @IsString({ message: 'Dashboard name must be a string' })
  @IsNotEmpty({ message: 'Dashboard name is required' })
  name: string;

  @IsString({ message: 'Description must be a string' })
  @IsOptional()
  description?: string;

  @IsUUID('4', { message: 'projectId must be a valid UUID' })
  @IsOptional()
  projectId?: string;
}
