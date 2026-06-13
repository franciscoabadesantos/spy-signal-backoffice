import type { Metadata } from 'next'
import { ClerkProvider, SignInButton, UserButton } from '@clerk/nextjs'
import { auth } from '@clerk/nextjs/server'
import { Sidebar, type SidebarHealth } from '@/components/layout/Sidebar'
import { requestBackendJson } from '@/lib/backend-client'
import './globals.css'

const DATA_HEALTH_TIMEOUT_MS = 12000

export const metadata: Metadata = {
  title: 'Spy Signal Backoffice',
  description: 'Admin-only operations console',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  const sidebar = userId ? await loadSidebarState() : { health: grayHealth() }

  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <div className="app-shell">
            <Sidebar
              health={sidebar.health}
              candidateCount={sidebar.candidateCount}
              failedJobCount={sidebar.failedJobCount}
            />
            <div className="app-main">
              <div className="auth-row">
                {userId ? <UserButton /> : <SignInButton />}
              </div>
              <main className="container main">{children}</main>
            </div>
          </div>
        </body>
      </html>
    </ClerkProvider>
  )
}

async function loadSidebarState(): Promise<{
  health: SidebarHealth
  candidateCount?: number
  failedJobCount?: number
}> {
  const today = new Date().toISOString().slice(0, 10)
  const [system, data, research, signals, registry, jobs] = await Promise.allSettled([
    requestBackendJson({ path: '/health', includeCloudflareAccess: true }),
    requestDataHealthWithTimeout({
      path: '/analyst/data-ops/health',
      searchParams: new URLSearchParams({ domains: 'market,macro,release-calendar', end_date: today }),
      requireBackendServiceToken: true,
      includeCloudflareAccess: true,
    }),
    requestBackendJson({
      path: '/analyst/research/experiments',
      searchParams: new URLSearchParams({ limit: '50' }),
      requireBackendServiceToken: true,
      includeCloudflareAccess: true,
    }),
    requestBackendJson({
      path: '/analyst/signal-evaluation/candidates',
      searchParams: new URLSearchParams({ limit: '1', include_official: 'true' }),
      requireBackendServiceToken: true,
      includeCloudflareAccess: true,
    }),
    requestBackendJson({
      path: '/analyst/registry/candidates',
      searchParams: new URLSearchParams({ limit: '1' }),
      requireBackendServiceToken: true,
      includeCloudflareAccess: true,
    }),
    requestBackendJson({
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
      signals: signals.status === 'fulfilled' && signals.value.upstream.ok ? 'green' : 'gray',
      registry: registry.status === 'fulfilled'
        ? (registry.value.upstream.ok ? 'green' : 'red')
        : 'gray',
      operations: failedJobCount > 0 ? 'red' : (jobs.status === 'fulfilled' && jobs.value.upstream.ok ? 'green' : 'gray'),
      system: system.status === 'fulfilled' ? (system.value.upstream.ok ? 'green' : 'red') : 'gray',
    },
    candidateCount: (readCount(candidatePayload, ['total', 'count']) ?? readItems(candidatePayload, ['candidates', 'items', 'results']).length) || undefined,
    failedJobCount: failedJobCount || undefined,
  }
}

function grayHealth(): SidebarHealth {
  return {
    data: 'gray',
    research: 'gray',
    signals: 'gray',
    registry: 'gray',
    operations: 'gray',
    system: 'gray',
  }
}

async function requestDataHealthWithTimeout(options: Parameters<typeof requestBackendJson>[0]): Promise<{ payload: unknown; upstream: Response } | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const result = await Promise.race([
      requestBackendJson(options),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), DATA_HEALTH_TIMEOUT_MS)
      }),
    ])
    return result
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function settledPayload(result: PromiseSettledResult<{ payload: unknown; upstream: Response } | null>): unknown {
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
