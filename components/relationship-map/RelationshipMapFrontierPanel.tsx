'use client'

import { useEffect, useMemo, useState } from 'react'
import { requestClientJson } from '@/lib/client-json'
import { asRecord, firstList, type RowRecord } from '@/lib/payload'

type FrontierCandidate = {
  symbol: string
  name: string | null
  country: string
  themes: string[]
  etfs: string[]
  adjacency: number
  score: number
  weight: number
}

type FrontierTheme = {
  theme: string
  etfs: string[]
  totalConstituents: number
  trackedConstituents: number
  coverageRatio: number
  coverageGap: number
  onboardableCount: number
}

type FrontierPayload = {
  generatedAt: string | null
  summary: {
    holdingCount: number
    trackedHoldingCount: number
    candidateCount: number
    untappedThemeCount: number
  }
  adjacentCandidates: FrontierCandidate[]
  untappedThemes: FrontierTheme[]
}

export function RelationshipMapFrontierPanel() {
  const [payload, setPayload] = useState<FrontierPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    let cancelled = false

    async function loadFrontier() {
      setLoading(true)
      setError(null)
      try {
        const response = await requestClientJson('/api/relationship-map/frontier')
        if (!cancelled) setPayload(normalizeFrontierPayload(response))
      } catch (requestError) {
        if (!cancelled) {
          setPayload(null)
          setError(requestError)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadFrontier()
    return () => {
      cancelled = true
    }
  }, [])

  const candidates = useMemo(() => payload?.adjacentCandidates ?? [], [payload])
  const themes = useMemo(() => payload?.untappedThemes ?? [], [payload])
  const unavailable = Boolean(error && !loading)

  return (
    <section className="card" id="relationship-map-frontier">
      <div className="split-row">
        <div>
          <h2>Frontier / Grow</h2>
          <p className="small">Untracked names around the current universe, plus themes with the largest onboarding gaps.</p>
        </div>
        <span className="badge queued">generated {payload?.generatedAt ? shortTimestamp(payload.generatedAt) : '-'}</span>
      </div>

      {error ? <FrontierError error={error} /> : null}

      <div className="relationship-map-summary-grid">
        <FrontierMetric label="Holdings scanned" value={summaryValue(payload?.summary.holdingCount, loading, unavailable)} sub="ETF holdings input" />
        <FrontierMetric label="Tracked holdings" value={summaryValue(payload?.summary.trackedHoldingCount, loading, unavailable)} sub="Already priced in backend" />
        <FrontierMetric label="Adjacent candidates" value={summaryValue(payload?.summary.candidateCount, loading, unavailable)} sub="Untracked, ranked by closeness" />
        <FrontierMetric label="Untapped themes" value={summaryValue(payload?.summary.untappedThemeCount, loading, unavailable)} sub="Coverage gaps to inspect" />
      </div>

      <section className="relationship-map-frontier-grid" aria-label="Relationship-map growth frontier views">
        <div>
          <div>
            <h3>Adjacent candidates</h3>
            <p className="small">Names most connected to tracked ETF neighborhoods and still missing from price coverage.</p>
          </div>
          <div className="table-wrap relationship-map-table">
            <table className="registry-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Name</th>
                  <th>Country</th>
                  <th>Themes</th>
                  <th>ETFs</th>
                  <th>Adjacency</th>
                  <th>Weight</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="small" colSpan={7}>Loading frontier candidates...</td>
                  </tr>
                ) : null}
                {!loading && candidates.length === 0 ? (
                  <tr>
                    <td className="small" colSpan={7}>{unavailable ? 'Relationship-map frontier is unavailable.' : 'No adjacent candidates were returned.'}</td>
                  </tr>
                ) : null}
                {!loading ? candidates.map((candidate) => (
                  <tr key={candidate.symbol}>
                    <td><strong>{candidate.symbol}</strong></td>
                    <td>{candidate.name ?? '-'}</td>
                    <td>{candidate.country}</td>
                    <td>{candidate.themes.join(', ') || '-'}</td>
                    <td>{candidate.etfs.join(', ') || '-'}</td>
                    <td>{formatScore(candidate.adjacency)}</td>
                    <td>{formatRatio(candidate.weight)}</td>
                  </tr>
                )) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div>
            <h3>Untapped themes</h3>
            <p className="small">Theme catalogs with many onboardable holdings and low tracked coverage.</p>
          </div>
          <div className="table-wrap relationship-map-table">
            <table className="registry-table">
              <thead>
                <tr>
                  <th>Theme</th>
                  <th>ETFs</th>
                  <th>Coverage</th>
                  <th>Onboardable</th>
                  <th>Total</th>
                  <th>Gap</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="small" colSpan={6}>Loading untapped themes...</td>
                  </tr>
                ) : null}
                {!loading && themes.length === 0 ? (
                  <tr>
                    <td className="small" colSpan={6}>{unavailable ? 'Relationship-map frontier is unavailable.' : 'No untapped themes were returned.'}</td>
                  </tr>
                ) : null}
                {!loading ? themes.map((theme) => (
                  <tr key={theme.theme}>
                    <td><strong>{theme.theme}</strong></td>
                    <td>{theme.etfs.join(', ') || '-'}</td>
                    <td>{formatRatio(theme.coverageRatio)}</td>
                    <td>{theme.onboardableCount}</td>
                    <td>{theme.totalConstituents}</td>
                    <td>{formatRatio(theme.coverageGap)}</td>
                  </tr>
                )) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </section>
  )
}

