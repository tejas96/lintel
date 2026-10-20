import type { ErrorResponse } from '@lintel/api-contracts';
import { HTTP_STATUS_BY_ERROR_CODE, isApplicationError } from '@lintel/shared';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { RequestValidationError } from '@ts-rest/nest';
import type { Request, Response } from 'express';
import type { ZodError } from 'zod';

function zodDetails(error: ZodError | null | undefined, prefix: string) {
  return (error?.issues ?? []).map((issue) => ({
    field: [prefix, ...issue.path].filter((part) => part !== '').join('.'),
    message: issue.message,
  }));
}

/**
 * Turns every thrown error into the shared error shape. Expected business
 * errors keep their safe message; unexpected ones are logged and hidden.
 */
@Catch()
export class ApplicationErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const requestId = request.requestId ?? 'unknown';
    const { status, body } = this.toResponse(exception, requestId);
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.path} failed (${requestId})`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }
    if (body.retryAfterSeconds) response.setHeader('retry-after', String(body.retryAfterSeconds));
    response.status(status).json(body);
  }

  private toResponse(
    exception: unknown,
    requestId: string,
  ): { status: number; body: ErrorResponse } {
    if (isApplicationError(exception)) {
      const retryAfterSeconds =
        'retryAfterSeconds' in exception && typeof exception.retryAfterSeconds === 'number'
          ? exception.retryAfterSeconds
          : undefined;
      return {
        status: HTTP_STATUS_BY_ERROR_CODE[exception.code],
        body: {
          code: exception.code,
          message: exception.message,
          details: [...exception.details],
          requestId,
          ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
        },
      };
    }
    if (exception instanceof RequestValidationError) {
      const details = [
        ...zodDetails(exception.body, ''),
        ...zodDetails(exception.query, 'query'),
        ...zodDetails(exception.pathParams, 'path'),
        ...zodDetails(exception.headers, 'header'),
      ];
      return {
        status: 400,
        body: {
          code: 'VALIDATION_FAILED',
          message: 'Some fields need attention.',
          details,
          requestId,
        },
      };
    }
    if (exception instanceof HttpException) return this.fromHttpException(exception, requestId);
    return {
      status: 500,
      body: {
        code: 'INTERNAL',
        message: 'Something went wrong on our side. Please try again.',
        details: [],
        requestId,
      },
    };
  }

  private fromHttpException(exception: HttpException, requestId: string) {
    const status = exception.getStatus();
    const mapped = HTTP_EXCEPTION_MAP[status];
    if (!mapped) {
      const message = 'The request could not be completed.';
      return {
        status: 500,
        body: { code: 'INTERNAL', message, details: [], requestId } satisfies ErrorResponse,
      };
    }
    return {
      status,
      body: {
        code: mapped.code,
        message: mapped.message,
        details: [],
        requestId,
      } satisfies ErrorResponse,
    };
  }
}

/** Framework HTTP exceptions (unknown route, body too large, throttling) mapped to safe messages. */
const HTTP_EXCEPTION_MAP: Readonly<
  Record<number, { code: ErrorResponse['code']; message: string }>
> = {
  [HttpStatus.BAD_REQUEST]: {
    code: 'VALIDATION_FAILED',
    message: 'The request could not be read.',
  },
  [HttpStatus.UNAUTHORIZED]: { code: 'UNAUTHENTICATED', message: 'Please sign in to continue.' },
  [HttpStatus.FORBIDDEN]: { code: 'FORBIDDEN', message: 'You do not have permission to do this.' },
  [HttpStatus.NOT_FOUND]: { code: 'NOT_FOUND', message: 'This page or resource does not exist.' },
  [HttpStatus.PAYLOAD_TOO_LARGE]: { code: 'VALIDATION_FAILED', message: 'That file is too large.' },
  [HttpStatus.TOO_MANY_REQUESTS]: {
    code: 'RATE_LIMITED',
    message: 'Too many requests. Please slow down.',
  },
};
