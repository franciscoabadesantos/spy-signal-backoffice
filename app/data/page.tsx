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
  searchParams?: Promise<{ source?: string; start_date?: string; end_date?: string }>
}

export default async function DataPage({ searchParams }: PageProps) {
  const admin = await requireAdminUser()
  const resolvedSearchParams = await searchParams
  const today = new Date().toISOString().slice(0, 10)
  const range = resolveDateRange(resolvedSearchParams, today)
  const [healthResult] = await Promise.allSettled([
    requestBackendJson({
      path: '/analyst/data-ops/health',
      searchParams: new URLSearchParams({
        domains: 'market,macro,release-calendar',
        start_date: range.startDate,
        end_date: range.endDate,
      }),
      requireBackendServiceToken: true,
      includeCloudflareAccess: true,
    }),
  ])
  const health = healthResult.status === 'fulfilled' && healthResult.value.upstream.ok
    ? healthResult.value.payload as HealthResponse
    : null
  if (health) {
    console.info('[data] data-ops health raw response', JSON.stringify(health).slice(0, 4000))
  }
  const calendarDays = buildCalendarDays(health, range.startDate, range.endDate)
  const sources = buildSourceRows(health)
  const coverage = coveragePercent(health)
  const staleCount = sources.filter((source) => source.status !== 'ok' && source.status !== 'unknown').length
  const hasDayLevelData = hasUsableDayLevelData(health)
  const windowLabel = dateWindowLabel(health?.start_date ?? range.startDate, health?.end_date ?? range.endDate)

  return (
    <div className="page-stack">
      <div className="card">
        <div className="split-row">
          <div>
            <h1>Data</h1>
          </div>
          <div className="small">Admin: {admin.email}</div>
        </div>
      </div>

      <div className="metric-grid">
        <KpiCard label="Coverage window" value={coverage === null ? '—' : String(coverage)} unit={coverage === null ? undefined : '%'} sub={health ? windowLabel : 'unavailable'} />
        <KpiCard label="Sources with gaps" value={health ? String(staleCount) : '—'} sub={health ? 'Missing or partial status' : 'unavailable'} />
        <KpiCard label="Days loaded" value={String(calendarDays.length)} sub={windowLabel} />
      </div>

      <div className="card data-range-card">
        <form className="data-range-form" action="/data">
          {resolvedSearchParams?.source ? <input type="hidden" name="source" value={resolvedSearchParams.source} /> : null}
          <div>
            <label htmlFor="start_date">Start date</label>
            <input id="start_date" name="start_date" type="date" defaultValue={range.startDate} />
          </div>
          <div>
            <label htmlFor="end_date">End date</label>
            <input id="end_date" name="end_date" type="date" defaultValue={range.endDate} />
          </div>
          <div className="data-range-actions">
            <button className="primary" type="submit">Apply range</button>
            <a className="secondary-button" href={`/data?start_date=${shiftIsoDays(today, -29)}&end_date=${today}`}>30 days</a>
            <a className="secondary-button" href={`/data?start_date=${shiftIsoDays(today, -89)}&end_date=${today}`}>90 days</a>
            <a className="secondary-button" href={`/data?start_date=${shiftIsoDays(today, -364)}&end_date=${today}`}>1 year</a>
          </div>
        </form>
      </div>

      <div className="card">
        <DataCalendar
          days={calendarDays}
          title={windowLabel}
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

function buildCalendarDays(health: HealthResponse | null, startDate: string, endDate: string): CalendarDay[] {
  const todayIso = new Date().toISOString().slice(0, 10)
  const rowsByDate = new Map((health?.rows ?? []).map((row) => [row.date, row]))
  const gapRanges = readGapRanges(health)
  const lastSeenRows = buildSourceRows(health).filter((source) => source.lastSeen)
  const days: CalendarDay[] = []

  for (const date of eachDate(startDate, endDate)) {
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

function resolveDateRange(searchParams: Awaited<PageProps['searchParams']>, today: string): { startDate: string; endDate: string } {
  const endDate = validIsoDate(searchParams?.end_date) ?? today
  const startDate = validIsoDate(searchParams?.start_date) ?? shiftIsoDays(endDate, -89)
  if (startDate > endDate) {
    return { startDate: shiftIsoDays(today, -89), endDate: today }
  }
  return { startDate, endDate }
}

function validIsoDate(value?: string): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : value
}

function shiftIsoDays(dateIso: string, days: number): string {
  const date = new Date(`${dateIso}T00:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function eachDate(startDate: string, endDate: string): Date[] {
  const dates: Date[] = []
  const cursor = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  while (cursor <= end) {
    dates.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

function dateWindowLabel(startDate: string, endDate: string): string {
  const start = formatShortDate(startDate)
  const end = formatShortDate(endDate)
  return start === end ? start : `${start} to ${end}`
}

function formatShortDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
