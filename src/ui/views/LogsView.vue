<template>
  <div class="logs-view">
    <!-- Pterodactyl-Style App Switcher Bar -->
    <div class="app-switcher-bar">
      <button
        class="switcher-tab"
        :class="{ active: activeApp === 'all' }"
        @click="selectApp('all')"
      >
        <SvgIcon name="server" size="13" />
        <span>All Running Apps</span>
      </button>

      <button
        v-for="proc in pm2List"
        :key="proc.pm_id"
        class="switcher-tab"
        :class="{ active: activeApp === proc.name }"
        @click="selectApp(proc.name)"
      >
        <span class="status-dot" :class="`dot-${proc.status}`"></span>
        <span class="font-mono">#{{ proc.pm_id }}</span>
        <span class="tab-proc-name">{{ proc.name }}</span>
      </button>
    </div>

    <!-- Active Process Console Header (Pterodactyl-style) -->
    <div class="console-hero-card" v-if="currentProcess">
      <div class="hero-left">
        <div class="hero-title-row">
          <span class="hero-id font-mono">#{{ currentProcess.pm_id }}</span>
          <h3 class="hero-name">{{ currentProcess.name }}</h3>
          <span class="hero-status-tag" :class="`tag-${currentProcess.status}`">
            {{ currentProcess.status }}
          </span>
        </div>
        <div class="hero-stats-row font-mono">
          <span>CPU: {{ currentProcess.cpu }}%</span>
          <span class="sep">•</span>
          <span>RAM: {{ currentProcess.memoryFormatted }}</span>
          <span class="sep">•</span>
          <span>Restarts: {{ currentProcess.restarts }}</span>
          <span class="sep">•</span>
          <span>Uptime: {{ currentProcess.uptimeFormatted }}</span>
        </div>
      </div>


    </div>

    <!-- Terminal Header & Filter Toolbar -->
    <div class="terminal-toolbar">
      <div class="toolbar-left">
        <!-- Severity Mode Filter -->
        <div class="severity-toggle">
          <button
            class="sev-btn"
            :class="{ active: severityFilter === 'all' }"
            @click="setSeverity('all')"
          >
            All Output
          </button>
          <button
            class="sev-btn sev-critical"
            :class="{ active: severityFilter === 'critical' }"
            @click="setSeverity('critical')"
          >
            <SvgIcon name="alert" size="12" />
            <span>Crashes &amp; Errors Only</span>
          </button>
        </div>

        <span class="log-count font-mono">{{ logs.length }} lines</span>
      </div>

      <div class="toolbar-right">
        <!-- Lines selector -->
        <select v-model="maxLines" class="select-input font-mono" @change="fetchLogs">
          <option :value="50">50 lines</option>
          <option :value="100">100 lines</option>
          <option :value="250">250 lines</option>
          <option :value="500">500 lines</option>
        </select>

        <label class="toggle-label">
          <input type="checkbox" v-model="autoScroll" class="checkbox-input" />
          <span>Auto-scroll</span>
        </label>

        <button class="tool-btn" @click="fetchLogs" :disabled="loading" title="Refresh">
          <SvgIcon name="refresh" size="13" :class="{ spinning: loading }" />
        </button>

        <button class="tool-btn" @click="clearLogs" title="Clear Console">
          <SvgIcon name="trash" size="13" />
        </button>

        <button class="tool-btn" @click="copyLogs" title="Copy Console">
          <SvgIcon :name="copied ? 'check' : 'copy'" size="13" />
        </button>
      </div>
    </div>

    <!-- Pterodactyl-Style Terminal Console -->
    <div class="terminal-box" ref="terminalRef">
      <div v-if="logs.length === 0" class="terminal-empty">
        <SvgIcon name="terminal" size="24" />
        <span v-if="severityFilter === 'critical'">No crash or error events detected in the selected buffer.</span>
        <span v-else>Awaiting log output from application...</span>
      </div>

      <div
        v-for="(log, idx) in logs"
        :key="idx"
        class="log-row"
        :class="{
          'row-critical': log.level === 'critical',
          'row-error': log.level === 'error'
        }"
      >
        <!-- Optional Timestamp -->
        <span class="col-time font-mono" v-if="log.timestamp">{{ log.timestamp }}</span>
        <span class="col-time font-mono text-muted" v-else>--:--:--</span>

        <!-- App Source Tag -->
        <span class="col-source font-mono">[{{ log.source }}]</span>

        <!-- Severity Badge if critical/error -->
        <span v-if="log.level === 'critical'" class="badge-critical font-mono">CRASH</span>
        <span v-else-if="log.level === 'error'" class="badge-error font-mono">ERR</span>

        <!-- Log Text Content -->
        <span class="col-text font-mono">{{ log.text }}</span>
      </div>
    </div>


  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import SvgIcon from '../components/SvgIcon.vue'


export interface ProcessLogEntry {
  source: string
  text: string
  level: 'info' | 'error' | 'critical'
  timestamp?: string
}

const props = defineProps<{
  pm2List: any[]
  initialApp?: string
  token: string
}>()



const activeApp = ref(props.initialApp || 'all')
const severityFilter = ref<'all' | 'critical'>('all')
const maxLines = ref(100)
const logs = ref<ProcessLogEntry[]>([])
const loading = ref(false)
const autoScroll = ref(true)
const copied = ref(false)
const terminalRef = ref<HTMLElement | null>(null)



const currentProcess = computed(() => {
  if (!activeApp.value || activeApp.value === 'all') return null
  return props.pm2List.find(p => p.name === activeApp.value || String(p.pm_id) === activeApp.value) || null
})

let pollTimer: any = null

function selectApp(appName: string) {
  activeApp.value = appName
  fetchLogs()
}

