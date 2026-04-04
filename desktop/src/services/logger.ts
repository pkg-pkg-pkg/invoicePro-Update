/**
 * Production-safe logging service
 * Only logs errors and warnings in production
 */

const isDevelopment = import.meta.env.VITE_ENV !== 'production' && process.env.NODE_ENV !== 'production';

export const logger = {
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug('[DEBUG]', ...args);
    }
  },
  
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log('[LOG]', ...args);
    }
  },
  
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info('[INFO]', ...args);
    }
  },
  
  warn: (...args: any[]) => {
    // Always log warnings, even in production
    console.warn('[WARN]', ...args);
  },
  
  error: (...args: any[]) => {
    // Always log errors, even in production
    console.error('[ERROR]', ...args);
  },

  /**
   * Log sensitive operations only in development
   */
  sensitive: (...args: any[]) => {
    if (isDevelopment) {
      console.log('[SENSITIVE]', ...args);
    }
  }
};

export default logger;
