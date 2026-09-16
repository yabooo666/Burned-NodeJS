import os from 'node:os'
import fs from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

let prevCpus = os.cpus()

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / (3600 * 24))
  const hours = Math.floor((seconds % (3600 * 24)) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export function getCpuUsagePercent(): number {
  const currentCpus = os.cpus()
  let idleDiff = 0
  let totalDiff = 0

  for (let i = 0; i < currentCpus.length; i++) {
    const prev = prevCpus[i]?.times || { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 }
    const curr = currentCpus[i].times

    const prevTotal = prev.user + prev.nice + prev.sys + prev.idle + prev.irq
    const currTotal = curr.user + curr.nice + curr.sys + curr.idle + curr.irq

    idleDiff += curr.idle - prev.idle
    totalDiff += currTotal - prevTotal
  }

  prevCpus = currentCpus
  if (totalDiff === 0) return 0
  const usage = 100 - (idleDiff / totalDiff) * 100
  return Math.max(0, Math.min(100, Math.round(usage * 10) / 10))
}

export function getSystemMetrics() {
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const usedMem = totalMem - freeMem
  const memUsagePercent = Math.round((usedMem / totalMem) * 1000) / 10

  const cpus = os.cpus()
  const cpuModel = cpus[0]?.model || 'Unknown'
  const loadAvg = os.loadavg().map(v => v.toFixed(2))

  return {
    hostname: os.hostname(),
    platform: os.platform(),
    type: os.type(),
    release: os.release(),
    arch: os.arch(),
    nodeVersion: process.version,
    uptimeSeconds: os.uptime(),
    uptimeFormatted: formatUptime(os.uptime()),
    cpu: {
      model: cpuModel,
      cores: cpus.length,
      usagePercent: getCpuUsagePercent(),
      loadAvg
    },
    memory: {
      total: totalMem,
      used: usedMem,
      free: freeMem,
      totalFormatted: formatBytes(totalMem),
      usedFormatted: formatBytes(usedMem),
      freeFormatted: formatBytes(freeMem),
      usagePercent: memUsagePercent
    }
  }
}

export interface Pm2ProcessInfo {
  pm_id: number
  name: string
  status: string
  cpu: number
  memory: number
  memoryFormatted: string
  restarts: number
  uptimeFormatted: string
  mode: string
  out_log_path?: string
  err_log_path?: string
}

function readLastLinesFromFile(filePath: string, maxLines = 100): string[] {
  try {
    if (!fs.existsSync(filePath)) return []
    const stat = fs.statSync(filePath)
    if (!stat.isFile() || stat.size === 0) return []
    const bytesToRead = Math.min(stat.size, 128 * 1024) // last 128KB
    const fd = fs.openSync(filePath, 'r')
    const buffer = Buffer.alloc(bytesToRead)
    fs.readSync(fd, buffer, 0, bytesToRead, stat.size - bytesToRead)
    fs.closeSync(fd)
    const lines = buffer.toString('utf-8').split('\n').filter((l: string) => l.trim().length > 0)
    return lines.slice(-maxLines)
  } catch {
    return []
  }
}

/**
 * Strips all ANSI escape sequences, color codes, and unprintable terminal artifacts.
 */
function cleanAnsiAndControl(raw: string): string {
  if (!raw) return ''
  return raw
    // Standard ANSI escape sequences (\x1b[...] or \u001b[... or \u009b[...)
    .replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
    // Orphan ANSI color codes if ESC char was stripped: e.g. [32m, [39m, [38;5;3m, [0m
    .replace(/\[(?:\d{1,3}(?:;\d{1,3})*)m/g, '')
    // Stray ESC or bracketed codes
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    // Non-printable control characters except newline & tab
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
}

/**
 * Extracts a clean time string (e.g. "18:09:21" or "6:09:21 PM").
 */
function extractTime(raw: string): string {
  if (!raw) return ''
  const timeWithAmPm = raw.match(/(\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM)?)/i)
  if (timeWithAmPm) return timeWithAmPm[1].trim()

  const timeIso = raw.match(/(\d{2}:\d{2}:\d{2})/i)
  if (timeIso) return timeIso[1].trim()

  return raw.trim()
}

export interface ProcessLogEntry {
  source: string
  text: string
  level: 'info' | 'error' | 'critical'
  timestamp?: string
}

function parseLogLine(rawLine: string, source: string, defaultLevel: 'info' | 'error'): ProcessLogEntry {
  let text = cleanAnsiAndControl(rawLine).trim()
  let timestamp = ''
  let level: 'info' | 'error' | 'critical' = defaultLevel

  // 1. PM2 / ISO timestamp at beginning: "2026-09-16T04:58:33:" or "[2026-09-16 04:58:33]"
  const isoMatch = text.match(/^\[?(\d{4}[-/]\d{2}[-/]\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)\]?:?\s*/)
  if (isoMatch) {
    timestamp = extractTime(isoMatch[1])
    text = text.slice(isoMatch[0].length).trim()
  }

  // 2. NestJS timestamp format: "[Nest] 644441  - 09/15/2026, 6:09:21 PM     LOG [RouterExplorer] ..."
  if (!timestamp) {
    const nestMatch = text.match(/^(\[Nest\]\s*(?:\d+\s*-\s*)?)(\d{1,2}\/\d{1,2}\/\d{4},\s*\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM)?)\s+(.*)$/i)
    if (nestMatch) {
      timestamp = extractTime(nestMatch[2])
      const prefix = nestMatch[1] ? nestMatch[1].trim() + ' ' : ''
      text = `${prefix}${nestMatch[3]}`.trim()
    }
  }

  // 3. Bracketed or standalone time at beginning: "[18:09:21]" or "18:09:21 "
  if (!timestamp) {
    const timeMatch = text.match(/^\[?(\d{2}:\d{2}:\d{2}(?:\s*(?:AM|PM))?)\]?:?\s*/)
    if (timeMatch) {
      timestamp = timeMatch[1].trim()
      text = text.slice(timeMatch[0].length).trim()
    }
  }

  // Crash and critical error detection
  const isCrash = /(?:FATAL|EXCEPTION|UNHANDLED|SIGSEGV|SIGABRT|SYNTAXERROR|TYPEERROR|REFERENCEERROR|EADDRINUSE|MODULE_NOT_FOUND|EXITED WITH CODE|CRASH)/i.test(text)
  if (isCrash) {
    level = 'critical'
  } else if (defaultLevel === 'error' || /\b(?:ERROR|ERR)\b/i.test(text)) {
    level = 'error'
  }

  return { source, text, level, timestamp }
}

