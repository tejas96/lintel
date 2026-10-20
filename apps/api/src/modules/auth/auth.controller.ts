import {
  type ApplicationStores,
  type AuthenticatedSession,
  type RequestContext,
  RequestOtpCommand,
  SessionManagement,
  type UnitOfWork,
  VerifyOtpCommand,
} from '@lintel/application';
import type { Environment } from '@lintel/configuration';
import { toPhoneNumberE164, ValidationFailedError } from '@lintel/shared';
import { Controller, Inject, Req, Res } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import type { Request, Response } from 'express';
import { Ctx, CurrentSession, Public } from '../../common/auth/auth.decorators';
import { clearSessionCookies, setSessionCookies } from '../../common/auth/session-cookies';
import { ENVIRONMENT } from '../../config/configuration.module';
import { apiContract } from '../../contract';
import { UNIT_OF_WORK } from '../../infrastructure/tokens';
import { presentCurrentUser, presentSession } from './current-user.presenter';

const { requestOtp, verifyOtp, signOut, ...sessionRoutes } = apiContract.auth;

function phoneFrom(body: { countryCallingCode: string; nationalNumber: string }) {
  const phone = toPhoneNumberE164(body.countryCallingCode, body.nationalNumber);
  if (!phone) {
    throw new ValidationFailedError('Enter a valid phone number.', [
      { field: 'nationalNumber', message: 'This does not look like a valid phone number.' },
    ]);
  }
  return phone;
}

function clientOf(request: Request) {
  return {
    ipAddress: request.ip ?? null,
    userAgent: request.header('user-agent') ?? null,
    requestId: request.requestId ?? 'unknown',
  };
}

@Controller()
export class AuthController {
  constructor(
    private readonly requestOtpCommand: RequestOtpCommand,
    private readonly verifyOtpCommand: VerifyOtpCommand,
    private readonly sessions: SessionManagement,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork<ApplicationStores>,
    @Inject(ENVIRONMENT) private readonly env: Environment,
  ) {}

  private get secureCookies(): boolean {
    return this.env.COOKIE_SECURE ?? this.env.NODE_ENV === 'production';
  }

  @Public()
  @TsRestHandler(requestOtp)
  requestOtp(@Req() request: Request) {
    return tsRestHandler(requestOtp, async ({ body }) => {
      const result = await this.requestOtpCommand.execute({
        phoneE164: phoneFrom(body),
        client: clientOf(request),
      });
      return { status: 200, body: result };
    });
  }

  @Public()
  @TsRestHandler(verifyOtp)
  verifyOtp(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return tsRestHandler(verifyOtp, async ({ body }) => {
      const result = await this.verifyOtpCommand.execute({
        phoneE164: phoneFrom(body),
        code: body.code,
        sessionClient: body.client,
        client: clientOf(request),
      });
      const capabilities = await this.uow.stores.identity.capabilitiesForRole(result.user.role);
      const organization = await this.uow.stores.settings.organization();
      if (body.client === 'web') {
        setSessionCookies(response, result.sessionToken, result.expiresAt, this.secureCookies);
      }
      return {
        status: 200,
        body: {
          user: presentCurrentUser(result.user, capabilities, organization),
          expiresAt: result.expiresAt.toISOString(),
          sessionToken: body.client === 'mobile' ? result.sessionToken : null,
        },
      };
    });
  }

  /** Single-route handler: multi-route handlers must not inject @Res (the response never completes). */
  @TsRestHandler(signOut)
  signOut(@Ctx() context: RequestContext, @Res({ passthrough: true }) response: Response) {
    return tsRestHandler(signOut, async () => {
      await this.sessions.signOut(context);
      clearSessionCookies(response, this.secureCookies);
      return { status: 204, body: undefined };
    });
  }

  @TsRestHandler(sessionRoutes)
  sessionHandlers(@Ctx() context: RequestContext, @CurrentSession() session: AuthenticatedSession) {
    return tsRestHandler(sessionRoutes, {
      me: async () => ({
        status: 200,
        body: presentSession(session, await this.uow.stores.settings.organization()),
      }),
      listSessions: async () => {
        const list = await this.sessions.listMySessions(context);
        return {
          status: 200,
          body: list.map((item) => ({
            id: item.id,
            client: item.client,
            userAgent: item.userAgent,
            createdAt: item.createdAt.toISOString(),
            lastSeenAt: item.lastSeenAt.toISOString(),
            isCurrent: item.id === context.sessionId,
          })),
        };
      },
      revokeSession: async ({ params }) => {
        await this.sessions.revokeSession(context, params.id);
        return { status: 204, body: undefined };
      },
    });
  }
}
