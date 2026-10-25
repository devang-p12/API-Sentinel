import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateApiDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  @IsNotEmpty()
  projectId: string;
}
