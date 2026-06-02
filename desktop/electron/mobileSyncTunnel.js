let activeTunnel = null;

async function startDesktopSyncTunnel(localPort) {
  const enabled = String(process.env.DESKTOP_SYNC_TUNNEL_ENABLED || 'true').toLowerCase() !== 'false';
  if (!enabled) return null;
  try {
    // Optional dependency: if unavailable we skip tunnel gracefully.
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const localtunnel = require('localtunnel');
    activeTunnel = await localtunnel({ port: localPort });
    // Guard against unhandled emitter errors bubbling to Electron main process.
    if (activeTunnel && typeof activeTunnel.on === 'function') {
      activeTunnel.on('error', () => {
        // Keep middleware alive even if tunnel drops.
      });
    }
    if (activeTunnel && activeTunnel.client && typeof activeTunnel.client.on === 'function') {
      activeTunnel.client.on('error', () => {
        // Swallow transient tunnel socket errors; status will be reflected by caller.
      });
    }
    return {
      url: activeTunnel.url,
      close: async () => {
        try {
          if (activeTunnel) {
            activeTunnel.close();
          }
        } finally {
          activeTunnel = null;
        }
      },
    };
  } catch (error) {
    return null;
  }
}

async function stopDesktopSyncTunnel() {
  if (!activeTunnel) return;
  try {
    activeTunnel.close();
  } finally {
    activeTunnel = null;
  }
}

module.exports = {
  startDesktopSyncTunnel,
  stopDesktopSyncTunnel,
};
