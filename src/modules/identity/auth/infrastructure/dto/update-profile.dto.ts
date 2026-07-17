import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

// email/password are intentionally absent — see design.md ADR-3: the global
// ValidationPipe({ whitelist: true }) in main.ts silently strips any unknown
// keys (including email/password) instead of 400ing, which is the required
// behavior for this endpoint.
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Jane Doe' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ example: '1995-05-20' })
  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'birthDate must be in YYYY-MM-DD format',
  })
  birthDate?: string;
}
