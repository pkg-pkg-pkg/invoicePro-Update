/**
 * Session IPC handlers — registered from main.js on load and again at app ready (dev HMR safe).
 */
const { ipcMain } = require('electron');

function registerSessionIpc(app, sessionStore, companyRegistry) {
  const handlers = {
    'session-validate': () => sessionStore.validateSession(app),
    /** Alias used by some renderer builds */
    'session-check': () => sessionStore.validateSession(app),
    'session-login': (_event, payload) => {
      try {
        return sessionStore.loginWithPassword(app, payload);
      } catch (e) {
        return { success: false, reason: e?.message || 'Login failed' };
      }
    },
    'session-register': async (_event, payload) => {
      try {
        const res = sessionStore.registerSessionAfterLogin(app, payload);
        return { success: true, ...res };
      } catch (err) {
        console.error('[session-register]', err);
        return { success: false, reason: err?.message || 'Session registration failed' };
      }
    },
    'session-legacy': (_event, payload) => sessionStore.ensureSessionFromLegacy(app, payload),
    'session-logout': () => sessionStore.logoutSession(app),
    'session-touch': (_event, lastCompany) => sessionStore.touchSession(app, lastCompany),
    /** Extend session expiry / re-validate */
    'session-refresh': async (_event, lastCompany) => {
      try {
        if (lastCompany) {
          sessionStore.touchSession(app, String(lastCompany));
        } else if (companyRegistry?.readActiveId) {
          sessionStore.touchSession(app, companyRegistry.readActiveId(app));
        }
        return sessionStore.validateSession(app);
      } catch (err) {
        console.error('[session-refresh]', err);
        return { valid: false, reason: err?.message || 'refresh_failed' };
      }
    },
    'session-get-settings': () => sessionStore.getSessionSettings(app),
    'session-set-settings': (_event, payload) => sessionStore.setSessionSettings(app, payload),
    /** Alias for companies-list */
    'get-companies': () => {
      if (!companyRegistry?.listCompanies) {
        return { companies: [], activeId: '', error: 'company_registry_unavailable' };
      }
      try {
        return companyRegistry.listCompanies(app);
      } catch (err) {
        console.error('[get-companies]', err);
        return { companies: [], activeId: '', error: err?.message || 'list_failed' };
      }
    },
  };

  for (const [channel, fn] of Object.entries(handlers)) {
    try {
      ipcMain.removeHandler(channel);
    } catch {
      /* ignore */
    }
    ipcMain.handle(channel, fn);
  }
  if (process.env.NODE_ENV === 'development') {
    console.log('[ipc] Session handlers registered:', Object.keys(handlers).join(', '));
  }
}

module.exports = { registerSessionIpc };
