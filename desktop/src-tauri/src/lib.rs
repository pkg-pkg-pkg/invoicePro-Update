use tauri::Manager;

use axum::{
  extract::{Path, State},
  http::StatusCode,
  routing::get,
  Json, Router,
};
use once_cell::sync::Lazy;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::sync::Mutex;
use tokio::sync::oneshot;
use tower_http::cors::CorsLayer;
use uuid::Uuid;

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use ed25519_dalek::{Signature, VerifyingKey};

use tauri_plugin_updater::UpdaterExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[tauri::command]
fn close_splashscreen(app: tauri::AppHandle) {
  if let Some(splash) = app.get_webview_window("splashscreen") {
    let _ = splash.close();
  }
  if let Some(main) = app.get_webview_window("main") {
    let _ = main.show();
    let _ = main.set_focus();
  }
}

#[derive(Debug, Clone, Serialize)]
struct HostServerStatus {
  running: bool,
  port: u16,
  server_url: Option<String>,
  local_ip: Option<String>,
}

struct HostServerState {
  status: HostServerStatus,
  shutdown: Option<oneshot::Sender<()>>,
}

#[derive(Clone)]
struct ApiState {
  db_path: String,
}

static HOST_SERVER: Lazy<Mutex<HostServerState>> = Lazy::new(|| {
  Mutex::new(HostServerState {
    status: HostServerStatus {
      running: false,
      port: 3000,
      server_url: None,
      local_ip: None,
    },
    shutdown: None,
  })
});

async fn health() -> Json<serde_json::Value> {
  Json(serde_json::json!({
    "status": "ok",
    "timestamp": chrono::Utc::now().to_rfc3339()
  }))
}

const LICENSE_PUBKEY_B64: &str = "PASTE_LICENSE_PUBLIC_KEY_BASE64";

fn meta_get(conn: &Connection, key: &str) -> Result<Option<String>, String> {
  let mut stmt = conn
    .prepare("SELECT value FROM meta WHERE key = ? LIMIT 1")
    .map_err(|e| format!("SQLite prepare failed: {e}"))?;
  let mut rows = stmt
    .query(rusqlite::params![key])
    .map_err(|e| format!("SQLite query failed: {e}"))?;
  if let Some(r) = rows
    .next()
    .map_err(|e| format!("SQLite row read failed: {e}"))?
  {
    let v: String = r
      .get(0)
      .map_err(|e| format!("SQLite row read failed: {e}"))?;
    return Ok(Some(v));
  }
  Ok(None)
}

fn meta_set(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
  conn
    .execute(
      "INSERT INTO meta (key, value) VALUES (?, ?)\
       ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      rusqlite::params![key, value],
    )
    .map_err(|e| format!("SQLite write failed: {e}"))?;
  Ok(())
}

fn get_or_create_machine_id(conn: &Connection) -> Result<String, String> {
  if let Some(v) = meta_get(conn, "machine_id")? {
    let t = v.trim().to_string();
    if !t.is_empty() {
      return Ok(t);
    }
  }
  let id = Uuid::new_v4().to_string();
  meta_set(conn, "machine_id", &id)?;
  Ok(id)
}

fn is_host_licensed(conn: &Connection) -> Result<bool, String> {
  if meta_get(conn, "license_activated")?.as_deref() == Some("1") {
    return Ok(true);
  }
  Ok(meta_get(conn, "multi_user_lan")?.as_deref() == Some("1"))
}

fn verify_activation(license_key: &str, machine_id: &str, activation_code_b64: &str) -> Result<(), String> {
  if LICENSE_PUBKEY_B64.contains("PASTE_") {
    return Err("License public key not configured".to_string());
  }

  let pk_bytes = BASE64
    .decode(LICENSE_PUBKEY_B64.trim())
    .map_err(|e| format!("Invalid license public key base64: {e}"))?;
  let pk: [u8; 32] = pk_bytes
    .as_slice()
    .try_into()
    .map_err(|_| "Invalid license public key length".to_string())?;
  let vk = VerifyingKey::from_bytes(&pk).map_err(|e| format!("Invalid license public key: {e}"))?;

  let sig_bytes = BASE64
    .decode(activation_code_b64.trim())
    .map_err(|e| format!("Invalid activation code base64: {e}"))?;
  let sb: [u8; 64] = sig_bytes
    .as_slice()
    .try_into()
    .map_err(|_| "Invalid activation code length".to_string())?;
  let sig = Signature::from_bytes(&sb);

  let msg = format!("{license_key}|{machine_id}");
  vk.verify_strict(msg.as_bytes(), &sig)
    .map_err(|_| "Activation code invalid".to_string())?;
  Ok(())
}

