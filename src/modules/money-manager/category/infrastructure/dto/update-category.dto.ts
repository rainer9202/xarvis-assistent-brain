import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { MOVEMENT_TYPE_CODES } from '@domain/enums/movement-type.enum';

export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: 'Groceries', maxLength: 50 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({ example: 'MT01', enum: MOVEMENT_TYPE_CODES })
  @IsOptional()
  @IsIn(MOVEMENT_TYPE_CODES)
  movementType?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
