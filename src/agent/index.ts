import http from 'node:http'
import { getSystemMetrics, getPm2List, executePm2Command, getProcessLogs } from './system.js'
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

const PORT = parseInt(process.env.PORT || '27109', 10)
const HOST = process.env.HOST || '0.0.0.0'

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
  } catch {}
  return ''
}

function isAuthenticated(req: http.IncomingMessage): boolean {
  const token = getSessionToken(req)
  return validateSession(token)
}

function sendJson(res: http.ServerResponse, status: number, data: any) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-burned-token'
  })
  res.end(JSON.stringify(data))
}

function readJsonBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => { body += chunk })
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

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-burned-token'
    })
    res.end()
    return
  }

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

  // Login with Password (open)
  if (req.method === 'POST' && pathname === '/api/auth/login') {
    try {
      const { password } = await readJsonBody(req)
      const result = authenticateAdmin(password)
      sendJson(res, result.success ? 200 : 401, result)
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

    // API: PM2 Actions (restart, stop, reload)
    if (req.method === 'POST' && pathname === '/api/pm2/action') {
      try {
        const { action, id } = await readJsonBody(req)
        if (!action) {
          sendJson(res, 400, { success: false, error: 'Missing action parameter' })
          return
        }
        const result = await executePm2Command(action, id)
        sendJson(res, result.success ? 200 : 500, result)
      } catch (err: any) {
        sendJson(res, 400, { success: false, error: err.message })
      }
      return
    }

    // API: SSE Real-Time Stream (requires token in query param or header)
    if (req.method === 'GET' && pathname === '/api/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
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
  console.log(`[Burned-Agent] Listening on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`)
  console.log(`[Burned-Agent] PID: ${process.pid} | Platform: ${process.platform} (${process.arch})`)
})

// PM2 Graceful Shutdown
function handleShutdown(signal: string) {
  console.log(`\n[Burned-Agent] Received ${signal}. Closing gracefully...`)
  for (const client of sseClients) {
    try { client.end() } catch {}
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
