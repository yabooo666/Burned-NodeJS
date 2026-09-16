<template>
  <div v-if="isOpen" class="modal-backdrop" @click.self="cancel">
    <div class="modal-dialog" role="dialog" aria-modal="true">
      <div class="modal-header">
        <div class="modal-icon-title">
          <SvgIcon name="alert" size="18" />
          <h3>{{ title }}</h3>
        </div>
        <button class="close-btn" @click="cancel" title="Close">
          <SvgIcon name="stop" size="12" />
        </button>
      </div>

      <div class="modal-body">
        <p class="modal-message">{{ message }}</p>
        <p v-if="warning" class="modal-warning">
          <span class="warning-tag">WARNING</span>
          {{ warning }}
        </p>
      </div>

      <div class="modal-footer">
        <button class="btn btn-cancel" @click="cancel">
          Cancel
        </button>
        <button class="btn btn-confirm" @click="confirm">
          {{ confirmText || 'Confirm' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import SvgIcon from './SvgIcon.vue'

defineProps<{
  isOpen: boolean
  title: string
  message: string
  warning?: string
  confirmText?: string
}>()

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

function confirm() {
  emit('confirm')
}

function cancel() {
  emit('cancel')
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  animation: fadeIn 0.15s ease;
}

.modal-dialog {
  width: 100%;
  max-width: 440px;
  background: #0a0a0a;
  border: 1px solid #2e2e2e;
  border-radius: 12px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.95);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: scaleIn 0.15s ease;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #1a1a1a;
}

.modal-icon-title {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: #ffffff;
}

.modal-icon-title h3 {
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.close-btn {
  color: #737373;
  padding: 0.35rem;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.close-btn:hover {
  color: #ffffff;
  background: #171717;
}

.modal-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.modal-message {
  font-size: 0.875rem;
  color: #d4d4d4;
  line-height: 1.5;
}

.modal-warning {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: #a3a3a3;
  background: #121212;
  border: 1px solid #262626;
  padding: 0.75rem;
  border-radius: 6px;
  line-height: 1.4;
}

.warning-tag {
  font-size: 0.65rem;
  font-weight: 800;
  font-family: var(--font-mono);
  background: #ffffff;
  color: #000000;
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
  flex-shrink: 0;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid #1a1a1a;
  background: #080808;
}

.btn {
  padding: 0.55rem 1rem;
  border-radius: 6px;
  font-size: 0.825rem;
  font-weight: 600;
  transition: all 0.15s ease;
}

.btn-cancel {
  background: #121212;
  border: 1px solid #262626;
  color: #a3a3a3;
}

.btn-cancel:hover {
  background: #1a1a1a;
  color: #ffffff;
  border-color: #404040;
}

.btn-confirm {
  background: #ffffff;
  color: #000000;
  border: 1px solid #ffffff;
}

.btn-confirm:hover {
  background: #e5e5e5;
  border-color: #e5e5e5;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleIn {
  from { transform: scale(0.95); }
  to { transform: scale(1); }
}
</style>
