import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateExerciseDto {
  @ApiPropertyOptional({ example: 'Custom Bicep Curl', maxLength: 100 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'upper arms', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional({ example: 'upper arms', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  bodyPart?: string;

  @ApiPropertyOptional({ example: 'dumbbell', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  equipment?: string;

  @ApiPropertyOptional({ example: 'biceps', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  target?: string;

  @ApiPropertyOptional({ example: 'biceps brachii', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  muscleGroup?: string;
}
