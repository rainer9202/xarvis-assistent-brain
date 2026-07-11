export const ACCOUNT_TYPES = [
  { code: 'AT01', label: 'Efectivo' },
  { code: 'AT02', label: 'Banco' },
  { code: 'AT03', label: 'Tarjeta' },
] as const;

export type AccountTypeCode = (typeof ACCOUNT_TYPES)[number]['code'];

export const ACCOUNT_TYPE_CODES = ACCOUNT_TYPES.map((t) => t.code);

export function getAccountTypeLabel(code: string): string | undefined {
  return ACCOUNT_TYPES.find((t) => t.code === code)?.label;
}