async fn license_status(State(st): State<ApiState>) -> Json<serde_json::Value> {
  let licensed = open_db(&st.db_path)
    .and_then(|c| is_host_licensed(&c))
    .unwrap_or(false);

  Json(serde_json::json!({
    "licensed": licensed,
    "mode": "host",
    "timestamp": chrono::Utc::now().to_rfc3339()
  }))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LicenseState {
  machine_id: String,
  activated: bool,
  license_key: Option<String>,
}

#[tauri::command]
async fn get_license_state(app: tauri::AppHandle) -> Result<LicenseState, String> {
  let db_path = init_sqlite(&app)?;
  let conn = open_db(&db_path)?;
  let machine_id = get_or_create_machine_id(&conn)?;
  let activated = is_host_licensed(&conn)?;
  let license_key = meta_get(&conn, "license_key")?;
  Ok(LicenseState {
    machine_id,
    activated,
    license_key,
  })
}

/// After Firestore `multiUserLan` is approved, the desktop app sets this so the LAN host server can start without a per-machine signed activation code.
#[tauri::command]
fn set_multi_user_lan_unlock(app: tauri::AppHandle, unlocked: bool) -> Result<(), String> {
  let db_path = init_sqlite(&app)?;
  let conn = open_db(&db_path)?;
  if unlocked {
    meta_set(&conn, "multi_user_lan", "1")?;
  } else {
    meta_set(&conn, "multi_user_lan", "0")?;
  }
  Ok(())
}

#[tauri::command]
async fn activate_host_license(app: tauri::AppHandle, license_key: String, activation_code: String) -> Result<LicenseState, String> {
  let db_path = init_sqlite(&app)?;
  let conn = open_db(&db_path)?;
  let machine_id = get_or_create_machine_id(&conn)?;

  verify_activation(&license_key, &machine_id, &activation_code)?;

  meta_set(&conn, "license_activated", "1")?;
  meta_set(&conn, "license_key", license_key.trim())?;
  meta_set(&conn, "license_activated_at", &chrono::Utc::now().to_rfc3339())?;

  Ok(LicenseState {
    machine_id,
    activated: true,
    license_key: Some(license_key),
  })
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DocUpsertRequest {
  id: Option<String>,
  doc_number: Option<String>,
  date: Option<String>,
  party_name: Option<String>,
  amount: Option<f64>,
  payload: serde_json::Value,
  created_at: Option<String>,
  created_by_id: Option<String>,
  created_by_name: Option<String>,
  updated_at: Option<String>,
  updated_by_id: Option<String>,
  updated_by_name: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DocRow {
  id: String,
  doc_type: String,
  doc_number: Option<String>,
  date: Option<String>,
  party_name: Option<String>,
  amount: Option<f64>,
  payload: serde_json::Value,
  created_at: Option<String>,
  created_by_id: Option<String>,
  created_by_name: Option<String>,
  updated_at: Option<String>,
  updated_by_id: Option<String>,
  updated_by_name: Option<String>,
}

fn open_db(db_path: &str) -> Result<Connection, String> {
  Connection::open(db_path).map_err(|e| format!("SQLite open failed: {e}"))
}

async fn list_docs(State(st): State<ApiState>, Path(doc_type): Path<String>) -> Result<Json<Vec<DocRow>>, (StatusCode, String)> {
  let conn = open_db(&st.db_path).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
  let mut stmt = conn
    .prepare(
      "SELECT id, doc_type, doc_number, date, party_name, amount, payload, created_at, created_by_id, created_by_name, updated_at, updated_by_id, updated_by_name\
       FROM documents WHERE doc_type = ? ORDER BY COALESCE(date, '') DESC, rowid DESC",
    )
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("SQLite prepare failed: {e}")))?;

  let rows = stmt
    .query_map(rusqlite::params![doc_type], |r| {
      let payload_str: String = r.get(6)?;
      let payload: serde_json::Value = serde_json::from_str(&payload_str).unwrap_or(serde_json::Value::Null);
      Ok(DocRow {
        id: r.get(0)?,
        doc_type: r.get(1)?,
        doc_number: r.get(2)?,
        date: r.get(3)?,
        party_name: r.get(4)?,
        amount: r.get(5)?,
        payload,
        created_at: r.get(7)?,
        created_by_id: r.get(8)?,
        created_by_name: r.get(9)?,
        updated_at: r.get(10)?,
        updated_by_id: r.get(11)?,
        updated_by_name: r.get(12)?,
      })
    })
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("SQLite query failed: {e}")))?;

  let mut out: Vec<DocRow> = Vec::new();
  for r in rows {
    out.push(r.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("SQLite row read failed: {e}")))?);
  }
  Ok(Json(out))
}

