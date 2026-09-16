<template>
  <div class="app-layout">
    <!-- 1. Initial Setup Gate (If admin not registered) -->
    <SetupView
      v-if="!authChecked || !isInitialized"
      @completed="onAuthSuccess"
    />

    <!-- 2. Login Gate (If registered but not logged in) -->
    <LoginView
      v-else-if="!isAuthenticated"
      @authenticated="onAuthSuccess"
    />

    <!-- 3. Authenticated Dashboard -->
    <div v-else class="authenticated-container">
      <!-- Main Top Navbar -->
      <header class="navbar">
        <div class="navbar-container">
          <div class="brand-section">
            <img :src="logoImg" alt="Burned Logo" class="brand-logo" />
            <div class="brand-info">
              <div class="brand-name-row">
                <span class="brand-title">BURNED</span>
                <span class="brand-badge">AGENT</span>
              </div>
              <span class="host-pill" :title="system?.hostname">
                <SvgIcon name="server" size="11" />
                <span>{{ system?.hostname || 'Connecting...' }}</span>
              </span>
            </div>
          </div>

          <!-- Navigation Tabs -->
          <nav class="nav-tabs">
            <button
              class="tab-btn"
              :class="{ active: currentTab === 'dashboard' }"
              @click="currentTab = 'dashboard'"
            >
              <SvgIcon name="dashboard" size="14" />
              <span>Dashboard</span>
            </button>
            <button
              class="tab-btn"
              :class="{ active: currentTab === 'processes' }"
              @click="currentTab = 'processes'"
            >
              <SvgIcon name="processes" size="14" />
              <span>Processes</span>
              <span class="badge" v-if="pm2List.length > 0">{{ pm2List.length }}</span>
            </button>
            <button
              class="tab-btn"
              :class="{ active: currentTab === 'logs' }"
              @click="currentTab = 'logs'"
            >
              <SvgIcon name="terminal" size="14" />
              <span>Logs</span>
            </button>
          </nav>

          <!-- Status & Controls -->
          <div class="nav-actions">
            <div class="connection-status" :class="{ online: connected, offline: !connected }">
              <span class="indicator-dot"></span>
              <span>{{ connected ? 'Live' : 'Polling' }}</span>
            </div>
            <button class="icon-btn" title="Refresh Now" @click="fetchData" :disabled="loading">
              <SvgIcon name="refresh" size="13" :class="{ spinning: loading }" />
            </button>
            <button class="icon-btn" title="Logout" @click="logout">
              <SvgIcon name="logout" size="13" />
            </button>
          </div>
        </div>
      </header>

      <!-- Toast Notification -->
      <div v-if="notification" class="notification-toast">
        <span>{{ notification.message }}</span>
      </div>

      <!-- Main Content Page -->
      <main class="page-container">
        <DashboardView
          v-if="currentTab === 'dashboard'"
          :system="system"
          :pm2List="pm2List"
        />
        <ProcessesView
          v-else-if="currentTab === 'processes'"
          :pm2List="pm2List"
          :loading="loading"
          @refresh="fetchData"

          @view-logs="onViewLogs"
        />
        <LogsView
          v-else-if="currentTab === 'logs'"
          :pm2List="pm2List"
          :initialApp="selectedLogApp"
          :token="token"
        />
      </main>

      <!-- Minimal Footer -->
      <footer class="app-footer">
        <span>Burned Node.js VDS Agent</span>
        <span class="footer-sep">•</span>
        <span>GPL-3.0 License</span>
        <span class="footer-sep">•</span>
        <a href="https://github.com/yabooo666/Burned-NodeJS" target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import logoImg from './assets/logo.png'
import SvgIcon from './components/SvgIcon.vue'
import SetupView from './views/SetupView.vue'
import LoginView from './views/LoginView.vue'
import DashboardView from './views/DashboardView.vue'
import ProcessesView from './views/ProcessesView.vue'
import LogsView, { type LogEntry } from './views/LogsView.vue'

const authChecked = ref(false)
const isInitialized = ref(true)
const isAuthenticated = ref(false)
const token = ref(localStorage.getItem('burned_token') || '')

const currentTab = ref<'dashboard' | 'processes' | 'logs'>('dashboard')
const selectedLogApp = ref('all')
const connected = ref(false)
const loading = ref(false)
const system = ref<any>(null)
const pm2List = ref<any[]>([])
const logs = ref<LogEntry[]>([])
const notification = ref<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

function onViewLogs(appName: string) {
  selectedLogApp.value = appName
  currentTab.value = 'logs'
}

let eventSource: EventSource | null = null
let pollTimer: any = null

function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  notification.value = { message, type }
  setTimeout(() => {
    notification.value = null
  }, 3500)
}

function addLog(text: string, source = 'Agent', level: 'info' | 'warn' | 'error' | 'success' = 'info') {
  const time = new Date().toLocaleTimeString()
  logs.value.push({ time, source, text, level })
  if (logs.value.length > 500) logs.value.shift()
}

async function checkAuthStatus() {
  try {
    const headers: Record<string, string> = {}
    if (token.value) {
      headers['Authorization'] = `Bearer ${token.value}`
    }
    const res = await fetch('/api/auth/status', { headers })
    const data = await res.json()

    isInitialized.value = data.initialized
    isAuthenticated.value = data.authenticated
    authChecked.value = true

    if (data.authenticated) {
      startDashboard()
    }
  } catch (err) {
    authChecked.value = true
  }
}

