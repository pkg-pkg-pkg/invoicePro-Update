const http = require('http');
const { URL } = require('url');

const ALLOWED_ENTITY_TYPES = new Set(['ledger', 'payment', 'receipt', 'invoice']);
const ALLOWED_OPERATION = 'CREATE';

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => resolve(body));
  });
}

function writeJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Token',
  });
  res.end(JSON.stringify(payload));
}

function buildStatus(state) {
  return {
    running: Boolean(state.server),
    listenPort: state.listenPort,
    publicUrl: state.publicUrl || null,
    tunnelConnected: Boolean(state.tunnelConnected),
    startedAt: state.startedAt || null,
    lastUploadAt: state.lastUploadAt || null,
    lastDownloadAt: state.lastDownloadAt || null,
    lastError: state.lastError || null,
    pendingInboxCount: state.inboxQueue.length,
    pendingOutboxCount: state.outboundEvents.length,
    processedCount: state.processedCount,
    rejectedCount: state.rejectedCount,
    acceptedCount: state.acceptedCount,
    nextCursor: state.nextCursor,
  };
}

function validateEvent(event) {
  if (!event || typeof event !== 'object') return 'Invalid event object';
  const entityType = String(event.entityType || '').toLowerCase();
  const operation = String(event.operation || '').toUpperCase();
  if (!ALLOWED_ENTITY_TYPES.has(entityType)) return `Unsupported entityType: ${entityType}`;
  if (operation !== ALLOWED_OPERATION) return `Only ${ALLOWED_OPERATION} is allowed for mobile`;
  if (!event.idempotencyKey || typeof event.idempotencyKey !== 'string') {
    return 'Missing idempotencyKey';
  }
  if (!event.payload || typeof event.payload !== 'object') {
    return 'Missing payload';
  }
  return null;
}

