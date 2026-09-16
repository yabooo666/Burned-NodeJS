<template>
  <div class="setup-container">
    <div class="setup-card">
      <div class="card-header">
        <img :src="logoImg" alt="Burned Logo" class="auth-logo" />
        <h1 class="auth-title">BURNED NODEJS</h1>
        <div class="status-tag">INITIAL SETUP REQUIRED</div>
      </div>

      <!-- Notice Box -->
      <div class="alert-box">
        <div class="alert-icon">
          <SvgIcon name="shield" size="20" />
        </div>
        <div class="alert-content">
          <div class="alert-title">NO PASSWORD CONFIGURED</div>
          <div class="alert-desc">
            A temporary master key was generated on startup. Check your server terminal or run
            <code>pm2 logs burned-agent</code> to retrieve it.
          </div>
        </div>
      </div>

      <!-- Step 1: Verify Temp Key -->
      <form @submit.prevent="handleSubmit" class="setup-form">
        <div class="form-group">
          <label class="form-label">
            <SvgIcon name="key" size="14" />
            Temporary Master Key
          </label>
          <input
            v-model="tempKey"
            type="text"
            placeholder="Paste 48-character key from terminal logs..."
            class="form-input font-mono"
            required
            autocomplete="off"
            spellcheck="false"
          />
        </div>

        <div class="form-divider"></div>

        <!-- Step 2: New Admin Password -->
        <div class="form-group">
          <label class="form-label">
            <SvgIcon name="lock" size="14" />
            New Admin Password
          </label>
          <input
            v-model="password"
            type="password"
            placeholder="Minimum 8 characters..."
            class="form-input"
            required
            autocomplete="new-password"
          />
        </div>

        <div class="form-group">
          <label class="form-label">
            <SvgIcon name="check" size="14" />
            Confirm Password
          </label>
          <input
            v-model="confirmPassword"
            type="password"
            placeholder="Re-enter password..."
            class="form-input"
            required
            autocomplete="new-password"
          />
        </div>

        <div v-if="errorMessage" class="form-error">
          <SvgIcon name="alert" size="14" />
          <span>{{ errorMessage }}</span>
        </div>

        <button type="submit" class="submit-btn" :disabled="loading">
          <span v-if="loading">Configuring...</span>
          <span v-else>Register Master Password</span>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import logoImg from '../assets/logo.png'
import SvgIcon from '../components/SvgIcon.vue'

const emit = defineEmits<{
  (e: 'completed', token: string): void
}>()

const tempKey = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const errorMessage = ref('')

async function handleSubmit() {
  errorMessage.value = ''

  if (!tempKey.value.trim()) {
    errorMessage.value = 'Please paste the temporary master key from terminal logs'
    return
  }

  if (password.value.length < 8) {
    errorMessage.value = 'Password must be at least 8 characters long'
    return
  }

  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'Passwords do not match'
    return
  }

  loading.value = true
  try {
    const res = await fetch('/api/auth/setup-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tempKey: tempKey.value.trim(),
        password: password.value
      })
    })

    const data = await res.json()
    if (data.success && data.token) {
      emit('completed', data.token)
    } else {
      errorMessage.value = data.error || 'Failed to set admin password'
    }
  } catch (err: any) {
    errorMessage.value = 'Network error: ' + err.message
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.setup-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background-color: var(--bg-oled);
}

.setup-card {
  width: 100%;
  max-width: 480px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.card-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.5rem;
}

.auth-logo {
  width: 64px;
  height: 64px;
  border-radius: 14px;
  border: 1px solid var(--border);
}

.auth-title {
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  color: var(--text-primary);
}

.status-tag {
  font-size: 0.7rem;
  font-weight: 700;
  font-family: var(--font-mono);
  padding: 0.2rem 0.6rem;
  border-radius: 4px;
  background: var(--bg-surface-elevated);
  border: 1px solid var(--border);
  color: var(--text-secondary);
}

.alert-box {
  display: flex;
  gap: 0.85rem;
  padding: 1rem;
  border-radius: 8px;
  background: var(--bg-surface-elevated);
  border: 1px solid var(--border-strong);
}

.alert-icon {
  color: var(--text-primary);
  margin-top: 0.1rem;
}

.alert-title {
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.alert-desc {
  font-size: 0.8rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.alert-desc code {
  font-family: var(--font-mono);
  background: #000000;
  padding: 0.15rem 0.35rem;
  border-radius: 4px;
  border: 1px solid var(--border);
  color: #ffffff;
}

.setup-form {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.form-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.form-input {
  width: 100%;
}

.font-mono {
  font-family: var(--font-mono);
  font-size: 0.825rem;
}

.form-divider {
  height: 1px;
  background: var(--border-subtle);
  margin: 0.25rem 0;
}

.form-error {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.6rem 0.8rem;
  border-radius: 6px;
  background: #171717;
  border: 1px solid #404040;
  color: #ffffff;
  font-size: 0.8rem;
  font-weight: 500;
}

.submit-btn {
  width: 100%;
  padding: 0.75rem;
  border-radius: 8px;
  background: var(--btn-primary-bg);
  color: var(--btn-primary-text);
  font-weight: 700;
  font-size: 0.9rem;
  transition: opacity 0.2s ease;
  margin-top: 0.5rem;
}

.submit-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
