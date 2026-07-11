import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Response } from 'express';
import { map, Observable } from 'rxjs';

export interface ApiResponse<T> {
  statusCode: number;
  message: string;
  data: T;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      // Every controller returns { message, data } by convention (see
      // AGENTS.md's "Response shape") — asserted here since `body: T` is
      // generic and spreading it as `object` erases that shape from TS.
      map(
        (body) =>
          ({
            statusCode: response.statusCode,
            ...(body as object),
          }) as ApiResponse<T>,
      ),
    );
  }
}
