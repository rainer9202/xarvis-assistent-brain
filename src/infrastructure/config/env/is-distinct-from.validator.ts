import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

// Security fix from the gate-approved design (see design.md's
// "token-confusion defense in depth" ADR): boot-time proof that
// REFRESH_JWT_SECRET can never equal JWT_SECRET, closing the case where a
// leaked refresh token would validate as an access token against every
// protected route (see JwtAuthGuard's payload.type check for the runtime
// half of this defense-in-depth pair). Implemented the same way every other
// env invariant in this file is — a class-validator property decorator
// validated through validateSync() in validateEnv() — rather than a
// hand-rolled assertion in main.ts.
@ValidatorConstraint({ name: 'IsDistinctFrom', async: false })
class IsDistinctFromConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const [relatedPropertyName] = args.constraints as [string];
    const relatedValue = (args.object as Record<string, unknown>)[
      relatedPropertyName
    ];
    return value !== relatedValue;
  }

  defaultMessage(args: ValidationArguments): string {
    const [relatedPropertyName] = args.constraints as [string];
    return `${args.property} must be distinct from ${relatedPropertyName}`;
  }
}

export function IsDistinctFrom(
  property: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [property],
      validator: IsDistinctFromConstraint,
    });
  };
}
