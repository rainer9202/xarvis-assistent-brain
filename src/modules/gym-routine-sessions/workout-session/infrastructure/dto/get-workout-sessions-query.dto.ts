import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GetWorkoutSessionsQueryDto {
  @ApiPropertyOptional({
    example: 1,
    minimum: 1,
    description:
      'Page number (1-based). Providing page or limit switches the ' +
      'response into paginated mode, adding page/limit/totalCount/' +
      'totalPages/hasMore alongside data. Defaults to 1.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    example: 20,
    minimum: 1,
    maximum: 100,
    description:
      'Page size. Providing page or limit switches the response into ' +
      'paginated mode. Defaults to 20, capped at 100.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
