// In-code default account template provisioned for every new user at
// sign-up (see openspec/changes/add-default-user-template). `Principal` is
// explicitly `isPrincipal: true` here — this is NOT the same as
// CreateAccountUseCase's `accountCount === 0` inference, since all 3
// defaults are created together and only one of them must end up principal.
export type DefaultAccount = {
  name: string;
  type: string;
  isPrincipal: boolean;
};

export const DEFAULT_ACCOUNTS: DefaultAccount[] = [
  { name: 'Principal', type: 'AT02', isPrincipal: true },
  { name: 'Ahorro', type: 'AT04', isPrincipal: false },
  { name: 'Efectivo', type: 'AT01', isPrincipal: false },
];
