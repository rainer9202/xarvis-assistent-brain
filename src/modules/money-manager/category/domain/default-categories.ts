import type { MovementTypeCode } from '@domain/enums/movement-type.enum';

// In-code default category template provisioned for every new user at
// sign-up (see openspec/changes/add-default-user-template). This is the
// single shared source of truth for the 15 default categories — both
// `prisma/seed.ts` and `ProvisionDefaultCategoriesUseCase` import this
// constant instead of each keeping their own copy.
//
// icon values are Ionicons names (https://ionic.io/ionicons) — the frontend
// renders these directly, the backend just stores/validates the string.
export type DefaultCategory = {
  name: string;
  icon: string;
  movementType: MovementTypeCode;
};

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: 'Supermercado', icon: 'cart-outline', movementType: 'MT01' },
  { name: 'Transporte', icon: 'car-outline', movementType: 'MT01' },
  { name: 'Alquiler', icon: 'home-outline', movementType: 'MT01' },
  { name: 'Servicios', icon: 'flash-outline', movementType: 'MT01' },
  { name: 'Salud', icon: 'medkit-outline', movementType: 'MT01' },
  { name: 'Entretenimiento', icon: 'film-outline', movementType: 'MT01' },
  { name: 'Restaurantes', icon: 'restaurant-outline', movementType: 'MT01' },
  { name: 'Ropa', icon: 'shirt-outline', movementType: 'MT01' },
  { name: 'Sueldo', icon: 'briefcase-outline', movementType: 'MT02' },
  { name: 'Freelance', icon: 'laptop-outline', movementType: 'MT02' },
  { name: 'Inversiones', icon: 'trending-up-outline', movementType: 'MT02' },
  { name: 'Regalos', icon: 'gift-outline', movementType: 'MT02' },
  { name: 'Ahorro', icon: 'wallet-outline', movementType: 'MT03' },
  { name: 'Pago de tarjeta', icon: 'card-outline', movementType: 'MT03' },
  {
    name: 'Entre cuentas',
    icon: 'swap-horizontal-outline',
    movementType: 'MT03',
  },
];
