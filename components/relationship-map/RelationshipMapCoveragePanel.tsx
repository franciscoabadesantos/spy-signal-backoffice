'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { requestClientJson } from '@/lib/client-json'
import { asRecord, firstList, type RowRecord } from '@/lib/payload'

type CoverageLayer = 'all' | 'raw_price' | 'residual_price' | 'lead_lag' | 'theme_etf'
type CoverageStatus = 'green' | 'yellow' | 'red' | 'gray'

type CoverageFilters = {
  window: 126 | 252
  layer: CoverageLayer
  freshPriceDays: number
  minTickerCount: number
}

type CoverageCountry = {
  country: string
  region: string
  tickerCount: number
  pricedTickerCount: number
  freshPricedTickerCount: number
  relationshipNodeCount: number
  relationshipEdgeCount: number
  pricedCoverageRatio: number | null
  freshPriceCoverageRatio: number | null
  relationshipCoverageRatio: number | null
  status: CoverageStatus
}

type CoveragePayload = {
  generatedAt: string | null
  asOf: string | null
  config: CoverageFilters & {
    entityDedupEnabled: boolean
  }
  summary: {
    countryCount: number
    tickerCount: number
    pricedTickerCount: number
    freshPricedTickerCount: number
    relationshipNodeCount: number
    relationshipEdgeCount: number
  }
  countries: CoverageCountry[]
}

const DEFAULT_FILTERS: CoverageFilters = {
  window: 252,
  layer: 'all',
  freshPriceDays: 7,
  minTickerCount: 1,
}

const LAYERS: CoverageLayer[] = ['all', 'raw_price', 'residual_price', 'lead_lag', 'theme_etf']
const STATUS_ORDER: Record<CoverageStatus, number> = { red: 0, yellow: 1, gray: 2, green: 3 }

