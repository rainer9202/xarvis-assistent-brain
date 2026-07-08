// better-auth ships real ESM (see AGENTS.md's e2e notes) which the unit
// ts-jest transform can't parse — mock it before any other import so
// requiring AuthGuard never pulls in the real `better-auth/node` module, nor
// `@config/auth/auth.provider` (which itself imports the `better-auth`
// package to build the betterAuth() instance — only the `AUTH` DI token is
// needed here, same pattern as the repository specs mocking PrismaService).
jest.mock('better-auth/node', () => ({
  fromNodeHeaders: jest.fn(() => ({})),
}));
jest.mock('@config/auth/auth.provider', () => ({
  AUTH: Symbol('BetterAuth'),
}));

import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Auth } from '@config/auth/auth.provider';
import { AuthGuard } from './auth.guard';

function createExecutionContext(): ExecutionContext {
  const request = { headers: {} };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
  let reflector: Reflector;
  let getAllAndOverride: jest.Mock;
  let getSession: jest.Mock;
  let auth: Auth;
  let guard: AuthGuard;

  beforeEach(() => {
    getAllAndOverride = jest.fn();
    reflector = { getAllAndOverride } as unknown as Reflector;

    getSession = jest.fn();
    auth = { api: { getSession } } as unknown as Auth;

    guard = new AuthGuard(auth, reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns true without calling auth.api.getSession when the route is @Public()', async () => {
    getAllAndOverride.mockReturnValue(true);

    const result = await guard.canActivate(createExecutionContext());

    expect(result).toBe(true);
    expect(getSession).not.toHaveBeenCalled();
  });

  it('returns true when a session exists for a non-public route', async () => {
    getAllAndOverride.mockReturnValue(false);
    const user = { id: 'user-1', email: 'test@example.com', name: 'Test' };
    getSession.mockResolvedValue({ user });

    const context = createExecutionContext();
    const result = await guard.canActivate(context);

    expect(getSession).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
  });

  it('throws UnauthorizedException when no session exists for a non-public route', async () => {
    getAllAndOverride.mockReturnValue(false);
    getSession.mockResolvedValue(null);

    await expect(guard.canActivate(createExecutionContext())).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
