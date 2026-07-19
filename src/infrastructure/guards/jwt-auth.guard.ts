import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { RequestWithUser } from '@infra/decorators/current-user.decorator';
import { IS_PUBLIC_KEY } from '@infra/decorators/public.decorator';

interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  // Absent on a real access token; only present (as 'refresh') on a
  // refresh JWT — see the `type` check in canActivate() below.
  type?: string;
}

// Fully replaces the deleted Better-Auth-based guard: hand-rolled JWT
// verification, no Passport/strategy classes involved.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractTokenFromHeader(request);
    if (!token) throw new UnauthorizedException();

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);

      // Token-confusion defense in depth (design.md ADR): a refresh JWT's
      // payload is deliberately { sub, type: 'refresh' } — no email/name —
      // so this check is on payload SHAPE, not signature, and rejects a
      // refresh token used as a Bearer access token EVEN IF
      // REFRESH_JWT_SECRET were ever misconfigured equal to JWT_SECRET.
      // No new DB access added; legitimate access tokens (which never carry
      // `type`) are unaffected.
      if (payload.type === 'refresh') {
        throw new UnauthorizedException();
      }

      request.user = {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
      };
    } catch {
      throw new UnauthorizedException();
    }

    return true;
  }

  private extractTokenFromHeader(request: RequestWithUser): string | undefined {
    const authorization = request.headers.authorization;
    if (!authorization) return undefined;

    const [type, token] = authorization.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
