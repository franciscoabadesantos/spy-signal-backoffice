'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { requestClientJson } from '@/lib/client-json'
import { asRecord, firstList, type RowRecord } from '@/lib/payload'

const ONBOARD_BATCH_CAP = 25

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

type OnboardingRow = {
  key: string
  symbol: string
  name: string | null
  region: string
  exchange: string | null
  status: string
  registryKey: string | null
  normalizedSymbol: string | null
  validationReason: string | null
  validationFlowRunId: string | null
  backfillFlowRunId: string | null
  result: string | null
  loading: boolean
  error: string | null
  updatedAt: string
}

export function RelationshipMapFrontierPanel() {
  const [payload, setPayload] = useState<FrontierPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [selectedSymbols, setSelectedSymbols] = useState<Set<string>>(() => new Set())
  const [onboarding, setOnboarding] = useState<Record<string, OnboardingRow>>({})
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [adHocSymbols, setAdHocSymbols] = useState('')
  const [adHocRegion, setAdHocRegion] = useState('us')
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [bulkMessage, setBulkMessage] = useState<string | null>(null)

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
  const selectedCandidates = useMemo(
    () => candidates.filter((candidate) => selectedSymbols.has(candidateKey(candidate))),
    [candidates, selectedSymbols]
  )
  const onboardingRows = useMemo(
    () => Object.values(onboarding).sort((a, b) => a.symbol.localeCompare(b.symbol)),
    [onboarding]
  )
  const unavailable = Boolean(error && !loading)
  const adHocKnownCandidates = useMemo(() => {
    const typed = new Set(
      adHocSymbols.split(/[\s,]+/).map((value) => value.trim().toUpperCase()).filter(Boolean),
    )
    return candidates.filter((candidate) => typed.has(candidate.symbol.toUpperCase())).map((c) => c.symbol)
  }, [adHocSymbols, candidates])

  const refreshStatuses = useCallback(async (rows?: OnboardingRow[]) => {
    const sourceRows = rows ?? Object.values(onboarding)
    const targets = sourceRows.filter((row) => row.status !== 'ready' && row.status !== 'rejected')
    if (targets.length === 0) return
    const results = await Promise.allSettled(targets.map(async (row) => {
      const query = new URLSearchParams({ ticker: row.symbol, region: row.region })
      if (row.exchange) query.set('exchange', row.exchange)
      const response = await requestClientJson(`/api/tickers/status?${query.toString()}`)
      return { row, response }
    }))

    setOnboarding((current) => {
      const next = { ...current }
      for (const result of results) {
        if (result.status === 'fulfilled') {
          const candidate = rowToCandidate(result.value.row)
          next[result.value.row.key] = normalizeOnboardingRow(result.value.response, candidate, result.value.row.result)
        }
      }
      return next
    })
  }, [onboarding])

  useEffect(() => {
    const inFlight = Object.values(onboarding).filter((row) => row.status !== 'ready' && row.status !== 'rejected')
    if (inFlight.length === 0) return
    const timer = window.setInterval(() => {
      void refreshStatuses(inFlight)
    }, 15000)
    return () => window.clearInterval(timer)
  }, [onboarding, refreshStatuses])

  function toggleSelected(candidate: FrontierCandidate, checked: boolean) {
    const key = candidateKey(candidate)
    setSelectedSymbols((current) => {
      const next = new Set(current)
      if (checked) {
        if (next.size >= ONBOARD_BATCH_CAP && !next.has(key)) {
          setActionError(`Select at most ${ONBOARD_BATCH_CAP} candidates per onboarding request.`)
          return next
        }
        next.add(key)
      } else {
        next.delete(key)
      }
      setActionError(null)
      return next
    })
  }

  async function onboardSelected() {
    if (selectedCandidates.length === 0) return
    if (selectedCandidates.length > ONBOARD_BATCH_CAP) {
      setActionError(`Select at most ${ONBOARD_BATCH_CAP} candidates per onboarding request.`)
      return
    }
    const confirmed = window.confirm(
      `Onboard ${selectedCandidates.length} candidate${selectedCandidates.length === 1 ? '' : 's'}? They appear in the map on the next daily build.`
    )
    if (!confirmed) return
    await onboardCandidates(selectedCandidates)
  }

  async function onboardCandidates(targets: FrontierCandidate[]) {
    if (targets.length === 0) return
    setSubmitting(true)
    setActionError(null)
    const now = new Date().toISOString()
    setOnboarding((current) => {
      const next = { ...current }
      for (const candidate of targets) {
        const key = candidateKey(candidate)
        next[key] = {
          ...(next[key] ?? baseOnboardingRow(candidate, now)),
          loading: true,
          error: null,
          updatedAt: now,
        }
      }
      return next
    })

    const results = await Promise.allSettled(targets.map(async (candidate) => {
      const region = candidateRegion(candidate)
      const response = await requestClientJson('/api/tickers/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: candidate.symbol, region }),
      })
      return { candidate, response }
    }))

    setOnboarding((current) => {
      const next = { ...current }
      for (const result of results) {
        if (result.status === 'fulfilled') {
          const { candidate, response } = result.value
          next[candidateKey(candidate)] = normalizeOnboardingRow(response, candidate, null)
        } else {
          const candidate = targets[results.indexOf(result)]
          const key = candidateKey(candidate)
          next[key] = {
            ...(next[key] ?? baseOnboardingRow(candidate)),
            loading: false,
            error: readErrorMessage(result.reason),
            updatedAt: new Date().toISOString(),
          }
        }
      }
      return next
    })
    setSelectedSymbols((current) => {
      const next = new Set(current)
      for (const candidate of targets) next.delete(candidateKey(candidate))
      return next
    })
    setSubmitting(false)
  }

  async function onboardAdHoc() {
    const symbols = Array.from(
      new Set(adHocSymbols.split(/[\s,]+/).map((value) => value.trim().toUpperCase()).filter(Boolean)),
    )
    if (symbols.length === 0) return
    if (symbols.length > ONBOARD_BATCH_CAP) {
      setActionError(`Enter at most ${ONBOARD_BATCH_CAP} symbols for a direct backfill.`)
      return
    }
    const region = adHocRegion.trim().toLowerCase() || 'us'
    const synthetic: FrontierCandidate[] = symbols.map((symbol) => ({
      symbol,
      name: null,
      country: region.toUpperCase(),
      themes: [],
      etfs: [],
      adjacency: 0,
      score: 0,
      weight: 0,
    }))
    setActionError(null)
    setAdHocSymbols('')
    await onboardCandidates(synthetic)
  }

  async function onboardSelectedBulk() {
    if (selectedCandidates.length === 0) return
    const confirmed = window.confirm(
      `Bulk-onboard ${selectedCandidates.length} selected candidate(s)? They full-backfill now in the background (Prefect handles the concurrency) and appear in the map on the next daily build.`,
    )
    if (!confirmed) return
    setBulkSubmitting(true)
    setBulkMessage(null)
    // The bulk endpoint takes one region + a ticker list, so group the selection by region.
    const byRegion = new Map<string, string[]>()
    for (const candidate of selectedCandidates) {
      const region = candidateRegion(candidate)
      const list = byRegion.get(region) ?? []
      list.push(candidate.symbol)
      byRegion.set(region, list)
    }
    try {
      let scheduled = 0
      for (const [region, tickers] of byRegion) {
        const response = await requestClientJson('/api/tickers/backfill-bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tickers, region }),
        })
        const record = asRecord(response)
        scheduled += typeof record?.requested_count === 'number' ? record.requested_count : tickers.length
      }
      setBulkMessage(`Scheduled ${scheduled} ticker(s) for full backfill — running now in the background; they appear in the map on the next daily build.`)
      setSelectedSymbols(new Set())
    } catch (bulkError) {
      setBulkMessage(readErrorMessage(bulkError))
    } finally {
      setBulkSubmitting(false)
    }
  }

  async function removeOnboarding(row: OnboardingRow) {
    const confirmed = window.confirm(`${row.symbol} will be removed from onboarding before the daily build. Continue?`)
    if (!confirmed) return
    setOnboarding((current) => ({
      ...current,
      [row.key]: { ...row, loading: true, error: null, updatedAt: new Date().toISOString() },
    }))
    try {
      const response = await requestClientJson('/api/tickers/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: row.symbol,
          region: row.region,
          exchange: row.exchange,
          reason: 'operator_removed_before_daily_build',
        }),
      })
      setOnboarding((current) => ({
        ...current,
        [row.key]: normalizeOnboardingRow(response, rowToCandidate(row), null),
      }))
    } catch (removeError) {
      setOnboarding((current) => ({
        ...current,
        [row.key]: { ...row, loading: false, error: readErrorMessage(removeError), updatedAt: new Date().toISOString() },
      }))
    }
  }

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
          <div className="relationship-map-frontier-toolbar">
            <div className="small">
              {selectedCandidates.length} selected. Backfills now in the background; appears in the map on the next daily build.
            </div>
            <div className="table-actions relationship-map-frontier-toolbar-actions">
              <button className="secondary" type="button" onClick={() => setSelectedSymbols(new Set())} disabled={selectedCandidates.length === 0 || submitting}>
                Clear
              </button>
              <button className="primary" type="button" onClick={() => void onboardSelected()} disabled={selectedCandidates.length === 0 || submitting}>
                {submitting ? 'Onboarding...' : `Onboard selected (${selectedCandidates.length})`}
              </button>
              <button className="secondary" type="button" onClick={() => void onboardSelectedBulk()} disabled={selectedCandidates.length === 0 || bulkSubmitting}>
                {bulkSubmitting ? 'Scheduling…' : `Bulk onboard selected (${selectedCandidates.length})`}
              </button>
            </div>
          </div>
          {actionError ? <div className="error">{actionError}</div> : null}
          {bulkMessage ? <div className="small">{bulkMessage}</div> : null}
          <div className="table-wrap relationship-map-table">
            <table className="registry-table">
              <thead>
                <tr>
                  <th>Select</th>
                  <th>Symbol</th>
                  <th>Name</th>
                  <th>Country</th>
                  <th>Themes</th>
                  <th>ETFs</th>
                  <th>Adjacency</th>
                  <th>Weight</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="small" colSpan={9}>Loading frontier candidates...</td>
                  </tr>
                ) : null}
                {!loading && candidates.length === 0 ? (
                  <tr>
                    <td className="small" colSpan={9}>{unavailable ? 'Relationship-map frontier is unavailable.' : 'No adjacent candidates were returned.'}</td>
                  </tr>
                ) : null}
                {!loading ? candidates.map((candidate) => {
                  const key = candidateKey(candidate)
                  const selected = selectedSymbols.has(key)
                  const row = onboarding[key]
                  const selectable = !row && (selected || selectedSymbols.size < ONBOARD_BATCH_CAP)
                  return (
                    <tr key={key}>
                      <td>
                        <input
                          aria-label={`Select ${candidate.symbol}`}
                          checked={selected}
                          className="relationship-map-select-checkbox"
                          disabled={!selectable || submitting}
                          onChange={(event) => toggleSelected(candidate, event.target.checked)}
                          type="checkbox"
                        />
                      </td>
                      <td className="relationship-map-symbol-cell">
                        <strong>{candidate.symbol}</strong>
                        {row ? <span className={`badge ${statusBadgeClass(row.status)}`}>{row.loading ? 'updating' : row.status}</span> : null}
                      </td>
                      <td>{candidate.name ?? '-'}</td>
                      <td>{candidate.country}</td>
                      <td>{candidate.themes.join(', ') || '-'}</td>
                      <td>{candidate.etfs.join(', ') || '-'}</td>
                      <td>{formatScore(candidate.adjacency)}</td>
                      <td>{formatRatio(candidate.weight)}</td>
                      <td>
                        <button
                          className="secondary relationship-map-action-button"
                          disabled={submitting || Boolean(row)}
                          onClick={() => void onboardCandidates([candidate])}
                          type="button"
                        >
                          Onboard
                        </button>
                      </td>
                    </tr>
                  )
                }) : null}
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

      <section className="card compact-card relationship-map-adhoc-panel" aria-label="Direct ticker backfill">
        <h3>Backfill tickers directly</h3>
        <p className="small">
          Type symbols (need not be on the list) to onboard + full-backfill now — prices, fundamentals, earnings,
          technicals. Runs in the background; appears in the map on the next daily build.
        </p>
        <div className="relationship-map-frontier-toolbar">
          <input
            aria-label="Symbols to backfill"
            className="relationship-map-adhoc-input"
            value={adHocSymbols}
            onChange={(event) => setAdHocSymbols(event.target.value)}
            placeholder="e.g. PLTR, SNOW, DDOG"
            type="text"
          />
          <select aria-label="Region" value={adHocRegion} onChange={(event) => setAdHocRegion(event.target.value)}>
            <option value="us">US</option>
            <option value="eu">EU</option>
            <option value="apac">APAC</option>
            <option value="global">Global</option>
          </select>
          <button
            className="primary relationship-map-action-button"
            type="button"
            onClick={() => void onboardAdHoc()}
            disabled={submitting || !adHocSymbols.trim()}
          >
            Full backfill
          </button>
        </div>
        {adHocKnownCandidates.length > 0 ? (
          <div className="small">
            {adHocKnownCandidates.join(', ')} already on the adjacent-candidates list above — you can select there instead.
          </div>
        ) : null}
      </section>

      <section className="relationship-map-onboarding-panel" aria-label="Ticker onboarding status">
        <div className="split-row">
          <div>
            <h3>Onboarding</h3>
            <p className="small">Appears in the map on the next daily build. Pending and backfilling tickers can still be removed.</p>
          </div>
          <button className="secondary relationship-map-action-button" type="button" onClick={() => void refreshStatuses()} disabled={onboardingRows.length === 0}>
            Refresh
          </button>
        </div>
        <div className="table-wrap relationship-map-table">
          <table className="registry-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Home</th>
                <th>Status</th>
                <th>Registry key</th>
                <th>Reason</th>
                <th>Updated</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {onboardingRows.length === 0 ? (
                <tr>
                  <td className="small" colSpan={7}>No onboarding requests in this session.</td>
                </tr>
              ) : null}
              {onboardingRows.map((row) => (
                <tr key={row.key}>
                  <td><strong>{row.symbol}</strong>{row.name ? <div className="small">{row.name}</div> : null}</td>
                  <td>{row.region.toUpperCase()}</td>
                  <td><span className={`badge ${statusBadgeClass(row.status)}`}>{row.loading ? 'updating' : row.status}</span></td>
                  <td className="small">{row.registryKey ?? '-'}</td>
                  <td>{row.error ? <span className="error-inline">{row.error}</span> : row.validationReason ?? '-'}</td>
                  <td className="small">{shortTimestamp(row.updatedAt)}</td>
                  <td>
                    <button
                      className="secondary relationship-map-action-button"
                      disabled={row.loading || !isRemovableOnboardingStatus(row.status)}
                      onClick={() => void removeOnboarding(row)}
                      type="button"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

function candidateRegion(candidate: FrontierCandidate): string {
  const country = String(candidate.country || '').trim().toLowerCase()
  return country && country !== 'unknown' ? country : 'global'
}

function candidateKey(candidate: FrontierCandidate): string {
  return onboardingKey(candidate.symbol, candidateRegion(candidate), null)
}

function onboardingKey(symbol: string, region: string, exchange: string | null): string {
  return `${symbol.trim().toUpperCase()}|${region.trim().toLowerCase() || 'us'}|${exchange?.trim().toUpperCase() || 'default'}`
}

function baseOnboardingRow(candidate: FrontierCandidate, updatedAt = new Date().toISOString()): OnboardingRow {
  const region = candidateRegion(candidate)
  return {
    key: candidateKey(candidate),
    symbol: candidate.symbol.trim().toUpperCase(),
    name: candidate.name,
    region,
    exchange: null,
    status: 'pending_validation',
    registryKey: null,
    normalizedSymbol: null,
    validationReason: null,
    validationFlowRunId: null,
    backfillFlowRunId: null,
    result: null,
    loading: false,
    error: null,
    updatedAt,
  }
}

function normalizeOnboardingRow(payload: unknown, candidate: FrontierCandidate, resultFallback: string | null): OnboardingRow {
  const record = asRecord(payload) ?? {}
  const symbol = readString(record, ['ticker', 'symbol'])?.toUpperCase() ?? candidate.symbol.trim().toUpperCase()
  const region = readString(record, ['region'])?.toLowerCase() ?? candidateRegion(candidate)
  const exchange = readString(record, ['exchange'])
  return {
    key: onboardingKey(symbol, region, exchange),
    symbol,
    name: candidate.name,
    region,
    exchange,
    status: readString(record, ['status']) ?? 'pending_validation',
    registryKey: readString(record, ['registry_key', 'registryKey']),
    normalizedSymbol: readString(record, ['normalized_symbol', 'normalizedSymbol']),
    validationReason: readString(record, ['validation_reason', 'validationReason']),
    validationFlowRunId: readString(record, ['validation_flow_run_id', 'validationFlowRunId']),
    backfillFlowRunId: readString(record, ['backfill_flow_run_id', 'backfillFlowRunId']),
    result: readString(record, ['result']) ?? resultFallback,
    loading: false,
    error: null,
    updatedAt: new Date().toISOString(),
  }
}

function rowToCandidate(row: OnboardingRow): FrontierCandidate {
  return {
    symbol: row.symbol,
    name: row.name,
    country: row.region.toUpperCase(),
    themes: [],
    etfs: [],
    adjacency: 0,
    score: 0,
    weight: 0,
  }
}

function isRemovableOnboardingStatus(status: string): boolean {
  return ['pending_validation', 'validating', 'pending_backfill', 'backfilling'].includes(status)
}

function statusBadgeClass(status: string): string {
  if (status === 'ready') return 'completed'
  if (status === 'rejected') return 'failed'
  if (status === 'validating' || status === 'backfilling') return 'running'
  if (status === 'pending_validation' || status === 'pending_backfill') return 'queued'
  return 'muted'
}

function readErrorMessage(error: unknown): string {
  const record = asRecord(error)
  const detail = asRecord(record?.detail)
  return (
    readString(detail, ['message', 'error'])
    ?? readString(record, ['message', 'error', 'detail'])
    ?? (error instanceof Error ? error.message : 'Request failed.')
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
