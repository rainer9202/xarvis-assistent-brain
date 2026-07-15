import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsPositive } from 'class-validator';

export class UpdateBodyMetricDto {
  @ApiPropertyOptional({ example: 75000, description: 'Weight in grams' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  weightGrams?: number;

  @ApiPropertyOptional({ example: 178, description: 'Height in centimeters' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  heightCm?: number;

  @ApiPropertyOptional({ example: '2026-07-14T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  measuredAt?: string;
}
