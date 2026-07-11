import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
import { MOVEMENT_TYPE_CODES } from '@domain/enums/movement-type.enum';

export class CreateMovementDto {
  @ApiProperty({ example: 1500, minimum: 1 })
  @IsInt()
  @Min(1)
  amountCents: number;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  @IsISO8601()
  date: string;

  @ApiPropertyOptional({ example: 'Weekly groceries', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;

  @ApiProperty({ example: '3c1f2e2a-5b1b-4b3e-8b3a-2f6b1e5a9c1d' })
  @IsUUID()
  accountId: string;

  @ApiProperty({ example: '3c1f2e2a-5b1b-4b3e-8b3a-2f6b1e5a9c1d' })
  @IsUUID()
  categoryId: string;

  @ApiProperty({ example: 'MT01', enum: MOVEMENT_TYPE_CODES })
  @IsIn(MOVEMENT_TYPE_CODES)
  movementType: string;

  @ApiPropertyOptional({
    example: '3c1f2e2a-5b1b-4b3e-8b3a-2f6b1e5a9c1d',
    description: 'Required when movementType refers to a transfer',
  })
  @IsOptional()
  @IsUUID()
  toAccountId?: string;

  @ApiPropertyOptional({
    example: '3c1f2e2a-5b1b-4b3e-8b3a-2f6b1e5a9c1d',
    description: 'Optional Group this movement belongs to',
  })
  @IsOptional()
  @IsUUID()
  groupId?: string;
}
