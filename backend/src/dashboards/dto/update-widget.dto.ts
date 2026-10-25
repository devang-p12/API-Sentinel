import { IsInt, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateWidgetDto {
  @IsString({ message: 'Widget title must be a string' })
  @IsOptional()
  title?: string;

  @IsString({ message: 'Metric identifier must be a string' })
  @IsOptional()
  metric?: string;

  @IsString({ message: 'Visualization type must be a string' })
  @IsOptional()
  visualizationType?: string;

  @IsObject({ message: 'Configuration must be an object' })
  @IsOptional()
  configuration?: Record<string, any>;

  @IsInt({ message: 'x coordinate must be an integer' })
  @Min(0)
  @Max(11)
  @IsOptional()
  x?: number;

  @IsInt({ message: 'y coordinate must be an integer' })
  @Min(0)
  @IsOptional()
  y?: number;

  @IsInt({ message: 'Width must be between 1 and 12 columns' })
  @Min(1)
  @Max(12)
  @IsOptional()
  width?: number;

  @IsInt({ message: 'Height must be at least 1' })
  @Min(1)
  @Max(24)
  @IsOptional()
  height?: number;
}
