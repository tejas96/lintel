import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

/**
 * Gives every request one correlation ID, echoed in `x-request-id`, in logs
 * and in error bodies. Called first by the HTTP logger, then by the middleware.
 */
export function resolveRequestId(request: IncomingMessage, response: ServerResponse): string {
  const holder = request as IncomingMessage & { requestId?: string };
  if (holder.requestId) return holder.requestId;
  const header = request.headers['x-request-id'];
  const incoming = Array.isArray(header) ? header[0] : header;
  const requestId = incoming && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();
  holder.requestId = requestId;
  if (!response.headersSent) response.setHeader('x-request-id', requestId);
  return requestId;
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    resolveRequestId(request, response);
    next();
  }
}
