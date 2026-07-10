import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { MOVEMENT_TYPES } from '@domain/enums/movement-type.enum';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Groceries', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @ApiProperty({ example: 'Gasto', enum: MOVEMENT_TYPES })
  @IsIn(MOVEMENT_TYPES)
  movementType: string;
}
