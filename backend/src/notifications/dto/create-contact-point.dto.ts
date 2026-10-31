import { IsString, IsNotEmpty, IsEnum, IsObject, IsBoolean, IsOptional } from 'class-validator';
import { ContactPointType } from '@prisma/client';

export class CreateContactPointDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(ContactPointType)
  type: ContactPointType;

  @IsObject()
  @IsNotEmpty()
  configuration: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;
}

export class UpdateContactPointDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(ContactPointType)
  @IsOptional()
  type?: ContactPointType;

  @IsObject()
  @IsOptional()
  configuration?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;
}
