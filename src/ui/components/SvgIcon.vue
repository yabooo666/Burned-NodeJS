<template>
  <svg
    :width="size || 16"
    :height="size || 16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth || 2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="svg-icon"
  >
    <!-- Server -->
    <g v-if="name === 'server'">
      <rect width="20" height="8" x="2" y="2" rx="2" ry="2"/>
      <rect width="20" height="8" x="2" y="14" rx="2" ry="2"/>
      <line x1="6" x2="6.01" y1="6" y2="6"/>
      <line x1="6" x2="6.01" y1="18" y2="18"/>
    </g>

    <!-- CPU -->
    <g v-else-if="name === 'cpu'">
      <rect width="16" height="16" x="4" y="4" rx="2"/>
      <rect width="6" height="6" x="9" y="9"/>
      <path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/>
      <path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/>
    </g>

    <!-- RAM / Memory -->
    <g v-else-if="name === 'ram'">
      <path d="M6 19v-3"/><path d="M10 19v-3"/><path d="M14 19v-3"/><path d="M18 19v-3"/>
      <rect width="20" height="12" x="2" y="4" rx="2"/>
    </g>

    <!-- PM2 / Rocket -->
    <g v-else-if="name === 'pm2'">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
    </g>

    <!-- Uptime / Clock -->
    <g v-else-if="name === 'clock'">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </g>

    <!-- Terminal -->
    <g v-else-if="name === 'terminal'">
      <polyline points="4 17 10 11 4 5"/>
      <line x1="12" x2="20" y1="19" y2="19"/>
    </g>

    <!-- Refresh -->
    <g v-else-if="name === 'refresh'">
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/>
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
      <path d="M16 21h5v-5"/>
    </g>

    <!-- Restart / Rotate -->
    <g v-else-if="name === 'restart'">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/>
    </g>

    <!-- Stop / Square -->
    <g v-else-if="name === 'stop'">
      <rect width="14" height="14" x="5" y="5" rx="2"/>
    </g>

    <!-- Play / Start -->
    <g v-else-if="name === 'play'">
      <polygon points="6 3 20 12 6 21 6 3"/>
    </g>

    <!-- Reload / Lightning -->
    <g v-else-if="name === 'reload'">
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>
    </g>

    <!-- Copy -->
    <g v-else-if="name === 'copy'">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
    </g>

    <!-- Check -->
    <g v-else-if="name === 'check'">
      <polyline points="20 6 9 17 4 12"/>
    </g>

    <!-- Trash -->
    <g v-else-if="name === 'trash'">
      <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
    </g>

    <!-- Lock -->
    <g v-else-if="name === 'lock'">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </g>

    <!-- Key -->
    <g v-else-if="name === 'key'">
      <path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/>
      <path d="m21 2-9.6 9.6"/>
      <circle cx="7.5" cy="15.5" r="5.5"/>
    </g>

    <!-- Shield -->
    <g v-else-if="name === 'shield'">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
    </g>

    <!-- Logout -->
    <g v-else-if="name === 'logout'">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" x2="9" y1="12" y2="12"/>
    </g>

    <!-- Alert / Warning -->
    <g v-else-if="name === 'alert'">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" x2="12" y1="8" y2="12"/>
      <line x1="12" x2="12.01" y1="16" y2="16"/>
    </g>

    <!-- Dashboard / Grid -->
    <g v-else-if="name === 'dashboard'">
      <rect width="7" height="9" x="3" y="3" rx="1"/>
      <rect width="7" height="5" x="14" y="3" rx="1"/>
      <rect width="7" height="9" x="14" y="12" rx="1"/>
      <rect width="7" height="5" x="3" y="16" rx="1"/>
    </g>

    <!-- Processes -->
    <g v-else-if="name === 'processes'">
      <rect width="18" height="18" x="3" y="3" rx="2"/>
      <path d="M3 9h18"/><path d="M9 21V9"/>
    </g>
  </svg>
</template>

<script setup lang="ts">
defineProps<{
  name: string
  size?: number | string
  strokeWidth?: number | string
}>()
</script>

<style scoped>
.svg-icon {
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
}
</style>
