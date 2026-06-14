import type Database from 'better-sqlite3';
import type { DbConnection, ExecuteOptions, ExecuteResult } from './types';
import { OUT_FORMAT_OBJECT } from './types';

const TABLE_COLUMNS: Record<string, Set<string>> = {};

function loadTableColumns(db: Database.Database, table: string): Set<string> {
  if (TABLE_COLUMNS[table]) return TABLE_COLUMNS[table];
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  TABLE_COLUMNS[table] = new Set(cols.map((c) => c.name));
  return TABLE_COLUMNS[table];
}

function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k.toUpperCase()] = v;
    out[k] = v;
  }
  return out;
}

function rewriteSql(sql: string): string {
  let s = sql;
  s = s.replace(/TO_DATE\(\s*:(\w+)\s*,\s*'YYYY-MM-DD'\s*\)/gi, ':$1');
  s = s.replace(/TRUNC\(SYSDATE\)/gi, "date('now')");
  s = s.replace(/CURRENT_TIMESTAMP/gi, "datetime('now')");
  s = s.replace(
    /OFFSET\s+:(\w+)\s+ROWS\s+FETCH\s+NEXT\s+:(\w+)\s+ROWS\s+ONLY/gi,
    'LIMIT :$2 OFFSET :$1'
  );
  return s;
}

function namedBinds(sql: string, binds: Record<string, unknown>): { sql: string; values: unknown[] } {
  const order: string[] = [];
  const replaced = sql.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, key: string) => {
    order.push(key);
    return '?';
  });
  const values = order.map((k) => {
    const v = binds[k];
    if (v instanceof Date) return v.toISOString();
    return v ?? null;
  });
  return { sql: replaced, values };
}

function handleMerge(
  db: Database.Database,
  sql: string,
  binds: Record<string, unknown>
): ExecuteResult {
  const tableMatch = sql.match(/MERGE\s+INTO\s+(\w+)/i);
  if (!tableMatch) throw new Error('Unsupported MERGE statement');
  const table = tableMatch[1];

  const idColMatch = sql.match(/USING\s+\(SELECT\s+:(\w+)/i) || sql.match(/ON\s+\(t\.(\w+)/i);
  const idCol = idColMatch?.[1] ?? 'id';

  const allowed = loadTableColumns(db, table);
  const row: Record<string, unknown> = {};
  const extra: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(binds)) {
    const col = k === idCol ? idCol : k;
    if (allowed.has(col)) {
      row[col] = v instanceof Date ? v.toISOString() : v;
    } else if (allowed.has(k)) {
      row[k] = v instanceof Date ? v.toISOString() : v;
    } else {
      extra[k] = v;
    }
  }

  if (allowed.has('extra_data') && Object.keys(extra).length > 0) {
    row.extra_data = JSON.stringify(extra);
  }

  const cols = Object.keys(row);
  const placeholders = cols.map(() => '?').join(', ');
  const updates = cols.filter((c) => c !== idCol).map((c) => `${c}=excluded.${c}`).join(', ');

  const upsertSql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})
    ON CONFLICT(${idCol}) DO UPDATE SET ${updates}`;
  const stmt = db.prepare(upsertSql);
  const info = stmt.run(...cols.map((c) => row[c]));

  return { rowsAffected: info.changes };
}

export function createSqliteConnection(db: Database.Database): DbConnection {
  return {
    async execute<T = Record<string, unknown>>(
      sql: string,
      binds: Record<string, unknown> | unknown[] = {},
      options: ExecuteOptions = {}
    ): Promise<ExecuteResult<T>> {
      const bindObj = Array.isArray(binds)
        ? Object.fromEntries(binds.map((v, i) => [`p${i}`, v]))
        : { ...binds };

      if (/^\s*MERGE\s+INTO/i.test(sql)) {
        const result = handleMerge(db, sql, bindObj);
        return result as ExecuteResult<T>;
      }

      const rewritten = rewriteSql(sql);
      const { sql: finalSql, values } = namedBinds(rewritten, bindObj);
      const isSelect = /^\s*SELECT/i.test(finalSql);

      if (isSelect) {
        const rows = db.prepare(finalSql).all(...values) as Record<string, unknown>[];
        const normalized =
          options.outFormat === OUT_FORMAT_OBJECT
            ? rows.map((r) => normalizeRow(r) as T)
            : (rows as T[]);
        return { rows: normalized };
      }

      const info = db.prepare(finalSql).run(...values);
      return { rowsAffected: info.changes };
    },

    async commit(): Promise<void> {
      /* better-sqlite3 autocommits per statement */
    },
  };
}
