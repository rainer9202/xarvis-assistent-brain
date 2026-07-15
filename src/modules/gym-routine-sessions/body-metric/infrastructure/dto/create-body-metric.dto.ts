import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsPositive } from 'class-validator';

export class CreateBodyMetricDto {
  @ApiProperty({ example: 75000, description: 'Weight in grams' })
  @IsInt()
  @IsPositive()
  weightGrams: number;

  @ApiProperty({ example: 178, description: 'Height in centimeters' })
  @IsInt()
  @IsPositive()
  heightCm: number;

  @ApiPropertyOptional({
    example: '2026-07-14T10:00:00.000Z',
    description: 'Defaults to now if omitted',
  })
  @IsOptional()
  @IsDateString()
  measuredAt?: string;
}
