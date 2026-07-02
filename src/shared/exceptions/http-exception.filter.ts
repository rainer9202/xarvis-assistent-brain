import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ConflictException,
  DomainException,
  NotFoundException,
  ValidationException,
} from './domain.exception';

@Catch(DomainException)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status = this.resolveStatus(exception);

    response.status(status).json({
      statusCode: status,
      message: exception.message,
      error: exception.name,
    });
  }

  private resolveStatus(exception: DomainException): number {
    if (exception instanceof NotFoundException) return HttpStatus.NOT_FOUND;
    if (exception instanceof ValidationException) return HttpStatus.BAD_REQUEST;
    if (exception instanceof ConflictException) return HttpStatus.CONFLICT;
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}
