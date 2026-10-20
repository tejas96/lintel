import { DefaultLogger, type LogEntry, type LogLevel } from '@temporalio/worker';
import type { WorkerLogger } from './observability/worker-logger';

function safeJson(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  try {
    return JSON.stringify(value, (_key, item: unknown) =>
      typeof item === 'bigint' ? item.toString() : item,
    );
  } catch {
    return '[unserialisable]';
  }
}

const SDK_LEVEL: Readonly<Record<string, LogLevel>> = {
  trace: 'TRACE',
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARN',
  error: 'ERROR',
  fatal: 'ERROR',
};

/** Routes Temporal SDK logs through the worker's JSON logger. */
export function temporalSdkLogger(logger: WorkerLogger, level: string): DefaultLogger {
  return new DefaultLogger(SDK_LEVEL[level] ?? 'INFO', (entry: LogEntry) => {
    const context = { source: 'temporal-sdk', meta: safeJson(entry.meta) };
    if (entry.level === 'ERROR') logger.error(entry.message, context);
    else if (entry.level === 'WARN') logger.warn(entry.message, context);
    else if (entry.level === 'INFO') logger.info(entry.message, context);
    else logger.debug(entry.message, context);
  });
}
