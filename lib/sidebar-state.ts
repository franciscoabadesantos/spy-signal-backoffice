import { type SidebarHealth } from '@/components/layout/Sidebar'
import { requestBackendJson } from '@/lib/backend-client'

const SIDEBAR_REQUEST_TIMEOUT_MS = 2500

type SidebarState = {
  health: SidebarHealth
  candidateCount?: number
  failedJobCount?: number
}

type TimedFetch = { payload: unknown; upstream: Response } | null

export async function loadSidebarState(): Promise<SidebarState> {
  const today = new Date().toISOString().slice(0, 10)
  const [system, data, research, signals, registry, jobs] = await Promise.allSettled([
    requestBackendJsonWithTimeout({ path: '/health', includeCloudflareAccess: true }),
    requestBackendJsonWithTimeout({
      path: '/analyst/data-ops/health',
      searchParams: new URLSearchParams({ domains: 'market,macro,release-calendar', end_date: today }),
      requireBackendServiceToken: true,
      includeCloudflareAccess: true,
    }),
    requestBackendJsonWithTimeout({
      path: '/analyst/research/experiments',
      searchParams: new URLSearchParams({ limit: '50' }),
      requireBackendServiceToken: true,
      includeCloudflareAccess: true,
    }),
    requestBackendJsonWithTimeout({
      path: '/analyst/signal-evaluation/candidates',
      searchParams: new URLSearchParams({ limit: '1', include_official: 'true' }),
      requireBackendServiceToken: true,
      includeCloudflareAccess: true,
    }),
    requestBackendJsonWithTimeout({
      path: '/analyst/registry/candidates',
      searchParams: new URLSearchParams({ limit: '1' }),
      requireBackendServiceToken: true,
      includeCloudflareAccess: true,
    }),
    requestBackendJsonWithTimeout({
      path: '/analyst/jobs',
      searchParams: new URLSearchParams({ limit: '80' }),
      includeCloudflareAccess: true,
    }),
  ])

  const candidatePayload = settledPayload(signals)
  const jobsPayload = settledPayload(jobs)
  const jobRows = readItems(jobsPayload, ['jobs', 'items', 'results'])
  const failedJobCount = jobRows.filter((job) => readString(job, ['status']) === 'failed').length

  return {
    health: {
      data: dotForDataHealth(settledPayload(data)),
      research: dotForFailedRecent(settledPayload(research), ['experiments', 'items', 'results']),
      evaluation: signals.status === 'fulfilled' && signals.value?.upstream.ok ? 'green' : 'gray',
      production: registry.status === 'fulfilled'
        ? (registry.value?.upstream.ok ? 'green' : 'red')
        : 'gray',
      frontoffice: 'gray',
      system: system.status === 'fulfilled' ? (system.value?.upstream.ok ? 'green' : 'red') : 'gray',
    },
    candidateCount: (readCount(candidatePayload, ['total', 'count']) ?? readItems(candidatePayload, ['candidates', 'items', 'results']).length) || undefined,
    failedJobCount: failedJobCount || undefined,
  }
}

export function grayHealth(): SidebarHealth {
  return {
    data: 'gray',
    research: 'gray',
    evaluation: 'gray',
    production: 'gray',
    frontoffice: 'gray',
    system: 'gray',
  }
}

async function requestBackendJsonWithTimeout(options: Parameters<typeof requestBackendJson>[0]): Promise<TimedFetch> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      requestBackendJson(options),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), SIDEBAR_REQUEST_TIMEOUT_MS)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function settledPayload(result: PromiseSettledResult<TimedFetch>): unknown {
  return result.status === 'fulfilled' && result.value?.upstream.ok ? result.value.payload : null
}

function dotForDataHealth(payload: unknown): SidebarHealth['data'] {
  const rows = readItems(payload, ['rows'])
  if (!payload) return 'gray'
  if (rows.some((row) => Object.values(readRecord(row, 'domains')).some((cell) => readString(cell, ['status']) === 'missing'))) return 'red'
  if (rows.some((row) => Object.values(readRecord(row, 'domains')).some((cell) => readString(cell, ['status']) !== 'ok'))) return 'amber'
  return 'green'
}

function dotForFailedRecent(payload: unknown, keys: string[]): SidebarHealth['research'] {
  if (!payload) return 'gray'
  const items = readItems(payload, keys)
  return items.some((item) => readString(item, ['status', 'state']) === 'failed') ? 'red' : 'green'
}

function readItems(payload: unknown, keys: string[]): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter(isRecord)
  if (!isRecord(payload)) return []
  for (const key of keys) {
    const value = payload[key]
    if (Array.isArray(value)) return value.filter(isRecord)
  }
  return []
}

function readRecord(payload: unknown, key: string): Record<string, unknown> {
  if (!isRecord(payload)) return {}
  const value = payload[key]
  return isRecord(value) ? value : {}
}

function readString(payload: unknown, keys: string[]): string {
  if (!isRecord(payload)) return ''
  for (const key of keys) {
    const value = payload[key]
    if (typeof value === 'string') return value.toLowerCase()
  }
  return ''
}

function readCount(payload: unknown, keys: string[]): number | undefined {
  if (!isRecord(payload)) return undefined
  for (const key of keys) {
    const value = payload[key]
    if (typeof value === 'number') return value
  }
  return undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