function onAuthSuccess(newToken: string) {
  token.value = newToken
  localStorage.setItem('burned_token', newToken)
  isInitialized.value = true
  isAuthenticated.value = true
  startDashboard()
}

async function logout() {
  try {
    if (token.value) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token.value}` }
      })
    }
  } catch {}
  token.value = ''
  localStorage.removeItem('burned_token')
  isAuthenticated.value = false
  eventSource?.close()
  eventSource = null
  if (pollTimer) clearInterval(pollTimer)
}

function startDashboard() {
  addLog('Dashboard session started', 'Auth', 'info')
  fetchData()
  setupSSE()
  if (!pollTimer) {
    pollTimer = setInterval(() => {
      if (!connected.value && isAuthenticated.value) {
        fetchData()
      }
    }, 3000)
  }
}

async function fetchData() {
  if (!isAuthenticated.value || !token.value) return
  loading.value = true
  try {
    const headers = { 'Authorization': `Bearer ${token.value}` }
    const [sysRes, pm2Res] = await Promise.all([
      fetch('/api/system', { headers }).then(r => {
        if (r.status === 401) { logout(); return null }
        return r.json()
      }).catch(() => null),
      fetch('/api/pm2', { headers }).then(r => {
        if (r.status === 401) { logout(); return null }
        return r.json()
      }).catch(() => null)
    ])
    if (sysRes) system.value = sysRes
    if (pm2Res && Array.isArray(pm2Res)) pm2List.value = pm2Res
  } catch (err) {
    // network error
  } finally {
    loading.value = false
  }
}



function setupSSE() {
  if (typeof EventSource === 'undefined' || !token.value) return
  try {
    eventSource = new EventSource(`/api/events?token=${encodeURIComponent(token.value)}`)
    eventSource.onopen = () => {
      connected.value = true
    }
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        if (payload.system) system.value = payload.system
        if (payload.pm2) pm2List.value = payload.pm2
      } catch (e) {}
    }
    eventSource.onerror = () => {
      connected.value = false
      eventSource?.close()
      eventSource = null
      setTimeout(setupSSE, 4000)
    }
  } catch (e) {
    connected.value = false
  }
}

onMounted(() => {
  checkAuthStatus()
})

onUnmounted(() => {
  eventSource?.close()
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<style scoped>
.app-layout {
  min-height: 100vh;
  background-color: var(--bg-oled);
}

.authenticated-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.navbar {
  position: sticky;
  top: 0;
  z-index: 100;
  background: #000000;
  border-bottom: 1px solid var(--border);
}

.navbar-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0.75rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
}

.brand-section {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.brand-logo {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  object-fit: contain;
  border: 1px solid var(--border);
}

.brand-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.brand-name-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.brand-title {
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  color: var(--text-primary);
}

.brand-badge {
  font-size: 0.65rem;
  font-weight: 700;
  font-family: var(--font-mono);
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  background: var(--bg-surface-elevated);
  border: 1px solid var(--border);
  color: var(--text-secondary);
}

.host-pill {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-family: var(--font-mono);
  display: flex;
  align-items: center;
  gap: 0.35rem;
  max-width: 180px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nav-tabs {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  background: var(--bg-surface);
  padding: 0.25rem;
  border-radius: 8px;
  border: 1px solid var(--border);
}

.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.4rem 0.85rem;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
  transition: all 0.15s ease;
}

.tab-btn:hover {
  color: var(--text-primary);
}

.tab-btn.active {
  background: var(--bg-surface-elevated);
  color: var(--text-primary);
  border: 1px solid var(--border-strong);
}

.badge {
  font-size: 0.65rem;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  color: var(--text-primary);
  padding: 0.05rem 0.4rem;
  border-radius: 4px;
  font-weight: 700;
  font-family: var(--font-mono);
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  color: var(--text-secondary);
}

.indicator-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #525252;
}

.connection-status.online .indicator-dot {
  background: #ffffff;
}

.icon-btn {
  padding: 0.45rem 0.65rem;
  border-radius: 6px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  transition: all 0.15s;
}

.icon-btn:hover:not(:disabled) {
  background: var(--bg-surface-elevated);
  color: var(--text-primary);
  border-color: var(--border-strong);
}

.page-container {
  flex: 1;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.notification-toast {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  z-index: 1000;
  padding: 0.75rem 1.25rem;
  border-radius: 8px;
  font-size: 0.825rem;
  font-weight: 600;
  background: #171717;
  color: #ffffff;
  border: 1px solid #404040;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.8);
}

.app-footer {
  border-top: 1px solid var(--border);
  padding: 1.25rem 1.5rem;
  text-align: center;
  font-size: 0.75rem;
  color: var(--text-muted);
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.6rem;
  background: #000000;
}

.app-footer a:hover {
  color: var(--text-primary);
  text-decoration: underline;
}

.footer-sep {
  opacity: 0.3;
}

.spinning {
  animation: spin 1s infinite linear;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .navbar-container {
    flex-wrap: wrap;
    gap: 0.75rem;
  }
  .nav-tabs {
    order: 3;
    width: 100%;
    justify-content: space-around;
  }
}
</style>
