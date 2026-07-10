import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { MOVEMENT_TYPES } from '@domain/enums/movement-type.enum';

export class UpdateMovementDto {
  @ApiPropertyOptional({ example: 1500, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  amountCents?: number;

  @ApiPropertyOptional({ example: '2024-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  date?: string;

  @ApiPropertyOptional({ example: 'Weekly groceries', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;

  @ApiPropertyOptional({ example: '3c1f2e2a-5b1b-4b3e-8b3a-2f6b1e5a9c1d' })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional({ example: '3c1f2e2a-5b1b-4b3e-8b3a-2f6b1e5a9c1d' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ example: 'Gasto', enum: MOVEMENT_TYPES })
  @IsOptional()
  @IsIn(MOVEMENT_TYPES)
  movementType?: string;

  @ApiPropertyOptional({
    example: '3c1f2e2a-5b1b-4b3e-8b3a-2f6b1e5a9c1d',
    description: 'Required when movementType refers to a transfer',
  })
  @IsOptional()
  @IsUUID()
  toAccountId?: string;
}