async fn get_doc(
  State(st): State<ApiState>,
  Path((doc_type, id)): Path<(String, String)>,
) -> Result<Json<DocRow>, (StatusCode, String)> {
  let conn = open_db(&st.db_path).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

  let mut stmt = conn
    .prepare(
      "SELECT id, doc_type, doc_number, date, party_name, amount, payload, created_at, created_by_id, created_by_name, updated_at, updated_by_id, updated_by_name\
       FROM documents WHERE doc_type = ? AND id = ? LIMIT 1",
    )
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("SQLite prepare failed: {e}")))?;

  let mut rows = stmt
    .query(rusqlite::params![doc_type, id])
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("SQLite query failed: {e}")))?;

  if let Some(r) = rows.next().map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("SQLite row read failed: {e}")))? {
    let payload_str: String = r.get(6).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("SQLite row read failed: {e}")))?;
    let payload: serde_json::Value = serde_json::from_str(&payload_str).unwrap_or(serde_json::Value::Null);
    let doc = DocRow {
      id: r.get(0).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("SQLite row read failed: {e}")))?,
      doc_type: r.get(1).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("SQLite row read failed: {e}")))?,
      doc_number: r.get(2).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("SQLite row read failed: {e}")))?,
      date: r.get(3).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("SQLite row read failed: {e}")))?,
      party_name: r.get(4).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("SQLite row read failed: {e}")))?,
      amount: r.get(5).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("SQLite row read failed: {e}")))?,
      payload,
      created_at: r.get(7).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("SQLite row read failed: {e}")))?,
      created_by_id: r.get(8).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("SQLite row read failed: {e}")))?,
      created_by_name: r.get(9).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("SQLite row read failed: {e}")))?,
      updated_at: r.get(10).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("SQLite row read failed: {e}")))?,
      updated_by_id: r.get(11).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("SQLite row read failed: {e}")))?,
      updated_by_name: r.get(12).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("SQLite row read failed: {e}")))?,
    };
    return Ok(Json(doc));
  }

  Err((StatusCode::NOT_FOUND, "Not found".to_string()))
}

async fn create_doc(
  State(st): State<ApiState>,
  Path(doc_type): Path<String>,
  Json(req): Json<DocUpsertRequest>,
) -> Result<Json<DocRow>, (StatusCode, String)> {
  let conn = open_db(&st.db_path).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

  let id = req.id.unwrap_or_else(|| Uuid::new_v4().to_string());
  let payload_str = serde_json::to_string(&req.payload)
    .map_err(|e| (StatusCode::BAD_REQUEST, format!("Invalid payload json: {e}")))?;

  conn
    .execute(
      "INSERT INTO documents (id, doc_type, doc_number, date, party_name, amount, payload, created_at, created_by_id, created_by_name, updated_at, updated_by_id, updated_by_name)\
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      rusqlite::params![
        id,
        doc_type,
        req.doc_number,
        req.date,
        req.party_name,
        req.amount,
        payload_str,
        req.created_at,
        req.created_by_id,
        req.created_by_name,
        req.updated_at,
        req.updated_by_id,
        req.updated_by_name,
      ],
    )
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("SQLite insert failed: {e}")))?;

  Ok(Json(DocRow {
    id,
    doc_type,
    doc_number: req.doc_number,
    date: req.date,
    party_name: req.party_name,
    amount: req.amount,
    payload: req.payload,
    created_at: req.created_at,
    created_by_id: req.created_by_id,
    created_by_name: req.created_by_name,
    updated_at: req.updated_at,
    updated_by_id: req.updated_by_id,
    updated_by_name: req.updated_by_name,
  }))
}

