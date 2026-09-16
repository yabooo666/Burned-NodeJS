# User Preferences & Operational Directives

> **FOR ALL AI MODELS & AGENTS:**
> This document details the preferences, aesthetic standards, and strict constraints established by the user for the **Burned NodeJS** project. Adhere to these instructions without deviation.

---

## 1. Aesthetic & UI Directives

| Directive | Rule | Reason / Context |
| :--- | :--- | :--- |
| **Monochrome Only** | Use only `#000000` pitch black, high-contrast grays, and white `#ffffff`. | Designed for OLED screens and dark-room NOC environments. |
| **ZERO EMOJIS** | **Strictly prohibited** in UI components, buttons, tabs, logs, titles, or headers. | Emojis look amateurish and unprofessional. Use SVG vector icons from `SvgIcon.vue` exclusively. |
| **No Raw ANSI Codes** | Strip all terminal codes (`\x1b[...]`, `[32m`, `[39m`) before displaying. | Raw escape characters cause ugly, broken glyphs in web terminals. |
| **Clean Word Wrapping** | Never use `word-break: break-all`. Use `word-break: normal; overflow-wrap: anywhere;`. | Prevents splitting English words in half (e.g. `Connecte` / `d`). |
| **Pterodactyl Layout** | Maintain the horizontal app switcher bar with active process hero card. | Preferred layout for monitoring multiple microservices in one dashboard. |

---

## 2. Architectural & Technical Constraints

### 2.1 Zero External Runtime Dependencies
- The production script `dist/burned-agent.js` must run on any bare Linux installation having Node.js 18+ installed.
- **Never install runtime dependencies** (e.g. `express`, `fastify`, `dotenv`, `better-sqlite3`, `chalk`, `cors`).
- All functionality must use Node.js built-ins:
  - `node:http` for HTTP & SSE.
  - `node:sqlite` for database operations.
  - `node:crypto` for scrypt hashing and secure tokens.
  - `node:fs` & `node:path` for direct log file streaming and `.env` loading.
  - `node:os` & `node:child_process` for metrics and PM2 querying.

### 2.2 Monitoring-Only Policy (No Shell Execution)
- **Never add endpoints or UI buttons that execute arbitrary shell commands** or restart/stop/delete PM2 processes.
- The project is an operational dashboard, not a remote management console. Keeping it read-only guarantees safety on public IPs.

### 2.3 Single-File Deployment
- The entire application (HTML, CSS, Vue runtime, SQLite auth, server logic) must compile into **one single script**: `dist/burned-agent.js`.
- Always run `npm run build` to verify the build pipeline completes and the bundle executes.

### 2.4 Network Defaults
- **Default Port**: `27109`.
- **Default Host**: `127.0.0.1` (localhost).
- For public access, users explicitly set `HOST=0.0.0.0` via environment or `.env`.

---

## 3. Workflow & Maintenance Checklist

Whenever modifying this codebase, follow this mandatory checklist:

1. **Frontend Changes (`src/ui/`)**:
   - Verify all icons exist in `SvgIcon.vue` (no emojis!).
   - Check contrast against `#000000` pitch black.
   - Run `npm run build:ui` to verify Vite compiles without errors.
2. **Backend Changes (`src/agent/`)**:
   - Maintain constant-time crypto (`timingSafeEqual`).
   - Ensure all database queries handle edge cases gracefully.
   - Clean ANSI codes on any new log or process output.
3. **Build & Bundle**:
   - Run `npm run build` (`npm run build:ui && npm run build:agent`).
   - Confirm `dist/burned-agent.js` is generated.
4. **Git Discipline**:
   - Never remove `.agents/` from the repository or add it to `.gitignore`.
   - Never commit `dist/` or `burned.db` to git (`.gitignore` protects them).
   - Write clear, concise commit messages following Conventional Commits (`feat:`, `fix:`, `chore:`, `security:`).
