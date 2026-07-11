import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ACCOUNT_TYPE_CODES } from '../../domain/enums/account-type.enum';

export class CreateAccountDto {
  @ApiProperty({ example: 'Main Checking', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @ApiProperty({ example: 'AT02', enum: ACCOUNT_TYPE_CODES })
  @IsIn(ACCOUNT_TYPE_CODES)
  type: string;
}
