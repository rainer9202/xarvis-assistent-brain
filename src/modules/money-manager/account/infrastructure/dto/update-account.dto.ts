import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
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
}
