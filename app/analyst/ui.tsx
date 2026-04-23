'use client'

import { useEffect, useMemo, useState } from 'react'

type AnalysisType = 'ticker_snapshot' | 'coverage_report' | 'ticker_signal_v1'
type JobStatus = 'queued' | 'running' | 'completed' | 'failed'

type LegacyAnalysisResult = {
  summary?: string
  sections?: Array<{ title?: string; items?: unknown[] }>
  warnings?: string[]
  metadata?: Record<string, unknown>
}

type SignalAnalysisResult = {
  summary?: {
    ticker?: string
    signal_label?: string
    signal_score?: number | null
    confidence?: number | null
    next_earnings_date?: string | null
  }
  market?: {
    last_price?: number | null
    as_of_date?: string | null
    return_1d_pct?: number | null
    return_1m_pct?: number | null
    return_3m_pct?: number | null
    return_1y_pct?: number | null
    distance_from_20d_ma_pct?: number | null
    distance_from_50d_ma_pct?: number | null
    distance_from_200d_ma_pct?: number | null
    drawdown_from_252d_high_pct?: number | null
    volatility_20d_pct?: number | null
    volume_vs_20d_avg?: number | null
  }
  earnings?: {
    next_event?: {
      earnings_date?: string | null
      session?: string | null
      days_until?: number | null
    }
    history?: {
      recent_quarters?: number | null
      beat_count_4q?: number | null
      miss_count_4q?: number | null
      avg_surprise_pct_4q?: number | null
      last_surprise_pct?: number | null
      trend?: string | null
    }
  }
  signal?: {
    stance?: string | null
    drivers?: string[] | null
    risks?: string[] | null
    confidence?: number | null
    score?: number | null
    label?: string | null
  }
  warnings?: string[] | null
  metadata?: Record<string, unknown>
  summary_text?: string | null
}

type AnalysisResult = LegacyAnalysisResult | SignalAnalysisResult

type AnalysisJob = {
  job_id: string
  ticker: string
  region?: string | null
  exchange?: string | null
  analysis_type: AnalysisType
  status: JobStatus
  created_at?: string | null
  started_at?: string | null
  finished_at?: string | null
  error_message?: string | null
  result?: AnalysisResult | null
}

const STUCK_MINUTES = 10

function formatDate(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function formatShortDate(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString()
}

function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return value.toFixed(3)
}

function formatConfidence(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${Math.round(value * 100)}%`
}

function formatNumber(value: number | null | undefined, digits = 3): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return value.toFixed(digits)
}

function formatPercent(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${(value * 100).toFixed(digits)}%`
}

function formatEarningsSession(value?: string | null): string {
  const normalized = String(value ?? '').trim()
  if (!normalized) return '—'
  const lower = normalized.toLowerCase()
  if (lower === '20:00:00' || lower === 'post_market' || lower === 'after_market') return 'After Market'
  if (lower === '09:30:00' || lower === 'pre_market' || lower === 'before_market') return 'Pre Market'
  return normalized
}

function formatEarningsTrend(value?: string | null): string {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (!normalized || normalized === 'market_only') return '—'
  return String(value)
}

function statusClass(status: JobStatus): string {
  return `badge ${status}`
}

function isStuck(job: AnalysisJob): boolean {
  if (!(job.status === 'queued' || job.status === 'running') || !job.created_at) return false
  const created = new Date(job.created_at).getTime()
  if (Number.isNaN(created)) return false
  const elapsedMs = Date.now() - created
  return elapsedMs > STUCK_MINUTES * 60_000
}

function signalResult(job: AnalysisJob): SignalAnalysisResult | null {
  if (job.analysis_type !== 'ticker_signal_v1' || !job.result) return null
  return job.result as SignalAnalysisResult
}

function legacyResult(job: AnalysisJob): LegacyAnalysisResult | null {
  if (job.analysis_type === 'ticker_signal_v1' || !job.result) return null
  return job.result as LegacyAnalysisResult
}

