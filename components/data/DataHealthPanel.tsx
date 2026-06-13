'use client'

import { useEffect, useMemo, useState } from 'react'
import { requestClientJson } from '@/lib/client-json'
import { DataCalendar, type CalendarDay, type DayStatus } from '@/components/data/DataCalendar'
import { SourcesTable, type SourceStatusRow } from '@/components/data/SourcesTable'

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

type Props = {
  startDate: string
  endDate: string
  source?: string
  today: string
}

export function DataHealthPanel({ startDate, endDate, source, today }: Props) {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadHealth() {
      setLoading(true)
      setError(null)
      try {
        const query = new URLSearchParams({
          domains: 'market,macro,release-calendar',
          start_date: startDate,
          end_date: endDate,
        })
        const payload = await requestClientJson(`/api/data-ops/health?${query.toString()}`)
        if (!cancelled) setHealth(payload as HealthResponse)
      } catch (requestError) {
        if (!cancelled) {
          setHealth(null)
          setError(requestError instanceof Error ? requestError.message : 'Failed to load data health.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadHealth()
    return () => {
      cancelled = true
    }
  }, [startDate, endDate])

  const calendarDays = useMemo(() => buildCalendarDays(health, startDate, endDate), [health, startDate, endDate])
  const sources = useMemo(() => buildSourceRows(health), [health])
  const coverage = coveragePercent(health)
  const staleCount = sources.filter((sourceRow) => sourceRow.status !== 'ok' && sourceRow.status !== 'unknown').length
  const hasDayLevelData = hasUsableDayLevelData(health)
  const windowLabel = dateWindowLabel(health?.start_date ?? startDate, health?.end_date ?? endDate)

  return (
    <>
      <div className="metric-grid">
        <KpiCard label="Coverage window" value={loading ? '...' : coverage === null ? '-' : String(coverage)} unit={!loading && coverage !== null ? '%' : undefined} sub={health ? windowLabel : loading ? 'Loading coverage data' : 'unavailable'} />
        <KpiCard label="Sources with gaps" value={loading ? '...' : health ? String(staleCount) : '-'} sub={health ? 'Missing or partial status' : loading ? 'Checking sources' : 'unavailable'} />
        <KpiCard label="Days loaded" value={String(calendarDays.length)} sub={windowLabel} />
      </div>

      <div className="card data-range-card">
        <form className="data-range-form" action="/data">
          {source ? <input type="hidden" name="source" value={source} /> : null}
          <div>
            <label htmlFor="start_date">Start date</label>
            <input id="start_date" name="start_date" type="date" defaultValue={startDate} />
          </div>
          <div>
            <label htmlFor="end_date">End date</label>
            <input id="end_date" name="end_date" type="date" defaultValue={endDate} />
          </div>
          <div className="data-range-actions">
            <button className="primary" type="submit">Apply range</button>
            <a className="secondary-button" href={`/data?start_date=${shiftIsoDays(today, -29)}&end_date=${today}`}>30 days</a>
            <a className="secondary-button" href={`/data?start_date=${shiftIsoDays(today, -89)}&end_date=${today}`}>90 days</a>
            <a className="secondary-button" href={`/data?start_date=${shiftIsoDays(today, -364)}&end_date=${today}`}>1 year</a>
          </div>
        </form>
      </div>

      {error ? <div className="alert error">Data health request failed: {error}</div> : null}

      <div className="card">
        <DataCalendar
          days={calendarDays}
          title={windowLabel}
          unavailableNote={hasDayLevelData ? undefined : loading ? 'Loading day-level coverage data' : 'Day-level coverage data not available from backend'}
        />
      </div>

      <SourcesTable sources={sources} />
    </>
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
  const lastSeenRows = buildSourceRows(health).filter((sourceRow) => sourceRow.lastSeen)
  const days: CalendarDay[] = []

  for (const date of eachDate(startDate, endDate)) {
    const iso = date.toISOString().slice(0, 10)
    const row = rowsByDate.get(iso)
    const weekend = date.getDay() === 0 || date.getDay() === 6
    if (!row) {
      const gapSources = gapRanges.filter((gap) => iso >= gap.startDate && iso <= gap.endDate).map((gap) => gap.source)
      const afterLastSeenSources = lastSeenRows.filter((sourceRow) => sourceRow.lastSeen && iso <= todayIso && iso > sourceRow.lastSeen).map((sourceRow) => sourceRow.source)
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
    ? health.sources.map((healthSource) => [String(healthSource.source ?? healthSource.name ?? healthSource.domain ?? 'unknown'), healthSource] as const)
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
  return Boolean(health?.rows?.some((row) => row.date && Object.keys(row.domains ?? {}).length > 0))
}

function readGapRanges(health: HealthResponse | null): Array<{ source: string; startDate: string; endDate: string }> {
  const ranges = [...(health?.gap_ranges ?? []), ...(health?.gaps ?? [])]
  return ranges.flatMap((gap) => {
    const source = readString(gap, ['source', 'domain', 'name']) ?? 'unknown'
    const startDate = readString(gap, ['start_date', 'startDate', 'from'])
    const endDate = readString(gap, ['end_date', 'endDate', 'to']) ?? startDate
    return startDate && endDate ? [{ source, startDate, endDate }] : []
  })
}

function readString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return null
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
