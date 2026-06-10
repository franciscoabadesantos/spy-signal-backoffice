'use client'

import { FormEvent, useEffect, useState } from 'react'
import { readApiError } from '@/lib/api-error'
import { requestClientJson } from '@/lib/client-json'
import { ApiErrorBox, DynamicTable, EmptyState, JsonBlock, asRecord, readArrayPayload, readString } from '@/app/components/workspace-data'

const RUN_COLUMNS = [
  { key: 'id', label: 'Run ID', keys: ['id', 'runId', 'run_id'] },
  { key: 'ticker', label: 'Ticker' },
  { key: 'question', label: 'Question' },
  { key: 'promptLabel', label: 'Prompt', keys: ['promptLabel', 'prompt_label'] },
  { key: 'signalDirection', label: 'Signal Direction', keys: ['signalDirection', 'signal_direction'] },
  { key: 'conviction', label: 'Conviction' },
  { key: 'predictionHorizon', label: 'Horizon', keys: ['predictionHorizon', 'prediction_horizon'] },
  { key: 'status', label: 'Status' },
  { key: 'provider', label: 'Provider' },
  { key: 'model', label: 'Model' },
  { key: 'citations', label: 'Citations' },
  { key: 'completedAt', label: 'Completed At', keys: ['completedAt', 'completed_at'] },
]

const SUBSCRIPTION_COLUMNS = [
  { key: 'ticker', label: 'Ticker' },
  { key: 'userId', label: 'User ID', keys: ['userId', 'user_id'] },
]

const MISSING_ADMIN_CONTRACTS = [
  'no admin all-users research run list',
  'no user search/list',
  'no usage/rate summary',
  'no moderation controls',
  'no frontoffice research dashboard endpoint',
  'no alert delivery dashboard',
  'no analytics summary endpoint',
]