export function RelationshipMapCoveragePanel() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const filters = useMemo(() => readFilters(searchParams), [searchParams])
  const [payload, setPayload] = useState<CoveragePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    let cancelled = false

    async function loadCoverage() {
      setLoading(true)
      setError(null)
      try {
        const response = await requestClientJson(`/api/relationship-map/coverage?${queryForFilters(filters).toString()}`)
        if (!cancelled) setPayload(normalizeCoveragePayload(response, filters))
      } catch (requestError) {
        if (!cancelled) {
          setPayload(null)
          setError(requestError)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadCoverage()
    return () => {
      cancelled = true
    }
  }, [filters])

  const countries = useMemo(() => [...(payload?.countries ?? [])].sort(compareCountries), [payload])
  const regions = useMemo(() => summarizeRegions(countries), [countries])
  const unavailable = Boolean(error && !loading)
  const geographyUnit = payload?.config.entityDedupEnabled ? 'entities' : 'tickers'
  const geographyUnitSingular = geographyUnit === 'entities' ? 'Entity' : 'Ticker'

  function updateFilters(partial: Partial<CoverageFilters>) {
    const nextFilters = normalizeFilters({ ...filters, ...partial })
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', 'coverage')
    for (const [key, value] of queryForFilters(nextFilters)) {
      params.set(key, value)
    }
    router.replace(`/relationship-map?${params.toString()}`, { scroll: false })
  }

  return (
    <section className="card" id="relationship-map-coverage">
      <div className="split-row">
        <div>
          <h2>Current universe coverage</h2>
          <p className="small">
            Coverage of the currently onboarded universe by country. Resolved entities use home country when entity-aware aggregation is enabled.
          </p>
        </div>
        <span className="badge queued">as of {payload?.asOf ?? '—'}</span>
      </div>

      <div className="relationship-map-filter-bar">
        <div>
          <label htmlFor="coverageWindow">Window</label>
          <select
            id="coverageWindow"
            value={filters.window}
            onChange={(event) => updateFilters({ window: event.target.value === '126' ? 126 : 252 })}
          >
            <option value={126}>126</option>
            <option value={252}>252</option>
          </select>
        </div>
        <div>
          <label htmlFor="coverageLayer">Layer</label>
          <select
            id="coverageLayer"
            value={filters.layer}
            onChange={(event) => updateFilters({ layer: normalizeLayer(event.target.value) })}
          >
            {LAYERS.map((layer) => <option key={layer} value={layer}>{layerLabel(layer)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="freshPriceDays">Fresh price days</label>
          <input
            id="freshPriceDays"
            min={1}
            type="number"
            value={filters.freshPriceDays}
            onChange={(event) => updateFilters({ freshPriceDays: readPositiveInt(event.target.value, DEFAULT_FILTERS.freshPriceDays) })}
          />
        </div>
        <div>
          <label htmlFor="minTickerCount">Min ticker count</label>
          <input
            id="minTickerCount"
            min={1}
            type="number"
            value={filters.minTickerCount}
            onChange={(event) => updateFilters({ minTickerCount: readPositiveInt(event.target.value, DEFAULT_FILTERS.minTickerCount) })}
          />
        </div>
      </div>

      {error ? <CoverageError error={error} /> : null}

      <div className="relationship-map-summary-grid">
        <CoverageMetric label="Countries covered" value={summaryValue(payload?.summary.countryCount, loading, unavailable)} sub="Countries returned by backend" />
        <CoverageMetric label={`Onboarded ${geographyUnit}`} value={summaryValue(payload?.summary.tickerCount, loading, unavailable)} sub="Current onboarded universe" />
        <CoverageMetric label={`Priced ${geographyUnit}`} value={summaryValue(payload?.summary.pricedTickerCount, loading, unavailable)} sub={`${geographyUnitSingular} denominator with prices`} />
        <CoverageMetric label={`Fresh priced ${geographyUnit}`} value={summaryValue(payload?.summary.freshPricedTickerCount, loading, unavailable)} sub={`Fresh price coverage, ${filters.freshPriceDays}d`} />
        <CoverageMetric label="Relationship nodes" value={summaryValue(payload?.summary.relationshipNodeCount, loading, unavailable)} sub={layerLabel(filters.layer)} />
        <CoverageMetric label="Relationship edges" value={summaryValue(payload?.summary.relationshipEdgeCount, loading, unavailable)} sub={`Window ${filters.window}`} />
        <CoverageMetric label="Relationship coverage" value={coverageRatioSummary(payload, loading, unavailable)} sub="Nodes / priced tickers" />
      </div>

      <section className="relationship-map-coverage-grid" aria-label="Relationship-map coverage views">
        <div className="relationship-map-heatmap">
          <div className="split-row">
            <div>
              <h3>Regional heatmap</h3>
              <p className="small">Fallback map view for the current onboarded universe.</p>
            </div>
          </div>
          <div className="relationship-map-region-list">
            {loading ? <div className="empty-state">Loading coverage...</div> : null}
            {!loading && regions.length === 0 ? <div className="empty-state">{unavailable ? 'Relationship-map coverage is unavailable.' : 'No coverage countries were returned.'}</div> : null}
            {!loading ? regions.map((region) => (
              <div className={`relationship-map-region-card ${region.status}`} key={region.region}>
                <div className="split-row">
                  <strong>{region.region}</strong>
                  <span className={`badge ${statusBadgeClass(region.status)}`}>{statusLabel(region.status)}</span>
                </div>
                <div className="relationship-map-region-bar" aria-hidden="true">
                  <span style={{ width: `${Math.round(region.relationshipCoverageRatio * 100)}%` }} />
                </div>
                <div className="small">
                  {region.countryCount} countries, {region.tickerCount} onboarded {geographyUnit}, {formatRatio(region.relationshipCoverageRatio)} relationship coverage
                </div>
              </div>
            )) : null}
          </div>
        </div>

        <CountryCoverageTable countries={countries} loading={loading} unavailable={unavailable} geographyUnitSingular={geographyUnitSingular} />
      </section>
    </section>
  )
}

function CoverageMetric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card compact-card relationship-map-metric-card">
      <label>{label}</label>
      <div className="metric-value">{value}</div>
      <div className="small">{sub}</div>
    </div>
  )
}

function CoverageError({ error }: { error: unknown }) {
  const record = asRecord(error)
  const message = readString(record, ['message', 'error']) ?? (error instanceof Error ? error.message : 'Relationship-map coverage is unavailable.')

  return (
    <div className="alert error">
      <strong>Relationship-map coverage unavailable.</strong>
      <div>{message}</div>
      {typeof record?.upstreamStatus === 'number' ? <div className="small">Upstream status: {record.upstreamStatus}</div> : null}
      {typeof record?.upstreamContentType === 'string' ? <div className="small">Content-Type: {record.upstreamContentType}</div> : null}
      {typeof record?.upstreamBodyPreview === 'string' && record.upstreamBodyPreview ? <pre>{record.upstreamBodyPreview}</pre> : null}
    </div>
  )
}

function CountryCoverageTable({ countries, loading, unavailable, geographyUnitSingular }: { countries: CoverageCountry[]; loading: boolean; unavailable: boolean; geographyUnitSingular: string }) {
  return (
    <div className="relationship-map-country-table">
      <div>
        <h3>Countries</h3>
        <p className="small">Sorted by red, yellow, gray, green; then by onboarded count.</p>
      </div>
      <div className="table-wrap">
        <table className="registry-table">
          <thead>
            <tr>
              <th>Country</th>
              <th>Region</th>
              <th>{geographyUnitSingular} count</th>
              <th>Priced</th>
              <th>Fresh priced</th>
              <th>Relationship nodes</th>
              <th>Relationship edges</th>
              <th>Priced coverage</th>
              <th>Relationship coverage</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="small" colSpan={10}>Loading current universe coverage...</td>
              </tr>
            ) : null}
            {!loading && countries.length === 0 ? (
              <tr>
                <td className="small" colSpan={10}>{unavailable ? 'Relationship-map coverage is unavailable.' : 'No country rows were returned.'}</td>
              </tr>
            ) : null}
            {!loading ? countries.map((country) => (
              <tr className={country.status === 'red' ? 'danger-row' : undefined} key={`${country.country}-${country.region}`}>
                <td><strong>{country.country}</strong></td>
                <td>{country.region}</td>
                <td>{country.tickerCount}</td>
                <td>{country.pricedTickerCount}</td>
                <td>{country.freshPricedTickerCount}</td>
                <td>{country.relationshipNodeCount}</td>
                <td>{country.relationshipEdgeCount}</td>
                <td>{formatRatio(country.pricedCoverageRatio)}</td>
                <td>{formatRatio(country.relationshipCoverageRatio)}</td>
                <td><span className={`badge ${statusBadgeClass(country.status)}`}>{statusLabel(country.status)}</span></td>
              </tr>
            )) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

type RegionSummary = {
  region: string
  countryCount: number
  tickerCount: number
  pricedTickerCount: number
  relationshipNodeCount: number
  relationshipCoverageRatio: number
  status: CoverageStatus
}

function summarizeRegions(countries: CoverageCountry[]): RegionSummary[] {
  const byRegion = new Map<string, Omit<RegionSummary, 'relationshipCoverageRatio' | 'status'> & { statuses: CoverageStatus[] }>()
  for (const country of countries) {
    const region = country.region || 'Unknown'
    const current = byRegion.get(region) ?? {
      region,
      countryCount: 0,
      tickerCount: 0,
      pricedTickerCount: 0,
      relationshipNodeCount: 0,
      statuses: [],
    }
    current.countryCount += 1
    current.tickerCount += country.tickerCount
    current.pricedTickerCount += country.pricedTickerCount
    current.relationshipNodeCount += country.relationshipNodeCount
    current.statuses.push(country.status)
    byRegion.set(region, current)
  }

  return [...byRegion.values()]
    .map((region) => ({
      region: region.region,
      countryCount: region.countryCount,
      tickerCount: region.tickerCount,
      pricedTickerCount: region.pricedTickerCount,
      relationshipNodeCount: region.relationshipNodeCount,
      relationshipCoverageRatio: region.pricedTickerCount > 0 ? region.relationshipNodeCount / region.pricedTickerCount : 0,
      status: worstStatus(region.statuses),
    }))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.tickerCount - a.tickerCount || a.region.localeCompare(b.region))
}

function worstStatus(statuses: CoverageStatus[]): CoverageStatus {
  return statuses.reduce<CoverageStatus>((worst, status) => STATUS_ORDER[status] < STATUS_ORDER[worst] ? status : worst, 'green')
}

function normalizeCoveragePayload(payload: unknown, fallbackFilters: CoverageFilters): CoveragePayload {
  const record = asRecord(payload) ?? {}
  const configRecord = asRecord(record.config)
  const config = {
    ...normalizeFilters({
      ...fallbackFilters,
      ...configRecord,
    }),
    entityDedupEnabled: readBoolean(configRecord, ['entityDedupEnabled', 'entity_dedup_enabled']) ?? false,
  }
  const summaryRecord = asRecord(record.summary) ?? {}
  return {
    generatedAt: readString(record, ['generatedAt', 'generated_at']),
    asOf: readString(record, ['asOf', 'as_of']),
    config,
    summary: {
      countryCount: readNumber(summaryRecord, ['countryCount', 'country_count']) ?? 0,
      tickerCount: readNumber(summaryRecord, ['tickerCount', 'ticker_count']) ?? 0,
      pricedTickerCount: readNumber(summaryRecord, ['pricedTickerCount', 'priced_ticker_count']) ?? 0,
      freshPricedTickerCount: readNumber(summaryRecord, ['freshPricedTickerCount', 'fresh_priced_ticker_count']) ?? 0,
      relationshipNodeCount: readNumber(summaryRecord, ['relationshipNodeCount', 'relationship_node_count']) ?? 0,
      relationshipEdgeCount: readNumber(summaryRecord, ['relationshipEdgeCount', 'relationship_edge_count']) ?? 0,
    },
    countries: firstList(payload, ['countries', 'items', 'rows']).map(normalizeCountry).filter((country): country is CoverageCountry => Boolean(country)),
  }
}

function normalizeCountry(row: unknown): CoverageCountry | null {
  const record = asRecord(row)
  if (!record) return null
  return {
    country: readString(record, ['country', 'countryName', 'country_name']) ?? 'Unknown',
    region: readString(record, ['region']) ?? 'Unknown',
    tickerCount: readNumber(record, ['tickerCount', 'ticker_count']) ?? 0,
    pricedTickerCount: readNumber(record, ['pricedTickerCount', 'priced_ticker_count']) ?? 0,
    freshPricedTickerCount: readNumber(record, ['freshPricedTickerCount', 'fresh_priced_ticker_count']) ?? 0,
    relationshipNodeCount: readNumber(record, ['relationshipNodeCount', 'relationship_node_count']) ?? 0,
    relationshipEdgeCount: readNumber(record, ['relationshipEdgeCount', 'relationship_edge_count']) ?? 0,
    pricedCoverageRatio: readRatio(record, ['pricedCoverageRatio', 'priced_coverage_ratio']),
    freshPriceCoverageRatio: readRatio(record, ['freshPriceCoverageRatio', 'fresh_price_coverage_ratio']),
    relationshipCoverageRatio: readRatio(record, ['relationshipCoverageRatio', 'relationship_coverage_ratio']),
    status: normalizeStatus(readString(record, ['status'])),
  }
}

function compareCountries(a: CoverageCountry, b: CoverageCountry): number {
  return STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    || b.tickerCount - a.tickerCount
    || a.country.localeCompare(b.country)
}

function coverageRatioSummary(payload: CoveragePayload | null, loading: boolean, unavailable: boolean): string {
  if (loading) return '...'
  if (unavailable || !payload) return '-'
  const denominator = payload.summary.pricedTickerCount
  if (denominator <= 0) return '—'
  return formatRatio(payload.summary.relationshipNodeCount / denominator)
}

function summaryValue(value: number | undefined, loading: boolean, unavailable: boolean): string {
  if (loading) return '...'
  if (unavailable || value === undefined) return '-'
  return String(value)
}

function readFilters(searchParams: { get(name: string): string | null }): CoverageFilters {
  return normalizeFilters({
    window: searchParams.get('window'),
    layer: searchParams.get('layer'),
    freshPriceDays: searchParams.get('freshPriceDays') ?? searchParams.get('fresh_price_days'),
    minTickerCount: searchParams.get('minTickerCount') ?? searchParams.get('min_ticker_count'),
  })
}

function normalizeFilters(input: Partial<Record<keyof CoverageFilters, unknown>>): CoverageFilters {
  return {
    window: Number(input.window) === 126 ? 126 : 252,
    layer: normalizeLayer(input.layer),
    freshPriceDays: readPositiveInt(input.freshPriceDays, DEFAULT_FILTERS.freshPriceDays),
    minTickerCount: readPositiveInt(input.minTickerCount, DEFAULT_FILTERS.minTickerCount),
  }
}

function queryForFilters(filters: CoverageFilters): URLSearchParams {
  return new URLSearchParams({
    window: String(filters.window),
    layer: filters.layer,
    freshPriceDays: String(filters.freshPriceDays),
    minTickerCount: String(filters.minTickerCount),
  })
}

function normalizeLayer(value: unknown): CoverageLayer {
  return LAYERS.includes(value as CoverageLayer) ? value as CoverageLayer : DEFAULT_FILTERS.layer
}

function readPositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : fallback
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

function readBoolean(record: RowRecord | null | undefined, keys: string[]): boolean | null {
  if (!record) return null
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      if (normalized === 'true') return true
      if (normalized === 'false') return false
    }
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

function readRatio(record: RowRecord, keys: string[]): number | null {
  const value = readNumber(record, keys)
  if (value === null) return null
  return Math.max(0, Math.min(1, value))
}

function formatRatio(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return `${Math.round(value * 100)}%`
}

function normalizeStatus(value: string | null): CoverageStatus {
  const normalized = value?.trim().toLowerCase()
  if (normalized === 'green' || normalized === 'yellow' || normalized === 'red' || normalized === 'gray') return normalized
  return 'gray'
}

function statusLabel(status: CoverageStatus): string {
  if (status === 'green') return 'OK'
  if (status === 'yellow') return 'Low coverage'
  if (status === 'red') return 'No relationship nodes'
  return 'Unknown'
}

function statusBadgeClass(status: CoverageStatus): string {
  if (status === 'green') return 'completed'
  if (status === 'yellow') return 'running'
  if (status === 'red') return 'failed'
  return 'queued'
}

function layerLabel(layer: CoverageLayer): string {
  if (layer === 'all') return 'All layers'
  if (layer === 'raw_price') return 'Raw price'
  if (layer === 'residual_price') return 'Residual price'
  if (layer === 'lead_lag') return 'Lead-lag'
  return 'Theme ETF'
}
