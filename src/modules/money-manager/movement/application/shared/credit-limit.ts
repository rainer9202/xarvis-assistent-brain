import { ValidationException } from '@domain/exceptions/domain.exception';

// Locally defined — this codebase duplicates these small type-discriminator
// constants per-file/module rather than centralizing them (see
// TRANSFER_TYPE_NAME in PrismaAccountRepository / create-movement.use-case.ts
// / update-movement.use-case.ts).
export const EXPENSE_TYPE_NAME = 'MT01';
export const TRANSFER_TYPE_NAME = 'MT03';
export const CREDIT_TYPE_NAME = 'AT03';

export type AccountForCreditCheck = {
  name: string;
  type: string;
  creditLimitCents?: number | null;
  balanceCents: number;
};

// The signed effect a movement of this type/amount has on its OWN accountId's
// balance — mirrors PrismaAccountRepository's real balance formula exactly
// (expense/outgoing-transfer subtract, income adds). Update flows need the
// TRUE signed contribution, not just a "is this risky" flag: removing an
// existing income movement (or shrinking its amount) really does decrease
// the account's balance, which can newly breach a Crédito account's limit.
export function sourceAccountEffectCents(
  movementType: string,
  amountCents: number,
): number {
  if (movementType === EXPENSE_TYPE_NAME || movementType === TRANSFER_TYPE_NAME)
    return -amountCents;
  return amountCents;
}

// Throws if applying `deltaCents` to `account.balanceCents` would push a
// Crédito account past its limit. No-op for any other account type, or for
// a Crédito account with no limit configured.
export function assertWithinCreditLimit(
  account: AccountForCreditCheck,
  deltaCents: number,
): void {
  if (account.type !== CREDIT_TYPE_NAME || account.creditLimitCents == null)
    return;
  const projectedBalanceCents = account.balanceCents + deltaCents;
  if (projectedBalanceCents < -account.creditLimitCents)
    throw new ValidationException(
      `This movement would exceed account "${account.name}"'s credit limit`,
    );
}
