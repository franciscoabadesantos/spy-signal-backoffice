'use client'

import { useEffect, useMemo, useState } from 'react'
import { readApiError } from '@/lib/api-error'
import { requestClientJson } from '@/lib/client-json'
import { ApiErrorBox, DynamicTable, EmptyState, asRecord, readArrayPayload, readString } from '@/app/components/workspace-data'

const OLD_RUNNING_MINUTES = 30

const JOB_COLUMNS = [
  { key: 'id', label: 'ID', keys: ['job_id', 'backend_job_id', 'experiment_id', 'id'] },
  { key: 'status', label: 'Status' },
  { key: 'ticker', label: 'Ticker / Symbols', keys: ['ticker', 'symbols'] },
  { key: 'type', label: 'Type', keys: ['analysis_type', 'strategy_family', 'domain'] },
  { key: 'created_at', label: 'Created' },
  { key: 'started_at', label: 'Started' },
  { key: 'finished_at', label: 'Finished' },
  { key: 'error_message', label: 'Error' },
]

const MISSING_QUEUE_CONTRACTS = [
  'no queue depth endpoint',
  'no worker heartbeat endpoint',
  'no dispatch lag endpoint',
  'no dead-letter/failed task endpoint',
  'no unified retry/cancel across job types',
]

type OperationsState = {
  analystJobs: unknown[]
  dataOpsJobs: unknown[]
  researchJobs: unknown[]
}

export default function OperationsWorkspace({ adminEmail }: { adminEmail: string }) {
  const [state, setState] = useState<OperationsState>({ analystJobs: [], dataOpsJobs: [], researchJobs: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadOperations() {
    setLoading(true)
    setError(null)
    try {
      const [analystPayload, dataOpsPayload, researchPayload] = await Promise.all([
        requestClientJson('/api/analyst/jobs?limit=100'),
        requestClientJson('/api/data-ops/rebuild-jobs?limit=100'),
        requestClientJson('/api/research/experiments?limit=100'),
      ])
      setState({
        analystJobs: readArrayPayload(analystPayload, 'jobs'),
        dataOpsJobs: readArrayPayload(dataOpsPayload, 'jobs'),
        researchJobs: readArrayPayload(researchPayload, 'jobs'),
      })
    } catch (err) {
      setError(readApiError(err, 'Failed to load operations data.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadOperations()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const summaries = useMemo(() => [
    buildSummary('Analyst jobs', state.analystJobs),
    buildSummary('Data Ops jobs', state.dataOpsJobs),
    buildSummary('Research experiments', state.researchJobs),
  ], [state])

  const heuristicRows = useMemo(() => [
    ...markSource('Analyst', state.analystJobs),
    ...markSource('Data Ops', state.dataOpsJobs),
    ...markSource('Research', state.researchJobs),
  ].filter(isOldRunning), [state])

  return (
    <div className="page-stack">
      <div className="hero-panel">
        <div>
          <p className="eyebrow">Queue & Worker Operations</p>
          <h1>Aggregate today’s visible job surfaces without pretending worker health exists.</h1>
          <p className="hero-copy">
            This workspace uses existing Analyst, Data Ops, and Research job list APIs. It computes only a UI heuristic for old queued/running rows; true queue depth and worker heartbeat remain backend gaps.
          </p>
        </div>
        <div className="hero-actions">
          <div className="small">Admin: {adminEmail}</div>
          <button className="hero-link" type="button" onClick={loadOperations} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh Operations'}</button>
        </div>
      </div>

      <ApiErrorBox error={error} />

      <div className="metric-grid">
        {summaries.map((summary) => (
          <div className="card compact-card" key={summary.label}>
            <label>{summary.label}</label>
            <div className="metric-value">{summary.total}</div>
            <div className="small">Returned rows from existing backend list contract.</div>
            <div className="status-chip-row">
              {Object.entries(summary.byStatus).map(([status, count]) => (
                <span className={`badge ${statusClass(status)}`} key={status}>{status}: {count}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>UI-Only Old Queued/Running Heuristic</h2>
        <p className="small">
          This is not worker health. It flags rows whose status is queued/running and whose created_at or started_at timestamp is older than {OLD_RUNNING_MINUTES} minutes.
        </p>
        <DynamicTable rows={heuristicRows} columns={[
          { key: 'source', label: 'Source' },
          ...JOB_COLUMNS,
          { key: 'heuristicAgeMinutes', label: 'Approx Age (min)' },
        ]} emptyLabel="No old queued/running rows matched the UI heuristic." />
      </div>

      <JobSection title="Analyst Jobs Summary" route="/api/analyst/jobs?limit=100" rows={state.analystJobs} />
      <JobSection title="Data Ops Jobs Summary" route="/api/data-ops/rebuild-jobs?limit=100" rows={state.dataOpsJobs} />
      <JobSection title="Research Jobs Summary" route="/api/research/experiments?limit=100" rows={state.researchJobs} />

      <div className="card">
        <h2>Missing Backend Contracts</h2>
        <p className="small">These are required before Backoffice can show true queue and worker health.</p>
        <ul className="plain-list">
          {MISSING_QUEUE_CONTRACTS.map((gap) => (
            <li key={gap}>{gap}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function JobSection({ title, route, rows }: { title: string; route: string; rows: unknown[] }) {
  return (
    <div className="card">
      <div className="split-row">
        <div>
          <h2>{title}</h2>
          <p className="small">Local Backoffice API: {route}</p>
        </div>
        <div className="small">{rows.length} returned</div>
      </div>
      {rows.length === 0 ? <EmptyState>No rows returned.</EmptyState> : <DynamicTable rows={rows} columns={JOB_COLUMNS} />}
    </div>
  )
}

function buildSummary(label: string, rows: unknown[]) {
  const byStatus: Record<string, number> = {}
  for (const row of rows) {
    const status = readString(row, ['status']).toLowerCase()
    byStatus[status] = (byStatus[status] ?? 0) + 1
  }
  return { label, total: rows.length, byStatus }
}

function markSource(source: string, rows: unknown[]): unknown[] {
  return rows.map((row) => {
    const record = asRecord(row)
    if (!record) return { source, value: row }
    const age = ageMinutes(record.started_at ?? record.created_at)
    return { source, ...record, heuristicAgeMinutes: age ?? '—' }
  })
}

function isOldRunning(row: unknown): boolean {
  const record = asRecord(row)
  if (!record) return false
  const status = String(record.status ?? '').toLowerCase()
  if (status !== 'queued' && status !== 'running') return false
  const age = typeof record.heuristicAgeMinutes === 'number' ? record.heuristicAgeMinutes : null
  return age !== null && age > OLD_RUNNING_MINUTES
}

function ageMinutes(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return null
  return Math.max(0, Math.round((Date.now() - timestamp) / 60_000))
}

function statusClass(status: string): string {
  if (['queued', 'running', 'completed', 'failed', 'cancelled'].includes(status)) return status
  return 'queued'
}