function renderSignalResult(result: SignalAnalysisResult) {
  const summary = result.summary ?? {}
  const signal = result.signal ?? {}
  const market = result.market ?? {}
  const earnings = result.earnings ?? {}
  const nextEvent = earnings.next_event ?? {}
  const history = earnings.history ?? {}
  const isMarketOnlyInstrument = signal.stance === 'market_only' || history.trend === 'market_only'
  const warnings = Array.isArray(result.warnings) ? result.warnings : []
  const drivers = Array.isArray(signal.drivers) ? signal.drivers : []
  const risks = Array.isArray(signal.risks) ? signal.risks : []

  return (
    <>
      <h4>Signal Summary</h4>
      <div className="row" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        <div>
          <label>Label</label>
          <div>{summary.signal_label ?? signal.label ?? '—'}</div>
        </div>
        <div>
          <label>Score</label>
          <div>{formatScore(summary.signal_score ?? signal.score)}</div>
        </div>
        <div>
          <label>Confidence</label>
          <div>{formatConfidence(summary.confidence ?? signal.confidence)}</div>
        </div>
        <div>
          <label>Stance</label>
          <div>{signal.stance ?? '—'}</div>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <label>Next Earnings Date</label>
        <div>{formatShortDate(summary.next_earnings_date)}</div>
      </div>

      <div style={{ marginTop: 16 }}>
        <h4>Drivers</h4>
        {drivers.length > 0 ? (
          <ul>
            {drivers.map((driver) => (
              <li key={driver}>{driver}</li>
            ))}
          </ul>
        ) : (
          <p className="small">No drivers returned.</p>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <h4>Risks</h4>
        {risks.length > 0 ? (
          <ul>
            {risks.map((risk) => (
              <li key={risk}>{risk}</li>
            ))}
          </ul>
        ) : (
          <p className="small">No risks returned.</p>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <h4>Warnings</h4>
        {warnings.length > 0 ? (
          <div className="error">
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="small">No warnings.</p>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <h4>Narrative</h4>
        <p>{result.summary_text ?? '—'}</p>
      </div>

      <div style={{ marginTop: 16 }}>
        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Market Details</summary>
          <div className="row" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', marginTop: 12 }}>
            <div>
              <label>Last Price</label>
              <div>{formatNumber(market.last_price, 3)}</div>
            </div>
            <div>
              <label>As-of Date</label>
              <div>{formatShortDate(market.as_of_date)}</div>
            </div>
            <div>
              <label>Return 1D</label>
              <div>{formatPercent(market.return_1d_pct)}</div>
            </div>
            <div>
              <label>Return 1M</label>
              <div>{formatPercent(market.return_1m_pct)}</div>
            </div>
            <div>
              <label>Return 3M</label>
              <div>{formatPercent(market.return_3m_pct)}</div>
            </div>
            <div>
              <label>Return 1Y</label>
              <div>{formatPercent(market.return_1y_pct)}</div>
            </div>
            <div>
              <label>Distance From 20D MA</label>
              <div>{formatPercent(market.distance_from_20d_ma_pct)}</div>
            </div>
            <div>
              <label>Distance From 50D MA</label>
              <div>{formatPercent(market.distance_from_50d_ma_pct)}</div>
            </div>
            <div>
              <label>Distance From 200D MA</label>
              <div>{formatPercent(market.distance_from_200d_ma_pct)}</div>
            </div>
            <div>
              <label>Drawdown From 52W High</label>
              <div>{formatPercent(market.drawdown_from_252d_high_pct)}</div>
            </div>
            <div>
              <label>Volatility 20D</label>
              <div>{formatPercent(market.volatility_20d_pct)}</div>
            </div>
            <div>
              <label>Volume vs 20D Avg</label>
              <div>{formatNumber(market.volume_vs_20d_avg, 3)}</div>
            </div>
          </div>
        </details>
      </div>

      <div style={{ marginTop: 16 }}>
        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Earnings Details</summary>
          <div className="row" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', marginTop: 12 }}>
            <div>
              <label>Next Earnings Date</label>
              <div>{formatShortDate(nextEvent.earnings_date)}</div>
            </div>
            <div>
              <label>Session</label>
              <div>{formatEarningsSession(nextEvent.session)}</div>
            </div>
            <div>
              <label>Days Until</label>
              <div>{nextEvent.days_until ?? '—'}</div>
            </div>
            <div>
              <label>Recent Quarters</label>
              <div>{isMarketOnlyInstrument ? '—' : (history.recent_quarters ?? '—')}</div>
            </div>
            <div>
              <label>Beat Count (4Q)</label>
              <div>{isMarketOnlyInstrument ? '—' : (history.beat_count_4q ?? '—')}</div>
            </div>
            <div>
              <label>Miss Count (4Q)</label>
              <div>{isMarketOnlyInstrument ? '—' : (history.miss_count_4q ?? '—')}</div>
            </div>
            <div>
              <label>Avg Surprise (4Q)</label>
              <div>{formatPercent(history.avg_surprise_pct_4q)}</div>
            </div>
            <div>
              <label>Last Surprise</label>
              <div>{formatPercent(history.last_surprise_pct)}</div>
            </div>
            <div>
              <label>Trend</label>
              <div>{formatEarningsTrend(history.trend)}</div>
            </div>
          </div>
        </details>
      </div>

      <div style={{ marginTop: 16 }}>
        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Raw JSON</summary>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </details>
      </div>
    </>
  )
}

function renderLegacyResult(result: LegacyAnalysisResult) {
  return (
    <>
      <h4>Summary</h4>
      <p>{result.summary ?? '—'}</p>

      <h4>Sections</h4>
      {(result.sections ?? []).map((section, index) => (
        <div key={`${section.title ?? 'section'}-${index}`} style={{ marginBottom: 10 }}>
          <strong>{section.title ?? 'Untitled'}</strong>
          <pre>{JSON.stringify(section.items ?? [], null, 2)}</pre>
        </div>
      ))}

      <h4>Warnings</h4>
      <pre>{JSON.stringify(result.warnings ?? [], null, 2)}</pre>

      <h4>Metadata</h4>
      <pre>{JSON.stringify(result.metadata ?? {}, null, 2)}</pre>
    </>
  )
}

export default function AnalystConsole({ adminEmail }: { adminEmail: string }) {
  const [ticker, setTicker] = useState('AAPL')
  const [region, setRegion] = useState('us')
  const [exchange, setExchange] = useState('')
  const [analysisType, setAnalysisType] = useState<AnalysisType>('ticker_signal_v1')

  const [jobs, setJobs] = useState<AnalysisJob[]>([])
  const [currentJob, setCurrentJob] = useState<AnalysisJob | null>(null)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [loadingJobs, setLoadingJobs] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeJobId = selectedJobId ?? currentJob?.job_id ?? null

  async function loadJobs() {
    setLoadingJobs(true)
    try {
      const response = await fetch('/api/analyst/jobs?limit=30', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Failed to load jobs')
      }
      const list = Array.isArray(payload?.jobs) ? (payload.jobs as AnalysisJob[]) : []
      setJobs(list)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to load jobs')
    } finally {
      setLoadingJobs(false)
    }
  }

  async function loadJob(jobId: string) {
    try {
      const response = await fetch(`/api/analyst/jobs/${encodeURIComponent(jobId)}`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Failed to load job')
      }
      setCurrentJob(payload as AnalysisJob)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to load job')
    }
  }

  async function createJob(input: { ticker: string; region?: string | null; exchange?: string | null; analysisType: AnalysisType }) {
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch('/api/analyst/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: input.ticker,
          region: input.region || null,
          exchange: input.exchange || null,
          analysis_type: input.analysisType,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Job creation failed')
      }

      const job = payload as AnalysisJob
      setCurrentJob(job)
      setSelectedJobId(job.job_id)
      await loadJobs()
      return job
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to create job')
      return null
    } finally {
      setSubmitting(false)
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await createJob({
      ticker: ticker.trim().toUpperCase(),
      region: region.trim() || null,
      exchange: exchange.trim() || null,
      analysisType,
    })
  }

  async function onRetry(job: AnalysisJob) {
    await createJob({
      ticker: job.ticker,
      region: job.region ?? null,
      exchange: job.exchange ?? null,
      analysisType: job.analysis_type,
    })
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadJobs()
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!activeJobId) return
    const timer = setTimeout(() => {
      void loadJob(activeJobId)
    }, 0)
    return () => clearTimeout(timer)
  }, [activeJobId])

  const pollingJobId = currentJob?.job_id ?? null
  const pollingStatus = currentJob?.status ?? null

  useEffect(() => {
    if (!pollingJobId) return
    if (!(pollingStatus === 'queued' || pollingStatus === 'running')) return

    const timer = setInterval(() => {
      void loadJob(pollingJobId)
      void loadJobs()
    }, 4000)

    return () => clearInterval(timer)
  }, [pollingJobId, pollingStatus])

  const sortedJobs = useMemo(() => {
    return [...jobs].sort((a, b) => {
      const aTs = a.created_at ? new Date(a.created_at).getTime() : 0
      const bTs = b.created_at ? new Date(b.created_at).getTime() : 0
      return bTs - aTs
    })
  }, [jobs])

  return (
    <div>
      <div className="card">
        <h2>Analyst Console</h2>
        <p className="small">Admin: {adminEmail}</p>
      </div>

      <div className="card">
        <h3>Create Analysis Job</h3>
        <form onSubmit={onSubmit}>
          <div className="row">
            <div>
              <label htmlFor="ticker">Ticker</label>
              <input id="ticker" value={ticker} onChange={(event) => setTicker(event.target.value)} required />
            </div>
            <div>
              <label htmlFor="region">Region (optional)</label>
              <input id="region" value={region} onChange={(event) => setRegion(event.target.value)} />
            </div>
            <div>
              <label htmlFor="exchange">Exchange (optional)</label>
              <input id="exchange" value={exchange} onChange={(event) => setExchange(event.target.value)} />
            </div>
            <div>
              <label htmlFor="analysisType">Analysis Type</label>
              <select id="analysisType" value={analysisType} onChange={(event) => setAnalysisType(event.target.value as AnalysisType)}>
                <option value="ticker_signal_v1">ticker_signal_v1</option>
                <option value="ticker_snapshot">ticker_snapshot</option>
                <option value="coverage_report">coverage_report</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button className="primary" type="submit" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Job'}
            </button>
            <button className="secondary" type="button" onClick={() => void loadJobs()}>
              Refresh Jobs
            </button>
          </div>
        </form>
      </div>

      {error ? <div className="error">{error}</div> : null}

      <div className="card">
        <h3>Current Job</h3>
        {!currentJob ? (
          <p className="small">No selected job yet.</p>
        ) : (
          <>
            <div className="meta">
              <span className={statusClass(currentJob.status)}>{currentJob.status}</span>
              {isStuck(currentJob) ? <span className="badge failed">stuck &gt; {STUCK_MINUTES}m</span> : null}
            </div>
            <p>
              <strong>{currentJob.ticker}</strong> · {currentJob.analysis_type}
            </p>
            <p className="small">Created: {formatDate(currentJob.created_at)}</p>
            <p className="small">Started: {formatDate(currentJob.started_at)}</p>
            <p className="small">Finished: {formatDate(currentJob.finished_at)}</p>
            {currentJob.error_message ? <div className="error">{currentJob.error_message}</div> : null}

            {signalResult(currentJob) ? renderSignalResult(signalResult(currentJob) as SignalAnalysisResult) : null}
            {legacyResult(currentJob) ? renderLegacyResult(legacyResult(currentJob) as LegacyAnalysisResult) : null}
          </>
        )}
      </div>

      <div className="card">
        <h3>Recent Jobs</h3>
        {loadingJobs ? <p className="small">Loading…</p> : null}
        {sortedJobs.length === 0 ? (
          <p className="small">No jobs found.</p>
        ) : (
          sortedJobs.map((job) => (
            <div className="job-row" key={job.job_id}>
              <div>
                <div>
                  <strong>{job.ticker}</strong> · {job.analysis_type}
                </div>
                <div className="small">{job.job_id}</div>
                <div className="small">Created: {formatDate(job.created_at)}</div>
              </div>
              <div>
                <span className={statusClass(job.status)}>{job.status}</span>
                {isStuck(job) ? <div className="small" style={{ color: '#b91c1c' }}>stuck &gt; {STUCK_MINUTES}m</div> : null}
              </div>
              <div className="small">{job.error_message ?? ''}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="secondary"
                  type="button"
                  onClick={() => {
                    setSelectedJobId(job.job_id)
                    void loadJob(job.job_id)
                  }}
                >
                  Open Result
                </button>
                {job.status === 'failed' ? (
                  <button className="secondary" type="button" onClick={() => void onRetry(job)}>
                    Retry
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
