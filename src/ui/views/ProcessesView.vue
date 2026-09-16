<template>
  <div class="processes-view">
    <div class="view-header">
      <div class="header-titles">
        <h2>PM2 Process Manager</h2>
        <p class="subtitle">Active managed processes on this VDS instance.</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary" @click="$emit('refresh')" :disabled="loading">
          <SvgIcon name="refresh" size="14" :class="{ spinning: loading }" />
          <span>Refresh</span>
        </button>

      </div>
    </div>

    <!-- Process Table -->
    <div class="table-container" v-if="pm2List && pm2List.length > 0">
      <table class="pm2-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Status</th>
            <th>CPU</th>
            <th>Memory</th>
            <th>Restarts</th>
            <th>Uptime</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="proc in pm2List" :key="proc.pm_id">
            <td class="font-mono text-muted">#{{ proc.pm_id }}</td>
            <td>
              <div class="proc-name-cell">
                <span class="proc-name">{{ proc.name }}</span>
                <span v-if="proc.mode" class="proc-mode font-mono">{{ proc.mode }}</span>
              </div>
            </td>
            <td>
              <span class="status-pill" :class="`status-${proc.status}`">
                <span class="status-dot"></span>
                {{ proc.status }}
              </span>
            </td>
            <td class="font-mono">{{ proc.cpu }}%</td>
            <td class="font-mono">{{ proc.memoryFormatted }}</td>
            <td class="font-mono">{{ proc.restarts }}</td>
            <td class="text-muted">{{ proc.uptimeFormatted }}</td>
            <td class="text-right">
              <div class="action-buttons">
                <button
                  class="btn-icon"
                  title="View Process Logs"
                  @click="$emit('view-logs', proc.name)"
                >
                  <SvgIcon name="terminal" size="13" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Empty State -->
    <div class="empty-state" v-else>
      <div class="empty-icon">
        <SvgIcon name="server" size="32" />
      </div>
      <h3>No PM2 Processes Found</h3>
      <p>No managed processes are registered with the PM2 daemon on this instance.</p>
      <code class="empty-hint">pm2 start your-app.js</code>
    </div>


  </div>
</template>

<script setup lang="ts">
import SvgIcon from '../components/SvgIcon.vue'

defineProps<{
  pm2List: any[]
  loading?: boolean
}>()

defineEmits<{
  (e: 'refresh'): void
  (e: 'view-logs', appName: string): void
}>()
</script>

<style scoped>
.processes-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.header-titles h2 {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
}

.subtitle {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.85rem;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  transition: all 0.15s ease;
}

.btn-secondary {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  color: var(--text-primary);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--bg-surface-elevated);
  border-color: var(--border-strong);
}

.btn-outline {
  background: transparent;
  border: 1px solid var(--border-strong);
  color: var(--text-primary);
}

.btn-outline:hover:not(:disabled) {
  background: var(--bg-surface-elevated);
}

.table-container {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow-x: auto;
}

.pm2-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.85rem;
}

.pm2-table th {
  background: var(--bg-surface-elevated);
  padding: 0.75rem 1rem;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--border);
}

.pm2-table td {
  padding: 0.9rem 1rem;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-primary);
}

.pm2-table tr:last-child td {
  border-bottom: none;
}

.pm2-table tr:hover td {
  background: var(--bg-surface-hover);
}

.font-mono {
  font-family: var(--font-mono);
}

.proc-name-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.proc-name {
  font-weight: 600;
  color: var(--text-primary);
}

.proc-mode {
  font-size: 0.65rem;
  background: var(--bg-surface-elevated);
  border: 1px solid var(--border-subtle);
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  color: var(--text-muted);
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.15rem 0.55rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  background: var(--bg-surface-elevated);
  border: 1px solid var(--border);
  color: var(--text-primary);
  text-transform: capitalize;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-online .status-dot {
  background: #ffffff;
}

.status-stopped .status-dot {
  border: 1px solid #737373;
}

.status-errored .status-dot,
.status-error .status-dot {
  background: #737373;
}

.text-right {
  text-align: right;
}

.action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 0.35rem;
}

.btn-icon {
  padding: 0.35rem 0.5rem;
  border-radius: 6px;
  background: var(--bg-surface-elevated);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  transition: all 0.15s ease;
}

.btn-icon:hover:not(:disabled) {
  background: var(--bg-surface-hover);
  color: var(--text-primary);
  border-color: var(--border-strong);
}

.btn-icon:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.empty-state {
  background: var(--bg-surface);
  border: 1px dashed var(--border);
  border-radius: 10px;
  padding: 3.5rem 1.5rem;
  text-align: center;
}

.empty-icon {
  color: var(--text-muted);
  margin-bottom: 0.75rem;
}

.empty-hint {
  margin-top: 0.75rem;
  display: inline-block;
  background: #000000;
  border: 1px solid var(--border);
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 0.8rem;
}

.spinning {
  animation: spin 1s infinite linear;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
