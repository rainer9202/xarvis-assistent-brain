import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { MOVEMENT_TYPE_CODES } from '@domain/enums/movement-type.enum';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Groceries', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @ApiProperty({
    example: 'cart-outline',
    maxLength: 50,
    description: 'Ionicons icon name (e.g. "cart-outline", "home-outline")',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  icon: string;

  @ApiProperty({ example: 'MT01', enum: MOVEMENT_TYPE_CODES })
  @IsIn(MOVEMENT_TYPE_CODES)
  movementType: string;
}
