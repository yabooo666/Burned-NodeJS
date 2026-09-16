# Technical Architecture & Runtime Internals

## 1. High-Level Architecture

Burned NodeJS operates as a monolithic hybrid process: a Node.js HTTP backend that serves an embedded Vue 3 SPA frontend from memory and streams real-time telemetry via Server-Sent Events (SSE).

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Burned Agent Runtime                            │
│                                                                        │
│  ┌───────────────────────┐             ┌────────────────────────────┐  │
│  │   HTTP Server (Node)  │             │   SQLite (node:sqlite)     │  │
│  │   - Auth verification │◄───────────►│   - admins table           │  │
│  │   - 3-fail Rate Limit │             │   - sessions table         │  │
│  │   - Security Headers  │             │   - setup_keys table       │  │
│  └───────────┬───────────┘             └────────────────────────────┘  │
│              │                                                         │
│              ├──────────────────────────┐                              │
│              ▼                          ▼                              │
│  ┌───────────────────────┐  ┌───────────────────────┐                  │
│  │   SSE Telemetry Loop  │  │   Embedded UI Server  │                  │
│  │   - CPU & Memory      │  │   - Inlined Vue 3 SPA │                  │
│  │   - pm2 jlist polling │  │   - Zero asset files  │                  │
│  │   - Streamed to UI    │  │   - Served from RAM   │                  │
│  └───────────┬───────────┘  └───────────────────────┘                  │
│              │                                                         │
└──────────────┼─────────────────────────────────────────────────────────┘
               │ (Reads OS / PM2 stats)
               ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Linux Host System                               │
