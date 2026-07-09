import {
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

// Matches every format `app.module.ts`'s JwtModule.registerAsync factory can
// actually pass through to jsonwebtoken's `expiresIn` sign option: a plain
// integer number-of-seconds string (e.g. "3600"), or the `ms`-package
// duration shorthand jsonwebtoken accepts (e.g. "2h", "10m", "7d", "1.5h",
// optionally spaced, s/m/h/d/w/y units). A typo here previously passed boot
// validation and only surfaced as a thrown error inside jwtService.signAsync()
// on the very first real sign-up/sign-in.
const JWT_DURATION_PATTERN = /^\d+(\.\d+)?\s*(ms|s|m|h|d|w|y)?$/;

export class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsOptional()
  @IsNumberString()
  PORT?: string;

  @IsOptional()
  @IsString()
  CORS_ORIGINS?: string;

  @IsOptional()
  @IsString()
  TRUSTED_PROXIES?: string;

  @IsString()
  @IsNotEmpty()
  // A short secret makes the HS256 signature brute-forceable — 32 chars is
  // a reasonable practical floor for a symmetric JWT signing key.
  @MinLength(32)
  JWT_SECRET: string;

  @IsOptional()
  @IsString()
  @Matches(JWT_DURATION_PATTERN, {
    message:
      'JWT_EXPIRES_IN must be a plain number of seconds (e.g. "3600") or a duration string (e.g. "2h", "10m", "7d")',
  })
  JWT_EXPIRES_IN?: string;
}
