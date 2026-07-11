import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
}

// `user` stays optional here since Express itself has no concept of our
// auth guard — this type describes the request BEFORE JwtAuthGuard runs.
export interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
}
export type AuthenticatedRequest = RequestWithUser;

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    if (!request.user) {
      // JwtAuthGuard (registered globally via APP_GUARD) always populates
      // this before any non-@Public() handler runs, or throws
      // UnauthorizedException first — the only way to land here is
      // @CurrentUser() mistakenly used on a @Public() route.
      throw new InternalServerErrorException(
        '@CurrentUser() used on a route not protected by JwtAuthGuard',
      );
    }
    return request.user;
  },
);
