import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

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

  @ApiPropertyOptional({ example: '3c1f2e2a-5b1b-4b3e-8b3a-2f6b1e5a9c1d' })
  @IsOptional()
  @IsUUID()
  movementTypeId?: string;

  @ApiPropertyOptional({
    example: '3c1f2e2a-5b1b-4b3e-8b3a-2f6b1e5a9c1d',
    description: 'Required when movementTypeId refers to a transfer',
  })
  @IsOptional()
  @IsUUID()
  toAccountId?: string;
}
