import * as functions from 'firebase-functions/v1';
import { ensureAdminInitialized } from './adminBootstrap';

export { functions };

type CallableHandler = Parameters<typeof functions.https.onCall>[0];

function wrapHandler(handler: CallableHandler): CallableHandler {
  return async (data, context) => {
    ensureAdminInitialized();
    return handler(data, context);
  };
}

/** Registers a callable function with lazy Firebase Admin initialization. */
export function onCallWithAdmin(handler: CallableHandler) {
  return functions.https.onCall(wrapHandler(handler));
}

/** runWith + onCall with lazy Firebase Admin initialization. */
export function runWithWithAdmin(options: functions.RuntimeOptions) {
  return {
    https: {
      onCall: (handler: CallableHandler) => functions.runWith(options).https.onCall(wrapHandler(handler)),
    },
  };
}
