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

  // Fail-closed opt-in for local-debugging-only routes (e.g. GET /auth/users
  // — see auth.controller.ts). Must be exactly "true" to enable; unset or
  // any other value keeps the route hidden, so a misconfigured or forgotten
  // env var in a real deployment can never accidentally expose it (unlike a
  // check that only hides on NODE_ENV === 'production', which stays open by
  // default in every other environment, including a misconfigured one).
  @IsOptional()
  @IsString()
  DEBUG_ROUTES_ENABLED?: string;
}
