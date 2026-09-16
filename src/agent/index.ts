import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { getSystemMetrics, getPm2List, getProcessLogs } from './system.js'
import { EMBEDDED_HTML } from './embedded-ui.js'
import {
  initDb,
  isInitialized,
  verifyTempKey,
  registerAdminPassword,
  authenticateAdmin,
  validateSession,
  revokeSession,
  closeDb
} from './db.js'

// Automatically load .env file if present
try {
  const envPath = path.resolve(process.cwd(), '.env')
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8')
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim()
        let val = trimmed.slice(eqIdx + 1).trim()
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1)
        }
        if (process.env[key] === undefined) {
          process.env[key] = val
        }
      }
    }
  }
} catch {}

const PORT = parseInt(process.env.PORT || '27109', 10)
const HOST = process.env.HOST || '127.0.0.1'

// In-memory rate limiter (resets on service restart)
const rateLimiter = new Map<string, { count: number; lockedUntil: number }>()

// Initialize SQLite database & first-run checks
initDb()

// Active SSE client connections
const sseClients = new Set<http.ServerResponse>()

function getSessionToken(req: http.IncomingMessage): string {
  const authHeader = req.headers['authorization']
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim()
  }
  const customHeader = req.headers['x-burned-token']
  if (typeof customHeader === 'string' && customHeader) {
    return customHeader.trim()
  }
  try {
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`)
    const queryToken = url.searchParams.get('token')
    if (queryToken) return queryToken.trim()
  } catch { }
  return ''
}

function isAuthenticated(req: http.IncomingMessage): boolean {
  const token = getSessionToken(req)
  return validateSession(token)
}

function addSecurityHeaders(res: http.ServerResponse) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data:; connect-src 'self'; frame-ancestors 'none'")
}

function sendJson(res: http.ServerResponse, status: number, data: any) {
  addSecurityHeaders(res)
  res.writeHead(status, {
    'Content-Type': 'application/json'
  })
  res.end(JSON.stringify(data))
}

const MAX_BODY_SIZE = 5 * 1024 * 1024 // 5MB

function readJsonBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = ''
    let size = 0
    req.on('data', (chunk: Buffer | string) => {
      size += typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length
      if (size > MAX_BODY_SIZE) {
        req.destroy()
        reject(new Error('Request body too large'))
        return
      }
      body += chunk
    })
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch (err) {
        reject(new Error('Invalid JSON payload'))
      }
    })
    req.on('error', reject)
  })
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  const pathname = url.pathname



  // Healthcheck endpoint (open)
  if (pathname === '/health' || pathname === '/api/health') {
    sendJson(res, 200, { status: 'healthy', uptime: process.uptime() })
    return
  }

  // Auth Status Endpoint (open)
  if (req.method === 'GET' && pathname === '/api/auth/status') {
    sendJson(res, 200, {
      initialized: isInitialized(),
      authenticated: isAuthenticated(req)
    })
    return
  }

  // Verify Temporary Setup Key (open, for setup wizard)
  if (req.method === 'POST' && pathname === '/api/auth/verify-temp-key') {
    try {
      const { tempKey } = await readJsonBody(req)
      if (!tempKey) {
        sendJson(res, 400, { valid: false, error: 'Missing temporary key' })
        return
      }
      const valid = verifyTempKey(tempKey)
      sendJson(res, valid ? 200 : 401, { valid })
    } catch (err: any) {
      sendJson(res, 400, { valid: false, error: err.message })
    }
    return
  }

  // Register Admin Password (open, only works with valid tempKey)
  if (req.method === 'POST' && pathname === '/api/auth/setup-password') {
    try {
      const { tempKey, password } = await readJsonBody(req)
      const result = registerAdminPassword(tempKey, password)
      sendJson(res, result.success ? 200 : 400, result)
    } catch (err: any) {
      sendJson(res, 400, { success: false, error: err.message })
    }
    return
  }

  // Login with Password (rate-limited: 3 failures = 24h lockout, resets on restart)
  if (req.method === 'POST' && pathname === '/api/auth/login') {
    const clientIp = req.socket.remoteAddress || 'unknown'
    const rl = rateLimiter.get(clientIp)
    if (rl && rl.lockedUntil > Date.now()) {
      const hoursLeft = Math.ceil((rl.lockedUntil - Date.now()) / (1000 * 60 * 60))
      sendJson(res, 429, { success: false, error: `Too many failed attempts. Locked for ${hoursLeft}h. Restart the service to reset.` })
      return
    }
    try {
      const { password } = await readJsonBody(req)
      const result = authenticateAdmin(password)
      if (result.success) {
        rateLimiter.delete(clientIp)
        sendJson(res, 200, result)
      } else {
        const entry = rateLimiter.get(clientIp) || { count: 0, lockedUntil: 0 }
        entry.count++
        if (entry.count >= 3) {
          entry.lockedUntil = Date.now() + (24 * 60 * 60 * 1000)
        }
        rateLimiter.set(clientIp, entry)
        const remaining = 3 - entry.count
        if (remaining > 0) {
          sendJson(res, 401, { success: false, error: `Invalid password. ${remaining} attempt(s) remaining before 24h lockout.` })
        } else {
          sendJson(res, 429, { success: false, error: 'Too many failed attempts. Locked for 24h. Restart the service to reset.' })
        }
      }
    } catch (err: any) {
      sendJson(res, 400, { success: false, error: err.message })
    }
    return
  }

  // Logout (requires token)
  if (req.method === 'POST' && pathname === '/api/auth/logout') {
    const token = getSessionToken(req)
    if (token) revokeSession(token)
    sendJson(res, 200, { success: true })
    return
  }

  // --- PROTECTED API ENDPOINTS (Require Session Token) ---
  if (pathname.startsWith('/api/')) {
    if (!isAuthenticated(req)) {
      sendJson(res, 401, { error: 'Unauthorized: valid session token required' })
      return
    }

    // API: System Metrics
    if (req.method === 'GET' && pathname === '/api/system') {
      sendJson(res, 200, getSystemMetrics())
      return
    }

    // API: PM2 Process List
    if (req.method === 'GET' && pathname === '/api/pm2') {
      const list = await getPm2List()
      sendJson(res, 200, list)
      return
    }

    // API: Live PM2 Process Logs
    if (req.method === 'GET' && pathname === '/api/pm2/logs') {
      const appFilter = url.searchParams.get('app') || 'all'
      const lines = parseInt(url.searchParams.get('lines') || '100', 10)
      const severity = (url.searchParams.get('severity') as 'all' | 'critical') || 'all'
      const logs = await getProcessLogs(appFilter, lines, severity)
      sendJson(res, 200, logs)
      return
    }



    // API: SSE Real-Time Stream (max 50 concurrent connections)
    if (req.method === 'GET' && pathname === '/api/events') {
      if (sseClients.size >= 50) {
        sendJson(res, 503, { error: 'Maximum concurrent connections reached' })
        return
      }
      addSecurityHeaders(res)
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      })
      res.write(': connected\n\n')

      sseClients.add(res)
      req.on('close', () => {
        sseClients.delete(res)
      })
      return
    }

    sendJson(res, 404, { error: 'Not Found' })
    return
  }

  // Web UI: Serve Embedded Single-Page App for any non-API route
  if (req.method === 'GET') {
    addSecurityHeaders(res)
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache'
    })
    res.end(EMBEDDED_HTML)
    return
  }

  sendJson(res, 404, { error: 'Not Found' })
})

// Real-time broadcast loop for authenticated SSE clients
setInterval(async () => {
  if (sseClients.size === 0) return
  try {
    const system = getSystemMetrics()
    const pm2 = await getPm2List()
    const payload = `data: ${JSON.stringify({ system, pm2 })}\n\n`
    for (const client of sseClients) {
      client.write(payload)
    }
  } catch (e) {
    // broadcast error
  }
}, 1500)

// Start Server
server.listen(PORT, HOST, () => {
  console.log(`[Burned-Agent] Listening on http://${HOST}:${PORT}`)
  console.log(`[Burned-Agent] PID: ${process.pid} | Platform: ${process.platform} (${process.arch})`)
})

// PM2 Graceful Shutdown
function handleShutdown(signal: string) {
  console.log(`\n[Burned-Agent] Received ${signal}. Closing gracefully...`)
  for (const client of sseClients) {
    try { client.end() } catch { }
  }
  server.close(() => {
    closeDb()
    console.log('[Burned-Agent] Database closed. Server shutdown complete.')
    process.exit(0)
  })
  setTimeout(() => process.exit(0), 4000)
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'))
process.on('SIGINT', () => handleShutdown('SIGINT'))
