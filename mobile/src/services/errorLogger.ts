import AsyncStorage from '@react-native-async-storage/async-storage';

export type ErrorLogLevel = 'error' | 'warn' | 'info';

export type ErrorLogEntry = {
  level: ErrorLogLevel;
  message: string;
  ts: number;
};

const STORAGE_KEY = 'pveb_error_logs';
const MAX_LOGS = 50;

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

let memoryLogs: ErrorLogEntry[] = [];
let initialized = false;

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(memoryLogs));
  } catch {
    // ignore
  }
}

export async function initErrorLogger(): Promise<void> {
  if (initialized) return;
  initialized = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) memoryLogs = JSON.parse(raw) as ErrorLogEntry[];
  } catch {
    memoryLogs = [];
  }

  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);
  console.error = (...args: unknown[]) => {
    void pushLog('error', args);
    origError(...args);
  };
  console.warn = (...args: unknown[]) => {
    void pushLog('warn', args);
    origWarn(...args);
  };
}

async function pushLog(level: ErrorLogLevel, args: unknown[]): Promise<void> {
  const message = formatArgs(args).trim();
  if (!message) return;
  memoryLogs.push({ level, message, ts: Date.now() });
  if (memoryLogs.length > MAX_LOGS) memoryLogs = memoryLogs.slice(-MAX_LOGS);
  await persist();
}

export function getLogs(): ErrorLogEntry[] {
  return [...memoryLogs];
}

export async function clearLogs(): Promise<void> {
  memoryLogs = [];
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export function exportLogs(): string {
  return JSON.stringify(memoryLogs, null, 2);
}
