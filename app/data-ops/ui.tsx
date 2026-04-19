'use client'

import { useEffect, useMemo, useState } from 'react'

type JobStatus = 'queued' | 'running' | 'completed' | 'failed'
type DataOpsDomain = 'market' | 'fundamentals' | 'earnings' | 'macro' | 'release-calendar'
type RebuildMode = 'rebuild_missing_only' | 'rebuild_from_start_date' | 'wipe_rebuild'
type ScopeType = 'whole_domain' | 'region' | 'ticker' | 'date_range'

type DataOpsJob = {
  job_id: string
  status: JobStatus
  analysis_type: string
  ticker: string
  created_at?: string | null
  started_at?: string | null
  finished_at?: string | null
  error_message?: string | null
  worker_job_id?: string | null
  params?: Record<string, unknown> | null
  result?: Record<string, unknown> | null
}

type HealthCell = {
  count: number
  status: string
}

type HealthRow = {
  date: string
  domains: Record<string, HealthCell>
}

type HealthResponse = {
  start_date: string
  end_date: string
  rows: HealthRow[]
  summaries: Record<string, Record<string, unknown>>
}

const DOMAIN_OPTIONS: DataOpsDomain[] = ['market', 'fundamentals', 'earnings', 'macro', 'release-calendar']

function formatDate(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function statusClass(status: JobStatus): string {
  return `badge ${status}`
}

function healthClass(status: string): string {
  if (status === 'ok') return 'cell-ok'
  if (status === 'missing') return 'cell-missing'
  return 'cell-na'
}

function toTodayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function shiftIsoDays(days: number): string {
  const now = new Date()
  now.setDate(now.getDate() + days)
  return now.toISOString().slice(0, 10)
}

export default function DataOpsConsole({ adminEmail }: { adminEmail: string }) {
  const [jobs, setJobs] = useState<DataOpsJob[]>([])
  const [currentJob, setCurrentJob] = useState<DataOpsJob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingJobs, setLoadingJobs] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [loadingHealth, setLoadingHealth] = useState(false)
  const [healthStartDate, setHealthStartDate] = useState(shiftIsoDays(-30))
  const [healthEndDate, setHealthEndDate] = useState(toTodayIso())
  const [healthTicker, setHealthTicker] = useState('')
  const [healthDomains, setHealthDomains] = useState<DataOpsDomain[]>(['market', 'macro', 'release-calendar'])

  const [domain, setDomain] = useState<DataOpsDomain>('market')
  const [mode, setMode] = useState<RebuildMode>('rebuild_missing_only')
  const [scopeType, setScopeType] = useState<ScopeType>('whole_domain')
  const [scopeRegion, setScopeRegion] = useState('us')
  const [scopeTicker, setScopeTicker] = useState('')
  const [scopeStartDate, setScopeStartDate] = useState(shiftIsoDays(-90))
  const [scopeEndDate, setScopeEndDate] = useState(toTodayIso())
  const [dryRun, setDryRun] = useState(true)
  const [confirmPhrase, setConfirmPhrase] = useState('')

  const [macroSeriesKey, setMacroSeriesKey] = useState('')
  const [macroSourceProvider, setMacroSourceProvider] = useState<'fred' | 'yfinance'>('fred')
  const [macroSourceCode, setMacroSourceCode] = useState('')
  const [macroFrequency, setMacroFrequency] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  const [macroBackfillStart, setMacroBackfillStart] = useState(shiftIsoDays(-365))
  const [macroBackfillEnd, setMacroBackfillEnd] = useState(toTodayIso())
  const [macroDryRun, setMacroDryRun] = useState(true)

  const [releaseSeriesKey, setReleaseSeriesKey] = useState('ICSA')
  const [releaseObservationPeriod, setReleaseObservationPeriod] = useState(toTodayIso())
  const [releaseObservationDate, setReleaseObservationDate] = useState(toTodayIso())
  const [releaseTimestampUtc, setReleaseTimestampUtc] = useState(`${toTodayIso()}T08:30:00Z`)
  const [releaseDryRun, setReleaseDryRun] = useState(true)

  const activeJobId = currentJob?.job_id ?? null

  async function loadJobs() {
    setLoadingJobs(true)
    try {
      const response = await fetch('/api/data-ops/rebuild-jobs?limit=80', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Failed to load jobs')
      }
      const list = Array.isArray(payload?.jobs) ? (payload.jobs as DataOpsJob[]) : []
      setJobs(list)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to load jobs')
    } finally {
      setLoadingJobs(false)
    }
  }

  async function loadJob(jobId: string) {
    try {
      const response = await fetch(`/api/data-ops/rebuild-jobs/${encodeURIComponent(jobId)}`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Failed to load job')
      }
      setCurrentJob(payload as DataOpsJob)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to load job')
    }
  }

  async function loadHealth() {
    setLoadingHealth(true)
    try {
      const query = new URLSearchParams()
      if (healthStartDate) query.set('start_date', healthStartDate)
      if (healthEndDate) query.set('end_date', healthEndDate)
      if (healthTicker.trim()) query.set('ticker', healthTicker.trim().toUpperCase())
      if (healthDomains.length > 0) query.set('domains', healthDomains.join(','))
      const response = await fetch(`/api/data-ops/health?${query.toString()}`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Failed to load health view')
      }
      setHealth(payload as HealthResponse)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to load health view')
    } finally {
      setLoadingHealth(false)
    }
  }

  async function submitRebuildJob() {
    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        domain,
        mode,
        dry_run: dryRun,
        confirm_phrase: confirmPhrase || null,
        requested_scope_label: `${domain} / ${scopeType}`,
        scope: {
          scope_type: scopeType,
          region: scopeType === 'region' ? scopeRegion.trim().toLowerCase() : null,
          ticker: scopeType === 'ticker' ? scopeTicker.trim().toUpperCase() : null,
          start_date: scopeType === 'date_range' || domain === 'market' || domain === 'macro' || domain === 'release-calendar' ? scopeStartDate : null,
          end_date: scopeType === 'date_range' || domain === 'market' || domain === 'macro' || domain === 'release-calendar' ? scopeEndDate : null,
        },
      }
      const response = await fetch('/api/data-ops/rebuild-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await response.json()
      if (!response.ok) {
        throw new Error(body?.detail ?? body?.error ?? 'Failed to create rebuild job')
      }
      const job = body as DataOpsJob
      setCurrentJob(job)
      await loadJobs()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to create rebuild job')
    } finally {
      setSubmitting(false)
    }
  }

  async function submitMacroSeriesJob() {
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch('/api/data-ops/series/macro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          series_key: macroSeriesKey.trim(),
          source_provider: macroSourceProvider,
          source_code: macroSourceCode.trim(),
          frequency: macroFrequency,
          dry_run: macroDryRun,
          backfill_start_date: macroBackfillStart || null,
          backfill_end_date: macroBackfillEnd || null,
        }),
      })
      const body = await response.json()
      if (!response.ok) {
        throw new Error(body?.detail ?? body?.error ?? 'Failed to create macro series job')
      }
      setCurrentJob(body as DataOpsJob)
      await loadJobs()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to create macro series job')
    } finally {
      setSubmitting(false)
    }
  }

  async function submitReleaseSeriesJob() {
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch('/api/data-ops/series/release-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          series_key: releaseSeriesKey.trim(),
          observation_period: releaseObservationPeriod.trim(),
          observation_date: releaseObservationDate.trim(),
          scheduled_release_timestamp_utc: releaseTimestampUtc.trim(),
          dry_run: releaseDryRun,
        }),
      })
      const body = await response.json()
      if (!response.ok) {
        throw new Error(body?.detail ?? body?.error ?? 'Failed to create release series job')
      }
      setCurrentJob(body as DataOpsJob)
      await loadJobs()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to create release series job')
    } finally {
      setSubmitting(false)
    }
  }

  async function retryJob(jobId: string) {
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch(`/api/data-ops/rebuild-jobs/${encodeURIComponent(jobId)}/retry`, {
        method: 'POST',
      })
      const body = await response.json()
      if (!response.ok) {
        throw new Error(body?.detail ?? body?.error ?? 'Failed to retry job')
      }
      const job = body as DataOpsJob
      setCurrentJob(job)
      await loadJobs()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to retry job')
    } finally {
      setSubmitting(false)
    }
  }

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    const timer = setTimeout(() => {
      void loadJobs()
      void loadHealth()
    }, 0)
    return () => clearTimeout(timer)
  }, [])
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    if (!activeJobId) return
    if (!(currentJob?.status === 'queued' || currentJob?.status === 'running')) return
    const timer = setInterval(() => {
      void loadJob(activeJobId)
      void loadJobs()
    }, 4000)
    return () => clearInterval(timer)
  }, [activeJobId, currentJob?.status])

  const sortedJobs = useMemo(() => {
    return [...jobs].sort((a, b) => {
      const aTs = a.created_at ? new Date(a.created_at).getTime() : 0
      const bTs = b.created_at ? new Date(b.created_at).getTime() : 0
      return bTs - aTs
    })
  }, [jobs])

  const currentResult = (currentJob?.result ?? null) as Record<string, unknown> | null
  const currentProgress = (currentResult?.progress ?? null) as Record<string, unknown> | null
  const currentOutput = (currentResult?.output ?? null) as Record<string, unknown> | null
  const currentPlan = ((currentResult?.plan ?? currentOutput?.preview ?? null) as Record<string, unknown> | null)
  const currentHealthChecks = Array.isArray(currentProgress?.health_checks) ? (currentProgress?.health_checks as Array<Record<string, unknown>>) : []

  return (
    <div>
      <div className="card">
        <h2>Data Ops Console</h2>
        <p className="small">Admin: {adminEmail}</p>
      </div>

      <div className="card">
        <h3>Data Health Calendar</h3>
        <div className="row">
          <div>
            <label htmlFor="healthStart">Start Date</label>
            <input id="healthStart" type="date" value={healthStartDate} onChange={(event) => setHealthStartDate(event.target.value)} />
          </div>
          <div>
            <label htmlFor="healthEnd">End Date</label>
            <input id="healthEnd" type="date" value={healthEndDate} onChange={(event) => setHealthEndDate(event.target.value)} />
          </div>
          <div>
            <label htmlFor="healthTicker">Ticker (optional)</label>
            <input id="healthTicker" value={healthTicker} onChange={(event) => setHealthTicker(event.target.value)} placeholder="AAPL" />
          </div>
          <div>
            <label>Domains</label>
            <select
              value={healthDomains.join(',')}
              onChange={(event) => setHealthDomains(event.target.value.split(',').map((item) => item.trim() as DataOpsDomain))}
            >
              <option value="market,macro,release-calendar">market + macro + release-calendar</option>
              <option value="market,fundamentals,earnings,macro,release-calendar">all domains</option>
              <option value="market">market</option>
              <option value="macro">macro</option>
              <option value="release-calendar">release-calendar</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button className="secondary" type="button" onClick={() => void loadHealth()} disabled={loadingHealth}>
            {loadingHealth ? 'Loading...' : 'Refresh Health'}
          </button>
        </div>
        {health ? (
          <>
            <div style={{ marginTop: 12, marginBottom: 10 }} className="small">
              Window: {health.start_date} to {health.end_date}
            </div>
            <div className="grid-health">
              <table className="health-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    {healthDomains.map((domainName) => (
                      <th key={domainName}>{domainName}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {health.rows.map((row) => (
                    <tr key={row.date}>
                      <td>{row.date}</td>
                      {healthDomains.map((domainName) => {
                        const cell = row.domains[domainName] || { count: 0, status: 'n/a' }
                        return (
                          <td key={`${row.date}-${domainName}`} className={healthClass(cell.status)}>
                            {cell.status} ({cell.count})
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>

      <div className="card">
        <h3>Targeted Rebuild / Refill</h3>
        <div className="row">
          <div>
            <label htmlFor="domain">Domain</label>
            <select id="domain" value={domain} onChange={(event) => setDomain(event.target.value as DataOpsDomain)}>
              {DOMAIN_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="mode">Mode</label>
            <select id="mode" value={mode} onChange={(event) => setMode(event.target.value as RebuildMode)}>
              <option value="rebuild_missing_only">rebuild_missing_only</option>
              <option value="rebuild_from_start_date">rebuild_from_start_date</option>
              <option value="wipe_rebuild">wipe_rebuild</option>
            </select>
          </div>
          <div>
            <label htmlFor="scopeType">Scope</label>
            <select id="scopeType" value={scopeType} onChange={(event) => setScopeType(event.target.value as ScopeType)}>
              <option value="whole_domain">whole_domain</option>
              <option value="region">region</option>
              <option value="ticker">ticker</option>
              <option value="date_range">date_range</option>
            </select>
          </div>
          <div>
            <label htmlFor="confirmPhrase">Confirm Phrase (wipe)</label>
            <input id="confirmPhrase" value={confirmPhrase} onChange={(event) => setConfirmPhrase(event.target.value)} placeholder={`WIPE ${domain}`} />
          </div>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <div>
            <label htmlFor="scopeRegion">Region</label>
            <input id="scopeRegion" value={scopeRegion} onChange={(event) => setScopeRegion(event.target.value)} />
          </div>
          <div>
            <label htmlFor="scopeTicker">Ticker</label>
            <input id="scopeTicker" value={scopeTicker} onChange={(event) => setScopeTicker(event.target.value)} />
          </div>
          <div>
            <label htmlFor="scopeStart">Start Date</label>
            <input id="scopeStart" type="date" value={scopeStartDate} onChange={(event) => setScopeStartDate(event.target.value)} />
          </div>
          <div>
            <label htmlFor="scopeEnd">End Date</label>
            <input id="scopeEnd" type="date" value={scopeEndDate} onChange={(event) => setScopeEndDate(event.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={dryRun} onChange={(event) => setDryRun(event.target.checked)} style={{ width: 'auto' }} />
            dry_run
          </label>
          <button className="primary" type="button" onClick={() => void submitRebuildJob()} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Run Rebuild Job'}
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Add Macro Series</h3>
        <div className="row">
          <div>
            <label htmlFor="macroSeriesKey">Series Key</label>
            <input id="macroSeriesKey" value={macroSeriesKey} onChange={(event) => setMacroSeriesKey(event.target.value)} placeholder="PMI_Manufacturing" />
          </div>
          <div>
            <label htmlFor="macroSourceProvider">Source Provider</label>
            <select id="macroSourceProvider" value={macroSourceProvider} onChange={(event) => setMacroSourceProvider(event.target.value as 'fred' | 'yfinance')}>
              <option value="fred">fred</option>
              <option value="yfinance">yfinance</option>
            </select>
          </div>
          <div>
            <label htmlFor="macroSourceCode">Source Code</label>
            <input id="macroSourceCode" value={macroSourceCode} onChange={(event) => setMacroSourceCode(event.target.value)} placeholder="DGS10" />
          </div>
          <div>
            <label htmlFor="macroFrequency">Frequency</label>
            <select id="macroFrequency" value={macroFrequency} onChange={(event) => setMacroFrequency(event.target.value as 'daily' | 'weekly' | 'monthly')}>
              <option value="daily">daily</option>
              <option value="weekly">weekly</option>
              <option value="monthly">monthly</option>
            </select>
          </div>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <div>
            <label htmlFor="macroBackfillStart">Backfill Start</label>
            <input id="macroBackfillStart" type="date" value={macroBackfillStart} onChange={(event) => setMacroBackfillStart(event.target.value)} />
          </div>
          <div>
            <label htmlFor="macroBackfillEnd">Backfill End</label>
            <input id="macroBackfillEnd" type="date" value={macroBackfillEnd} onChange={(event) => setMacroBackfillEnd(event.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'end' }}>
            <label style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={macroDryRun} onChange={(event) => setMacroDryRun(event.target.checked)} style={{ width: 'auto' }} />
              dry_run
            </label>
          </div>
          <div style={{ display: 'flex', alignItems: 'end' }}>
            <button className="secondary" type="button" onClick={() => void submitMacroSeriesJob()} disabled={submitting}>
              Queue Macro Series Job
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Add Release Row</h3>
        <div className="row">
          <div>
            <label htmlFor="releaseSeriesKey">Series Key</label>
            <input id="releaseSeriesKey" value={releaseSeriesKey} onChange={(event) => setReleaseSeriesKey(event.target.value)} />
          </div>
          <div>
            <label htmlFor="releaseObservationPeriod">Observation Period</label>
            <input id="releaseObservationPeriod" value={releaseObservationPeriod} onChange={(event) => setReleaseObservationPeriod(event.target.value)} placeholder="2026-04-01" />
          </div>
          <div>
            <label htmlFor="releaseObservationDate">Observation Date</label>
            <input id="releaseObservationDate" value={releaseObservationDate} onChange={(event) => setReleaseObservationDate(event.target.value)} placeholder="2026-04-01" />
          </div>
          <div>
            <label htmlFor="releaseTimestampUtc">Scheduled Release UTC</label>
            <input id="releaseTimestampUtc" value={releaseTimestampUtc} onChange={(event) => setReleaseTimestampUtc(event.target.value)} placeholder="2026-04-15T08:30:00Z" />
          </div>
        </div>
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={releaseDryRun} onChange={(event) => setReleaseDryRun(event.target.checked)} style={{ width: 'auto' }} />
            dry_run
          </label>
          <button className="secondary" type="button" onClick={() => void submitReleaseSeriesJob()} disabled={submitting}>
            Queue Release Upsert Job
          </button>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      <div className="card">
        <h3>Current Data Ops Job</h3>
        {!currentJob ? (
          <p className="small">No job selected.</p>
        ) : (
          <>
            <div className="meta">
              <span className={statusClass(currentJob.status)}>{currentJob.status}</span>
            </div>
            <p>
              <strong>{currentJob.analysis_type}</strong> · {currentJob.ticker}
            </p>
            <p className="small">Created: {formatDate(currentJob.created_at)}</p>
            <p className="small">Started: {formatDate(currentJob.started_at)}</p>
            <p className="small">Finished: {formatDate(currentJob.finished_at)}</p>
            {currentJob.error_message ? <div className="error">{currentJob.error_message}</div> : null}
            {currentProgress ? (
              <>
                <h4>Execution Progress</h4>
                <div className="small">Step: {renderValue(currentProgress.step)}</div>
                <div className="small">Step Status: {renderValue(currentProgress.step_status)}</div>
                <div className="small">
                  Batch: {renderValue(currentProgress.current_batch)} / {renderValue(currentProgress.total_batches)}
                </div>
                <div className="small">Rows Written: {renderValue(currentProgress.rows_written_total)}</div>
                <div className="small">Rows Deleted: {renderValue(currentProgress.rows_deleted_total)}</div>
                <div className="small">Finalization: {renderValue(currentProgress.finalization_status)}</div>
                {currentProgress.current_window ? (
                  <div className="small">Current Window: {renderValue(currentProgress.current_window)}</div>
                ) : null}
                {currentProgress.abort_reason ? <div className="error">Abort Reason: {renderValue(currentProgress.abort_reason)}</div> : null}
              </>
            ) : null}
            {currentPlan ? (
              <>
                <h4>Plan / Dry Run Preview</h4>
                <div className="small">Execution Mode: {renderValue(currentPlan.execution_mode)}</div>
                <div className="small">Window: {renderValue(currentPlan.start_date)} → {renderValue(currentPlan.end_date)}</div>
                <div className="small">Chunk Count: {renderValue(currentPlan.chunk_count)}</div>
                <div className="small">Chunk Size: {renderValue(currentPlan.chunk_size)}</div>
                <div className="small">Sleep Seconds: {renderValue(currentPlan.sleep_seconds)}</div>
                <div className="small">Resolved Symbols: {renderValue(currentPlan.resolved_symbols)}</div>
                <div className="small">Series Start Dates: {renderValue(currentPlan.series_start_dates)}</div>
                <div className="small">Refresh MVs: {renderValue(currentPlan.refresh_materialized_views)}</div>
                <div className="small">Wipe Tables: {renderValue(currentPlan.wipe_tables)}</div>
              </>
            ) : null}
            {currentHealthChecks.length > 0 ? (
              <>
                <h4>Health Checks</h4>
                <pre>{JSON.stringify(currentHealthChecks, null, 2)}</pre>
              </>
            ) : null}
            <h4>Params</h4>
            <pre>{JSON.stringify(currentJob.params ?? {}, null, 2)}</pre>
            <h4>Result</h4>
            <pre>{JSON.stringify(currentJob.result ?? {}, null, 2)}</pre>
          </>
        )}
      </div>

      <div className="card">
        <h3>Data Ops Job History</h3>
        {loadingJobs ? <p className="small">Loading jobs...</p> : null}
        {!loadingJobs && sortedJobs.length === 0 ? <p className="small">No jobs found.</p> : null}
        {sortedJobs.map((job) => (
          <div className="job-row" key={job.job_id}>
            <div>
              <div>
                <strong>{job.analysis_type}</strong> · {job.ticker}
              </div>
              <div className="small">{job.job_id}</div>
              <div className="small">Created: {formatDate(job.created_at)}</div>
            </div>
            <div>
              <span className={statusClass(job.status)}>{job.status}</span>
            </div>
            <div>
              <button className="secondary" type="button" onClick={() => void loadJob(job.job_id)}>
                Open
              </button>
            </div>
            <div>
              <button className="secondary" type="button" onClick={() => void retryJob(job.job_id)} disabled={submitting}>
                Retry
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
