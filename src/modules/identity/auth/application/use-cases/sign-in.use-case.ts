import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { buildAuthResponse } from '../shared/build-auth-response';
import type { AuthResponse } from '../shared/build-auth-response';
import { USER_REPOSITORY } from '../../domain/ports/user.repository.port';
import type { UserRepositoryPort } from '../../domain/ports/user.repository.port';

export type SignInResponse = AuthResponse;

export class SignInCommand {
  constructor(
    public readonly email: string,
    public readonly password: string,
  ) {}
}

// A syntactically valid but unusable PHC-formatted argon2 hash, used only to
// give the unknown-email path something real to argon2.verify() against —
// see the comment on the `!user` branch below for why this exists.
const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$8/RgIN4v7YQ92rjJRxJ4nWKtHOch/60iuOnvFYABZDU';

// Invalid credentials throw Nest's built-in UnauthorizedException directly
// (not a DomainException routed through DomainExceptionFilter) — same
// precedent as other auth/infra failures, so the generic "Unauthorized"
// message never leaks whether the email or the password was the wrong part.
@Injectable()
export class SignInUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly repository: UserRepositoryPort,
    private readonly jwtService: JwtService,
  ) {}

  async execute(command: SignInCommand): Promise<SignInResponse> {
    const user = await this.repository.findByEmail(command.email);
    if (!user) {
      // Timing side-channel guard: without this, an unknown email returns
      // immediately while a known email pays the deliberately-expensive
      // argon2.verify() cost below — an attacker can enumerate registered
      // emails purely from response-time differences on this endpoint.
      // Verifying against a fixed dummy hash costs comparable CPU time
      // without needing a real user record, and its result is discarded.
      await argon2.verify(DUMMY_PASSWORD_HASH, command.password).catch(() => {
        // Never reachable in practice (DUMMY_PASSWORD_HASH is always a
        // valid PHC string), but guards against an unhandled rejection if
        // it ever weren't.
      });
      throw new UnauthorizedException();
    }

    // argon2.verify() throws a raw TypeError (not a boolean false) when the
    // stored hash is empty or not a valid PHC-formatted string — e.g. a
    // pre-existing row backfilled with password: '' by the
    // 20260708130628_add_user_password migration. Treat any verify failure
    // the same as a wrong password so a malformed hash never surfaces as a
    // 500 or leaks which part of the credential was invalid.
    let passwordMatches: boolean;
    try {
      passwordMatches = await argon2.verify(user.password, command.password);
    } catch {
      throw new UnauthorizedException();
    }
    if (!passwordMatches) throw new UnauthorizedException();

    return buildAuthResponse(this.jwtService, user);
  }
}
