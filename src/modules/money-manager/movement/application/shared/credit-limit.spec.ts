import { ValidationException } from '@domain/exceptions/domain.exception';
import {
  assertWithinCreditLimit,
  sourceAccountEffectCents,
  type AccountForCreditCheck,
} from './credit-limit';

describe('sourceAccountEffectCents', () => {
  it('returns a negative effect for an expense (MT01)', () => {
    expect(sourceAccountEffectCents('MT01', 1500)).toBe(-1500);
  });

  it('returns a negative effect for an outgoing transfer (MT03)', () => {
    expect(sourceAccountEffectCents('MT03', 2000)).toBe(-2000);
  });

  it('returns a positive effect for income (MT02)', () => {
    expect(sourceAccountEffectCents('MT02', 5000)).toBe(5000);
  });
});

describe('assertWithinCreditLimit', () => {
  const creditAccount = (
    overrides: Partial<AccountForCreditCheck> = {},
  ): AccountForCreditCheck => ({
    name: 'Credit Card',
    type: 'AT03',
    creditLimitCents: 50000,
    balanceCents: 0,
    ...overrides,
  });

  it('is a no-op for a non-credit account regardless of amount', () => {
    const account = creditAccount({ type: 'AT02', balanceCents: -1000000 });

    expect(() => assertWithinCreditLimit(account, -1000000)).not.toThrow();
  });

  it('is a no-op for a Crédito account with no limit configured', () => {
    const account = creditAccount({ creditLimitCents: null });

    expect(() => assertWithinCreditLimit(account, -1000000)).not.toThrow();
  });

  it('throws when the projected balance would exceed the credit limit', () => {
    const account = creditAccount({ creditLimitCents: 50000, balanceCents: 0 });

    expect(() => assertWithinCreditLimit(account, -50001)).toThrow(
      ValidationException,
    );
  });

  it('allows a movement that lands exactly at the credit limit boundary', () => {
    const account = creditAccount({ creditLimitCents: 50000, balanceCents: 0 });

    expect(() => assertWithinCreditLimit(account, -50000)).not.toThrow();
  });

  it('allows a movement that stays within the credit limit', () => {
    const account = creditAccount({ creditLimitCents: 50000, balanceCents: 0 });

    expect(() => assertWithinCreditLimit(account, -100)).not.toThrow();
  });

  it('still enforces a Crédito account with an explicit 0 limit, unlike a truthy check would', () => {
    const account = creditAccount({ creditLimitCents: 0, balanceCents: 0 });

    expect(() => assertWithinCreditLimit(account, -1)).toThrow(
      ValidationException,
    );
  });
});
