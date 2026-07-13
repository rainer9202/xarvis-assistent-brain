import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsUUID } from 'class-validator';

export class CreateWorkoutSessionDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsUUID()
  routineId: string;

  @ApiProperty({ example: '2024-01-01T10:00:00.000Z' })
  @IsISO8601()
  date: string;
}
