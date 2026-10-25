import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNotEmpty, IsString, Max, Min, ValidateNested } from 'class-validator';

export class WidgetLayoutItemDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsInt()
  @Min(0)
  @Max(11)
  x: number;

  @IsInt()
  @Min(0)
  y: number;

  @IsInt()
  @Min(1)
  @Max(12)
  width: number;

  @IsInt()
  @Min(1)
  height: number;
}

export class UpdateLayoutDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WidgetLayoutItemDto)
  layout: WidgetLayoutItemDto[];
}
