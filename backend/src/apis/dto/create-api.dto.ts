import { IsNotEmpty, IsOptional, IsString, IsUUID, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateEnvironmentDto } from '../../environments/dto/create-environment.dto';

export class CreateApiDto {
  @IsString({ message: 'API name must be a string' })
  @IsNotEmpty({ message: 'API name is required' })
  name: string;

  @IsString({ message: 'Description must be a string' })
  @IsOptional()
  description?: string;

  @IsString({ message: 'Service/Application identifier must be a string' })
  @IsOptional()
  service?: string;

  @IsUUID('4', { message: 'projectId must be a valid UUID' })
  @IsOptional()
  projectId?: string;

  @IsArray({ message: 'Environments must be an array' })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateEnvironmentDto)
  environments?: CreateEnvironmentDto[];
}
