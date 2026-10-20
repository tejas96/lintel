import type { AuthenticatedSession } from '@lintel/application';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      auth?: AuthenticatedSession & { via: 'cookie' | 'bearer' };
    }
  }
}