export async function getProcessLogs(
  appFilter?: string | number,
  maxLines = 100,
  severityFilter: 'all' | 'critical' = 'all'
): Promise<ProcessLogEntry[]> {
  try {
    const { stdout } = await execFileAsync('pm2', ['jlist'], { timeout: 4000 })
    const list = JSON.parse(stdout)
    if (!Array.isArray(list) || list.length === 0) return []

    const targetApps = list.filter((item: any) => {
      if (!appFilter || appFilter === 'all') return true
      return String(item.pm_id) === String(appFilter) || item.name === String(appFilter)
    })

    const results: ProcessLogEntry[] = []

    for (const app of targetApps) {
      const appName = app.name || `proc-${app.pm_id}`
      const outPath = app.pm2_env?.pm_out_log_path
      const errPath = app.pm2_env?.pm_err_log_path

      // Read stdout
      if (outPath && severityFilter !== 'critical') {
        const outLines = readLastLinesFromFile(outPath, maxLines)
        for (const line of outLines) {
          results.push(parseLogLine(line, appName, 'info'))
        }
      }

      // Read stderr (always read, highest priority for crashes)
      if (errPath) {
        const errLines = readLastLinesFromFile(errPath, maxLines)
        for (const line of errLines) {
          const entry = parseLogLine(line, appName, 'error')
          results.push(entry)
        }
      }
    }

    // If direct files were empty, fallback to pm2 logs CLI
    if (results.length === 0) {
      const args = ['logs']
      const linesCount = Math.max(1, Math.min(Number(maxLines) || 50, 500))
      args.push('--lines', String(linesCount), '--nostream')

      if (appFilter && appFilter !== 'all') {
        const safeTarget = String(appFilter).replace(/[^a-zA-Z0-9_\-\.]/g, '')
        if (safeTarget && !safeTarget.startsWith('-')) {
          args.push('--', safeTarget)
        }
      }

      const { stdout: cliLogs } = await execFileAsync('pm2', args, { timeout: 4000 })
      const rawLines = cliLogs.split('\n').filter((l: string) => l.trim().length > 0)
      for (const line of rawLines) {
        if (line.startsWith('[TAILING]') || (line.includes('last ') && line.includes('lines:'))) continue
        const isErr = line.includes('error') || line.includes('Error:')
        results.push(parseLogLine(line, 'pm2', isErr ? 'error' : 'info'))
      }
    }

    // Filter by severity if requested
    const filtered = severityFilter === 'critical'
      ? results.filter(r => r.level === 'critical' || r.level === 'error')
      : results

    return filtered.slice(-maxLines)
  } catch (err) {
    return []
  }
}

