import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { MOVEMENT_TYPES } from '@domain/enums/movement-type.enum';

export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: 'Groceries', maxLength: 50 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({ example: 'Gasto', enum: MOVEMENT_TYPES })
  @IsOptional()
  @IsIn(MOVEMENT_TYPES)
  movementType?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
