import { systemLogger } from '../logging/systemLogger';

const SUBSYSTEM = 'sync';

type SyncLogLevel = 'info' | 'warn' | 'error';

export type SyncLogEvent =
  | 'enqueue'
  | 'middleware_enqueue'
  | 'queue_status'
  | 'push_attempt'
  | 'push_success'
  | 'push_failure'
  | 'pull_fetch'
  | 'pull_apply'
  | 'pull_error'
  | 'conflict_skip'
  | 'retry_scheduled';

export interface SyncLogPayload {
  event: SyncLogEvent;
  code: string;
  message: string;
  [key: string]: unknown;
}

const log = (level: SyncLogLevel, payload: SyncLogPayload) => {
  systemLogger[level === 'info' ? 'info' : level === 'warn' ? 'warn' : 'error'](SUBSYSTEM, payload);
};

export const syncLogger = {
  info(payload: SyncLogPayload) {
    log('info', payload);
  },
  warn(payload: SyncLogPayload) {
    log('warn', payload);
  },
  error(payload: SyncLogPayload) {
    log('error', payload);
  },
};
