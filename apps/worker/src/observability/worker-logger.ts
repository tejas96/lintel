export type LogContext = Readonly<Record<string, string | number | boolean | null | undefined>>;

/** Structured logging for the worker. Never pass tokens, phone numbers or secrets. */
export interface WorkerLogger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}

const LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;
export type WorkerLogLevel = (typeof LEVELS)[number];

/** JSON lines on stdout/stderr, one object per event (easy to ship to any log store). */
export function createConsoleLogger(minimum: WorkerLogLevel, scope = 'worker'): WorkerLogger {
  const threshold = LEVELS.indexOf(minimum);
  const write = (level: 'debug' | 'info' | 'warn' | 'error', message: string, context = {}) => {
    if (LEVELS.indexOf(level) < threshold) return;
    const line = JSON.stringify({
      time: new Date().toISOString(),
      level,
      scope,
      message,
      ...context,
    });
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.info(line);
  };
  return {
    debug: (message, context) => write('debug', message, context),
    info: (message, context) => write('info', message, context),
    warn: (message, context) => write('warn', message, context),
    error: (message, context) => write('error', message, context),
  };
}

/** A logger that drops everything (unit tests). */
export const silentLogger: WorkerLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

/** A short, single-line description of an unknown error, safe for logs and `last_error`. */
export function describeError(error: unknown, maxLength = 500): string {
  const text =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? 'Unknown error');
  const singleLine = text.replace(/\s+/g, ' ').trim();
  return singleLine.length > maxLength ? `${singleLine.slice(0, maxLength - 1)}…` : singleLine;
}