function setSeverity(mode: 'all' | 'critical') {
  severityFilter.value = mode
  fetchLogs()
}

async function fetchLogs() {
  if (!props.token) return
  loading.value = true
  try {
    const url = `/api/pm2/logs?app=${encodeURIComponent(activeApp.value)}&lines=${maxLines.value}&severity=${severityFilter.value}`
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${props.token}`
      }
    })
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data)) {
        logs.value = data
      }
    }
  } catch (err) {
    // network error
  } finally {
    loading.value = false
    if (autoScroll.value && terminalRef.value) {
      await nextTick()
      terminalRef.value.scrollTop = terminalRef.value.scrollHeight
    }
  }
}



watch(
  () => props.initialApp,
  (newApp) => {
    if (newApp) {
      activeApp.value = newApp
      fetchLogs()
    }
  }
)

watch(
  () => logs.value.length,
  async () => {
    if (autoScroll.value && terminalRef.value) {
      await nextTick()
      terminalRef.value.scrollTop = terminalRef.value.scrollHeight
    }
  }
)

function clearLogs() {
  logs.value = []
}

function copyLogs() {
  const text = logs.value.map(l => `[${l.timestamp || '--:--:--'}] [${l.source}] ${l.text}`).join('\n')
  navigator.clipboard.writeText(text)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

onMounted(() => {
  fetchLogs()
  pollTimer = setInterval(fetchLogs, 2000)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<style scoped>
.logs-view {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* Pterodactyl-Style App Switcher Tabs */
.app-switcher-bar {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
  border-bottom: 1px solid var(--border-subtle);
}

.switcher-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 0.85rem;
  border-radius: 6px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.switcher-tab:hover {
  background: var(--bg-surface-elevated);
  color: var(--text-primary);
  border-color: var(--border-strong);
}

.switcher-tab.active {
  background: #171717;
  color: #ffffff;
  border-color: #ffffff;
}

.tab-proc-name {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.dot-online {
  background: #ffffff;
}

.dot-stopped {
  border: 1px solid #737373;
}

.dot-errored, .dot-error {
  background: #737373;
}

/* Console Hero Header */
.console-hero-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1rem 1.25rem;
}

.hero-left {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.hero-title-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.hero-id {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.hero-name {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text-primary);
}

.hero-status-tag {
  font-size: 0.65rem;
  font-weight: 800;
  font-family: var(--font-mono);
  padding: 0.1rem 0.45rem;
  border-radius: 3px;
  text-transform: uppercase;
  background: var(--bg-surface-elevated);
  border: 1px solid var(--border-strong);
  color: var(--text-primary);
}

.hero-stats-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.775rem;
  color: var(--text-secondary);
}

.sep {
  opacity: 0.3;
}

.hero-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  background: var(--bg-surface-elevated);
  border: 1px solid var(--border);
  color: var(--text-primary);
  transition: all 0.15s ease;
}

.action-btn:hover:not(:disabled) {
  background: var(--bg-surface-hover);
  border-color: var(--border-strong);
}

.action-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* Toolbar */
.terminal-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.severity-toggle {
  display: flex;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.2rem;
  gap: 0.2rem;
}

.sev-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.65rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  transition: all 0.15s ease;
}

.sev-btn:hover {
  color: var(--text-primary);
}

.sev-btn.active {
  background: #262626;
  color: #ffffff;
}

.sev-btn.sev-critical.active {
  background: #ffffff;
  color: #000000;
  font-weight: 700;
}

.log-count {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.select-input {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  color: var(--text-primary);
  padding: 0.35rem 0.65rem;
  border-radius: 6px;
  font-size: 0.75rem;
  outline: none;
  cursor: pointer;
}

.toggle-label {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
}

.checkbox-input {
  accent-color: #ffffff;
  cursor: pointer;
}

.tool-btn {
  padding: 0.4rem 0.65rem;
  border-radius: 6px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  transition: all 0.15s ease;
}

.tool-btn:hover:not(:disabled) {
  background: var(--bg-surface-elevated);
  color: var(--text-primary);
  border-color: var(--border-strong);
}

/* Terminal Console Box */
.terminal-box {
  background: #000000;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1.25rem;
  min-height: 520px;
  max-height: 680px;
  overflow-y: auto;
  font-size: 0.8rem;
  line-height: 1.6;
}

.terminal-empty {
  color: var(--text-muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 5rem 0;
  justify-content: center;
  font-size: 0.85rem;
}

.log-row {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  padding: 0.2rem 0;
  border-bottom: 1px solid #080808;
  transition: background 0.1s ease;
}

.log-row:hover {
  background: #080808;
}

.col-time {
  color: var(--text-muted);
  font-size: 0.725rem;
  flex-shrink: 0;
  min-width: 75px;
}

.col-source {
  color: #888888;
  font-size: 0.75rem;
  font-weight: 700;
  flex-shrink: 0;
}

.badge-critical {
  font-size: 0.65rem;
  font-weight: 800;
  background: #ffffff;
  color: #000000;
  padding: 0.05rem 0.35rem;
  border-radius: 3px;
  flex-shrink: 0;
}

.badge-error {
  font-size: 0.65rem;
  font-weight: 700;
  background: #262626;
  border: 1px solid #404040;
  color: #ffffff;
  padding: 0.05rem 0.35rem;
  border-radius: 3px;
  flex-shrink: 0;
}

.col-text {
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-all;
}

.row-critical {
  background: rgba(255, 255, 255, 0.04);
}

.row-critical .col-text {
  color: #ffffff;
  font-weight: 600;
}

.row-error .col-text {
  color: #d4d4d4;
}

.font-mono {
  font-family: var(--font-mono);
}

.spinning {
  animation: spin 1s infinite linear;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
