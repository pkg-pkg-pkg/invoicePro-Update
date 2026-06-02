/**
 * Local users + sessions (offline). Stored in userData/local_users.db
 */
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const DB_FILE = 'local_users.db';
const SETTING_SESSION_DAYS = 'session_days_default';
const SETTING_REMEMBER_DAYS = 'session_days_remember';

let db = null;

function getDbPath(app) {
  return path.join(app.getPath('userData'), DB_FILE);
}

function openDb(app) {
  if (db) return db;
  const dbPath = getDbPath(app);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      username TEXT NOT NULL COLLATE NOCASE,
      email TEXT,
      full_name TEXT,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE TABLE IF NOT EXISTS sessions (
      session_token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      session_created TEXT NOT NULL,
      session_expiry TEXT NOT NULL,
      last_active TEXT NOT NULL,
      last_company TEXT,
      remember_me INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    );
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  ensureDefaultSettings();
  return db;
}

function closeDb() {
  try {
    if (db) db.close();
  } catch {
    /* ignore */
  }
  db = null;
}

function ensureDefaultSettings() {
  const ins = db.prepare('INSERT OR IGNORE INTO app_settings(key, value) VALUES(?, ?)');
  ins.run(SETTING_SESSION_DAYS, '7');
  ins.run(SETTING_REMEMBER_DAYS, '30');
}

