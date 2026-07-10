import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class GetMovementsQueryDto {
  @ApiPropertyOptional({
    example: '3c1f2e2a-5b1b-4b3e-8b3a-2f6b1e5a9c1d',
    description:
      'Filter to movements where this account is the source or destination',
  })
  @IsOptional()
  @IsUUID()
  accountId?: string;
}
