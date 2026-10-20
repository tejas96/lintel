import type { OtpDeliveryRequest, OtpDeliveryResult, OtpProvider } from '@lintel/application';
import { maskPhoneNumber } from '@lintel/shared';

export interface DevelopmentLogger {
  warn(message: string): void;
}

/**
 * Development-only OTP delivery. It writes the code to the local API log
 * instead of sending an SMS. It refuses to exist in production.
 */
export class LocalDevelopmentOtpProvider implements OtpProvider {
  readonly name = 'local';
  readonly isDevelopmentOnly = true;

  constructor(
    private readonly logger: DevelopmentLogger,
    nodeEnvironment: string,
  ) {
    if (nodeEnvironment === 'production') {
      throw new Error('The local OTP provider cannot be used in production.');
    }
  }

  async sendCode(request: OtpDeliveryRequest): Promise<OtpDeliveryResult> {
    this.logger.warn(
      `[DEVELOPMENT ONLY] Sign-in code for ${maskPhoneNumber(request.phoneE164)}: ${request.code}`,
    );
    return { delivered: true, providerReference: null };
  }
}