function getSettingInt(key, fallback) {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key);
  const n = Number(row?.value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function setSetting(key, value) {
  db.prepare(
    'INSERT INTO app_settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, String(value));
}

function isoNow() {
  return new Date().toISOString();
}

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function hashPassword(password) {
  return bcrypt.hashSync(String(password), 10);
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(String(password), String(hash));
}

function upsertUser({ userId, username, email, fullName, password }) {
  const now = isoNow();
  const existing = db.prepare('SELECT user_id FROM users WHERE user_id = ? OR username = ? COLLATE NOCASE').get(
    userId,
    username
  );
  const hash = password ? hashPassword(password) : null;
  if (existing) {
    if (hash) {
      db.prepare(
        `UPDATE users SET username = ?, email = ?, full_name = ?, password_hash = ?, updated_at = ? WHERE user_id = ?`
      ).run(username, email || username, fullName || username, hash, now, existing.user_id);
      return existing.user_id;
    }
    db.prepare(`UPDATE users SET username = ?, email = ?, full_name = ?, updated_at = ? WHERE user_id = ?`).run(
      username,
      email || username,
      fullName || username,
      now,
      existing.user_id
    );
    return existing.user_id;
  }
  if (!hash) throw new Error('Password required for new user');
  const id = userId || `PK${Date.now()}`;
  db.prepare(
    `INSERT INTO users(user_id, username, email, full_name, password_hash, created_at, updated_at)
     VALUES(?, ?, ?, ?, ?, ?, ?)`
  ).run(id, username, email || username, fullName || username, hash, now, now);
  return id;
}

function rowToUser(row) {
  return {
    id: row.user_id,
    username: row.username,
    email: row.email || row.username,
    fullName: row.full_name || row.username,
    role: 'admin',
    companyId: '',
    company: null,
  };
}

function getLatestSession() {
  return db
    .prepare('SELECT * FROM sessions ORDER BY datetime(last_active) DESC LIMIT 1')
    .get();
}

function createSessionForUser(userId, rememberMe, lastCompany) {
  const days = rememberMe ? getSettingInt(SETTING_REMEMBER_DAYS, 30) : getSettingInt(SETTING_SESSION_DAYS, 7);
  const token = randomUUID();
  const now = isoNow();
  const expiry = addDays(days);
  db.prepare('DELETE FROM sessions').run();
  db.prepare(
    `INSERT INTO sessions(session_token, user_id, session_created, session_expiry, last_active, last_company, remember_me)
     VALUES(?, ?, ?, ?, ?, ?, ?)`
  ).run(token, userId, now, expiry, now, lastCompany || '', rememberMe ? 1 : 0);
  return { sessionToken: token, sessionExpiry: expiry, sessionDays: days };
}

function validateSession(app) {
  openDb(app);
  const row = getLatestSession();
  if (!row) return { valid: false, reason: 'no_session' };
  const expiry = new Date(row.session_expiry).getTime();
  if (!Number.isFinite(expiry) || expiry < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE session_token = ?').run(row.session_token);
    return { valid: false, reason: 'expired' };
  }
  const userRow = db.prepare('SELECT * FROM users WHERE user_id = ?').get(row.user_id);
  if (!userRow) {
    db.prepare('DELETE FROM sessions WHERE session_token = ?').run(row.session_token);
    return { valid: false, reason: 'user_missing' };
  }
  const now = isoNow();
  db.prepare('UPDATE sessions SET last_active = ? WHERE session_token = ?').run(now, row.session_token);
  return {
    valid: true,
    sessionToken: row.session_token,
    sessionExpiry: row.session_expiry,
    lastCompany: row.last_company || '',
    rememberMe: Boolean(row.remember_me),
    user: rowToUser(userRow),
  };
}

function loginWithPassword(app, { username, password, rememberMe, lastCompany }) {
  openDb(app);
  const ident = String(username || '').trim();
  if (!ident || !password) throw new Error('Username and password required');
  const userRow = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(ident);
  if (!userRow || !verifyPassword(password, userRow.password_hash)) {
    return { success: false, reason: 'Invalid username or password' };
  }
  const session = createSessionForUser(userRow.user_id, Boolean(rememberMe), lastCompany);
  return {
    success: true,
    sessionToken: session.sessionToken,
    sessionExpiry: session.sessionExpiry,
    user: rowToUser(userRow),
  };
}

function registerSessionAfterLogin(app, payload) {
  openDb(app);
  const userId = upsertUser({
    userId: payload.userId,
    username: payload.username,
    email: payload.email,
    fullName: payload.fullName,
    password: payload.password,
  });
  const session = createSessionForUser(
    userId,
    Boolean(payload.rememberMe),
    payload.lastCompany || ''
  );
  return {
    success: true,
    sessionToken: session.sessionToken,
    sessionExpiry: session.sessionExpiry,
    user: rowToUser(db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId)),
  };
}

function ensureSessionFromLegacy(app, payload) {
  openDb(app);
  const existing = getLatestSession();
  if (existing) {
    const expiry = new Date(existing.session_expiry).getTime();
    if (Number.isFinite(expiry) && expiry >= Date.now()) {
      return validateSession(app);
    }
  }
  const userId = payload.userId || payload.id;
  const username = payload.username || payload.email;
  if (!userId || !username) return { valid: false, reason: 'legacy_incomplete' };
  let userRow = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
  if (!userRow) {
    const placeholderHash = hashPassword(randomUUID());
    const now = isoNow();
    db.prepare(
      `INSERT INTO users(user_id, username, email, full_name, password_hash, created_at, updated_at)
       VALUES(?, ?, ?, ?, ?, ?, ?)`
    ).run(
      userId,
      username,
      payload.email || username,
      payload.fullName || username,
      placeholderHash,
      now,
      now
    );
    userRow = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
  }
  const session = createSessionForUser(userId, false, payload.lastCompany || '');
  return {
    valid: true,
    sessionToken: session.sessionToken,
    sessionExpiry: session.sessionExpiry,
    lastCompany: payload.lastCompany || '',
    user: rowToUser(userRow),
    migrated: true,
  };
}

function logoutSession(app) {
  openDb(app);
  db.prepare('DELETE FROM sessions').run();
  return { success: true };
}

function touchSession(app, lastCompany) {
  openDb(app);
  const row = getLatestSession();
  if (!row) return { success: false };
  const expiry = new Date(row.session_expiry).getTime();
  if (!Number.isFinite(expiry) || expiry < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE session_token = ?').run(row.session_token);
    return { success: false, expired: true };
  }
  db.prepare('UPDATE sessions SET last_active = ?, last_company = COALESCE(?, last_company) WHERE session_token = ?').run(
    isoNow(),
    lastCompany || null,
    row.session_token
  );
  return { success: true };
}

function getSessionSettings(app) {
  openDb(app);
  return {
    sessionDaysDefault: getSettingInt(SETTING_SESSION_DAYS, 7),
    sessionDaysRemember: getSettingInt(SETTING_REMEMBER_DAYS, 30),
  };
}

function setSessionSettings(app, { sessionDaysDefault, sessionDaysRemember }) {
  openDb(app);
  if (sessionDaysDefault != null) setSetting(SETTING_SESSION_DAYS, Math.max(1, Number(sessionDaysDefault) || 7));
  if (sessionDaysRemember != null) setSetting(SETTING_REMEMBER_DAYS, Math.max(1, Number(sessionDaysRemember) || 30));
  return getSessionSettings(app);
}

module.exports = {
  openDb,
  closeDb,
  validateSession,
  loginWithPassword,
  registerSessionAfterLogin,
  ensureSessionFromLegacy,
  logoutSession,
  touchSession,
  getSessionSettings,
  setSessionSettings,
};
