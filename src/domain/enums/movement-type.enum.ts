export const MOVEMENT_TYPES = ['Gasto', 'Ingreso', 'Transferencia'] as const;

export type MovementTypeValue = (typeof MOVEMENT_TYPES)[number];
