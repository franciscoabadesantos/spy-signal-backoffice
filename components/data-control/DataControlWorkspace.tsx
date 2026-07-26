'use client'

import { useEffect, useMemo, useState } from 'react'
import { requestClientJson } from '@/lib/client-json'
import { asRecord, firstList, type RowRecord } from '@/lib/payload'

type Props = { adminEmail: string }
type Tab = 'coverage' | 'domains' | 'sources'
type DomainSnapshot = { state: string; coverageClass: string; recordCount: number; latestKnownAt: string | null; sources: string[] }
type CoverageRow = { symbol: string; readinessState: string | null; coreStatus: string; missingCoreDomains: string[]; unavailableCoreDomains: string[]; observedDomains: number; domains: Record<string, DomainSnapshot> }
type SourceRow = { domain: string; source: string; role: string; recordCount: number; symbolCount: number; lowConfidenceRecords: number; latestKnownAt: string | null; latestIngestedAt: string | null; coverageClass: string }
type BuildRecord = { id: number | null; status: string; startedAt: string | null; endedAt: string | null; rowCount: number; error: string | null }
type DomainRow = { domain: string; table: string; available: boolean; state: string; reason: string | null; rowCount: number; latestObservationKnownAt: string | null; latestObservationIngestedAt: string | null; sources: string[]; buildTelemetryAvailable: boolean | null; buildTelemetryReason: string | null; latestBuild: BuildRecord | null; latestFailedBuild: BuildRecord | null; freshnessStatus: string }
const COVERAGE_PAGE_SIZE = 250

const DOMAINS = [
  ['financialStatements', 'Statements'], ['marketMetrics', 'Metrics'], ['earningsEvents', 'Earnings'],
  ['filings', 'Filings'], ['corporateActions', 'Actions'], ['investorEvents', 'Investor events'], ['guidance', 'Guidance'], ['equityCapitalEvents', 'Capital events'], ['fundDistributions', 'Fund distributions'],
] as const

