import { IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateApiDto {
  @IsString({ message: 'API name must be a string' })
  @IsOptional()
  name?: string;

  @IsString({ message: 'Description must be a string' })
  @IsOptional()
  description?: string;

  @IsString({ message: 'Service/Application identifier must be a string' })
  @IsOptional()
  service?: string;

  @IsUUID('4', { message: 'projectId must be a valid UUID' })
  @IsOptional()
  projectId?: string;
}
