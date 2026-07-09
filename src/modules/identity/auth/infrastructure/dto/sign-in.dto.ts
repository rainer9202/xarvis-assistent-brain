import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class SignInDto {
  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'a-strong-password' })
  @IsString()
  @MinLength(8)
  // Upper bound: argon2's hashing cost scales with input size, so an
  // unbounded password is a cheap DoS vector against argon2.verify().
  @MaxLength(128)
  password: string;
}