async fn update_doc(
  State(st): State<ApiState>,
  Path((doc_type, id)): Path<(String, String)>,
  Json(req): Json<DocUpsertRequest>,
) -> Result<Json<DocRow>, (StatusCode, String)> {
  let conn = open_db(&st.db_path).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

  let payload_str = serde_json::to_string(&req.payload)
    .map_err(|e| (StatusCode::BAD_REQUEST, format!("Invalid payload json: {e}")))?;

  let changed = conn
    .execute(
      "UPDATE documents SET doc_number = ?, date = ?, party_name = ?, amount = ?, payload = ?, updated_at = ?, updated_by_id = ?, updated_by_name = ?\
       WHERE doc_type = ? AND id = ?",
      rusqlite::params![
        req.doc_number,
        req.date,
        req.party_name,
        req.amount,
        payload_str,
        req.updated_at,
        req.updated_by_id,
        req.updated_by_name,
        doc_type,
        id,
      ],
    )
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("SQLite update failed: {e}")))?;

  if changed == 0 {
    return Err((StatusCode::NOT_FOUND, "Not found".to_string()));
  }

  Ok(Json(DocRow {
    id,
    doc_type,
    doc_number: req.doc_number,
    date: req.date,
    party_name: req.party_name,
    amount: req.amount,
    payload: req.payload,
    created_at: req.created_at,
    created_by_id: req.created_by_id,
    created_by_name: req.created_by_name,
    updated_at: req.updated_at,
    updated_by_id: req.updated_by_id,
    updated_by_name: req.updated_by_name,
  }))
}

async fn delete_doc(
  State(st): State<ApiState>,
  Path((doc_type, id)): Path<(String, String)>,
) -> Result<StatusCode, (StatusCode, String)> {
  let conn = open_db(&st.db_path).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
  let changed = conn
    .execute(
      "DELETE FROM documents WHERE doc_type = ? AND id = ?",
      rusqlite::params![doc_type, id],
    )
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("SQLite delete failed: {e}")))?;
  if changed == 0 {
    return Err((StatusCode::NOT_FOUND, "Not found".to_string()));
  }
  Ok(StatusCode::NO_CONTENT)
}

async fn auto_update(app: tauri::AppHandle) {
  let updater = match app.updater() {
    Ok(u) => u,
    Err(e) => {
      log::warn!("updater init failed: {e}");
      return;
    }
  };

  let update = match updater.check().await {
    Ok(v) => v,
    Err(e) => {
      log::warn!("updater check failed: {e}");
      return;
    }
  };

  if let Some(update) = update {
    log::info!("update found: {}", update.version);
    let res = update
      .download_and_install(
        |_chunk_length, _content_length| {},
        || {},
      )
      .await;
    match res {
      Ok(_) => {
        log::info!("update installed, restarting");
        app.restart();
      }
      Err(e) => {
        log::warn!("update download/install failed: {e}");
      }
    }
  }
}

