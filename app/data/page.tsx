import { DataCalendar, type CalendarDay, type DayStatus } from '@/components/data/DataCalendar'
import { SourcesTable, type SourceStatusRow } from '@/components/data/SourcesTable'
import DataOpsConsole from '@/app/data-ops/ui'
import { requireAdminUser } from '@/lib/admin-auth'
import { requestBackendJson } from '@/lib/backend-client'

type HealthCell = {
  count?: number
  status?: string
}

type HealthRow = {
  date?: string
  domains?: Record<string, HealthCell>
}

type HealthResponse = {
  start_date?: string
  end_date?: string
  rows?: HealthRow[]
  summaries?: Record<string, Record<string, unknown>>
  gaps?: Array<Record<string, unknown>>
  gap_ranges?: Array<Record<string, unknown>>
  sources?: Array<Record<string, unknown>>
}

type PageProps = {
  searchParams?: Promise<{ source?: string }>
}

export default async function DataPage({ searchParams }: PageProps) {
  const admin = await requireAdminUser()
  const resolvedSearchParams = await searchParams
  const today = new Date().toISOString().slice(0, 10)
  const start = monthStartIso()
  const [healthResult] = await Promise.allSettled([
    requestBackendJson({
      path: '/analyst/data-ops/health',
      searchParams: new URLSearchParams({
        domains: 'market,macro,release-calendar',
        start_date: start,
        end_date: today,
      }),
      requireBackendServiceToken: true,
      includeCloudflareAccess: true,
    }),
  ])
  const health = healthResult.status === 'fulfilled' && healthResult.value.upstream.ok
    ? healthResult.value.payload as HealthResponse
    : null
  const calendarDays = buildCalendarDays(health)
  const sources = buildSourceRows(health)
  const coverage = coveragePercent(health)
  const staleCount = sources.filter((source) => source.status !== 'ok' && source.status !== 'unknown').length
  const hasDayLevelData = hasUsableDayLevelData(health)

  return (
    <div className="page-stack">
      <div className="card">
        <div className="split-row">
          <div>
            <h1>Data</h1>
            <p className="small">Coverage calendar and repair controls use the existing data-ops backend contracts.</p>
          </div>
          <div className="small">Admin: {admin.email}</div>
        </div>
      </div>

      <div className="metric-grid">
        <KpiCard label="Coverage this month" value={coverage === null ? '—' : String(coverage)} unit={coverage === null ? undefined : '%'} sub={health ? 'From current health rows' : 'unavailable'} />
        <KpiCard label="Sources with gaps" value={health ? String(staleCount) : '—'} sub={health ? 'Missing or partial status' : 'unavailable'} />
      </div>

      <div className="card">
        <DataCalendar
          days={calendarDays}
          month={monthLabel(today)}
          unavailableNote={hasDayLevelData ? undefined : 'Day-level coverage data not available from backend'}
        />
      </div>

      <SourcesTable sources={sources} />

      <details className="card" open={Boolean(resolvedSearchParams?.source)}>
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Advanced repair console</summary>
        <div style={{ marginTop: 16 }}>
          <DataOpsConsole adminEmail={admin.email} initialDomain={resolvedSearchParams?.source} />
        </div>
      </details>
    </div>
  )
}

function KpiCard({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub: string }) {
  return (
    <div className="card compact-card">
      <label>{label}</label>
      <div className="metric-value">{value}{unit ? <span className="metric-unit">{unit}</span> : null}</div>
      <div className="small">{sub}</div>
    </div>
  )
}

function buildCalendarDays(health: HealthResponse | null): CalendarDay[] {
  const today = new Date()
  const todayIso = today.toISOString().slice(0, 10)
  const year = today.getFullYear()
  const month = today.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const rowsByDate = new Map((health?.rows ?? []).map((row) => [row.date, row]))
  const gapRanges = readGapRanges(health)
  const lastSeenRows = buildSourceRows(health).filter((source) => source.lastSeen)
  const days: CalendarDay[] = []

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day)
    const iso = date.toISOString().slice(0, 10)
    const row = rowsByDate.get(iso)
    const weekend = date.getDay() === 0 || date.getDay() === 6
    if (!row) {
      const gapSources = gapRanges.filter((gap) => iso >= gap.startDate && iso <= gap.endDate).map((gap) => gap.source)
      const afterLastSeenSources = lastSeenRows.filter((source) => source.lastSeen && iso <= todayIso && iso > source.lastSeen).map((source) => source.source)
      const affectedSources = [...new Set([...gapSources, ...afterLastSeenSources])]
      days.push({
        date: iso,
        status: affectedSources.length > 0 ? 'missing' : 'weekend',
        affectedSources,
      })
      continue
    }

    const domains = Object.entries(row.domains ?? {})
    const affectedSources = domains
      .filter(([, cell]) => normalizeStatus(cell.status) !== 'ok')
      .map(([domain]) => domain)
    days.push({
      date: iso,
      status: statusForDomains(domains.map(([, cell]) => cell.status), weekend),
      coverage: coverageForDomains(domains.map(([, cell]) => cell.status)),
      affectedSources,
    })
  }

  return days
}

