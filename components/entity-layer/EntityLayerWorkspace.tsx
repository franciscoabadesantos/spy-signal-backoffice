'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { requestClientJson } from '@/lib/client-json'
import { asRecord, firstList, type RowRecord } from '@/lib/payload'

type Props = {
  adminEmail: string
}

type EndpointKey = 'summary' | 'dedup' | 'tail' | 'sourceHealth' | 'review'

type WorkspaceState = Record<EndpointKey, unknown | null> & {
  loading: boolean
  errors: Partial<Record<EndpointKey, string>>
}

type AvailabilityState = {
  label: string
  available: boolean | null
  detail: string
}

type CountRow = {
  label: string
  value: string
  detail?: string
}

const endpointRequests: Array<[EndpointKey, string]> = [
  ['summary', '/api/entity-layer/summary'],
  ['dedup', '/api/entity-layer/dedup?limit=20'],
  ['tail', '/api/entity-layer/tail?limit=20'],
  ['sourceHealth', '/api/entity-layer/source-health?sample_limit=10'],
  ['review', '/api/entity-layer/review'],
]

const sourceLabels = [
  'OpenFIGI',
  'listing ISIN',
  'GLEIF legal-name',
  'GLEIF ISIN->LEI',
  'GLEIF LEI->ISIN',
]

export function EntityLayerWorkspace({ adminEmail }: Props) {
  const [state, setState] = useState<WorkspaceState>({
    summary: null,
    dedup: null,
    tail: null,
    sourceHealth: null,
    review: null,
    loading: true,
    errors: {},
  })
  const [entityQueryKind, setEntityQueryKind] = useState('symbol')
  const [entityQuery, setEntityQuery] = useState('SAP')
  const [entitiesPayload, setEntitiesPayload] = useState<unknown | null>(null)
  const [entitiesLoading, setEntitiesLoading] = useState(true)
  const [entitiesError, setEntitiesError] = useState<string | null>(null)

  async function loadWorkspace() {
    setState((current) => ({ ...current, loading: true, errors: {} }))
    const results = await Promise.allSettled(
      endpointRequests.map(async ([key, url]) => [key, await requestClientJson(url)] as const)
    )
    const next: WorkspaceState = {
      summary: null,
      dedup: null,
      tail: null,
      sourceHealth: null,
      review: null,
      loading: false,
      errors: {},
    }

    results.forEach((result, index) => {
      const key = endpointRequests[index][0]
      if (result.status === 'fulfilled') {
        next[key] = result.value[1]
      } else {
        next.errors[key] = errorMessage(result.reason)
      }
    })

    setState(next)
  }

  async function loadEntities(kind = entityQueryKind, query = entityQuery) {
    const trimmed = query.trim()
    if (!trimmed) {
      setEntitiesPayload(null)
      setEntitiesError('Enter a symbol, entity id, LEI, or free-text query.')
      return
    }

    setEntitiesLoading(true)
    setEntitiesError(null)
    try {
      const params = new URLSearchParams({ [kind]: trimmed })
      setEntitiesPayload(await requestClientJson(`/api/entity-layer/entities?${params.toString()}`))
    } catch (error) {
      setEntitiesPayload(null)
      setEntitiesError(errorMessage(error))
    } finally {
      setEntitiesLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadWorkspace()
      void loadEntities('symbol', 'SAP')
    }, 0)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const summary = useMemo(() => normalizeSummary(state.summary), [state.summary])
  const dedupGroups = useMemo(() => normalizeDedupGroups(state.dedup), [state.dedup])
  const tailRows = useMemo(() => normalizeTailRows(state.tail), [state.tail])
  const sourceHealth = useMemo(() => normalizeSourceHealth(state.sourceHealth), [state.sourceHealth])
  const entityRows = useMemo(() => normalizeEntityRows(entitiesPayload), [entitiesPayload])
  const reviewRows = useMemo(() => normalizeReviewRows(state.review), [state.review])
  const reviewQueueAvailable = readQueueAvailable(state.review)
  const degradedEndpoints = useMemo(() => {
    return endpointRequests
      .map(([key]) => [key, availabilityFor(state[key])] as const)
      .filter(([, availability]) => availability.available === false)
  }, [state])

  function submitEntityQuery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void loadEntities()
  }

  return (
    <div className="page-stack entity-layer-workspace">
      <div className="card">
        <div className="split-row">
          <div>
            <p className="eyebrow">Analyst workspace</p>
            <h1>Entity Layer</h1>
            <p className="small">
              Read-only diagnostics for entity identity coverage, deduplication, source cache health, and review queue state.
            </p>
          </div>
          <div className="entity-layer-header-meta">
            <div className="small">Admin: {adminEmail}</div>
            <button className="secondary entity-layer-refresh" onClick={() => void loadWorkspace()} type="button">Refresh</button>
          </div>
        </div>
      </div>

      {Object.keys(state.errors).length > 0 ? <EndpointErrorPanel errors={state.errors} /> : null}
      {degradedEndpoints.length > 0 ? <DegradedPanel endpoints={degradedEndpoints} /> : null}

      <CoverageSummaryPanel loading={state.loading} summary={summary} />
      <DedupPanel groups={dedupGroups} loading={state.loading} payload={state.dedup} />
      <TailPanel loading={state.loading} rows={tailRows} summaryPayload={state.summary} tailPayload={state.tail} />
      <SourceHealthPanel loading={state.loading} rows={sourceHealth} payload={state.sourceHealth} />

      <section className="card">
        <div className="split-row">
          <div>
            <h2>Entity drill-down</h2>
            <p className="small">Query the entity layer by symbol, entity id, LEI, or free text. This panel only reads the analyst endpoint.</p>
          </div>
          <AvailabilityBadge availability={availabilityFor(entitiesPayload)} />
        </div>

        <form className="entity-layer-query" onSubmit={submitEntityQuery}>
          <div>
            <label htmlFor="entity-query-kind">Query key</label>
            <select id="entity-query-kind" onChange={(event) => setEntityQueryKind(event.target.value)} value={entityQueryKind}>
              <option value="symbol">symbol</option>
              <option value="entity">entity</option>
              <option value="lei">LEI</option>
              <option value="q">q</option>
            </select>
          </div>
          <div>
            <label htmlFor="entity-query">Value</label>
            <input id="entity-query" onChange={(event) => setEntityQuery(event.target.value)} value={entityQuery} />
          </div>
          <div className="entity-layer-query-action">
            <button className="primary" type="submit">Search</button>
          </div>
        </form>

        {entitiesError ? <div className="error">Entity query failed: {entitiesError}</div> : null}
        <EntityDrilldownTable loading={entitiesLoading} rows={entityRows} payload={entitiesPayload} />
      </section>

      <ReviewQueuePanel loading={state.loading} queueAvailable={reviewQueueAvailable} rows={reviewRows} />
    </div>
  )
}