export function DataControlWorkspace({ adminEmail }: Props) {
  const [tab, setTab] = useState<Tab>('coverage')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [coveragePayload, setCoveragePayload] = useState<unknown>(null)
  const [sourcesPayload, setSourcesPayload] = useState<unknown>(null)
  const [domainsPayload, setDomainsPayload] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const coverage = useMemo(() => normalizeCoverage(coveragePayload), [coveragePayload])
  const sources = useMemo(() => normalizeSources(sourcesPayload), [sourcesPayload])
  const domains = useMemo(() => normalizeDomains(domainsPayload), [domainsPayload])

  async function loadCoverage(nextSearch = search, nextOffset = offset) {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ limit: String(COVERAGE_PAGE_SIZE), offset: String(nextOffset) })
    if (nextSearch.trim()) params.set('search', nextSearch.trim().toUpperCase())
    try {
      setCoveragePayload(await requestClientJson(`/api/data-control/coverage?${params.toString()}`))
    } catch (requestError) {
      setError(message(requestError))
    } finally {
      setLoading(false)
    }
  }

  async function loadSources() {
    setLoading(true)
    setError(null)
    try {
      setSourcesPayload(await requestClientJson('/api/data-control/sources?limit=500'))
    } catch (requestError) {
      setError(message(requestError))
    } finally {
      setLoading(false)
    }
  }

  async function loadDomains() {
    setLoading(true)
    setError(null)
    try {
      setDomainsPayload(await requestClientJson('/api/data-control/domains'))
    } catch (requestError) {
      setError(message(requestError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadCoverage(''), 0)
    return () => window.clearTimeout(timer)
    // The initial view is the global coverage matrix.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function switchTab(nextTab: Tab) {
    setTab(nextTab)
    if (nextTab === 'domains' && domainsPayload === null) void loadDomains()
    if (nextTab === 'sources' && sourcesPayload === null) void loadSources()
  }

  return (
    <div className="page-stack">
      <section className="card">
        <div className="split-row">
          <div>
            <p className="eyebrow">Data operations</p>
            <h1>Data Control</h1>
            <p className="small">Coverage, pipeline state, and source lineage for canonical read models.</p>
          </div>
          <div className="small">Admin: {adminEmail}</div>
        </div>
        <div className="entity-layer-query-action">
          <button className={tab === 'coverage' ? 'primary' : 'secondary'} onClick={() => switchTab('coverage')} type="button">Coverage</button>
          <button className={tab === 'domains' ? 'primary' : 'secondary'} onClick={() => switchTab('domains')} type="button">Pipelines</button>
          <button className={tab === 'sources' ? 'primary' : 'secondary'} onClick={() => switchTab('sources')} type="button">Source health</button>
        </div>
      </section>

      {error ? <section className="card"><div className="error">Data control request failed: {error}</div></section> : null}
      {tab === 'coverage' ? (
        <CoverageView coverage={coverage} loading={loading} offset={offset} search={search} onSearch={setSearch} onLoad={() => { setOffset(0); void loadCoverage(search, 0) }} onPage={(nextOffset) => { setOffset(nextOffset); void loadCoverage(search, nextOffset) }} />
      ) : null}
      {tab === 'domains' ? <DomainsView domains={domains} loading={loading} /> : null}
      {tab === 'sources' ? <SourcesView sources={sources} loading={loading} /> : null}
    </div>
  )
}

function CoverageView({ coverage, loading, offset, search, onSearch, onLoad, onPage }: { coverage: Coverage; loading: boolean; offset: number; search: string; onSearch: (value: string) => void; onLoad: () => void; onPage: (offset: number) => void }) {
  return <section className="card">
    <div className="split-row"><div><h2>Tracked universe coverage</h2><p className="small">Required domains: statements, market metrics and earnings. Events are observational, not missing-data failures.</p></div><Availability available={coverage.available} /></div>
    <div className="metric-grid">
      <Metric label="Tracked" value={String(coverage.summary.trackedTickers ?? 0)} />
      <Metric label="Core healthy" value={String(coverage.summary.coreHealthy ?? 0)} />
      <Metric label="Core missing" value={String(coverage.summary.coreMissing ?? 0)} />
      <Metric label="Core unavailable" value={String(coverage.summary.coreUnavailable ?? 0)} />
    </div>
    <div className="data-filter-bar"><div><label htmlFor="data-control-search">Ticker</label><input id="data-control-search" onChange={(event) => onSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') onLoad() }} placeholder="Filter tracked universe" value={search} /></div><div className="entity-layer-query-action"><button className="primary" disabled={loading} onClick={onLoad} type="button">{loading ? 'Loading' : 'Apply'}</button></div></div>
    {coverage.available === false ? <div className="small">{coverage.reason ?? 'Coverage read model unavailable.'}</div> : null}
    <div className="table-wrap"><table className="registry-table"><thead><tr><th>Ticker</th><th>Core</th>{DOMAINS.map(([, label]) => <th key={label}>{label}</th>)}</tr></thead><tbody>
      {loading ? <EmptyRow cols={DOMAINS.length + 2} message="Loading tracked-universe coverage..." /> : null}
      {!loading && coverage.rows.length === 0 ? <EmptyRow cols={DOMAINS.length + 2} message="No tracked tickers match this filter." /> : null}
      {!loading ? coverage.rows.map((row) => <tr key={row.symbol}><td><strong>{row.symbol}</strong><div className="small">{row.readinessState ?? '-'}</div></td><td><span className={`badge ${badgeClass(row.coreStatus)}`}>{row.coreStatus}</span><div className="small">{[...row.unavailableCoreDomains, ...row.missingCoreDomains].join(', ') || 'complete'}</div></td>{DOMAINS.map(([key]) => <DomainCell key={key} snapshot={row.domains[key]} />)}</tr>) : null}
    </tbody></table></div>
    {coverage.available && coverage.total > COVERAGE_PAGE_SIZE ? <div className="split-row"><span className="small">{offset + 1}-{Math.min(offset + coverage.rows.length, coverage.total)} of {coverage.total} tracked tickers</span><div className="entity-layer-query-action"><button className="secondary" disabled={loading || offset === 0} onClick={() => onPage(Math.max(0, offset - COVERAGE_PAGE_SIZE))} type="button">Previous</button><button className="secondary" disabled={loading || offset + COVERAGE_PAGE_SIZE >= coverage.total} onClick={() => onPage(offset + COVERAGE_PAGE_SIZE)} type="button">Next</button></div></div> : null}
  </section>
}

function SourcesView({ sources, loading }: { sources: Sources; loading: boolean }) {
  return <section className="card"><div className="split-row"><div><h2>Source lineage</h2><p className="small">Primary sources are canonical table columns; contributing sources are observed provenance, not provider availability claims.</p></div><Availability available={sources.available} /></div>
    {sources.available === false ? <div className="small">{sources.reason ?? 'Source-health read model unavailable.'}</div> : null}
    <div className="table-wrap"><table className="registry-table"><thead><tr><th>Domain</th><th>Source</th><th>Role</th><th>Tickers</th><th>Records</th><th>Low confidence</th><th>Latest known</th><th>Latest ingested</th></tr></thead><tbody>
      {loading ? <EmptyRow cols={8} message="Loading canonical source health..." /> : null}
      {!loading && sources.rows.length === 0 ? <EmptyRow cols={8} message="No source-health rows returned." /> : null}
      {!loading ? sources.rows.map((row) => <tr key={`${row.domain}-${row.source}-${row.role}`}><td>{row.domain}</td><td><strong>{row.source}</strong></td><td><span className="badge muted">{row.role}</span></td><td>{row.symbolCount}</td><td>{row.recordCount}</td><td>{row.lowConfidenceRecords || '-'}</td><td>{row.latestKnownAt ?? '-'}</td><td>{row.latestIngestedAt ?? '-'}</td></tr>) : null}
    </tbody></table></div>
  </section>
}

function DomainsView({ domains, loading }: { domains: Domains; loading: boolean }) {
  return <section className="card"><div className="split-row"><div><h2>Canonical pipeline inventory</h2><p className="small">A successful empty build means no safe canonical observations, not a source failure. Freshness SLAs are not configured yet.</p></div><Availability available={domains.available} /></div>
    {domains.available === false ? <div className="small">{domains.reason ?? 'Domain inventory unavailable.'}</div> : null}
    <div className="table-wrap"><table className="registry-table"><thead><tr><th>Domain / state</th><th>Canonical data</th><th>Sources</th><th>Latest build</th><th>Last failure</th></tr></thead><tbody>
      {loading ? <EmptyRow cols={5} message="Loading canonical pipeline inventory..." /> : null}
      {!loading && domains.rows.length === 0 ? <EmptyRow cols={5} message="No canonical domains returned." /> : null}
      {!loading ? domains.rows.map((row) => <tr key={row.domain}><td><strong>{row.domain}</strong><div className="small">{row.table}</div><span className={`badge ${badgeClass(row.state)}`}>{row.state}</span><div className="small">{row.reason ?? '-'}</div></td><td>{row.rowCount} rows<div className="small">known: {row.latestObservationKnownAt ?? '-'}</div><div className="small">ingested: {row.latestObservationIngestedAt ?? '-'}</div></td><td>{row.sources.join(', ') || '-'}<div className="small">telemetry: {row.buildTelemetryAvailable === true ? 'available' : row.buildTelemetryAvailable === false ? row.buildTelemetryReason ?? 'unavailable' : '-'}</div></td><td><BuildSummary build={row.latestBuild} /><div className="small">freshness: {row.freshnessStatus}</div></td><td><BuildSummary build={row.latestFailedBuild} failure /></td></tr>) : null}
    </tbody></table></div>
  </section>
}

function BuildSummary({ build, failure = false }: { build: BuildRecord | null; failure?: boolean }) { if (!build) return <span className="small">-</span>; return <><span className={`badge ${badgeClass(build.status)}`}>{build.status}</span><div className="small">#{build.id ?? '-'} · {build.rowCount} written</div><div className="small">{build.endedAt ?? build.startedAt ?? '-'}</div>{failure && build.error ? <div className="small">{build.error}</div> : null}</> }

function DomainCell({ snapshot }: { snapshot: DomainSnapshot | undefined }) {
  const state = snapshot?.state ?? 'unavailable'
  return <td><span className={`badge ${badgeClass(state)}`}>{state}</span><div className="small">{snapshot?.recordCount ?? 0} rows</div><div className="small">{snapshot?.latestKnownAt ?? '-'}</div></td>
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="compact-card"><label>{label}</label><div className="metric-value">{value}</div></div> }
function EmptyRow({ cols, message }: { cols: number; message: string }) { return <tr><td className="small" colSpan={cols}>{message}</td></tr> }
function Availability({ available }: { available: boolean | null }) { return <span className={`badge ${available === true ? 'completed' : available === false ? 'failed' : 'muted'}`}>{available === true ? 'available' : available === false ? 'unavailable' : 'not loaded'}</span> }
function badgeClass(value: string): string { return value === 'healthy' || value === 'has_observations' || value === 'success' ? 'completed' : value === 'missing' || value === 'unavailable' || value === 'read_model_unavailable' || value === 'build_failed' || value === 'failed' ? 'failed' : 'muted' }

type Coverage = { available: boolean | null; reason: string | null; total: number; summary: Record<string, unknown>; rows: CoverageRow[] }
type Sources = { available: boolean | null; reason: string | null; rows: SourceRow[] }
type Domains = { available: boolean | null; reason: string | null; rows: DomainRow[] }
function normalizeCoverage(payload: unknown): Coverage { const record = asRecord(payload); return { available: typeof record?.available === 'boolean' ? record.available : null, reason: stringValue(record?.reason), total: numberValue(record?.total) ?? 0, summary: asRecord(record?.summary) ?? {}, rows: firstList<RowRecord>(payload, ['rows']).map(normalizeCoverageRow) } }
function normalizeSources(payload: unknown): Sources { const record = asRecord(payload); return { available: typeof record?.available === 'boolean' ? record.available : null, reason: stringValue(record?.reason), rows: firstList<RowRecord>(payload, ['rows']).map((row) => ({ domain: stringValue(row.domain) ?? '-', source: stringValue(row.source) ?? '-', role: stringValue(row.role) ?? '-', recordCount: numberValue(row.recordCount) ?? 0, symbolCount: numberValue(row.symbolCount) ?? 0, lowConfidenceRecords: numberValue(row.lowConfidenceRecords) ?? 0, latestKnownAt: stringValue(row.latestKnownAt), latestIngestedAt: stringValue(row.latestIngestedAt), coverageClass: stringValue(row.coverageClass) ?? '-' })) } }
function normalizeBuild(value: unknown): BuildRecord | null { const row = asRecord(value); return row ? { id: numberValue(row.id), status: stringValue(row.status) ?? 'unknown', startedAt: stringValue(row.startedAt), endedAt: stringValue(row.endedAt), rowCount: numberValue(row.rowCount) ?? 0, error: stringValue(row.error) } : null }
function normalizeDomains(payload: unknown): Domains { const record = asRecord(payload); return { available: typeof record?.available === 'boolean' ? record.available : null, reason: stringValue(record?.reason), rows: firstList<RowRecord>(payload, ['rows']).map((row) => ({ domain: stringValue(row.domain) ?? '-', table: stringValue(row.table) ?? '-', available: row.available === true, state: stringValue(row.state) ?? 'unknown', reason: stringValue(row.reason), rowCount: numberValue(row.rowCount) ?? 0, latestObservationKnownAt: stringValue(row.latestObservationKnownAt), latestObservationIngestedAt: stringValue(row.latestObservationIngestedAt), sources: stringList(row.sources), buildTelemetryAvailable: typeof row.buildTelemetryAvailable === 'boolean' ? row.buildTelemetryAvailable : null, buildTelemetryReason: stringValue(row.buildTelemetryReason), latestBuild: normalizeBuild(row.latestBuild), latestFailedBuild: normalizeBuild(row.latestFailedBuild), freshnessStatus: stringValue(row.freshnessStatus) ?? 'not_configured' })) } }
function normalizeCoverageRow(row: RowRecord): CoverageRow { const domainsRecord = asRecord(row.domains) ?? {}; const domains: Record<string, DomainSnapshot> = {}; for (const [key, value] of Object.entries(domainsRecord)) { const item = asRecord(value) ?? {}; domains[key] = { state: stringValue(item.state) ?? 'unavailable', coverageClass: stringValue(item.coverageClass) ?? '-', recordCount: numberValue(item.recordCount) ?? 0, latestKnownAt: stringValue(item.latestKnownAt), sources: stringList(item.sources) } } return { symbol: stringValue(row.symbol) ?? '-', readinessState: stringValue(row.readinessState), coreStatus: stringValue(row.coreStatus) ?? 'unavailable', missingCoreDomains: stringList(row.missingCoreDomains), unavailableCoreDomains: stringList(row.unavailableCoreDomains), observedDomains: numberValue(row.observedDomains) ?? 0, domains } }
function stringValue(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value.trim() : null }
function numberValue(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) ? value : typeof value === 'string' && Number.isFinite(Number(value)) ? Number(value) : null }
function stringList(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [] }
function message(error: unknown): string { const record = asRecord(error); return stringValue(record?.message) ?? stringValue(record?.detail) ?? (error instanceof Error ? error.message : 'Unknown error.') }
