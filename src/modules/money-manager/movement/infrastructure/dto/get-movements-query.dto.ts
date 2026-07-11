import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsUUID, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
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
}
