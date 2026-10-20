import { createHash } from 'node:crypto';
import { type DatabaseConnection, IdempotencyRepository } from '@lintel/database';
import { type Clock, ConflictError, ValidationFailedError } from '@lintel/shared';
import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { from, mergeMap, type Observable, of } from 'rxjs';
import { CLOCK, DATABASE_CONNECTION } from '../../infrastructure/tokens';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const KEY_PATTERN = /^[A-Za-z0-9_-]{8,100}$/;
const REPLAY_WINDOW_MS = 24 * 3_600_000;

/**
 * Replays the stored response when an authenticated client retries a command
 * with the same `Idempotency-Key` (mobile apps on flaky networks). A key reused
 * for a different request is rejected. Only successful responses are stored.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly repository: IdempotencyRepository;

  constructor(
    @Inject(DATABASE_CONNECTION) connection: DatabaseConnection,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    this.repository = new IdempotencyRepository(connection.db);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const key = request.header('idempotency-key');
    const userId = request.auth?.user.id;
    if (!key || !userId || SAFE_METHODS.has(request.method)) return next.handle();
    if (!KEY_PATTERN.test(key))
      throw new ValidationFailedError('Idempotency-Key must be 8–100 letters, digits, - or _.');
    const fingerprint = createHash('sha256')
      .update(`${request.method} ${request.originalUrl} ${JSON.stringify(request.body ?? null)}`)
      .digest('hex');
    const now = this.clock.now();
    return from(this.repository.find(userId, key, now)).pipe(
      mergeMap((stored) => {
        if (stored) {
          if (stored.requestFingerprint !== fingerprint) {
            throw new ConflictError(
              'This Idempotency-Key was already used for a different request.',
            );
          }
          response.status(stored.responseStatus).setHeader('idempotent-replay', 'true');
          return of(stored.responseBody);
        }
        return next.handle().pipe(
          mergeMap(async (body: unknown) => {
            if (response.statusCode < 400) {
              await this.repository.save({
                userId,
                key,
                requestFingerprint: fingerprint,
                responseStatus: response.statusCode,
                responseBody: body ?? null,
                expiresAt: new Date(now.getTime() + REPLAY_WINDOW_MS),
              });
            }
            return body;
          }),
        );
      }),
    );
  }
}