export async function getPm2List(): Promise<Pm2ProcessInfo[]> {
  try {
    const { stdout } = await execFileAsync('pm2', ['jlist'], { timeout: 4000 })
    const list = JSON.parse(stdout)
    if (!Array.isArray(list)) return []

    return list.map((item: any) => {
      const pm_id = item.pm_id
      const name = item.name
      const status = item.pm2_env?.status || 'unknown'
      const cpu = item.monit?.cpu || 0
      const memory = item.monit?.memory || 0
      const restarts = item.pm2_env?.restart_time || 0
      const mode = item.pm2_env?.exec_mode || 'fork'

      let uptimeFormatted = '-'
      if (item.pm2_env?.pm_uptime && status === 'online') {
        const uptimeSecs = Math.floor((Date.now() - item.pm2_env.pm_uptime) / 1000)
        uptimeFormatted = formatUptime(uptimeSecs)
      }

      return {
        pm_id,
        name,
        status,
        cpu,
        memory,
        memoryFormatted: formatBytes(memory),
        restarts,
        uptimeFormatted,
        mode,
        out_log_path: item.pm2_env?.pm_out_log_path,
        err_log_path: item.pm2_env?.pm_err_log_path
      }
    })
  } catch (err) {
    // PM2 might not be installed or not in PATH or daemon not running
    return []
  }
}

/**
 * Bulletproof PM2 Action Execution:
 * 1. Uses `execFile` directly without shell spawning (zero bash interpolation).
 * 2. Enforces a strict action whitelist.
 * 3. Resolves and verifies targets against current PM2 process list.
 * 4. Passes strictly validated numeric pm_id to prevent any argument/command injection.
 */
export async function executePm2Command(
  action: string,
  id?: number | string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (action === 'restartAll') {
      await execFileAsync('pm2', ['restart', 'all'], { timeout: 10000 })
      return { success: true }
    }
    if (action === 'reloadAll') {
      await execFileAsync('pm2', ['reload', 'all'], { timeout: 10000 })
      return { success: true }
    }

    const validActions = ['start', 'restart', 'stop', 'reload']
    if (!validActions.includes(action)) {
      return { success: false, error: `Invalid PM2 action: ${action}` }
    }

    if (id === undefined || id === null) {
      return { success: false, error: 'Process ID is required' }
    }

    // Resolve target against current PM2 process list to verify existence
    const list = await getPm2List()
    const target = list.find(p => p.pm_id === Number(id) || p.name === String(id))

    if (!target) {
      return { success: false, error: `Process '${id}' not found in PM2` }
    }

    // Pass strictly validated numeric pm_id to execFile (no shell)
    const safePmId = String(target.pm_id)
    await execFileAsync('pm2', [action, safePmId], { timeout: 10000 })
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'PM2 command execution failed' }
  }
}


