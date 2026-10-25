import { IsNotEmpty, IsObject, IsOptional, IsString, IsUrl, IsUUID } from 'class-validator';

export class CreateEnvironmentDto {
  @IsString({ message: 'Environment name must be a string' })
  @IsNotEmpty({ message: 'Environment name is required' })
  name: string;

  @IsString({ message: 'Base URL must be a string' })
  @IsNotEmpty({ message: 'Base URL is required' })
  @IsUrl(
    { require_tld: false, require_protocol: true, protocols: ['http', 'https'] },
    { message: 'baseUrl must be a valid HTTP or HTTPS URL (e.g. http://localhost:4000 or https://api.example.com)' },
  )
  baseUrl: string;

  @IsObject({ message: 'Variables must be an object' })
  @IsOptional()
  variables?: Record<string, any>;

  @IsUUID('4', { message: 'apiId must be a valid UUID' })
  @IsOptional()
  apiId?: string;
}
