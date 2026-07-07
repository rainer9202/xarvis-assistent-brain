import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Groceries', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @ApiProperty({ example: '3c1f2e2a-5b1b-4b3e-8b3a-2f6b1e5a9c1d' })
  @IsUUID()
  movementTypeId: string;
}
