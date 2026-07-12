import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { MOVEMENT_TYPE_CODES } from '@domain/enums/movement-type.enum';

export class GetMovementsQueryDto {
  @ApiPropertyOptional({
    example: '3c1f2e2a-5b1b-4b3e-8b3a-2f6b1e5a9c1d',
    description:
      'Filter to movements where this account is the source or destination',
  })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional({
    example: ['3c1f2e2a-5b1b-4b3e-8b3a-2f6b1e5a9c1d'],
    isArray: true,
    description:
      'Filter to movements with any of these categoryIds. Repeat the param ' +
      'for multiple (?categoryId=a&categoryId=b) or pass a single value.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? undefined : Array.isArray(value) ? value : [value],
  )
  @IsUUID('4', { each: true })
  categoryId?: string[];

  @ApiPropertyOptional({ example: 'MT01', enum: MOVEMENT_TYPE_CODES })
  @IsOptional()
  @IsIn(MOVEMENT_TYPE_CODES)
  movementType?: string;

  @ApiPropertyOptional({
    example: '3c1f2e2a-5b1b-4b3e-8b3a-2f6b1e5a9c1d',
    description: 'Filter to movements assigned to this Group',
  })
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @ApiPropertyOptional({
    example: '2026-07',
    description: 'Calendar month (YYYY-MM) to filter by, in UTC',
  })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'month must be in YYYY-MM format',
  })
  month?: string;

  @ApiPropertyOptional({
    example: false,
    description:
      'By default only movements from the last 3 calendar months are ' +
      'returned. Pass historic=true to get the full history instead. ' +
      'Ignored when month is also present (an explicit month always wins).',
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
  historic?: boolean;

  @ApiPropertyOptional({
    example: '2026-04-01T00:00:00.000Z',
    description:
      'Start of an arbitrary date range (inclusive, ISO8601). Wins over ' +
      'historic/the default 3-month window, but is ignored when month is ' +
      'also present.',
  })
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @ApiPropertyOptional({
    example: '2026-06-30T23:59:59.999Z',
    description:
      'End of an arbitrary date range (inclusive, ISO8601). Wins over ' +
      'historic/the default 3-month window, but is ignored when month is ' +
      'also present.',
  })
  @IsOptional()
  @IsISO8601()
  dateTo?: string;

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
