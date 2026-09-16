<template>
  <div class="dashboard-view">
    <!-- Stat Highlights Grid -->
    <div class="stats-grid">
      <!-- CPU -->
      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-title">CPU UTILIZATION</span>
          <div class="stat-icon">
            <SvgIcon name="cpu" size="16" />
          </div>
        </div>
        <div class="stat-value-row">
          <span class="stat-value">{{ system?.cpu?.usagePercent ?? 0 }}%</span>
          <span class="stat-sub">{{ system?.cpu?.cores ?? 0 }} Cores</span>
        </div>
        <div class="progress-bar-bg">
          <div
            class="progress-bar-fill"
            :style="{ width: `${Math.min(system?.cpu?.usagePercent ?? 0, 100)}%` }"
          ></div>
        </div>
        <div class="stat-footer">
          <span>Load Avg: {{ system?.cpu?.loadAvg?.join(' / ') || '0.00' }}</span>
        </div>
      </div>

      <!-- Memory (RAM) -->
      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-title">MEMORY (RAM)</span>
          <div class="stat-icon">
            <SvgIcon name="ram" size="16" />
          </div>
        </div>
        <div class="stat-value-row">
          <span class="stat-value">{{ system?.memory?.usagePercent ?? 0 }}%</span>
          <span class="stat-sub">{{ system?.memory?.usedFormatted || '0 B' }} / {{ system?.memory?.totalFormatted || '0 B' }}</span>
        </div>
        <div class="progress-bar-bg">
          <div
            class="progress-bar-fill"
            :style="{ width: `${Math.min(system?.memory?.usagePercent ?? 0, 100)}%` }"
          ></div>
        </div>
        <div class="stat-footer">
          <span>Free: {{ system?.memory?.freeFormatted || '0 B' }}</span>
        </div>
      </div>

      <!-- PM2 Services -->
      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-title">PM2 SERVICES</span>
          <div class="stat-icon">
            <SvgIcon name="pm2" size="16" />
          </div>
        </div>
        <div class="stat-value-row">
          <span class="stat-value">{{ pm2Summary.online }}</span>
          <span class="stat-sub">of {{ pm2Summary.total }} running</span>
        </div>
        <div class="pm2-pills">
          <span class="pill pill-online">
            <span class="status-marker filled"></span>
            {{ pm2Summary.online }} online
          </span>
          <span v-if="pm2Summary.errored > 0" class="pill pill-error">
            <span class="status-marker cross"></span>
            {{ pm2Summary.errored }} error
          </span>
          <span v-if="pm2Summary.stopped > 0" class="pill pill-stopped">
            <span class="status-marker hollow"></span>
            {{ pm2Summary.stopped }} stopped
          </span>
        </div>
        <div class="stat-footer">
          <span>PM2 Daemon Active</span>
        </div>
      </div>

      <!-- System Uptime -->
      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-title">SYSTEM UPTIME</span>
          <div class="stat-icon">
            <SvgIcon name="clock" size="16" />
          </div>
        </div>
        <div class="stat-value-row">
          <span class="stat-value text-medium">{{ system?.uptimeFormatted || '0m' }}</span>
        </div>
        <div class="stat-footer margin-top-auto">
          <span>{{ system?.platform || 'Linux' }} ({{ system?.arch || 'x64' }})</span>
        </div>
      </div>
    </div>

    <!-- Host Specs & Environment -->
    <div class="specs-panel">
      <div class="panel-header">
        <div class="panel-title-group">
          <SvgIcon name="server" size="18" />
          <h3>Host Specifications</h3>
        </div>
        <span class="agent-tag">Burned Agent v1.0.0</span>
      </div>
      <div class="specs-grid">
        <div class="spec-item">
          <span class="spec-label">Hostname</span>
          <span class="spec-val">{{ system?.hostname || 'localhost' }}</span>
        </div>
        <div class="spec-item">
          <span class="spec-label">CPU Model</span>
          <span class="spec-val truncate" :title="system?.cpu?.model">{{ system?.cpu?.model || 'Generic CPU' }}</span>
        </div>
        <div class="spec-item">
          <span class="spec-label">Operating System</span>
          <span class="spec-val">{{ system?.type || 'Linux' }} {{ system?.release || '' }}</span>
        </div>
        <div class="spec-item">
          <span class="spec-label">Node Runtime</span>
          <span class="spec-val">{{ system?.nodeVersion || 'v20.0.0' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import SvgIcon from '../components/SvgIcon.vue'

const props = defineProps<{
  system: any
  pm2List: any[]
}>()

const pm2Summary = computed(() => {
  const list = props.pm2List || []
  let online = 0
  let stopped = 0
  let errored = 0
  for (const p of list) {
    if (p.status === 'online') online++
    else if (p.status === 'errored' || p.status === 'error') errored++
    else stopped++
  }
  return { total: list.length, online, stopped, errored }
})
</script>

<style scoped>
.dashboard-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.25rem;
}

.stat-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  transition: border-color 0.15s ease;
}

.stat-card:hover {
  border-color: var(--border-strong);
}

.stat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.stat-title {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 700;
  letter-spacing: 0.08em;
}

.stat-icon {
  color: var(--text-secondary);
  padding: 0.35rem;
  border-radius: 6px;
  background: var(--bg-surface-elevated);
  border: 1px solid var(--border-subtle);
}

.stat-value-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.stat-value {
  font-size: 2rem;
  font-weight: 800;
  color: var(--text-primary);
  font-family: var(--font-mono);
}

.stat-value.text-medium {
  font-size: 1.35rem;
}

.stat-sub {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.progress-bar-bg {
  width: 100%;
  height: 4px;
  background: #1a1a1a;
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 0.75rem;
}

.progress-bar-fill {
  height: 100%;
  background: #ffffff;
  border-radius: 2px;
  transition: width 0.4s ease;
}

.stat-footer {
  font-size: 0.75rem;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.margin-top-auto {
  margin-top: auto;
}

.pm2-pills {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.pill {
  font-size: 0.75rem;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: var(--bg-surface-elevated);
  border: 1px solid var(--border);
  color: var(--text-primary);
}

.status-marker {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-marker.filled {
  background: #ffffff;
}

.status-marker.hollow {
  border: 1px solid #737373;
}

.status-marker.cross {
  background: #a3a3a3;
}

.specs-panel {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1.25rem 1.5rem;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
}

.panel-title-group {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: var(--text-primary);
}

.panel-title-group h3 {
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.agent-tag {
  font-size: 0.7rem;
  font-weight: 700;
  font-family: var(--font-mono);
  padding: 0.2rem 0.55rem;
  border-radius: 4px;
  background: var(--bg-surface-elevated);
  color: var(--text-secondary);
  border: 1px solid var(--border);
}

.specs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.25rem;
}

.spec-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.spec-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.spec-val {
  font-size: 0.9rem;
  font-weight: 600;
  font-family: var(--font-mono);
  color: var(--text-primary);
}

.truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
