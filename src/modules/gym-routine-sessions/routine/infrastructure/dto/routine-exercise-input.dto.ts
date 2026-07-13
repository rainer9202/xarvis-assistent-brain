import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Min } from 'class-validator';

export class RoutineExerciseInputDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsUUID()
  exerciseId: string;

  @ApiProperty({ example: 4, minimum: 1 })
  @IsInt()
  @Min(1)
  targetSets: number;

  @ApiProperty({ example: 10, minimum: 1 })
  @IsInt()
  @Min(1)
  targetReps: number;

  @ApiProperty({
    example: 20000,
    minimum: 0,
    description: 'Target weight in grams — 0 is valid for bodyweight exercises',
  })
  @IsInt()
  @Min(0)
  targetWeightGrams: number;
}
