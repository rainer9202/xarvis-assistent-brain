import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
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

  @ApiPropertyOptional({
    example: 50000000,
    minimum: 1,
    description:
      'Required for Crédito (AT03) accounts; not allowed for any other type',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  creditLimitCents?: number;
}
