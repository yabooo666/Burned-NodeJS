# Security Model, Hardening & Threat Analysis

## 1. Security Architecture & Threat Philosophy

Burned NodeJS is designed to be deployed directly on public-facing Virtual Dedicated Servers (VDS) and Virtual Private Servers (VPS). To guarantee safety against unauthorized intrusion and remote exploitation, the application operates under a **Zero-Trust, Read-Only Monitoring Policy**.

---

## 2. Hardened Security Measures

### 2.1 Bulletproof PM2 Process Management (Zero-Shell, Strict Verification)
- **Historical Vulnerability Addressed**: Earlier iterations executed unsanitized shell commands via `child_process.exec()` (`pm2 ${action} ${id}`), which spawned `/bin/sh` and was vulnerable to command injection if malicious payloads were supplied in `id`.
- **Hardened Bulletproof Architecture**:
  - **Zero-Shell Invocations**: All PM2 commands are executed via `node:child_process.execFile()`, which invokes the binary directly via kernel `execve` without spawning `/bin/sh` or `/bin/bash`. Shell operators (`;`, `&&`, `|`, `` ` ``, `$()`) have zero special meaning and cannot execute secondary commands.
  - **Strict Action Whitelist**: Only explicit, predefined actions are permitted: `'start'`, `'restart'`, `'stop'`, `'reload'`, `'restartAll'`, `'reloadAll'`.
  - **Process Verification & ID Coercion**: For single-process operations, `getPm2List()` is queried first. The requested process must match an active/registered PM2 item. The argument passed to `execFile` is strictly the verified integer `pm_id` (`String(target.pm_id)`), preventing any flag injection or parameter tampering.
  - **Authenticated & Rate-Limited**: The endpoint `POST /api/pm2/action` requires a valid cryptographic session token.
  - **Execution Timeouts**: All calls have a strict 10-second timeout to prevent process hangs.

### 2.2 In-Memory Brute-Force Rate Limiting
- **Rule**: Any client IP that accumulates **3 failed login attempts** is immediately locked out for **24 hours** (`24 * 60 * 60 * 1000` ms).
- **Implementation**:
  ```ts
  const rateLimiter = new Map<string, { count: number; lockedUntil: number }>()
  ```
- **Reset Mechanism**: The rate limit is held entirely in volatile RAM. If an administrator locks themselves out accidentally, restarting the process clears the lockout immediately (`pm2 restart burned-agent`).
- **Timing Protection**: Returns HTTP `429 Too Many Requests` before evaluating cryptographic hashes.

### 2.3 Cryptographic Standards (`src/agent/db.ts`)
- **Key Derivation Function (KDF)**: `node:crypto` `scrypt` with parameters:
  - `keylen`: 64 bytes
  - `cost (N)`: 16,384
  - `blockSize (r)`: 8
  - `parallelization (p)`: 1
- **Salt Generation**: 32 cryptographically random bytes via `crypto.randomBytes(32)` stored alongside the hash.
- **Timing Attack Mitigation**: All password checks and master key verifications use `crypto.timingSafeEqual(expectedBuffer, providedBuffer)` to prevent side-channel timing attacks.

### 2.4 First-Run Master Setup Gate
- On first launch, if no admin account exists in SQLite, the agent generates a high-entropy 48-character setup key using `crypto.randomBytes(36)`.
- The key is output **exclusively** to `stdout` within an ASCII warning box visible only to operators with SSH access:
  ```
  ══════════════════════════════════════════════════════════════════════════
  ║ [!] NO PASSWORD CONFIGURED! TEMPORARY MASTER KEY GENERATED               ║
  ║ Check pm2 logs or terminal below to retrieve the initial setup key:     ║
  ──────────────────────────────────────────────────────────────────────────
  ║ KEY: B7#mK9!qP$2vL.xZ;8wR?1jT@4nC*6yF+3sD=9hG~5aE^9zB                  ║
  ──────────────────────────────────────────────────────────────────────────
  ║ Open the Web UI and paste this key to complete admin registration.       ║
  ══════════════════════════════════════════════════════════════════════════
  ```
- The Web UI blocks access with a Setup Gate (`SetupView.vue`).
- Submitting the key permanently destroys the temporary key row from SQLite and stores the hashed admin password.

### 2.5 HTTP Defense-in-Depth
- **No Wildcard CORS**: All wildcard `Access-Control-Allow-Origin: *` headers have been removed. Cross-origin requests from foreign websites cannot query local agent APIs.
- **5MB Request Size Ceiling**: Enforced in `readRequestBody()` to prevent denial-of-service via huge payloads.
- **SSE Connection Throttling**: SSE client connections are hard-capped at 50 concurrent sockets. Excess connections receive `429 Too Many Requests` to prevent socket starvation.
- **Strict Headers**:
  - `Content-Security-Policy`: Restricts scripts and connections to origin only.
  - `X-Frame-Options: DENY`: Blocks clickjacking attacks.
  - `X-Content-Type-Options: nosniff`: Prevents MIME-sniffing exploits.
  - `Referrer-Policy: no-referrer`: Suppresses referrer leakage.
  - `Permissions-Policy`: Disables camera, microphone, and geolocation.