function buildSourceRows(health: HealthResponse | null): SourceStatusRow[] {
  const summaryEntries = Object.entries(health?.summaries ?? {})
  const sourceEntries = Array.isArray(health?.sources)
    ? health.sources.map((source) => [String(source.source ?? source.name ?? source.domain ?? 'unknown'), source] as const)
    : []
  const entries = summaryEntries.length > 0 ? summaryEntries : sourceEntries

  if (entries.length === 0) return []
  return entries.map(([source, summary]) => {
    const missingDays = Number(summary.missing_days ?? 0)
    const staleDays = Number(summary.stale_days ?? summary.lag_days ?? 0)
    const lastSeen = findLastSeen(health, source) ?? readString(summary, ['last_seen', 'lastSeen', 'latest_available_date', 'latest_date'])
    const status = missingDays > 0 ? 'missing' : staleDays > 0 ? 'partial' : 'ok'
    return {
      source,
      lastSeen,
      expectedCadence: readString(summary, ['cadence', 'expected_cadence', 'frequency']) ?? 'Daily',
      status,
      detail: status === 'missing' ? 'Missing' : status === 'partial' ? 'Stale' : 'Healthy',
    }
  })
}

function findLastSeen(health: HealthResponse | null, source: string): string | null {
  if (!health) return null
  const rows = [...(health.rows ?? [])].reverse()
  const found = rows.find((row) => row.date && normalizeStatus(row.domains?.[source]?.status) === 'ok')
  return found?.date ?? null
}

function statusForDomains(statuses: Array<string | undefined>, weekend: boolean): DayStatus {
  if (weekend && statuses.length === 0) return 'weekend'
  const normalized = statuses.map(normalizeStatus)
  if (normalized.some((status) => status === 'missing')) return 'missing'
  if (normalized.length === 0 || normalized.some((status) => status !== 'ok')) return 'partial'
  return 'ok'
}

function coverageForDomains(statuses: Array<string | undefined>): number {
  if (statuses.length === 0) return 0
  const ok = statuses.filter((status) => normalizeStatus(status) === 'ok').length
  return Math.round((ok / statuses.length) * 100)
}

function coveragePercent(health: HealthResponse | null): number | null {
  const rows = health?.rows ?? []
  const statuses = rows.flatMap((row) => Object.values(row.domains ?? {}).map((cell) => cell.status))
  return statuses.length ? coverageForDomains(statuses) : null
}

function normalizeStatus(status?: string): string {
  return String(status ?? '').trim().toLowerCase()
}

function hasUsableDayLevelData(health: HealthResponse | null): boolean {
  return Boolean(
    (health?.rows && health.rows.length > 0)
    || readGapRanges(health).length > 0
    || buildSourceRows(health).some((source) => source.lastSeen)
  )
}

function readGapRanges(health: HealthResponse | null): Array<{ source: string; startDate: string; endDate: string }> {
  const raw = [...(health?.gaps ?? []), ...(health?.gap_ranges ?? [])]
  return raw.map((gap) => {
    const source = readString(gap, ['source', 'domain', 'name']) ?? 'unknown'
    const startDate = readString(gap, ['start_date', 'startDate', 'from', 'date']) ?? ''
    const endDate = readString(gap, ['end_date', 'endDate', 'to', 'date']) ?? startDate
    return { source, startDate, endDate }
  }).filter((gap) => gap.startDate && gap.endDate)
}

function readString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value
    if (typeof value === 'number') return String(value)
  }
  return null
}

function monthStartIso(): string {
  const date = new Date()
  date.setDate(1)
  return date.toISOString().slice(0, 10)
}

function monthLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}
