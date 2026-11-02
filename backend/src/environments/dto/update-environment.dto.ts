import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';
import { EnvironmentType } from '@prisma/client';

export class UpdateEnvironmentDto {
  @IsString({ message: 'Environment name must be a string' })
  @IsNotEmpty({ message: 'Environment name cannot be empty' })
  @IsOptional()
  name?: string;

  @IsString({ message: 'Base URL must be a string' })
  @IsNotEmpty({ message: 'Base URL cannot be empty' })
  @IsUrl(
    { require_tld: false, require_protocol: true, protocols: ['http', 'https'] },
    {
      message:
        'baseUrl must be a valid HTTP or HTTPS URL (e.g. http://localhost:4000 or https://api.example.com)',
    },
  )
  @IsOptional()
  baseUrl?: string;

  @IsEnum(EnvironmentType, {
    message:
      'type must be one of: DEVELOPMENT, UAT, STAGING, PRODUCTION, CUSTOM',
  })
  @IsOptional()
  type?: EnvironmentType;

  @IsObject({ message: 'Variables must be an object' })
  @IsOptional()
  variables?: Record<string, any>;
}
