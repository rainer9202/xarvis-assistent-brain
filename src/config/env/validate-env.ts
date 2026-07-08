import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { EnvironmentVariables } from './environment-variables';

/**
 * Fail-fast env validation, run as the very first line of `bootstrap()` in
 * `main.ts` — before Nest's own error handling exists, so failures here
 * `process.exit(1)` instead of throwing.
 */
export function validateEnv(): void {
  const environmentVariables = plainToInstance(
    EnvironmentVariables,
    process.env,
    { enableImplicitConversion: true },
  );

  const errors = validateSync(environmentVariables, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    console.error('Invalid environment variables:');
    for (const error of errors) {
      const constraints = error.constraints
        ? Object.values(error.constraints)
        : ['unknown constraint violation'];
      for (const constraint of constraints) {
        console.error(`  - ${error.property}: ${constraint}`);
      }
    }
    process.exit(1);
  }
}
