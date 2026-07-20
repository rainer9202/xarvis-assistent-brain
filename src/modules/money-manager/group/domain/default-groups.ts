// In-code default group template provisioned for every new user at sign-up
// (see openspec/changes/add-default-user-template). Neither default group
// has a budgetCents set.
export type DefaultGroup = {
  name: string;
};

export const DEFAULT_GROUPS: DefaultGroup[] = [
  { name: 'Casa' },
  { name: 'Gastos Hormigas' },
];
