import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { CONFIG } from '../config.js';

// Ensure data directory exists
if (!fs.existsSync(CONFIG.DATA_DIR)) {
  fs.mkdirSync(CONFIG.DATA_DIR, { recursive: true });
}

export const db = new Database(CONFIG.DB_FILE);

// Enable WAL mode for high concurrent performance
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS monitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'http', -- 'http', 'tcp', 'ping', 'ssl'
      url TEXT NOT NULL,
      method TEXT NOT NULL DEFAULT 'GET',
      expected_status_code INTEGER DEFAULT 200,
      body_search TEXT,
      headers TEXT, -- JSON string
      timeout_ms INTEGER DEFAULT 10000,
      interval_seconds INTEGER DEFAULT 60,
      retries_before_down INTEGER DEFAULT 2,
      is_paused INTEGER DEFAULT 0,
      current_status TEXT NOT NULL DEFAULT 'pending', -- 'up', 'down', 'pending', 'paused'
      last_checked_at DATETIME,
      last_latency_ms INTEGER DEFAULT 0,
      last_error TEXT,
      ssl_days_remaining INTEGER,
      ssl_expiry_date TEXT,
      consecutive_failures INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monitor_id INTEGER NOT NULL,
      status TEXT NOT NULL, -- 'up', 'down'
      latency_ms INTEGER NOT NULL DEFAULT 0,
      status_code INTEGER,
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_checks_monitor_created ON checks(monitor_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_checks_created ON checks(created_at DESC);

    CREATE TABLE IF NOT EXISTS heartbeats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      interval_seconds INTEGER NOT NULL DEFAULT 300,
      grace_period_seconds INTEGER NOT NULL DEFAULT 60,
      current_status TEXT NOT NULL DEFAULT 'pending', -- 'up', 'down', 'pending', 'paused'
      last_ping_at DATETIME,
      consecutive_failures INTEGER DEFAULT 0,
      is_paused INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS heartbeat_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      heartbeat_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      duration_ms INTEGER DEFAULT 0,
      message TEXT,
      client_ip TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (heartbeat_id) REFERENCES heartbeats(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_hb_logs_created ON heartbeat_logs(heartbeat_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS incidents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'investigating', -- 'investigating', 'identified', 'monitoring', 'resolved'
      severity TEXT NOT NULL DEFAULT 'major', -- 'minor', 'major', 'critical', 'maintenance'
      monitor_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS incident_updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      incident_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS status_pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT 'Nabız Sistem Durumu',
      slug TEXT NOT NULL UNIQUE DEFAULT 'default',
      description TEXT DEFAULT 'Tüm servislerimizin anlık çalışma ve kesinti durumu.',
      is_public INTEGER DEFAULT 1,
      monitor_ids TEXT DEFAULT '[]', -- JSON array of monitor IDs
      custom_css TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notification_channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL, -- 'telegram', 'discord', 'webhook', 'email'
      config_json TEXT NOT NULL DEFAULT '{}',
      is_active INTEGER DEFAULT 1,
      events_json TEXT NOT NULL DEFAULT '["down", "up", "ssl_expiry"]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notification_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id INTEGER,
      event_type TEXT NOT NULL,
      target_name TEXT NOT NULL,
      status TEXT NOT NULL, -- 'sent', 'failed'
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS traffic_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id TEXT UNIQUE,
      project TEXT NOT NULL,
      host TEXT,
      method TEXT,
      path TEXT,
      status INTEGER,
      duration_ms REAL,
      size_bytes INTEGER,
      client_ip TEXT,
      country TEXT,
      user_agent TEXT,
      is_internal INTEGER DEFAULT 0,
      category TEXT DEFAULT 'page',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_traffic_logs_created ON traffic_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_traffic_logs_project_created ON traffic_logs(project, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_traffic_logs_internal_created ON traffic_logs(is_internal, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_traffic_logs_path ON traffic_logs(path);
  `);

  // Default Status Page if not exists
  const existingPage = db.prepare('SELECT id FROM status_pages WHERE slug = ?').get('default');
  if (!existingPage) {
    db.prepare(`
      INSERT INTO status_pages (title, slug, description, is_public, monitor_ids)
      VALUES (?, ?, ?, 1, '[]')
    `).run('Nabız Sistem Durumu', 'default', 'nabiz.thedemir.com servislerinin anlık operasyonel durumu ve geçmiş performans raporları.');
  }

  // Cleanup old check records older than 90 days periodically
  const pruneOldChecks = () => {
    try {
      db.prepare(`DELETE FROM checks WHERE created_at < datetime('now', '-90 days')`).run();
      db.prepare(`DELETE FROM heartbeat_logs WHERE created_at < datetime('now', '-90 days')`).run();
    } catch (e) {
      console.error('Error pruning old checks:', e);
    }
  };
  pruneOldChecks();
}