function FrontierMetric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card compact-card relationship-map-metric-card">
      <label>{label}</label>
      <div className="metric-value">{value}</div>
      <div className="small">{sub}</div>
    </div>
  )
}

function FrontierError({ error }: { error: unknown }) {
  const record = asRecord(error)
  const message = readString(record, ['message', 'error']) ?? (error instanceof Error ? error.message : 'Relationship-map frontier is unavailable.')

  return (
    <div className="alert error">
      <strong>Relationship-map frontier unavailable.</strong>
      <div>{message}</div>
      {typeof record?.upstreamStatus === 'number' ? <div className="small">Upstream status: {record.upstreamStatus}</div> : null}
      {typeof record?.upstreamContentType === 'string' ? <div className="small">Content-Type: {record.upstreamContentType}</div> : null}
      {typeof record?.upstreamBodyPreview === 'string' && record.upstreamBodyPreview ? <pre>{record.upstreamBodyPreview}</pre> : null}
    </div>
  )
}

function normalizeFrontierPayload(payload: unknown): FrontierPayload {
  const record = asRecord(payload) ?? {}
  const summary = asRecord(record.summary) ?? {}
  return {
    generatedAt: readString(record, ['generatedAt', 'generated_at']),
    summary: {
      holdingCount: readNumber(summary, ['holdingCount', 'holding_count']) ?? 0,
      trackedHoldingCount: readNumber(summary, ['trackedHoldingCount', 'tracked_holding_count']) ?? 0,
      candidateCount: readNumber(summary, ['candidateCount', 'candidate_count']) ?? 0,
      untappedThemeCount: readNumber(summary, ['untappedThemeCount', 'untapped_theme_count']) ?? 0,
    },
    adjacentCandidates: firstList(payload, ['adjacentCandidates', 'adjacent_candidates']).map(normalizeCandidate).filter((row): row is FrontierCandidate => Boolean(row)),
    untappedThemes: firstList(payload, ['untappedThemes', 'untapped_themes']).map(normalizeTheme).filter((row): row is FrontierTheme => Boolean(row)),
  }
}

function normalizeCandidate(row: unknown): FrontierCandidate | null {
  const record = asRecord(row)
  const symbol = readString(record, ['symbol'])
  if (!record || !symbol) return null
  return {
    symbol,
    name: readString(record, ['name']),
    country: readString(record, ['country']) ?? 'UNKNOWN',
    themes: readStringList(record.themes),
    etfs: readStringList(record.etfs),
    adjacency: readNumber(record, ['adjacency']) ?? 0,
    score: readNumber(record, ['score']) ?? 0,
    weight: readNumber(record, ['weight']) ?? 0,
  }
}

function normalizeTheme(row: unknown): FrontierTheme | null {
  const record = asRecord(row)
  const theme = readString(record, ['theme'])
  if (!record || !theme) return null
  return {
    theme,
    etfs: readStringList(record.etfs),
    totalConstituents: readNumber(record, ['totalConstituents', 'total_constituents']) ?? 0,
    trackedConstituents: readNumber(record, ['trackedConstituents', 'tracked_constituents']) ?? 0,
    coverageRatio: readNumber(record, ['coverageRatio', 'coverage_ratio']) ?? 0,
    coverageGap: readNumber(record, ['coverageGap', 'coverage_gap']) ?? 0,
    onboardableCount: readNumber(record, ['onboardableCount', 'onboardable_count']) ?? 0,
  }
}

function readString(record: RowRecord | null | undefined, keys: string[]): string | null {
  if (!record) return null
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  }
  return null
}

function readNumber(record: RowRecord | null | undefined, keys: string[]): number | null {
  if (!record) return null
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item).trim()).filter(Boolean)
}

function summaryValue(value: number | undefined, loading: boolean, unavailable: boolean): string {
  if (loading) return '...'
  if (unavailable || value === undefined) return '-'
  return String(value)
}

function formatRatio(value: number): string {
  if (!Number.isFinite(value)) return '-'
  return `${Math.round(value * 100)}%`
}

function formatScore(value: number): string {
  if (!Number.isFinite(value)) return '-'
  if (value === 0) return '0'
  return value.toFixed(5)
}

function shortTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}