fn init_sqlite(app: &tauri::AppHandle) -> Result<String, String> {
  let data_dir = app
    .path()
    .app_data_dir()
    .map_err(|e| format!("Failed to resolve app data dir: {e}"))?;

  std::fs::create_dir_all(&data_dir)
    .map_err(|e| format!("Failed to create app data dir: {e}"))?;

  let db_path = data_dir.join("invoicepro.db");
  let db_path_str = db_path
    .to_str()
    .ok_or_else(|| "Invalid db path".to_string())?
    .to_string();

  let conn = Connection::open(&db_path_str).map_err(|e| format!("SQLite open failed: {e}"))?;

  conn
    .execute_batch(
      "CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
       CREATE TABLE IF NOT EXISTS documents (
         id TEXT PRIMARY KEY,
         doc_type TEXT NOT NULL,
         doc_number TEXT,
         date TEXT,
         party_name TEXT,
         amount REAL,
         payload TEXT NOT NULL,
         created_at TEXT,
         created_by_id TEXT,
         created_by_name TEXT,
         updated_at TEXT,
         updated_by_id TEXT,
         updated_by_name TEXT
       );
       CREATE INDEX IF NOT EXISTS idx_documents_type_date ON documents(doc_type, date);
       CREATE INDEX IF NOT EXISTS idx_documents_type_number ON documents(doc_type, doc_number);",
    )
    .map_err(|e| format!("SQLite init failed: {e}"))?;

  Ok(db_path_str)
}

#[tauri::command]
async fn get_host_status() -> Result<HostServerStatus, String> {
  let st = HOST_SERVER.lock().map_err(|_| "Host server mutex poisoned".to_string())?;
  Ok(st.status.clone())
}

#[tauri::command]
async fn stop_host_server() -> Result<HostServerStatus, String> {
  let mut st = HOST_SERVER.lock().map_err(|_| "Host server mutex poisoned".to_string())?;
  if let Some(tx) = st.shutdown.take() {
    let _ = tx.send(());
  }
  st.status.running = false;
  st.status.server_url = None;
  Ok(st.status.clone())
}

#[tauri::command]
async fn start_host_server(app: tauri::AppHandle, port: Option<u16>) -> Result<HostServerStatus, String> {
  {
    let st = HOST_SERVER.lock().map_err(|_| "Host server mutex poisoned".to_string())?;
    if st.status.running {
      return Ok(st.status.clone());
    }
  }

  let chosen_port = port.unwrap_or(3000);
  let db_path = init_sqlite(&app)?;

  {
    let conn = open_db(&db_path)?;
    if !is_host_licensed(&conn)? {
      return Err("Host license not activated".to_string());
    }
  }

  let local_ip = local_ip_address::local_ip()
    .ok()
    .map(|ip| ip.to_string());

  let addr = SocketAddr::from(([0, 0, 0, 0], chosen_port));
  let server_url = local_ip
    .as_ref()
    .map(|ip| format!("http://{ip}:{chosen_port}"))
    .unwrap_or_else(|| format!("http://localhost:{chosen_port}"));

  let api_state = ApiState { db_path };
  let app_router = Router::new()
    .route("/health", get(health))
    .route("/api/license/status", get(license_status))
    .route("/api/docs/:doc_type", get(list_docs).post(create_doc))
    .route(
      "/api/docs/:doc_type/:id",
      get(get_doc).put(update_doc).delete(delete_doc),
    )
    .with_state(api_state)
    .layer(CorsLayer::permissive());

  let (tx, rx) = oneshot::channel::<()>();

  let server = axum::serve(
    tokio::net::TcpListener::bind(addr)
      .await
      .map_err(|e| format!("Failed to bind {addr}: {e}"))?,
    app_router,
  )
  .with_graceful_shutdown(async {
    let _ = rx.await;
  });

  tokio::spawn(async move {
    let _ = server.await;
  });

  let mut st = HOST_SERVER.lock().map_err(|_| "Host server mutex poisoned".to_string())?;
  st.shutdown = Some(tx);
  st.status.running = true;
  st.status.port = chosen_port;
  st.status.local_ip = local_ip;
  st.status.server_url = Some(server_url);
  Ok(st.status.clone())
}

pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      close_splashscreen,
      get_license_state,
      set_multi_user_lan_unlock,
      activate_host_license,
      start_host_server,
      stop_host_server,
      get_host_status
    ])
    .setup(|app| {
      #[cfg(desktop)]
      {
        app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
        let handle = app.handle().clone();
        tauri::async_runtime::spawn(async move {
          auto_update(handle).await;
        });
      }
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
