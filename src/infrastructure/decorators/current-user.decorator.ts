import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

// Exported so callers that need the param type for `@CurrentUser()` (e.g.
// controllers doing `@CurrentUser() user: AuthenticatedRequest['user']`) can
// import it from here now that the old Better-Auth-era guard (which used to
// be the source of this type) is gone. `AuthenticatedRequest` is kept as the
// exported name so those existing usages don't need to change, only their
// import path.
export interface RequestWithUser extends Request {
  user?: { id: string; email: string; name: string };
}
export type AuthenticatedRequest = RequestWithUser;

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return request.user;
  },
);
