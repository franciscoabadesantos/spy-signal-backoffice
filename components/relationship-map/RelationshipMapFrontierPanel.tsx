'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { requestClientJson } from '@/lib/client-json'
import { asRecord, firstList, type RowRecord } from '@/lib/payload'
import {
  baseOnboardingRow,
  buildOnboardingRequestPayload,
  candidateKey,
  candidateOnboardSymbol,
  groupCandidatesForBulkOnboard,
  isCandidateOnboardable,
  isRemovableOnboardingStatus,
  normalizeOnboardingRow,
  normalizeOnboardingPreview,
  readinessFromRecord,
  rowToCandidate,
  seedOnboardingRows,
  statusBadgeClass,
  type OnboardingRow,
  type RelationshipMapOnboardingCandidate,
} from '@/lib/relationship-map-onboarding'

const ONBOARD_BATCH_CAP = 25

type FrontierCandidate = RelationshipMapOnboardingCandidate

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
  const [selectedSymbols, setSelectedSymbols] = useState<Set<string>>(() => new Set())
  const [onboarding, setOnboarding] = useState<Record<string, OnboardingRow>>({})
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [adHocSymbols, setAdHocSymbols] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewCandidates, setPreviewCandidates] = useState<FrontierCandidate[]>([])
  const [previewReason, setPreviewReason] = useState<string | null>(null)
  const [previewQuery, setPreviewQuery] = useState('')
  const [selectedPreviewKey, setSelectedPreviewKey] = useState<string | null>(null)
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
  const adHocQuery = adHocSymbols.trim()
  const selectedPreviewCandidate = useMemo(
    () => previewCandidates.find((candidate) => candidateKey(candidate) === selectedPreviewKey) ?? null,
    [previewCandidates, selectedPreviewKey],
  )
  const adHocKnownCandidates = useMemo(() => {
    const typed = new Set(parseSymbolInput(adHocSymbols))
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
    if (!isCandidateOnboardable(candidate)) return
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
    const onboardableCandidates = selectedCandidates.filter(isCandidateOnboardable)
    if (onboardableCandidates.length !== selectedCandidates.length) {
      setActionError('One or more selected candidates are not onboardable.')
      return
    }
    if (selectedCandidates.length > ONBOARD_BATCH_CAP) {
      setActionError(`Select at most ${ONBOARD_BATCH_CAP} candidates per onboarding request.`)
      return
    }
    const confirmed = window.confirm(
      `Onboard ${selectedCandidates.length} candidate${selectedCandidates.length === 1 ? '' : 's'}? They appear in the map on the next daily build.`
    )
    if (!confirmed) return
    await onboardCandidates(onboardableCandidates)
  }

  async function onboardCandidates(targets: FrontierCandidate[]) {
    const onboardableTargets = targets.filter(isCandidateOnboardable)
    if (onboardableTargets.length === 0) {
      setActionError('No selected candidates are currently onboardable.')
      return
    }
    if (onboardableTargets.length !== targets.length) {
      setActionError('Skipped one or more candidates that are not onboardable.')
    }
    setSubmitting(true)
    if (onboardableTargets.length === targets.length) setActionError(null)
    const now = new Date().toISOString()
    setOnboarding((current) => seedOnboardingRows(current, onboardableTargets, { updatedAt: now, status: 'pending_validation', loading: true }))

    const results = await Promise.allSettled(onboardableTargets.map(async (candidate) => {
      const body = buildOnboardingRequestPayload(candidate)
      if (!body) throw new Error(candidate.notOnboardableReason ?? 'Candidate is not onboardable.')
      const response = await requestClientJson('/api/tickers/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
          const candidate = onboardableTargets[results.indexOf(result)]
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
      for (const candidate of onboardableTargets) next.delete(candidateKey(candidate))
      return next
    })
    setSubmitting(false)
  }

  async function previewAdHoc() {
    const query = adHocQuery
    if (!query) return
    setPreviewLoading(true)
    setPreviewError(null)
    setPreviewCandidates([])
    setPreviewReason(null)
    setSelectedPreviewKey(null)
    try {
      const response = await requestClientJson(`/api/tickers/onboarding-preview?q=${encodeURIComponent(query)}`)
      const preview = normalizeOnboardingPreview(response)
      setPreviewCandidates(preview.candidates)
      setPreviewReason(preview.reason)
      setPreviewQuery(query)
      setActionError(null)
    } catch (previewRequestError) {
      setPreviewError(readErrorMessage(previewRequestError))
    } finally {
      setPreviewLoading(false)
    }
  }

  async function onboardAdHoc() {
    if (!selectedPreviewCandidate) {
      setActionError('Select a canonical listing before onboarding.')
      return
    }
    if (selectedPreviewCandidate.alreadyTracked) {
      setActionError(`${candidateOnboardSymbol(selectedPreviewCandidate)} is already tracked.`)
      return
    }
    if (!isCandidateOnboardable(selectedPreviewCandidate)) {
      setActionError(selectedPreviewCandidate.notOnboardableReason ?? 'Selected listing is not onboardable.')
      return
    }
    setActionError(null)
    await onboardCandidates([selectedPreviewCandidate])
  }

  async function onboardSelectedBulk() {
    if (selectedCandidates.length === 0) return
    const onboardableCandidates = selectedCandidates.filter(isCandidateOnboardable)
    if (onboardableCandidates.length !== selectedCandidates.length) {
      setActionError('One or more selected candidates are not onboardable.')
      return
    }
    const confirmed = window.confirm(
      `Bulk-onboard ${selectedCandidates.length} selected candidate(s)? They full-backfill now in the background (Prefect handles the concurrency) and appear in the map on the next daily build.`,
    )
    if (!confirmed) return
    setBulkSubmitting(true)
    setBulkMessage(null)
    const now = new Date().toISOString()
    setOnboarding((current) => seedOnboardingRows(current, onboardableCandidates, { updatedAt: now, status: 'pending_backfill', loading: true }))
    // The bulk endpoint takes one region, one optional exchange, and a ticker list.
    const bulkGroups = groupCandidatesForBulkOnboard(onboardableCandidates)
    const results = await Promise.allSettled(bulkGroups.map(async (group) => {
      const response = await requestClientJson('/api/tickers/backfill-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tickers: group.tickers,
          region: group.region,
          ...(group.exchange ? { exchange: group.exchange } : {}),
        }),
      })
      return { candidates: group.candidates, response }
    }))

    const successfulCandidates: FrontierCandidate[] = []
    const failedGroups: Array<{ candidates: FrontierCandidate[]; error: string }> = []
    let scheduled = 0
    let firstError: string | null = null
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const record = asRecord(result.value.response)
        const scheduledCount = typeof record?.requested_count === 'number' ? record.requested_count : result.value.candidates.length
        scheduled += scheduledCount
        successfulCandidates.push(...result.value.candidates)
      } else {
        const failedGroup = bulkGroups[results.indexOf(result)]
        const errorMessage = readErrorMessage(result.reason)
        firstError = firstError ?? errorMessage
        if (failedGroup) failedGroups.push({ candidates: failedGroup.candidates, error: errorMessage })
      }
    }

    setOnboarding((current) => {
      let next = { ...current }
      if (successfulCandidates.length > 0) {
        next = seedOnboardingRows(next, successfulCandidates, {
          updatedAt: new Date().toISOString(),
          status: 'pending_backfill',
          loading: false,
        })
      }
      for (const failedGroup of failedGroups) {
        next = seedOnboardingRows(next, failedGroup.candidates, {
          updatedAt: new Date().toISOString(),
          status: 'pending_backfill',
          loading: false,
          error: failedGroup.error,
        })
      }
      return next
    })

    if (scheduled > 0) {
      setBulkMessage(`Scheduled ${scheduled} ticker(s) for full backfill — running now in the background; they appear in the map on the next daily build.`)
      setSelectedSymbols((current) => {
        const next = new Set(current)
        for (const candidate of successfulCandidates) next.delete(candidateKey(candidate))
        return next
      })
      void refreshStatuses(successfulCandidates.map((candidate) => baseOnboardingRow(candidate, new Date().toISOString(), 'pending_backfill')))
    } else if (firstError) {
      setBulkMessage(firstError)
    }
    setBulkSubmitting(false)
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
            <table className="registry-table relationship-map-frontier-candidates-table">
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
                  <th>Readiness</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="small" colSpan={10}>Loading frontier candidates...</td>
                  </tr>
                ) : null}
                {!loading && candidates.length === 0 ? (
                  <tr>
                    <td className="small" colSpan={10}>{unavailable ? 'Relationship-map frontier is unavailable.' : 'No adjacent candidates were returned.'}</td>
                  </tr>
                ) : null}
                {!loading ? candidates.map((candidate) => {
                  const key = candidateKey(candidate)
                  const selected = selectedSymbols.has(key)
                  const row = onboarding[key]
                  const readiness = row?.readiness ?? candidate.readiness
                  const onboardable = isCandidateOnboardable(candidate)
                  const rejected = readiness.label === 'Rejected'
                  const selectable = onboardable && !row && !rejected && (selected || selectedSymbols.size < ONBOARD_BATCH_CAP)
                  const onboardSymbol = candidateOnboardSymbol(candidate)
                  const showOnboardSymbol = Boolean(onboardSymbol && onboardSymbol !== candidate.symbol.trim().toUpperCase())
                  const sourceSymbol = candidate.sourceSymbol?.trim()
                  const showSourceSymbol = Boolean(sourceSymbol && sourceSymbol.toUpperCase() !== candidate.symbol.trim().toUpperCase())
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
                      <td>
                        <div className="relationship-map-symbol-cell">
                          <strong>{candidate.symbol}</strong>
                          {row ? <span className={`badge ${statusBadgeClass(row.status)}`}>{row.loading ? 'updating' : row.status}</span> : null}
                        </div>
                        {showSourceSymbol ? <div className="small">Source: {sourceSymbol}</div> : null}
                        {showOnboardSymbol ? <div className="small">Onboards as {onboardSymbol}</div> : null}
                      </td>
                      <td><span className="relationship-map-cell-clamp">{candidate.name ?? '-'}</span></td>
                      <td>{candidate.country}</td>
                      <td><span className="relationship-map-cell-clamp">{candidate.themes.join(', ') || '-'}</span></td>
                      <td><span className="relationship-map-cell-clamp">{candidate.etfs.join(', ') || '-'}</span></td>
                      <td>{formatScore(candidate.adjacency)}</td>
                      <td>{formatRatio(candidate.weight)}</td>
                      <td>
                        <span className={`badge ${readiness.className}`}>{readiness.label}</span>
                        {readiness.diagnostic ? <div className="small relationship-map-cell-clamp">{readiness.diagnostic}</div> : null}
                      </td>
                      <td>
                        <button
                          className="secondary relationship-map-action-button"
                          disabled={submitting || Boolean(row) || rejected || !onboardable}
                          onClick={() => void onboardCandidates([candidate])}
                          type="button"
                        >
                          {onboardable ? (readiness.label === 'Tracked' ? 'Onboard' : 'Backfill') : 'Unavailable'}
                        </button>
                        {!onboardable && candidate.notOnboardableReason ? <div className="small">{candidate.notOnboardableReason}</div> : null}
                      </td>
                    </tr>
                  )
                }) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="relationship-map-untapped-themes">
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
          Preview the backend canonical listing first, then onboard the selected listing.
        </p>
        <div className="relationship-map-frontier-toolbar">
          <input
            aria-label="Symbol to preview"
            className="relationship-map-adhoc-input"
            value={adHocSymbols}
            onChange={(event) => {
              setAdHocSymbols(event.target.value)
              setPreviewCandidates([])
              setPreviewReason(null)
              setPreviewError(null)
              setPreviewQuery('')
              setSelectedPreviewKey(null)
            }}
            placeholder="e.g. VWS, VWS.CO, 9766.T"
            type="text"
          />
          <button
            className="secondary relationship-map-action-button"
            type="button"
            onClick={() => void previewAdHoc()}
            disabled={previewLoading || !adHocQuery}
          >
            {previewLoading ? 'Previewing...' : 'Preview listings'}
          </button>
          <button
            className="primary relationship-map-action-button"
            type="button"
            onClick={() => void onboardAdHoc()}
            disabled={submitting || !selectedPreviewCandidate || selectedPreviewCandidate.alreadyTracked === true || !isCandidateOnboardable(selectedPreviewCandidate)}
          >
            Full backfill
          </button>
        </div>
        {previewError ? <div className="error">{previewError}</div> : null}
        {previewQuery && !previewLoading && previewCandidates.length === 0 ? (
          <div className="small">No canonical listing found{previewReason ? `: ${previewReason}` : '.'}</div>
        ) : null}
        {previewCandidates.length > 0 ? (
          <div className="table-wrap relationship-map-table relationship-map-preview-table-wrap">
            <table className="registry-table relationship-map-preview-table">
              <thead>
                <tr>
                  <th>Select</th>
                  <th>Source</th>
                  <th>Name</th>
                  <th>Onboard</th>
                  <th>Home</th>
                  <th>Region</th>
                  <th>Exchange</th>
                  <th>Readiness</th>
                </tr>
              </thead>
              <tbody>
                {previewCandidates.map((candidate) => {
                  const key = candidateKey(candidate)
                  const onboardable = isCandidateOnboardable(candidate)
                  const disabled = candidate.alreadyTracked === true || !onboardable
                  return (
                    <tr key={key}>
                      <td>
                        <input
                          aria-label={`Select ${candidateOnboardSymbol(candidate)}`}
                          checked={selectedPreviewKey === key}
                          className="relationship-map-select-checkbox"
                          disabled={disabled}
                          onChange={(event) => setSelectedPreviewKey(event.target.checked ? key : null)}
                          type="radio"
                        />
                      </td>
                      <td>
                        <strong>{candidate.displaySymbol ?? candidate.symbol}</strong>
                        {candidate.sourceSymbol && candidate.sourceSymbol !== candidate.symbol ? <div className="small">Source: {candidate.sourceSymbol}</div> : null}
                      </td>
                      <td>{candidate.name ?? '-'}</td>
                      <td><strong>{candidateOnboardSymbol(candidate)}</strong></td>
                      <td>{candidate.homeCountry ?? candidate.country}</td>
                      <td>{candidate.onboardRegion?.toUpperCase() ?? '-'}</td>
                      <td>{candidate.onboardExchange ?? '-'}</td>
                      <td>
                        {candidate.alreadyTracked ? <span className="badge completed">Already tracked</span> : <span className={`badge ${candidate.readiness.className}`}>{candidate.readiness.label}</span>}
                        {candidate.notOnboardableReason ? <div className="small">{candidate.notOnboardableReason}</div> : null}
                        {candidate.readinessState ? <div className="small">{candidate.readinessState}</div> : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
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
                <th>Asset type</th>
                <th>Registry key</th>
                <th>Reason</th>
                <th>Updated</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {onboardingRows.length === 0 ? (
                <tr>
                  <td className="small" colSpan={8}>No onboarding requests in this session.</td>
                </tr>
              ) : null}
              {onboardingRows.map((row) => (
                <tr key={row.key}>
                  <td>
                    <strong>{row.symbol}</strong>
                    {row.name ? <div className="small">{row.name}</div> : null}
                    {row.sourceSymbol && row.sourceSymbol.toUpperCase() !== row.symbol.toUpperCase() ? <div className="small">Source: {row.sourceSymbol}</div> : null}
                  </td>
                  <td>{row.region.toUpperCase()}</td>
                  <td>
                    <span className={`badge ${row.loading ? statusBadgeClass(row.status) : row.readiness.className}`}>
                      {row.loading ? 'updating' : row.readiness.label}
                    </span>
                    {!row.loading && row.status ? <div className="small">{row.status}</div> : null}
                  </td>
                  <td className="small">{row.assetType ?? 'Unknown'}</td>
                  <td className="small">{row.registryKey ?? '-'}</td>
                  <td>{row.error ? <span className="error-inline">{row.error}</span> : row.validationReason ?? row.readiness.diagnostic ?? '-'}</td>
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
    sourceSymbol: readString(record, ['sourceSymbol', 'source_symbol']),
    displaySymbol: readString(record, ['displaySymbol', 'display_symbol']),
    name: readString(record, ['name']),
    country: readString(record, ['sourceCountry', 'source_country', 'country']) ?? 'UNKNOWN',
    providerSymbol: readString(record, ['providerSymbol', 'provider_symbol']),
    onboardSymbol: readString(record, ['onboardSymbol', 'onboard_symbol']),
    onboardRegion: readString(record, ['onboardRegion', 'onboard_region']),
    onboardExchange: readString(record, ['onboardExchange', 'onboard_exchange']),
    isOnboardable: readBoolean(record, ['isOnboardable', 'is_onboardable']),
    notOnboardableReason: readString(record, ['notOnboardableReason', 'not_onboardable_reason']),
    resolutionSource: readString(record, ['resolutionSource', 'resolution_source']),
    alreadyTracked: readBoolean(record, ['alreadyTracked', 'already_tracked']),
    readinessState: readString(record, ['readinessState', 'readiness_state']),
    homeCountry: readString(record, ['homeCountry', 'home_country']),
    themes: readStringList(record.themes),
    etfs: readStringList(record.etfs),
    adjacency: readNumber(record, ['adjacency']) ?? 0,
    score: readNumber(record, ['score']) ?? 0,
    weight: readNumber(record, ['weight']) ?? 0,
    readiness: readinessFromRecord(record),
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

function readBoolean(record: RowRecord | null | undefined, keys: string[]): boolean | null {
  if (!record) return null
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value !== 0
    if (typeof value === 'string' && value.trim()) {
      const normalized = value.trim().toLowerCase()
      if (['true', '1', 'yes', 'y'].includes(normalized)) return true
      if (['false', '0', 'no', 'n'].includes(normalized)) return false
    }
  }
  return null
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item).trim()).filter(Boolean)
}

function parseSymbolInput(value: string): string[] {
  return Array.from(
    new Set(value.split(/[\s,]+/).map((symbol) => symbol.trim().toUpperCase()).filter(Boolean)),
  )
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
