import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Min } from 'class-validator';

export class CreateWorkoutSessionExerciseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsUUID()
  workoutSessionId: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsUUID()
  exerciseId: string;

  @ApiProperty({ example: 3, minimum: 1 })
  @IsInt()
  @Min(1)
  actualSets: number;

  @ApiProperty({ example: 12, minimum: 1 })
  @IsInt()
  @Min(1)
  actualReps: number;

  @ApiProperty({
    example: 18000,
    minimum: 0,
    description: 'Actual weight in grams — 0 is valid for bodyweight exercises',
  })
  @IsInt()
  @Min(0)
  actualWeightGrams: number;
}
