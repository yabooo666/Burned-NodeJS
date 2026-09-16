# OLED Black Design System & UI Specifications

## 1. Core Philosophy: True OLED Black Monochrome

Burned NodeJS adheres to a strict **pitch-black monochrome aesthetic**. It is engineered for system administrators, DevOps engineers, and developers who work in dark environments and demand maximum contrast, zero clutter, and battery-efficient OLED displays.

### The Absolute Design Rules:
1. **NO EMOJIS ANYWHERE IN THE UI**:
   - ❌ Never use Unicode emojis (e.g. 🚀, 💻, 🔥, 📊, ⚠️, ❌, ✅) in headings, buttons, status tags, badges, or terminal prompts.
   - ✅ Every icon MUST be an SVG vector icon rendered through [src/ui/components/SvgIcon.vue](file:///mnt/ssd/Burned-NodeJS/src/ui/components/SvgIcon.vue).
2. **TRUE PITCH BLACK BACKGROUND**:
   - The primary background is strictly `#000000`. Do NOT use dark navy (`#0f172a`), dark purple, or charcoal gray for the root backdrop.
3. **MONOCHROME ACCENTS**:
   - Primary interactive elements use white (`#ffffff`), grays, and blacks.
   - Colored accents (red, green, blue) are strictly avoided in standard states; only subtle status dots use high-contrast white or muted gray.
4. **PROFESSIONAL DENSITY & MONOSPACE TYPOGRAPHY**:
   - All server stats, metrics, memory bytes, process IDs, timestamps, and terminal rows use `--font-mono`.

---

## 2. Color System & CSS Design Tokens

Defined in [src/ui/style.css](file:///mnt/ssd/Burned-NodeJS/src/ui/style.css):

```css
:root {
  /* Surface Layers */
  --bg-base: #000000;              /* Pitch black screen background */
  --bg-surface: #0a0a0a;           /* Cards, sidebars, panel containers */
  --bg-surface-elevated: #141414;  /* Hovered cards, inputs, tab headers */
  --bg-surface-hover: #1f1f1f;     /* Active button hover, dropdown hover */

  /* Borders */
  --border: #262626;               /* Standard structural dividers */
  --border-subtle: #171717;        /* Inner card dividers, subtle rows */
  --border-strong: #404040;        /* Active borders, focused inputs */

  /* Text & Typography */
  --text-primary: #ffffff;         /* Headings, active values, high contrast */
  --text-secondary: #a3a3a3;       /* Labels, descriptions, secondary values */
  --text-muted: #737373;           /* Placeholders, disabled states, units */

  /* Fonts */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Roboto Mono', Menlo, Consolas, monospace;
}
```

---

## 3. Component Design Patterns

### 3.1 Pterodactyl-Style App Switcher Tabs
Located in `LogsView.vue` and `ProcessesView.vue`:
- A horizontal scrolling pill bar featuring:
  - An **"All Running Apps"** master tab with a server SVG icon.
  - Per-process tabs displaying the process ID `#<pm_id>`, status dot, and process name.
  - Active tab state: Background `#171717`, border `#ffffff`, text `#ffffff`.

### 3.2 Console Hero Header
Displays high-visibility metrics for the currently focused PM2 application:
- Process ID badge in monospace (`#0`).
- Process Name in bold (`1.15rem`).
- Status tag (`ONLINE`, `STOPPED`, `ERRORED`).
- Inline stats row separated by dimmed dots (`•`): CPU %, Memory formatted, Restart count, Uptime.

### 3.3 Terminal Console Box
- **Background**: `#000000` with 1px border `#262626`.
- **Toolbar**:
  - Severity filter button group: "All Output" vs "Crashes & Errors Only".
  - Buffer size dropdown: 50, 100, 250, 500 lines.
  - **Wrap Lines toggle**: switches between `white-space: pre-wrap; overflow-wrap: anywhere;` and horizontal scrolling `white-space: pre;`.
  - **Auto-scroll toggle**: automatically sticks to bottom on new log arrival.
  - Refresh, Clear, and Copy to clipboard buttons.
- **Log Row Structure**:
  - `col-time` (width `82px`): Clean time e.g. `6:09:21 PM` or `18:09:21`. If missing, shows a dimmed `-`.
  - `col-source` (bold gray): `[app-name]`.
  - `badge-critical` (white text on black or solid white badge) / `badge-error`.
  - `col-text`: Sanitized log line without ANSI escape codes, rendered with natural word wrapping (`word-break: normal`).

---

## 4. Iconography: [src/ui/components/SvgIcon.vue](file:///mnt/ssd/Burned-NodeJS/src/ui/components/SvgIcon.vue)

Every icon in Burned NodeJS is an inline SVG vector. Current icons in the registry:
- `server` — Main host & PM2 process indicator
- `cpu` — Processor core & load indicator
- `ram` — System memory metrics
- `terminal` — Console logs and CLI output
- `alert` — Crash/critical error warning
- `shield` — Security, setup gate, authentication
- `key` — Master key and session verification
- `refresh` — Live reload & fetch triggers
- `copy` / `check` — Clipboard copy action with stateful confirmation
- `trash` — Log buffer clear action
- `lock` — Password fields and login screen
- `arrow-right` — Form submissions and navigation
- `logout` — Admin sign-out

When adding any new feature, **NEVER use an emoji**. Always add a corresponding SVG path to `SvgIcon.vue`.
