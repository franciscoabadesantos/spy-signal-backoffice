'use client'

import { useEffect, useMemo, useState } from 'react'

type AnalysisType = 'ticker_snapshot' | 'coverage_report'
type JobStatus = 'queued' | 'running' | 'completed' | 'failed'

type AnalysisResult = {
  summary?: string
  sections?: Array<{ title?: string; items?: unknown[] }>
  warnings?: string[]
  metadata?: Record<string, unknown>
}

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

export default function AnalystConsole({ adminEmail }: { adminEmail: string }) {
  const [ticker, setTicker] = useState('AAPL')
  const [region, setRegion] = useState('us')
  const [exchange, setExchange] = useState('')
  const [analysisType, setAnalysisType] = useState<AnalysisType>('ticker_snapshot')

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

            {currentJob.result ? (
              <>
                <h4>Summary</h4>
                <p>{currentJob.result.summary ?? '—'}</p>

                <h4>Sections</h4>
                {(currentJob.result.sections ?? []).map((section, index) => (
                  <div key={`${section.title ?? 'section'}-${index}`} style={{ marginBottom: 10 }}>
                    <strong>{section.title ?? 'Untitled'}</strong>
                    <pre>{JSON.stringify(section.items ?? [], null, 2)}</pre>
                  </div>
                ))}

                <h4>Warnings</h4>
                <pre>{JSON.stringify(currentJob.result.warnings ?? [], null, 2)}</pre>

                <h4>Metadata</h4>
                <pre>{JSON.stringify(currentJob.result.metadata ?? {}, null, 2)}</pre>
              </>
            ) : null}
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
