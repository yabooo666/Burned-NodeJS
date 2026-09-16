<template>
  <div class="login-container">
    <div class="login-card">
      <div class="card-header">
        <img :src="logoImg" alt="Burned Logo" class="auth-logo" />
        <h1 class="auth-title">BURNED NODEJS</h1>
        <p class="auth-subtitle">Enter admin password to access VDS instance</p>
      </div>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label class="form-label">
            <SvgIcon name="lock" size="14" />
            Master Password
          </label>
          <input
            v-model="password"
            type="password"
            placeholder="Enter password..."
            class="form-input"
            required
            autofocus
            autocomplete="current-password"
          />
        </div>

        <div v-if="errorMessage" class="form-error">
          <SvgIcon name="alert" size="14" />
          <span>{{ errorMessage }}</span>
        </div>

        <button type="submit" class="submit-btn" :disabled="loading">
          <span v-if="loading">Verifying...</span>
          <span v-else>Unlock Dashboard</span>
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
  (e: 'authenticated', token: string): void
}>()

const password = ref('')
const loading = ref(false)
const errorMessage = ref('')

async function handleLogin() {
  if (!password.value) return
  errorMessage.value = ''
  loading.value = true

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password.value })
    })

    const data = await res.json()
    if (data.success && data.token) {
      emit('authenticated', data.token)
    } else {
      errorMessage.value = data.error || 'Invalid admin password'
      password.value = ''
    }
  } catch (err: any) {
    errorMessage.value = 'Network error: ' + err.message
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background-color: var(--bg-oled);
}

.login-card {
  width: 100%;
  max-width: 400px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 2.25rem 2rem;
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
  margin-bottom: 0.25rem;
}

.auth-title {
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  color: var(--text-primary);
}

.auth-subtitle {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
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
  margin-top: 0.25rem;
}

.submit-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
