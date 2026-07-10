import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let getAllAndOverride: jest.Mock;
  let reflector: Reflector;
  let verifyAsync: jest.Mock;
  let jwtService: JwtService;
  let guard: JwtAuthGuard;

  const buildContext = (
    headers: Record<string, string> = {},
  ): ExecutionContext => {
    const request: { headers: Record<string, string>; user?: unknown } = {
      headers,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    getAllAndOverride = jest.fn();
    reflector = { getAllAndOverride } as unknown as Reflector;

    verifyAsync = jest.fn();
    jwtService = { verifyAsync } as unknown as JwtService;

    guard = new JwtAuthGuard(reflector, jwtService);
  });

  it('bypasses auth for @Public() routes without calling verifyAsync', async () => {
    getAllAndOverride.mockReturnValue(true);
    const context = buildContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(verifyAsync).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when the Authorization header is missing', async () => {
    getAllAndOverride.mockReturnValue(false);
    const context = buildContext();

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(verifyAsync).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when the Authorization header is malformed', async () => {
    getAllAndOverride.mockReturnValue(false);
    const context = buildContext({ authorization: 'Basic abc123' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(verifyAsync).not.toHaveBeenCalled();
  });

  it('sets request.user and returns true for a valid token', async () => {
    getAllAndOverride.mockReturnValue(false);
    verifyAsync.mockResolvedValue({
      sub: 'user-1',
      email: 'jane@example.com',
      name: 'Jane Doe',
    });
    const request: { headers: Record<string, string>; user?: unknown } = {
      headers: { authorization: 'Bearer valid-token' },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(verifyAsync).toHaveBeenCalledWith('valid-token');
    expect(request.user).toEqual({
      id: 'user-1',
      email: 'jane@example.com',
      name: 'Jane Doe',
    });
  });

  it('throws UnauthorizedException when the token is expired/invalid', async () => {
    getAllAndOverride.mockReturnValue(false);
    verifyAsync.mockRejectedValue(new Error('jwt expired'));
    const context = buildContext({ authorization: 'Bearer expired-token' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException for a token signed with an algorithm other than HS256', async () => {
    // Exercises the real JwtService (not the mocked one used everywhere else
    // in this file) so the app.module.ts JwtModule.registerAsync factory's
    // `verifyOptions: { algorithms: ['HS256'] } }` restriction is actually
    // in effect, mirroring the real config instead of asserting against a
    // mock that would trivially agree with whatever we told it to return.
    const secret = 'test-secret';
    const signingService = new JwtService({
      secret,
      signOptions: { algorithm: 'HS384' },
    });
    const tokenSignedWithWrongAlgorithm = await signingService.signAsync({
      sub: 'user-1',
      email: 'jane@example.com',
      name: 'Jane Doe',
    });

    const restrictedJwtService = new JwtService({
      secret,
      verifyOptions: { algorithms: ['HS256'] },
    });
    const restrictedGuard = new JwtAuthGuard(reflector, restrictedJwtService);
    getAllAndOverride.mockReturnValue(false);
    const context = buildContext({
      authorization: `Bearer ${tokenSignedWithWrongAlgorithm}`,
    });

    await expect(restrictedGuard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
