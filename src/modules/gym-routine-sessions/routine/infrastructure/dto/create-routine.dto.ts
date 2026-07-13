import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { RoutineExerciseInputDto } from './routine-exercise-input.dto';

export class CreateRoutineDto {
  @ApiProperty({ example: 'Pecho', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @ApiProperty({ type: [RoutineExerciseInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RoutineExerciseInputDto)
  exercises: RoutineExerciseInputDto[];
}
