type LogLevel = 'info' | 'warn' | 'error';

export interface StructuredLogPayload {
  event: string;
  code: string;
  message: string;
  [key: string]: unknown;
}

const log = (subsystem: string, level: LogLevel, payload: StructuredLogPayload) => {
  const formatted = {
    ts: new Date().toISOString(),
    subsystem,
    ...payload,
  };

  if (level === 'error') {
    console.error(`[${subsystem}]`, formatted);
  } else if (level === 'warn') {
    console.warn(`[${subsystem}]`, formatted);
  } else {
    console.info(`[${subsystem}]`, formatted);
  }
};

export const systemLogger = {
  info(subsystem: string, payload: StructuredLogPayload) {
    log(subsystem, 'info', payload);
  },
  warn(subsystem: string, payload: StructuredLogPayload) {
    log(subsystem, 'warn', payload);
  },
  error(subsystem: string, payload: StructuredLogPayload) {
    log(subsystem, 'error', payload);
  },
};
