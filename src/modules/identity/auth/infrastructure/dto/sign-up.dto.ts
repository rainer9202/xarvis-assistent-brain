import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SignUpDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'a-strong-password' })
  @IsString()
  @MinLength(8)
  // Upper bound: argon2's hashing cost scales with input size, so an
  // unbounded password is a cheap DoS vector against argon2.hash().
  @MaxLength(128)
  password: string;

  @ApiProperty({ example: '1990-05-20' })
  @IsDateString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'birthDate must be in YYYY-MM-DD format',
  })
  birthDate: string;
}
