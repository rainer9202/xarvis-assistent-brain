import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { RoutineExerciseInputDto } from './routine-exercise-input.dto';

export class UpdateRoutineDto {
  @ApiPropertyOptional({ example: 'Pecho', maxLength: 50 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // No @ArrayMinSize(1) here — an empty array is a legal "clear all
  // exercises" update, unlike create where at least 1 exercise is required.
  @ApiPropertyOptional({ type: [RoutineExerciseInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoutineExerciseInputDto)
  exercises?: RoutineExerciseInputDto[];
}
