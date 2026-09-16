import { DatabaseSync } from 'node:sqlite'
import crypto from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs'

const DB_PATH = process.env.BURNED_DB_PATH || path.join(process.cwd(), 'burned.db')

let db: DatabaseSync

export function initDb() {
  db = new DatabaseSync(DB_PATH)

  // Initialize tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
  `)

  checkInitialization()
}

function getConfig(key: string): string | null {
  const stmt = db.prepare('SELECT value FROM config WHERE key = ?')
  const row = stmt.get(key) as { value: string } | undefined
  return row ? row.value : null
}

function setConfig(key: string, value: string) {
  const stmt = db.prepare('INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
  stmt.run(key, value)
}

function deleteConfig(key: string) {
  const stmt = db.prepare('DELETE FROM config WHERE key = ?')
  stmt.run(key)
}

export function isInitialized(): boolean {
  return getConfig('is_initialized') === 'true'
}

export function getTempSetupKey(): string | null {
  return getConfig('temp_setup_key')
}

function generateComplexKey(length = 48): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!?.;#$@&=+-_~%'
  let key = ''
  const randomBytes = crypto.randomBytes(length)
  for (let i = 0; i < length; i++) {
    key += charset[randomBytes[i] % charset.length]
  }
  return key
}

function checkInitialization() {
  if (isInitialized()) {
    return
  }

  // If not initialized, ensure we have a temporary setup key
  let tempKey = getTempSetupKey()
  if (!tempKey) {
    tempKey = generateComplexKey(48)
    setConfig('temp_setup_key', tempKey)
  }

  // Print prominent ASCII box for terminal / pm2 logs
  const border = '═'.repeat(74)
  const line = '─'.repeat(74)

  console.log('\n' + border)
  console.log('║ [!] NO PASSWORD CONFIGURED! TEMPORARY MASTER KEY GENERATED               ║')
  console.log('║ Check pm2 logs or terminal below to retrieve the initial setup key:     ║')
  console.log(line)
  console.log(`║ KEY: ${tempKey}  ║`)
  console.log(line)
  console.log('║ Open the Web UI and paste this key to complete admin registration.       ║')
  console.log(border + '\n')
}

export function verifyTempKey(key: string): boolean {
  if (isInitialized()) return false
  const stored = getTempSetupKey()
  if (!stored) return false
  const keyBuf = Buffer.from(key)
  const storedBuf = Buffer.from(stored)
  if (keyBuf.length !== storedBuf.length) return false
  return crypto.timingSafeEqual(keyBuf, storedBuf)
}

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return { hash, salt }
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const calculatedHash = crypto.scryptSync(password, salt, 64).toString('hex')
  const calcBuf = Buffer.from(calculatedHash)
  const hashBuf = Buffer.from(hash)
  if (calcBuf.length !== hashBuf.length) return false
  return crypto.timingSafeEqual(calcBuf, hashBuf)
}

export function createSession(): string {
  const token = crypto.randomBytes(32).toString('hex')
  const now = Date.now()
  const expiresAt = now + (1000 * 60 * 60 * 24 * 7) // 7 days
  const stmt = db.prepare('INSERT INTO sessions (token, created_at, expires_at) VALUES (?, ?, ?)')
  stmt.run(token, now, expiresAt)
  return token
}

export function validateSession(token: string): boolean {
  if (!token) return false
  const stmt = db.prepare('SELECT expires_at FROM sessions WHERE token = ?')
  const row = stmt.get(token) as { expires_at: number } | undefined
  if (!row) return false
  if (Date.now() > row.expires_at) {
    revokeSession(token)
    return false
  }
  return true
}

export function revokeSession(token: string) {
  const stmt = db.prepare('DELETE FROM sessions WHERE token = ?')
  stmt.run(token)
}

export function registerAdminPassword(tempKey: string, password: string): { success: boolean; token?: string; error?: string } {
  if (isInitialized()) {
    return { success: false, error: 'Admin is already registered' }
  }

  if (!verifyTempKey(tempKey)) {
    return { success: false, error: 'Invalid temporary setup key' }
  }

  if (!password || password.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters long' }
  }

  const { hash, salt } = hashPassword(password)
  setConfig('admin_password_hash', hash)
  setConfig('admin_password_salt', salt)
  setConfig('is_initialized', 'true')
  deleteConfig('temp_setup_key')

  // Generate initial session token
  const token = createSession()
  return { success: true, token }
}

export function authenticateAdmin(password: string): { success: boolean; token?: string; error?: string } {
  if (!isInitialized()) {
    return { success: false, error: 'System is not initialized' }
  }

  const hash = getConfig('admin_password_hash')
  const salt = getConfig('admin_password_salt')
  if (!hash || !salt) {
    return { success: false, error: 'Internal configuration error' }
  }

  if (verifyPassword(password, hash, salt)) {
    const token = createSession()
    return { success: true, token }
  }

  return { success: false, error: 'Invalid password' }
}

export function closeDb() {
  if (db) {
    db.close()
  }
}
