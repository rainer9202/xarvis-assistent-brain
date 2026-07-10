import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID, Matches } from 'class-validator';
import { MOVEMENT_TYPES } from '@domain/enums/movement-type.enum';

export class GetMovementsQueryDto {
  @ApiPropertyOptional({
    example: '3c1f2e2a-5b1b-4b3e-8b3a-2f6b1e5a9c1d',
    description:
      'Filter to movements where this account is the source or destination',
  })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional({ example: 'Gasto', enum: MOVEMENT_TYPES })
  @IsOptional()
  @IsIn(MOVEMENT_TYPES)
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
}
