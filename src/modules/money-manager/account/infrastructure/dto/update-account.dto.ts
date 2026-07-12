import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ACCOUNT_TYPE_CODES } from '../../domain/enums/account-type.enum';

export class UpdateAccountDto {
  @ApiPropertyOptional({ example: 'Main Checking', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({ example: 'AT02', enum: ACCOUNT_TYPE_CODES })
  @IsOptional()
  @IsIn(ACCOUNT_TYPE_CODES)
  type?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPrincipal?: boolean;

  @ApiPropertyOptional({
    example: 50000000,
    minimum: 1,
    nullable: true,
    description:
      'Required for Crédito (AT03) accounts; not allowed for any other type. Pass null to clear an existing limit.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  creditLimitCents?: number | null;
}