function CoverageSummaryPanel({ loading, summary }: { loading: boolean; summary: ReturnType<typeof normalizeSummary> }) {
  return (
    <section className="card">
      <div className="split-row">
        <div>
          <h2>Coverage summary</h2>
          <p className="small">Scope, batch, attachment coverage, confidence distribution, and recent batch trend.</p>
        </div>
        <AvailabilityBadge availability={summary.availability} />
      </div>

      <div className="metric-grid entity-layer-metric-grid">
        <KpiCard label="Batch" value={loading ? '...' : summary.batchId} sub={summary.scope} />
        <KpiCard label="Entity master" value={loading ? '...' : summary.entityMasterCount} sub="master records" />
        <KpiCard label="Listings" value={loading ? '...' : summary.listingCount} sub="entity listings" />
        <KpiCard label="Resolved" value={loading ? '...' : summary.resolvedCount} sub="attached listings" status="completed" />
        <KpiCard label="Provisional" value={loading ? '...' : summary.provisionalCount} sub="needs stronger evidence" status="running" />
        <KpiCard label="Unresolved" value={loading ? '...' : summary.unresolvedCount} sub="no entity assignment" status={summary.unresolvedCount === '0' ? 'completed' : 'failed'} />
      </div>

      <div className="entity-layer-three-column">
        <BreakdownBlock title="Attach method breakdown" rows={summary.attachMethods} />
        <BreakdownBlock title="Confidence distribution" rows={summary.confidenceDistribution} />
        <TrendBlock rows={summary.batchTrend} />
      </div>
    </section>
  )
}