function createDesktopMobileSyncMiddleware(options) {
  const persistState = options.persistState;
  const loadState = options.loadState;
  const authTokenProvider = options.authTokenProvider;
  const onStatus = options.onStatus || (() => {});
  const onRetry = options.onRetry || (() => Promise.resolve());
  const listenPort = Number(options.port || 3399);

  const restored = loadState() || {};
  const state = {
    listenPort,
    server: null,
    startedAt: restored.startedAt || null,
    publicUrl: restored.publicUrl || null,
    tunnelConnected: restored.tunnelConnected || false,
    lastUploadAt: restored.lastUploadAt || null,
    lastDownloadAt: restored.lastDownloadAt || null,
    lastError: null,
    processedCount: Number(restored.processedCount || 0),
    rejectedCount: Number(restored.rejectedCount || 0),
    acceptedCount: Number(restored.acceptedCount || 0),
    nextCursor: Number(restored.nextCursor || 1),
    outboundEvents: Array.isArray(restored.outboundEvents) ? restored.outboundEvents : [],
    inboxQueue: Array.isArray(restored.inboxQueue) ? restored.inboxQueue : [],
    seenIdempotency: restored.seenIdempotency && typeof restored.seenIdempotency === 'object'
      ? restored.seenIdempotency
      : {},
  };

  function notify() {
    onStatus(buildStatus(state));
  }

  function save() {
    persistState({
      startedAt: state.startedAt,
      publicUrl: state.publicUrl,
      tunnelConnected: state.tunnelConnected,
      lastUploadAt: state.lastUploadAt,
      lastDownloadAt: state.lastDownloadAt,
      processedCount: state.processedCount,
      rejectedCount: state.rejectedCount,
      acceptedCount: state.acceptedCount,
      nextCursor: state.nextCursor,
      outboundEvents: state.outboundEvents.slice(-1000),
      inboxQueue: state.inboxQueue.slice(-1000),
      seenIdempotency: state.seenIdempotency,
    });
    notify();
  }

  function setPublicEndpoint(url, connected) {
    state.publicUrl = url || null;
    state.tunnelConnected = Boolean(connected);
    save();
  }

  function pushOutboundEvent(kind, payload) {
    const event = {
      cursor: state.nextCursor++,
      kind,
      timestamp: new Date().toISOString(),
      payload,
    };
    state.outboundEvents.push(event);
    if (state.outboundEvents.length > 5000) {
      state.outboundEvents = state.outboundEvents.slice(-5000);
    }
    save();
  }

  function pushInboxEvent(payload) {
    const event = {
      id: `inbox_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      timestamp: new Date().toISOString(),
      status: 'pending',
      payload,
    };
    state.inboxQueue.push(event);
    if (state.inboxQueue.length > 5000) {
      state.inboxQueue = state.inboxQueue.slice(-5000);
    }
    save();
    return event;
  }

  function unauthorized(res) {
    writeJson(res, 401, { success: false, error: 'Unauthorized sync request' });
  }

  function ensureAuthorized(req, res) {
    const expected = String(authTokenProvider() || '').trim();
    if (!expected) return true;
    const authHeader = String(req.headers.authorization || '');
    const syncHeader = String(req.headers['x-sync-token'] || '');
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const token = bearerToken || syncHeader.trim();
    if (token !== expected) {
      unauthorized(res);
      return false;
    }
    return true;
  }

  async function handleUpload(req, res) {
    if (!ensureAuthorized(req, res)) return;
    const raw = await readBody(req);
    const payload = safeJsonParse(raw);
    const events = Array.isArray(payload?.events) ? payload.events : [];
    if (events.length === 0) {
      writeJson(res, 400, { success: false, error: 'events[] is required' });
      return;
    }

    const accepted = [];
    const rejected = [];
    const duplicates = [];

    for (const event of events) {
      const validationError = validateEvent(event);
      if (validationError) {
        rejected.push({ idempotencyKey: event?.idempotencyKey || null, reason: validationError });
        state.rejectedCount += 1;
        continue;
      }

      const key = String(event.idempotencyKey);
      if (state.seenIdempotency[key]) {
        duplicates.push({ idempotencyKey: key });
        continue;
      }

      state.seenIdempotency[key] = true;
      const inboxEvent = pushInboxEvent({
        idempotencyKey: key,
        entityType: String(event.entityType).toLowerCase(),
        operation: 'CREATE',
        payload: event.payload,
        mobileTimestamp: event.timestamp || null,
        sourceDeviceId: payload?.deviceId || null,
      });
      accepted.push({ idempotencyKey: key, inboxEventId: inboxEvent.id });
      state.acceptedCount += 1;
      pushOutboundEvent('mobile_create_accepted', {
        idempotencyKey: key,
        inboxEventId: inboxEvent.id,
      });
    }

    state.lastUploadAt = new Date().toISOString();
    save();
    writeJson(res, 200, {
      success: true,
      accepted,
      rejected,
      duplicates,
      status: buildStatus(state),
    });
  }

  function handleDownload(req, res) {
    if (!ensureAuthorized(req, res)) return;
    const requestUrl = new URL(req.url, `http://127.0.0.1:${state.listenPort}`);
    const cursor = Number(requestUrl.searchParams.get('cursor') || '0');
    const limit = Math.max(1, Math.min(200, Number(requestUrl.searchParams.get('limit') || '50')));
    const pending = state.outboundEvents.filter((event) => event.cursor > cursor).slice(0, limit);
    state.lastDownloadAt = new Date().toISOString();
    save();
    writeJson(res, 200, {
      success: true,
      events: pending,
      nextCursor: pending.length > 0 ? pending[pending.length - 1].cursor : cursor,
      serverTime: new Date().toISOString(),
      status: buildStatus(state),
    });
  }

  async function handleRetry(req, res) {
    if (!ensureAuthorized(req, res)) return;
    try {
      await onRetry();
      writeJson(res, 200, { success: true, status: buildStatus(state) });
    } catch (error) {
      state.lastError = error instanceof Error ? error.message : String(error);
      save();
      writeJson(res, 500, { success: false, error: state.lastError });
    }
  }

  function handleHealth(_req, res) {
    writeJson(res, 200, {
      success: true,
      status: buildStatus(state),
    });
  }

  async function requestHandler(req, res) {
    if (!req.url) {
      writeJson(res, 404, { success: false, error: 'Not found' });
      return;
    }
    if (req.method === 'OPTIONS') {
      writeJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'GET' && req.url.startsWith('/mobile-sync/health')) {
      handleHealth(req, res);
      return;
    }
    if (req.method === 'POST' && req.url.startsWith('/mobile-sync/upload')) {
      await handleUpload(req, res);
      return;
    }
    if (req.method === 'GET' && req.url.startsWith('/mobile-sync/download')) {
      handleDownload(req, res);
      return;
    }
    if (req.method === 'POST' && req.url.startsWith('/mobile-sync/retry')) {
      await handleRetry(req, res);
      return;
    }
    writeJson(res, 404, { success: false, error: 'Route not found' });
  }

  function start() {
    if (state.server) return;
    state.startedAt = new Date().toISOString();
    state.server = http.createServer((req, res) => {
      requestHandler(req, res).catch((error) => {
        state.lastError = error instanceof Error ? error.message : String(error);
        save();
        writeJson(res, 500, { success: false, error: state.lastError });
      });
    });
    state.server.listen(state.listenPort, '0.0.0.0');
    state.server.on('error', (error) => {
      state.lastError = error instanceof Error ? error.message : String(error);
      save();
    });
    save();
  }

  function stop() {
    if (!state.server) return;
    try {
      state.server.close();
    } catch {
      // no-op
    }
    state.server = null;
    save();
  }

  function getStatus() {
    return buildStatus(state);
  }

  function publishDesktopChange(change) {
    pushOutboundEvent('desktop_change', change);
  }

  function drainInbox(limit = 200) {
    const take = Math.max(1, Math.min(500, Number(limit)));
    const pending = state.inboxQueue.filter((e) => e.status === 'pending').slice(0, take);
    pending.forEach((event) => {
      event.status = 'processed';
      state.processedCount += 1;
      pushOutboundEvent('desktop_applied_mobile_create', {
        inboxEventId: event.id,
        idempotencyKey: event.payload?.idempotencyKey || null,
      });
    });
    save();
    return pending;
  }

  return {
    start,
    stop,
    getStatus,
    setPublicEndpoint,
    publishDesktopChange,
    drainInbox,
    retryNow: onRetry,
  };
}

module.exports = {
  createDesktopMobileSyncMiddleware,
};
