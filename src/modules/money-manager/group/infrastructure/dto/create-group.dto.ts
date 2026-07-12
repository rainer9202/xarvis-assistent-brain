import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateGroupDto {
  @ApiProperty({ example: 'Fixed Expenses', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @ApiPropertyOptional({
    example: 5000000,
    minimum: 1,
    description: 'Optional maximum spending cap for this group, in cents',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  budgetCents?: number;
}