│  - /proc/stat & /proc/meminfo / os.cpus() / os.totalmem()              │
│  - ~/.pm2/logs/*.log (Direct file tailing)                             │
│  - PM2 CLI (`pm2 jlist`)                                               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Backend Subsystems (`src/agent/`)

### 2.1 HTTP Server & Routing (`src/agent/index.ts`)
The server uses Node.js's native `node:http`. It intentionally does NOT use Express or Fastify to keep bundle size small and eliminate external vulnerabilities.

#### Request Flow:
1. **Security Headers Injection**:
   Every response receives strict headers:
   - `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; connect-src 'self'`
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY`
   - `Referrer-Policy: no-referrer`
   - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
2. **Payload Size Guard**:
   Enforces a strict **5MB limit** (`5 * 1024 * 1024` bytes) on incoming request bodies to prevent memory-exhaustion DoS.
3. **In-Memory Rate Limiter**:
   Failed authentication attempts are tracked per IP:
   - 3 failed attempts triggers an **immediate 24-hour lockout** (`24 * 60 * 60 * 1000` ms).
   - Stored in an in-memory `Map<string, { count: number; lockedUntil: number }>`.
   - Cleared automatically when the service restarts.
4. **Endpoint Routing Table**:
   - `GET /` — Serves `EMBEDDED_HTML` from memory.
   - `GET /api/status` — Returns `{ initialized: boolean, requiresSetup: boolean }`.
   - `POST /api/auth/setup` — Verifies 48-character master key, registers admin password.
   - `POST /api/auth/login` — Verifies admin password, issues 24-hour session token.
   - `POST /api/auth/logout` — Revokes session token.
   - `GET /api/system` — Authenticated: returns instantaneous system metrics.
   - `GET /api/pm2` — Authenticated: returns list of PM2 processes.
   - `GET /api/pm2/logs` — Authenticated: returns parsed, ANSI-stripped log entries.
   - `GET /api/events` — Authenticated: Server-Sent Events (SSE) telemetry stream.

### 2.2 Native SQLite Layer (`src/agent/db.ts`)
Burned uses Node 18+'s native `node:sqlite` module (`DatabaseSync`).
- **Database File**: Defaults to `./burned.db` (override via `BURNED_DB_PATH`).
- **WAL Mode**: Executed with `PRAGMA journal_mode = WAL;` for high concurrency without lock contention.
- **Foreign Keys**: Enabled with `PRAGMA foreign_keys = ON;`.

#### Database Schema:
```sql
CREATE TABLE IF NOT EXISTS setup_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  used INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
```

#### Cryptographic Mechanics:
- **Hashing Algorithm**: `crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 })`.
- **Salt**: 32 cryptographically secure random bytes generated via `crypto.randomBytes(32)`.
- **Timing Attack Resistance**: `crypto.timingSafeEqual()` is strictly used to compare password and key hashes.
- **Session Tokens**: 48 random bytes encoded as a hex string (96 hex chars), valid for 24 hours.

### 2.3 System Metrics & PM2 Integration (`src/agent/system.ts`)
- **System Metrics**:
  - CPU usage: Calculated by differential sampling of `os.cpus()` (`idle` vs `total` ticks).
  - RAM usage: `os.totalmem()`, `os.freemem()`, host memory percentage.
  - OS Specs: Platform, architecture, kernel release, uptime, hostname, load averages.
- **PM2 Process Discovery**:
  - Executes `pm2 jlist` via child process with a 4-second timeout.
  - Parses JSON output into typed `Pm2ProcessInfo` structs (CPU %, memory bytes, status, uptime, restarts, log file paths).
- **Log Collection & ANSI Sanitization**:
  - Directly reads the last 128KB of `pm_out_log_path` and `pm_err_log_path` using native `node:fs` file descriptors for instantaneous response without spawning child processes.
  - Falls back to `pm2 logs <name> --lines N --nostream` only if direct log paths do not exist.
  - **ANSI Sanitizer (`cleanAnsiAndControl`)**:
    Strips raw terminal codes (`\x1b[32m`, `\x1b[39m`, `\x1b[38;5;3m`, `\x1b[0m`), orphan bracket codes (`[32m`), and control bytes (`\x00` - `\x1F`).
  - **Smart Timestamp Extractor (`extractTime`)**:
    Automatically extracts NestJS timestamps (`09/15/2026, 6:09:21 PM` -> `6:09:21 PM`), standard ISO 8601 timestamps (`2026-09-16T04:58:33` -> `04:58:33`), and PM2 timestamps into clean table columns.
  - **Critical Crash Classifier**:
    Automatically flags lines containing `FATAL`, `EXCEPTION`, `UNHANDLED`, `SIGSEGV`, `SIGABRT`, `SYNTAXERROR`, `TYPEERROR`, `EADDRINUSE`, `MODULE_NOT_FOUND`, or `EXITED WITH CODE` as `critical` severity.

---

## 3. Real-Time Telemetry (Server-Sent Events)

Instead of high-frequency polling from the client, the server pushes updates via SSE:
- Endpoint: `GET /api/events`
- SSE client pool: `sseClients = new Set<http.ServerResponse>()` (hard capped at 50 connections to prevent resource exhaustion).
- Broadcast Interval: Every 1,500ms (`setInterval`).
- Payload:
  ```json
  {
    "system": { "cpu": 14.2, "ram": { "usedPercent": 42.8, ... }, "os": { ... } },
    "pm2": [ { "pm_id": 0, "name": "api", "status": "online", "cpu": 2.1, ... } ]
  }
  ```
- Heartbeat: Keep-alive comment `: keepalive\n\n` sent every 15 seconds.

---

## 4. Build Pipeline (`build.agent.js`)

The single-file agent is created through a 3-stage compilation process:

1. **Stage 1 (Vite UI Bundle)**:
   - Command: `npm run build:ui` (executes `vite build`).
   - Plugin: `vite-plugin-singlefile`.
   - Inlines all Vue components, CSS, fonts, and base64 assets into a single static file: `dist-ui/index.html`.
2. **Stage 2 (HTML Embedding)**:
   - Script: `build.agent.js`.
   - Reads `dist-ui/index.html`.
   - Generates `src/agent/embedded-ui.ts` containing:
     ```ts
     export const EMBEDDED_HTML = `...inlined HTML content...`
     ```
3. **Stage 3 (Backend Packaging with esbuild)**:
   - Bundles `src/agent/index.ts` with `platform: 'node'`, `target: 'node18'`, `format: 'cjs'`.
   - External dependencies: only Node built-ins (`node:http`, `node:sqlite`, `node:crypto`, `node:fs`, `node:os`, `node:path`, `node:child_process`).
   - Output: `dist/burned-agent.js` (~1.2 MB).
