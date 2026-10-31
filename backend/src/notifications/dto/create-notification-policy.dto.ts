import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class LabelMatcherDto {
  @IsString()
  @IsNotEmpty()
  label: string;

  @IsString()
  @IsNotEmpty()
  operator: '=' | '!=' | 'contains' | 'regex' | 'in';

  @IsString()
  @IsNotEmpty()
  value: string;
}

export class CreateNotificationPolicyDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;

  @IsNumber()
  @IsOptional()
  priority?: number;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => LabelMatcherDto)
  matchers?: LabelMatcherDto[];

  @IsArray()
  @IsString({ each: true })
  contactPointIds: string[];

  @IsBoolean()
  @IsOptional()
  notifyOnFiring?: boolean;

  @IsBoolean()
  @IsOptional()
  notifyOnRecovery?: boolean;

  @IsNumber()
  @IsOptional()
  repeatInterval?: number;
}

export class UpdateNotificationPolicyDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;

  @IsNumber()
  @IsOptional()
  priority?: number;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => LabelMatcherDto)
  matchers?: LabelMatcherDto[];

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  contactPointIds?: string[];

  @IsBoolean()
  @IsOptional()
  notifyOnFiring?: boolean;

  @IsBoolean()
  @IsOptional()
  notifyOnRecovery?: boolean;

  @IsNumber()
  @IsOptional()
  repeatInterval?: number;
}

export class PreviewPolicyDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LabelMatcherDto)
  matchers: LabelMatcherDto[];

  @IsNotEmpty()
  sampleLabels: Record<string, string>;
}
