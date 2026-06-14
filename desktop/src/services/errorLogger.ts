export type ErrorLogLevel = 'error' | 'warn' | 'info';

export type ErrorLogEntry = {
  level: ErrorLogLevel;
  message: string;
  ts: number;
};

const MAX_LOGS = 200;
const logs: ErrorLogEntry[] = [];
let initialized = false;

function formatArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
      if (typeof arg === 'string') return arg;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(' ');
}

function pushLog(level: ErrorLogLevel, args: unknown[]): void {
  const message = formatArgs(args).trim();
  if (!message) return;
  logs.push({ level, message, ts: Date.now() });
  if (logs.length > MAX_LOGS) logs.splice(0, logs.length - MAX_LOGS);
  void window.electronAPI?.superAdminAppendLog?.({ level, message, ts: Date.now() });
}

export function pushStructuredError(
  level: ErrorLogLevel,
  message: string,
  meta?: Record<string, unknown>
): void {
  const parts = [message.trim()];
  if (meta?.stack) parts.push(String(meta.stack));
  if (meta?.componentStack) parts.push(String(meta.componentStack));
  pushLog(level, parts);
}

export function initErrorLogger(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);
  const origInfo = console.info.bind(console);

  console.error = (...args: unknown[]) => {
    pushLog('error', args);
    origError(...args);
  };
  console.warn = (...args: unknown[]) => {
    pushLog('warn', args);
    origWarn(...args);
  };
  console.info = (...args: unknown[]) => {
    if (String(args[0] ?? '').includes('[superadmin]')) {
      pushLog('info', args);
    }
    origInfo(...args);
  };
}

export function getLogs(): ErrorLogEntry[] {
  return [...logs];
}

export function clearLogs(): void {
  logs.length = 0;
}

export function exportLogs(): string {
  return JSON.stringify(logs, null, 2);
}
