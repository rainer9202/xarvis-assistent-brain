export const MOVEMENT_TYPES = [
  { code: 'MT01', label: 'Gasto' },
  { code: 'MT02', label: 'Ingreso' },
  { code: 'MT03', label: 'Transferencia' },
] as const;

export type MovementTypeCode = (typeof MOVEMENT_TYPES)[number]['code'];

export const MOVEMENT_TYPE_CODES = MOVEMENT_TYPES.map((t) => t.code);

export function getMovementTypeLabel(code: string): string | undefined {
  return MOVEMENT_TYPES.find((t) => t.code === code)?.label;
}