function DedupPanel({ groups, loading, payload }: { groups: DedupGroup[]; loading: boolean; payload: unknown }) {
  const count = readNumber(asRecord(payload), ['count', 'total', 'group_count', 'groupCount']) ?? groups.length

  return (
    <section className="card">
      <div className="split-row">
        <div>
          <h2>Dedup results</h2>
          <p className="small">Multi-listing entities grouped by legal identity and sibling listing attachments.</p>
        </div>
        <div className="meta">
          <span className="badge muted">groups: {loading ? '...' : count}</span>
          <AvailabilityBadge availability={availabilityFor(payload)} />
        </div>
      </div>

      <div className="table-wrap">
        <table className="registry-table entity-layer-table">
          <thead>
            <tr>
              <th>Entity</th>
              <th>LEI</th>
              <th>Home</th>
              <th>Siblings</th>
              <th>Attach methods</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <EmptyRow colSpan={5} text="Loading dedup results..." /> : null}
            {!loading && groups.length === 0 ? <EmptyRow colSpan={5} text="No multi-listing entity groups returned." /> : null}
            {!loading ? groups.map((group, index) => (
              <tr key={`${group.lei}-${group.legalName}-${index}`}>
                <td>
                  <strong>{group.legalName}</strong>
                  <div className="small">{group.entityId}</div>
                </td>
                <td>{group.lei}</td>
                <td>{group.homeCountry}</td>
                <td><ListingList listings={group.listings} /></td>
                <td><BadgeList values={group.attachMethods} /></td>
              </tr>
            )) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function TailPanel({
  loading,
  rows,
  summaryPayload,
  tailPayload,
}: {
  loading: boolean
  rows: TailRow[]
  summaryPayload: unknown
  tailPayload: unknown
}) {
  const unresolvedMulti = readNumberFromAny(
    [summaryPayload, tailPayload],
    ['unresolvedMultiListingEntitiesCount', 'unresolved_multi_listing_entities_count', 'unresolved_multi_listing_count']
  )
  const reasonRows = bucketRows(rows, (row) => row.reason)
  const segmentRows = bucketRows(rows, (row) => row.segment)

  return (
    <section className="card">
      <div className="split-row">
        <div>
          <h2>Tail panel</h2>
          <p className="small">Unresolved and provisional entity attachments segmented by listing shape and reason bucket.</p>
        </div>
        <div className="meta">
          <span className={unresolvedMulti && unresolvedMulti > 0 ? 'badge failed' : 'badge completed'}>
            unresolved multi-listing: {loading ? '...' : unresolvedMulti ?? 0}
          </span>
          <AvailabilityBadge availability={availabilityFor(tailPayload)} />
        </div>
      </div>

      <div className="entity-layer-two-column">
        <BreakdownBlock title="Reason buckets" rows={reasonRows} />
        <BreakdownBlock title="Segment" rows={segmentRows} />
      </div>

      <div className="table-wrap">
        <table className="registry-table entity-layer-table">
          <thead>
            <tr>
              <th>Listing</th>
              <th>Status</th>
              <th>Segment</th>
              <th>Reason</th>
              <th>Importance</th>
              <th>Market cap</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <EmptyRow colSpan={6} text="Loading tail rows..." /> : null}
            {!loading && rows.length === 0 ? <EmptyRow colSpan={6} text="No unresolved or provisional rows returned." /> : null}
            {!loading ? rows.map((row, index) => (
              <tr className={row.status === 'unresolved' ? 'danger-row' : undefined} key={`${row.symbol}-${row.reason}-${index}`}>
                <td>
                  <strong>{row.symbol}</strong>
                  <div className="small">{row.exchange} {row.isin}</div>
                </td>
                <td><span className={row.status === 'unresolved' ? 'badge failed' : 'badge running'}>{row.status}</span></td>
                <td>{row.segment}</td>
                <td>{row.reason}</td>
                <td>{row.importanceBucket}</td>
                <td>{row.marketCap}</td>
              </tr>
            )) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function SourceHealthPanel({ loading, rows, payload }: { loading: boolean; rows: SourceHealthRow[]; payload: unknown }) {
  return (
    <section className="card">
      <div className="split-row">
        <div>
          <h2>Source/cache health</h2>
          <p className="small">Entity-layer cache health across OpenFIGI, listing ISIN, and GLEIF lookup paths.</p>
        </div>
        <AvailabilityBadge availability={availabilityFor(payload)} />
      </div>

      <div className="table-wrap">
        <table className="registry-table entity-layer-table">
          <thead>
            <tr>
              <th>Source</th>
              <th>Success</th>
              <th>Not found</th>
              <th>Error</th>
              <th>Gaps</th>
              <th>Samples</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <EmptyRow colSpan={6} text="Loading source/cache health..." /> : null}
            {!loading && rows.length === 0 ? <EmptyRow colSpan={6} text="No source/cache health rows returned." /> : null}
            {!loading ? rows.map((row) => (
              <tr className={row.errorCount > 0 || row.gapCount > 0 ? 'danger-row' : undefined} key={row.source}>
                <td><strong>{row.source}</strong></td>
                <td>{row.successCount}</td>
                <td>{row.notFoundCount}</td>
                <td>{row.errorCount}</td>
                <td>{row.gapCount}</td>
                <td><SampleList samples={row.samples} /></td>
              </tr>
            )) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function EntityDrilldownTable({ loading, rows, payload }: { loading: boolean; rows: EntityRow[]; payload: unknown }) {
  return (
    <div className="table-wrap entity-layer-drilldown">
      <table className="registry-table entity-layer-table">
        <thead>
          <tr>
            <th>Entity</th>
            <th>LEI</th>
            <th>Home</th>
            <th>Listings</th>
            <th>Provenance</th>
            <th>Confidence</th>
            <th>Evidence</th>
          </tr>
        </thead>
        <tbody>
          {loading ? <EmptyRow colSpan={7} text="Loading entity drill-down..." /> : null}
          {!loading && rows.length === 0 ? <EmptyRow colSpan={7} text="No entities matched the query." /> : null}
          {!loading ? rows.map((row, index) => (
            <tr key={`${row.entityId}-${row.lei}-${index}`}>
              <td>
                <strong>{row.legalName}</strong>
                <div className="small">{row.entityId}</div>
              </td>
              <td>{row.lei}</td>
              <td>{row.homeCountry}</td>
              <td><ListingList listings={row.listings} /></td>
              <td>{row.provenance}</td>
              <td>{row.confidence}</td>
              <td>
                <details>
                  <summary>metadata/evidence</summary>
                  <pre>{JSON.stringify(row.evidence ?? row.metadata ?? payload, null, 2)}</pre>
                </details>
              </td>
            </tr>
          )) : null}
        </tbody>
      </table>
    </div>
  )
}

function ReviewQueuePanel({
  loading,
  queueAvailable,
  rows,
}: {
  loading: boolean
  queueAvailable: boolean | null
  rows: ReviewRow[]
}) {
  return (
    <section className="card">
      <div className="split-row">
        <div>
          <h2>Review queue</h2>
          <p className="small">Read-only `entity_identity_review` rows. Empty queue is valid.</p>
        </div>
        <span className={queueAvailable === false ? 'badge failed' : queueAvailable === true ? 'badge completed' : 'badge muted'}>
          queueAvailable: {queueAvailable === null ? 'unknown' : String(queueAvailable)}
        </span>
      </div>

      <div className="table-wrap">
        <table className="registry-table entity-layer-table">
          <thead>
            <tr>
              <th>Entity/listing</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <EmptyRow colSpan={4} text="Loading review queue..." /> : null}
            {!loading && rows.length === 0 ? <EmptyRow colSpan={4} text="No review items currently queued." /> : null}
            {!loading ? rows.map((row, index) => (
              <tr key={`${row.subject}-${row.reason}-${index}`}>
                <td><strong>{row.subject}</strong></td>
                <td>{row.reason}</td>
                <td>{row.status}</td>
                <td>
                  <details>
                    <summary>details</summary>
                    <pre>{JSON.stringify(row.raw, null, 2)}</pre>
                  </details>
                </td>
              </tr>
            )) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function KpiCard({
  label,
  value,
  sub,
  status,
}: {
  label: string
  value: string
  sub: string
  status?: 'completed' | 'running' | 'failed'
}) {
  return (
    <div className="card compact-card">
      <label>{label}</label>
      <div className="metric-value">{value}</div>
      <div className="small">{sub}</div>
      {status ? <span className={`badge ${status}`}>{status}</span> : null}
    </div>
  )
}

function BreakdownBlock({ title, rows }: { title: string; rows: CountRow[] }) {
  return (
    <div className="entity-layer-breakdown">
      <h3>{title}</h3>
      {rows.length === 0 ? <p className="small">No breakdown returned.</p> : null}
      {rows.map((row) => (
        <div className="entity-layer-breakdown-row" key={`${title}-${row.label}`}>
          <span>{row.label}</span>
          <strong>{row.value}</strong>
          {row.detail ? <small>{row.detail}</small> : null}
        </div>
      ))}
    </div>
  )
}

function TrendBlock({ rows }: { rows: CountRow[] }) {
  return (
    <div className="entity-layer-breakdown">
      <h3>Batch trend</h3>
      {rows.length === 0 ? <p className="small">No batch trend returned.</p> : null}
      {rows.map((row) => (
        <div className="entity-layer-breakdown-row" key={`trend-${row.label}`}>
          <span>{row.label}</span>
          <strong>{row.value}</strong>
          {row.detail ? <small>{row.detail}</small> : null}
        </div>
      ))}
    </div>
  )
}

function AvailabilityBadge({ availability }: { availability: AvailabilityState }) {
  const className = availability.available === false ? 'badge failed' : availability.available === true ? 'badge completed' : 'badge muted'
  return <span className={className}>{availability.label}</span>
}

function EndpointErrorPanel({ errors }: { errors: Partial<Record<EndpointKey, string>> }) {
  return (
    <div className="error">
      Entity Layer requests failed: {Object.entries(errors).map(([key, message]) => `${labelForEndpoint(key as EndpointKey)}: ${message}`).join('; ')}
    </div>
  )
}

function DegradedPanel({ endpoints }: { endpoints: Array<readonly [EndpointKey, AvailabilityState]> }) {
  return (
    <div className="warning">
      Degraded entity-layer availability: {endpoints.map(([key, availability]) => `${labelForEndpoint(key)} - ${availability.detail}`).join('; ')}
    </div>
  )
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td className="small" colSpan={colSpan}>{text}</td>
    </tr>
  )
}

function ListingList({ listings }: { listings: ListingRow[] }) {
  if (listings.length === 0) return <span className="small">No listings</span>
  return (
    <div className="entity-layer-listing-list">
      {listings.map((listing, index) => (
        <div key={`${listing.symbol}-${listing.exchange}-${index}`}>
          <strong>{listing.symbol}</strong>
          <span className="small"> {listing.exchange} {listing.isin}</span>
          <div className="small">{listing.attachMethod} {listing.confidence}</div>
        </div>
      ))}
    </div>
  )
}

function BadgeList({ values }: { values: string[] }) {
  if (values.length === 0) return <span className="small">-</span>
  return (
    <div className="meta">
      {values.map((value) => <span className="badge muted" key={value}>{value}</span>)}
    </div>
  )
}

function SampleList({ samples }: { samples: string[] }) {
  if (samples.length === 0) return <span className="small">No samples</span>
  return <span>{samples.slice(0, 5).join(', ')}</span>
}

type DedupGroup = {
  entityId: string
  legalName: string
  lei: string
  homeCountry: string
  listings: ListingRow[]
  attachMethods: string[]
}

type ListingRow = {
  symbol: string
  exchange: string
  isin: string
  attachMethod: string
  confidence: string
}

type TailRow = {
  symbol: string
  exchange: string
  isin: string
  status: string
  segment: string
  reason: string
  importanceBucket: string
  marketCap: string
}

type SourceHealthRow = {
  source: string
  successCount: number
  notFoundCount: number
  errorCount: number
  gapCount: number
  samples: string[]
}

type EntityRow = {
  entityId: string
  legalName: string
  lei: string
  homeCountry: string
  listings: ListingRow[]
  provenance: string
  confidence: string
  metadata: unknown
  evidence: unknown
}

type ReviewRow = {
  subject: string
  reason: string
  status: string
  raw: unknown
}

function normalizeSummary(payload: unknown) {
  const root = mainRecord(payload, ['summary', 'coverage', 'data'])
  const countRoot = firstRecord(root, ['counts', 'coverage_counts', 'coverageCounts']) ?? root
  const availability = availabilityFor(payload)

  return {
    availability,
    scope: readString(root, ['scope', 'universe', 'as_of_scope']) ?? 'scope unavailable',
    batchId: readString(root, ['batchId', 'batch_id', 'batch']) ?? readString(firstRecord(root, ['batch']), ['id', 'batch_id']) ?? '-',
    entityMasterCount: formatCount(readNumber(countRoot, ['entity_master_count', 'entityMasterCount', 'entities_count', 'entity_count', 'entities'])),
    listingCount: formatCount(readNumber(countRoot, ['listing_count', 'listings_count', 'listingCount', 'listings'])),
    resolvedCount: formatCount(readNumber(countRoot, ['resolved_count', 'resolvedCount', 'resolved'])),
    provisionalCount: formatCount(readNumber(countRoot, ['provisional_count', 'provisionalCount', 'provisional'])),
    unresolvedCount: formatCount(readNumber(countRoot, ['unresolved_count', 'unresolvedCount', 'unresolved'])),
    attachMethods: normalizeBreakdown(firstValue(root, ['attach_method_breakdown', 'attachMethodBreakdown', 'attach_methods', 'attachMethods', 'attach_method_counts'])),
    confidenceDistribution: normalizeBreakdown(firstValue(root, ['confidence_distribution', 'confidenceDistribution', 'confidence_counts', 'confidence'])),
    batchTrend: normalizeTrend(firstValue(root, ['batch_trend', 'batchTrend', 'trend', 'batches'])),
  }
}

function normalizeDedupGroups(payload: unknown): DedupGroup[] {
  return firstList<RowRecord>(payload, ['groups', 'rows', 'results', 'dedup_results', 'multi_listing_entities', 'entities', 'items', 'data'])
    .map((row) => {
      const record = asRecord(row) ?? {}
      const entity = firstRecord(record, ['entity', 'master', 'entity_master']) ?? record
      const listings = normalizeListings(firstValue(record, ['siblings', 'sibling_listings', 'listings', 'listing_siblings']))
      return {
        entityId: readString(entity, ['entity_id', 'entityId', 'id']) ?? '-',
        legalName: readString(entity, ['legal_name', 'legalName', 'name']) ?? '-',
        lei: readString(entity, ['lei', 'LEI']) ?? '-',
        homeCountry: readString(entity, ['home_country', 'homeCountry', 'country']) ?? '-',
        listings,
        attachMethods: uniqueStrings([
          ...normalizeStrings(firstValue(record, ['attach_methods', 'attachMethods', 'methods'])),
          ...listings.map((listing) => listing.attachMethod).filter((value) => value !== '-'),
        ]),
      }
    })
}

function normalizeTailRows(payload: unknown): TailRow[] {
  return firstList<RowRecord>(payload, ['rows', 'tail', 'results', 'items', 'data'])
    .map((row) => {
      const record = asRecord(row) ?? {}
      const listing = firstRecord(record, ['listing']) ?? record
      const isMulti = readBool(record, ['multi_listing', 'is_multi_listing', 'multiListing', 'isMultiListing'])
      return {
        symbol: readString(listing, ['symbol', 'ticker']) ?? '-',
        exchange: readString(listing, ['exchange', 'mic', 'venue']) ?? '',
        isin: readString(listing, ['isin', 'listing_isin', 'listingIsin']) ?? '',
        status: (readString(record, ['status', 'resolution_status', 'resolutionStatus']) ?? 'unresolved').toLowerCase(),
        segment: readString(record, ['segment', 'listing_segment', 'listingSegment']) ?? (isMulti ? 'multi-listing' : 'single-listing'),
        reason: readString(record, ['reason', 'reason_bucket', 'reasonBucket', 'unresolved_reason']) ?? '-',
        importanceBucket: readString(record, ['importance_bucket', 'importanceBucket', 'importance']) ?? '-',
        marketCap: formatValue(firstValue(record, ['market_cap', 'marketCap', 'market_cap_usd', 'marketCapUsd'])),
      }
    })
}

function normalizeSourceHealth(payload: unknown): SourceHealthRow[] {
  const rows = firstList<RowRecord>(payload, ['sources', 'rows', 'source_health', 'sourceHealth', 'results', 'items', 'data'])
  const healthRecords = rows.length > 0 ? rows : sourceLabels.flatMap((label) => {
    const root = mainRecord(payload, ['health', 'source_health', 'sourceHealth', 'data'])
    const record = asRecord(root[label]) ?? asRecord(root[slugKey(label)]) ?? asRecord(root[label.toLowerCase()])
    return record ? [{ source: label, ...record }] : []
  })

  return healthRecords.map((row) => {
    const record = asRecord(row) ?? {}
    const source = readString(record, ['source', 'name', 'provider', 'cache']) ?? 'unknown'
    return {
      source: normalizeSourceLabel(source),
      successCount: readNumber(record, ['success', 'success_count', 'successCount', 'ok']) ?? 0,
      notFoundCount: readNumber(record, ['not_found', 'notFound', 'not_found_count', 'notFoundCount']) ?? 0,
      errorCount: readNumber(record, ['error', 'errors', 'error_count', 'errorCount']) ?? 0,
      gapCount: readNumber(record, ['gap', 'gaps', 'gap_count', 'gapCount']) ?? 0,
      samples: normalizeStrings(firstValue(record, ['samples', 'sample', 'examples', 'gaps_sample', 'gapSamples'])),
    }
  })
}

function normalizeEntityRows(payload: unknown): EntityRow[] {
  return firstList<RowRecord>(payload, ['entities', 'rows', 'results', 'items', 'data'])
    .map((row) => {
      const record = asRecord(row) ?? {}
      const entity = firstRecord(record, ['entity', 'master', 'entity_master']) ?? record
      return {
        entityId: readString(entity, ['entity_id', 'entityId', 'id']) ?? '-',
        legalName: readString(entity, ['legal_name', 'legalName', 'name']) ?? '-',
        lei: readString(entity, ['lei', 'LEI']) ?? '-',
        homeCountry: readString(entity, ['home_country', 'homeCountry', 'country']) ?? '-',
        listings: normalizeListings(firstValue(record, ['listings', 'sibling_listings', 'siblings'])),
        provenance: readString(record, ['provenance', 'source', 'attach_source', 'attachSource']) ?? '-',
        confidence: formatValue(firstValue(record, ['confidence', 'confidence_score', 'confidenceScore'])),
        metadata: firstValue(record, ['metadata', 'meta']),
        evidence: firstValue(record, ['evidence', 'evidence_json', 'evidenceJson']),
      }
    })
}

function normalizeReviewRows(payload: unknown): ReviewRow[] {
  return firstList<RowRecord>(payload, ['rows', 'review', 'queue', 'items', 'data', 'results'])
    .map((row) => {
      const record = asRecord(row) ?? {}
      return {
        subject: readString(record, ['subject', 'entity_id', 'entityId', 'symbol', 'listing_symbol']) ?? '-',
        reason: readString(record, ['reason', 'reason_bucket', 'reasonBucket']) ?? '-',
        status: readString(record, ['status', 'state']) ?? '-',
        raw: record,
      }
    })
}

function normalizeListings(value: unknown): ListingRow[] {
  const rows = Array.isArray(value) ? value : firstList(value, ['rows', 'listings', 'items'])
  return rows.map((row) => {
    const record = asRecord(row) ?? {}
    return {
      symbol: readString(record, ['symbol', 'ticker']) ?? '-',
      exchange: readString(record, ['exchange', 'mic', 'venue']) ?? '',
      isin: readString(record, ['isin', 'listing_isin', 'listingIsin']) ?? '',
      attachMethod: readString(record, ['attach_method', 'attachMethod', 'method']) ?? '-',
      confidence: formatValue(firstValue(record, ['confidence', 'confidence_score', 'confidenceScore'])),
    }
  })
}

function normalizeBreakdown(value: unknown): CountRow[] {
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      const record = asRecord(item)
      return {
        label: readString(record, ['label', 'bucket', 'method', 'name', 'key']) ?? `bucket ${index + 1}`,
        value: formatCount(readNumber(record, ['count', 'value', 'total'])),
        detail: readString(record, ['share', 'pct', 'percent', 'ratio']) ?? undefined,
      }
    })
  }

  const record = asRecord(value)
  if (!record) return []
  return Object.entries(record).map(([label, raw]) => ({
    label,
    value: formatValue(raw),
  }))
}

function normalizeTrend(value: unknown): CountRow[] {
  if (Array.isArray(value)) {
    return value.slice(-8).map((item, index) => {
      const record = asRecord(item)
      return {
        label: readString(record, ['batch_id', 'batchId', 'batch', 'date']) ?? `batch ${index + 1}`,
        value: formatCount(readNumber(record, ['listing_count', 'listings', 'entity_count', 'entities', 'count'])),
        detail: readString(record, ['status', 'availability', 'scope']) ?? undefined,
      }
    })
  }
  return normalizeBreakdown(value)
}

function bucketRows<T>(rows: T[], keyFn: (row: T) => string): CountRow[] {
  const counts = new Map<string, number>()
  rows.forEach((row) => {
    const key = keyFn(row) || '-'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  })
  return [...counts.entries()].map(([label, count]) => ({ label, value: String(count) }))
}

function availabilityFor(payload: unknown): AvailabilityState {
  const record = asRecord(payload)
  const availability = asRecord(record?.availability)
  if (!availability) {
    return { label: 'availability unknown', available: null, detail: 'availability not returned' }
  }

  const available = readBool(availability, ['available', 'is_available', 'isAvailable'])
  const status = readString(availability, ['status', 'state'])
  const reason = readString(availability, ['reason', 'message', 'detail', 'details'])
  const inferred = available ?? inferAvailability(status)
  const label = inferred === false ? 'degraded' : inferred === true ? 'available' : status ?? 'availability unknown'

  return {
    label,
    available: inferred,
    detail: reason ?? status ?? label,
  }
}

function inferAvailability(status: string | null): boolean | null {
  const normalized = status?.trim().toLowerCase()
  if (!normalized) return null
  if (['available', 'ok', 'ready', 'healthy', 'success'].includes(normalized)) return true
  if (['unavailable', 'disabled', 'missing', 'error', 'failed', 'degraded'].includes(normalized)) return false
  return null
}

function readQueueAvailable(payload: unknown): boolean | null {
  const record = asRecord(payload)
  return readBool(record, ['queueAvailable', 'queue_available'])
    ?? readBool(asRecord(record?.availability), ['queueAvailable', 'queue_available'])
}

function mainRecord(payload: unknown, keys: string[]): RowRecord {
  const record = asRecord(payload)
  if (!record) return {}
  for (const key of keys) {
    const nested = asRecord(record[key])
    if (nested) return nested
  }
  return record
}

function firstRecord(record: RowRecord | null | undefined, keys: string[]): RowRecord | null {
  if (!record) return null
  for (const key of keys) {
    const nested = asRecord(record[key])
    if (nested) return nested
  }
  return null
}

function firstValue(record: RowRecord | null | undefined, keys: string[]): unknown {
  if (!record) return undefined
  for (const key of keys) {
    if (record[key] !== undefined) return record[key]
  }
  return undefined
}

function readString(record: RowRecord | null | undefined, keys: string[]): string | null {
  if (!record) return null
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  }
  return null
}

function readNumber(record: RowRecord | null | undefined, keys: string[]): number | null {
  if (!record) return null
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  }
  return null
}

function readNumberFromAny(payloads: unknown[], keys: string[]): number | null {
  for (const payload of payloads) {
    const root = mainRecord(payload, ['summary', 'tail', 'data'])
    const value = readNumber(root, keys)
    if (value !== null) return value
  }
  return null
}

function readBool(record: RowRecord | null | undefined, keys: string[]): boolean | null {
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

function normalizeStrings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    if (typeof value === 'string' && value.trim()) return [value.trim()]
    return []
  }
  return value
    .map((item) => {
      if (typeof item === 'string') return item
      const record = asRecord(item)
      return readString(record, ['symbol', 'value', 'sample', 'id', 'name']) ?? JSON.stringify(item)
    })
    .filter(Boolean)
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function normalizeSourceLabel(source: string): string {
  const normalized = source.toLowerCase().replaceAll('_', ' ').replaceAll('-', ' ')
  const known = sourceLabels.find((label) => normalized === label.toLowerCase().replaceAll('->', ' ').replaceAll('-', ' '))
  return known ?? source
}

function slugKey(label: string): string {
  return label.toLowerCase().replaceAll(' ', '_').replaceAll('-', '_').replaceAll('->', '_to_')
}

function formatCount(value: number | null | undefined): string {
  return value === null || value === undefined ? '-' : new Intl.NumberFormat('en-US').format(value)
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'number') return Number.isInteger(value) ? formatCount(value) : value.toFixed(3)
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function errorMessage(error: unknown): string {
  const record = asRecord(error)
  return readString(record, ['message', 'error']) ?? (error instanceof Error ? error.message : 'Unknown request error.')
}

function labelForEndpoint(key: EndpointKey): string {
  if (key === 'sourceHealth') return 'source-health'
  return key
}