export default function FrontofficeWorkspace({ adminEmail }: { adminEmail: string }) {
  const [allTickers, setAllTickers] = useState<string[]>([])
  const [subscriptions, setSubscriptions] = useState<unknown[]>([])
  const [userId, setUserId] = useState('')
  const [ticker, setTicker] = useState('')
  const [runId, setRunId] = useState('')
  const [userWatchlist, setUserWatchlist] = useState<string[]>([])
  const [runs, setRuns] = useState<unknown[]>([])
  const [runDetail, setRunDetail] = useState<unknown | null>(null)
  const [activityError, setActivityError] = useState<string | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [activityLoading, setActivityLoading] = useState(false)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)

  async function loadWatchlistActivity() {
    setActivityLoading(true)
    setActivityError(null)
    try {
      const allPayload = await requestClientJson('/api/frontoffice/watchlist/all-tickers')
      const tickers = readArrayPayload(allPayload, 'tickers').map((value) => String(value).trim().toUpperCase()).filter(Boolean)
      setAllTickers([...new Set(tickers)])

      if (tickers.length > 0) {
        const subscriptionsPayload = await requestClientJson(`/api/frontoffice/watchlist/subscriptions?tickers=${encodeURIComponent([...new Set(tickers)].join(','))}`)
        setSubscriptions(readArrayPayload(subscriptionsPayload, 'subscriptions'))
      } else {
        setSubscriptions([])
      }
    } catch (err) {
      setActivityError(readApiError(err, 'Failed to load frontoffice watchlist activity.'))
    } finally {
      setActivityLoading(false)
    }
  }

  async function loadUserLookup() {
    const normalizedUserId = userId.trim()
    if (!normalizedUserId) {
      setLookupError('This endpoint requires user_id; admin all-user view is not exposed yet.')
      return
    }

    setLookupLoading(true)
    setLookupError(null)
    try {
      const params = new URLSearchParams()
      params.set('user_id', normalizedUserId)
      const watchlistPayload = await requestClientJson(`/api/frontoffice/watchlist?${params.toString()}`)
      setUserWatchlist(readArrayPayload(watchlistPayload, 'tickers').map((value) => String(value).trim().toUpperCase()).filter(Boolean))

      const runParams = new URLSearchParams()
      runParams.set('user_id', normalizedUserId)
      runParams.set('limit', '20')
      if (ticker.trim()) runParams.set('ticker', ticker.trim().toUpperCase())
      const runsPayload = await requestClientJson(`/api/frontoffice/ai-research/runs?${runParams.toString()}`)
      setRuns(readArrayPayload(runsPayload, 'runs'))
    } catch (err) {
      setLookupError(readApiError(err, 'Failed to load user frontoffice research data.'))
    } finally {
      setLookupLoading(false)
    }
  }

  async function loadRunDetail() {
    const normalizedUserId = userId.trim()
    const normalizedRunId = runId.trim()
    if (!normalizedUserId || !normalizedRunId) {
      setDetailError('Run detail lookup requires both user_id and run id.')
      return
    }

    setDetailLoading(true)
    setDetailError(null)
    try {
      const payload = await requestClientJson(`/api/frontoffice/ai-research/runs/${encodeURIComponent(normalizedRunId)}?user_id=${encodeURIComponent(normalizedUserId)}`)
      setRunDetail(asRecord(payload)?.run ?? payload)
    } catch (err) {
      setDetailError(readApiError(err, 'Failed to load AI research run detail.'))
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadWatchlistActivity()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  function onUserSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void loadUserLookup()
  }

  function onDetailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void loadRunDetail()
  }

  return (
    <div className="page-stack">
      <div className="hero-panel">
        <div>
          <p className="eyebrow">Frontoffice / User Research Control</p>
          <h1>Inspect what frontoffice users are watching and researching as far as backend contracts allow.</h1>
          <p className="hero-copy">
            This workspace uses existing site watchlist and AI research run contracts through Backoffice admin proxies. User-wide and all-user admin reporting remains a backend gap.
          </p>
        </div>
        <div className="hero-actions">
          <div className="small">Admin: {adminEmail}</div>
          <button className="hero-link" type="button" onClick={loadWatchlistActivity} disabled={activityLoading}>
            {activityLoading ? 'Refreshing...' : 'Refresh Watchlist Activity'}
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Watchlist Activity</h2>
        <p className="small">Backend: GET /site/watchlist/all-tickers and GET /site/watchlist/subscriptions.</p>
        <ApiErrorBox error={activityError} />
        {allTickers.length > 0 ? (
          <div className="meta">
            {allTickers.map((item) => (
              <span className="badge queued" key={item}>{item}</span>
            ))}
          </div>
        ) : (
          <EmptyState>No watched tickers returned.</EmptyState>
        )}
      </div>

      <div className="card">
        <h2>Watchlist Subscriptions</h2>
        <p className="small">Shows subscription rows returned by the backend. If user counts are needed, the backend should expose an admin summary contract.</p>
        <DynamicTable rows={subscriptions} columns={SUBSCRIPTION_COLUMNS} />
      </div>

      <form className="card" onSubmit={onUserSubmit}>
        <h2>User Lookup</h2>
        <p className="small">Existing backend contracts require user_id for user-specific watchlist and AI research run visibility.</p>
        <div className="row">
          <div>
            <label>User ID</label>
            <input value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="frontoffice user id" />
          </div>
          <div>
            <label>Ticker filter</label>
            <input value={ticker} onChange={(event) => setTicker(event.target.value)} placeholder="optional, e.g. SPY" />
          </div>
        </div>
        <div className="admin-action-row">
          <button className="primary" type="submit" disabled={lookupLoading}>{lookupLoading ? 'Loading...' : 'Load user activity'}</button>
        </div>
        <ApiErrorBox error={lookupError} />
      </form>

      <div className="feature-grid">
        <div className="card compact-card">
          <h2>Selected User Watchlist</h2>
          {userWatchlist.length > 0 ? (
            <div className="meta">
              {userWatchlist.map((item) => (
                <span className="badge queued" key={item}>{item}</span>
              ))}
            </div>
          ) : (
            <EmptyState>No user watchlist rows returned.</EmptyState>
          )}
        </div>
        <div className="card compact-card">
          <h2>Run Detail Lookup</h2>
          <form onSubmit={onDetailSubmit}>
            <label>Run ID</label>
            <input value={runId} onChange={(event) => setRunId(event.target.value)} placeholder="AI research run id" />
            <div className="admin-action-row">
              <button className="secondary" type="submit" disabled={detailLoading}>{detailLoading ? 'Loading...' : 'Load run detail'}</button>
            </div>
          </form>
          <ApiErrorBox error={detailError} />
        </div>
      </div>

      <div className="card">
        <h2>Recent AI Research Runs</h2>
        <p className="small">Backend: GET /site/ai-research/runs?user_id=... Fields are rendered if returned; raw JSON is preserved per row.</p>
        <DynamicTable rows={runs.map(addDerivedRunFields)} columns={RUN_COLUMNS} />
      </div>

      <div className="card">
        <h2>Run Detail</h2>
        {runDetail ? (
          <>
            <div className="field-grid">
              <div>
                <label>Ticker</label>
                <div>{readString(runDetail, ['ticker'])}</div>
              </div>
              <div>
                <label>Status</label>
                <div>{readString(runDetail, ['status'])}</div>
              </div>
              <div>
                <label>Provider / Model</label>
                <div>{readString(runDetail, ['provider'])} / {readString(runDetail, ['model'])}</div>
              </div>
            </div>
            <details className="details-block" open>
              <summary>Raw run detail</summary>
              <JsonBlock value={runDetail} />
            </details>
          </>
        ) : (
          <EmptyState>No run detail loaded.</EmptyState>
        )}
      </div>

      <div className="card">
        <h2>Missing Admin Contracts</h2>
        <p className="small">These gaps block a complete Frontoffice/User Research Control surface.</p>
        <ul className="plain-list">
          {MISSING_ADMIN_CONTRACTS.map((gap) => (
            <li key={gap}>{gap}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function addDerivedRunFields(row: unknown): unknown {
  const record = asRecord(row)
  if (!record) return row
  const citations = record.citations
  return {
    ...record,
    citations: Array.isArray(citations) ? citations.length : citations,
  }
}
