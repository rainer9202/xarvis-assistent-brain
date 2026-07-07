export const ACCOUNT_TYPES = ['cash', 'bank', 'card'] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];
