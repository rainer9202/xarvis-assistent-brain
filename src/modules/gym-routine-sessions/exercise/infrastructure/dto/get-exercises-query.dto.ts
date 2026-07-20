import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class GetExercisesQueryDto {
  @ApiPropertyOptional({
    example: 'press',
    description:
      'Case-insensitive partial match filter on exercise name (own + global catalog).',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: true,
    description:
      "Filter by ownership: true returns only the caller's own custom " +
      'exercises, false returns only the global catalog. Omit to include both.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    // Anything else (e.g. "yesplease") passes through unchanged so
    // @IsBoolean() below rejects it with a 400 instead of this transform
    // silently coercing garbage input into false.
    return value;
  })
  @IsBoolean()
  isCustom?: boolean;

  @ApiPropertyOptional({
    example: 1,
    minimum: 1,
    description:
      'Page number (1-based). Providing page or limit switches the ' +
      'response into paginated mode, adding page/limit/totalCount/' +
      'totalPages/hasMore alongside data. Defaults to 1.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    example: 20,
    minimum: 1,
    maximum: 100,
    description:
      'Page size. Providing page or limit switches the response into ' +
      'paginated mode. Defaults to 20, capped at 100.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
