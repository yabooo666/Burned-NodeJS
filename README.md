<p align="center">
  <img src="public/logo.png" alt="Burned NodeJS" width="130" style="border-radius: 20px;">
</p>

<h1 align="center">Burned NodeJS</h1>

<p align="center">
  <b>Minimalist, OLED-black VDS agent &amp; PM2 process dashboard built into a single file.</b><br>
  Self-contained runtime with embedded Vue 3 interface, native SQLite security, and real-time Server-Sent Events.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-GPL--3.0-white?style=flat-square" alt="License GPL-3.0"></a>
  <img src="https://img.shields.io/badge/Node.js-18%2B-white?style=flat-square" alt="Node.js 18+">
  <img src="https://img.shields.io/badge/Database-SQLite_(Native)-white?style=flat-square" alt="Native SQLite">
  <img src="https://img.shields.io/badge/Design-OLED_Black-black?style=flat-square" alt="OLED Black">
  <img src="https://img.shields.io/badge/PM2-Supported-white?style=flat-square" alt="PM2 Supported">
</p>

---

## Highlights

* **Single-File Deployment:** Everything—the Node backend, SQLite authentication layer, PM2 management adapter, and the compiled Vue 3 UI—is bundled into **one single executable script**: `dist/burned-agent.js` (~1.2 MB).
* **Native SQLite Security:** Uses Node.js's built-in `node:sqlite` (`DatabaseSync`). Zero external native npm compilation issues, storing scrypt-hashed credentials and active session tokens in a local `burned.db`.
* **First-Run Setup Gate:** If no admin password is set, the agent auto-generates a high-entropy 48-character temporary key displayed in an unmissable ASCII box inside `pm2 logs`. The Web UI requires pasting this key before registering the admin password.
* **OLED Black Monochrome Design:** Zero emojis. Pure `#000000` OLED black aesthetic with razor-sharp SVG vector icons and high-contrast typography.
* **Live Server-Sent Events (SSE):** Real-time streamed CPU, RAM, and PM2 service health updates without page refreshes.
* **Low Footprint:** Runs at **~20MB RAM** on your VDS instance.

---

## Quick Start (Any VDS / VPS)

### 1. Download & Run with PM2

```bash
# Start with PM2 (binds to 127.0.0.1 by default for security)
pm2 start burned-agent.js --name burned-agent

# Or bind to 0.0.0.0 to access directly via public IP:
HOST=0.0.0.0 pm2 start burned-agent.js --name burned-agent

# View the generated temporary setup key:
pm2 logs burned-agent
```

You can also create a `.env` file in the same directory:
```env
PORT=27109
HOST=0.0.0.0
```
> **Tip:** When updating `.env` or environment variables for an existing PM2 process, restart with `--update-env`:
> ```bash
> pm2 restart burned-agent --update-env
> ```

On first startup, the console displays an ASCII setup box:
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

### 2. Complete Setup in Web Browser
1. Visit `http://YOUR_SERVER_IP:27109` (or `http://localhost:27109`).
2. Paste the 48-character key from the terminal.
3. Set and confirm your new admin password.
4. The temporary key is immediately destroyed, your password is encrypted with `scrypt`, and your dashboard unlocks.

---

## Building from Source

```bash
# 1. Clone repository
git clone https://github.com/yabooo666/Burned-NodeJS.git
cd Burned-NodeJS

# 2. Install dev dependencies
npm install

# 3. Development mode (Vite UI with HMR)
npm run dev:ui

# 4. Build single-file production agent
npm run build
```

The build outputs:
```
dist/burned-agent.js   <-- The standalone agent to drop onto any server
```

---

## Configuration Options

Environment variables can be provided via shell, PM2 (`ecosystem.config.cjs`), or a `.env` file in the working directory:

| Environment Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `27109` | Port the web dashboard and API listen on |
| `HOST` | `127.0.0.1` | Bind address (`127.0.0.1` for local/reverse proxy, `0.0.0.0` for all interfaces) |
| `BURNED_DB_PATH` | `./burned.db` | Custom path for SQLite database |

---

## Project Structure

```
Burned-NodeJS/
├── LICENSE                   # GNU General Public License v3.0
├── README.md                 # Documentation
├── build.agent.js            # Bundles UI + agent into single file
├── ecosystem.config.cjs      # PM2 configuration template
├── public/
│   └── logo.png              # Brand logo
├── src/
│   ├── agent/                # Backend (Node.js + native SQLite)
│   │   ├── db.ts             # SQLite schema, scrypt hashing, session tokens
│   │   ├── index.ts          # HTTP server, auth routes, SSE broadcaster
│   │   └── system.ts         # CPU, RAM, & PM2 CLI adapters
│   └── ui/                   # Frontend (Vue 3 + OLED design)
│       ├── App.vue           # Main container & auth router
│       ├── style.css         # OLED black monochrome CSS tokens
│       ├── components/
│       │   └── SvgIcon.vue   # SVG icon set (zero emojis)
│       └── views/
│           ├── SetupView.vue     # First-run setup gate
│           ├── LoginView.vue     # Password unlock screen
│           ├── DashboardView.vue # CPU, RAM, and host specs
│           ├── ProcessesView.vue # PM2 management & actions
│           └── LogsView.vue      # Streamed console terminal
└── dist/
    └── burned-agent.js       # Deployable single-file artifact
```

---

## License

This project is licensed under the **GNU General Public License v3.0 (GPL-3.0)**.

> **Copyleft:** You are free to run, study, modify, and distribute this software for any purpose (personal or commercial), **provided that all distributed copies, forks, or derivative works must also remain open source under the GPL-3.0 license.**

See the [LICENSE](LICENSE) file for complete terms.
