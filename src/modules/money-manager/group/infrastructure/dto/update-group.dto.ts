import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateGroupDto {
  @ApiPropertyOptional({ example: 'Fixed Expenses', maxLength: 50 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: 5000000,
    minimum: 1,
    nullable: true,
    description:
      'Optional maximum spending cap for this group, in cents. Omit to leave unchanged, or send null to clear it.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  budgetCents?: number | null;
}
