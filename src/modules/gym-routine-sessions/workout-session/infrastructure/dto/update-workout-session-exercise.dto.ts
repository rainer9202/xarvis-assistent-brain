import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

export class UpdateWorkoutSessionExerciseDto {
  @ApiPropertyOptional({ example: 3, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  actualSets?: number;

  @ApiPropertyOptional({ example: 12, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  actualReps?: number;

  @ApiPropertyOptional({ example: 18000, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  actualWeightGrams?: number;
}
