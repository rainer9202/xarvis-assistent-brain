import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export const ACCOUNT_TYPES = ['cash', 'bank', 'card'] as const;

export class CreateAccountDto {
  @ApiProperty({ example: 'Main Checking', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @ApiProperty({ example: 'bank', enum: ACCOUNT_TYPES })
  @IsIn(ACCOUNT_TYPES)
  type: string;
}
