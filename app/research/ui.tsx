'use client'

import { useEffect, useEffectEvent, useMemo, useState } from 'react'
import { readApiError } from '@/lib/api-error'
import { requestClientJson } from '@/lib/client-json'
import { unwrapList, unwrapRecord } from '@/lib/payload'
import { EvidenceGap } from '@/app/components/workspace-data'
import { ExperimentTable, type ResearchArtifact, type ResearchEvent, type ResearchExperiment } from '@/components/research/ExperimentTable'
import { CrossSectionalExperimentForm, type CrossSectionalSubmissionResult } from '@/components/research/CrossSectionalExperimentForm'

type Pagination = {
  limit: number
  offset: number
  total?: number
  has_more?: boolean
}

export default function ResearchConsole({ adminEmail }: { adminEmail: string }) {
  const [experiments, setExperiments] = useState<ResearchExperiment[]>([])
  const [expandedExperimentId, setExpandedExperimentId] = useState<string | null>(null)
  const [events, setEvents] = useState<ResearchEvent[]>([])
  const [artifacts, setArtifacts] = useState<ResearchArtifact[]>([])
  const [loadingExperiments, setLoadingExperiments] = useState(false)
  const [runTypeFilter, setRunTypeFilter] = useState<'all' | 'experiment' | 'batch'>(() => initialRunTypeFilter())
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [offset, setOffset] = useState(0)

  const sortedExperiments = useMemo(
    () => [...experiments]
      .filter((run) => runTypeFilter === 'all' || (run.run_type ?? 'experiment') === runTypeFilter)
      .sort((a, b) => toTimestamp(b.started_at ?? b.created_at) - toTimestamp(a.started_at ?? a.created_at)),
    [experiments, runTypeFilter]
  )

  async function loadExperiments(newOffset = 0) {
    setLoadingExperiments(true)
    setError(null)
    try {
      const query = new URLSearchParams({ limit: '80', offset: String(newOffset) })
      const [experimentPayload, batchPayload] = await Promise.all([
        requestClientJson(`/api/research/experiments?${query.toString()}`),
        requestClientJson('/api/research/batches?limit=100'),
      ])
      const experimentList = normalizeExperiments(experimentPayload)
      const batchList = normalizeBatchesAsRuns(batchPayload)
      const list = [...experimentList, ...batchList]
      setExperiments(list)
      const page = unwrapRecord(experimentPayload, ['pagination'])
      setPagination(page as Pagination | null)
      setOffset(typeof page?.offset === 'number' ? page.offset : newOffset)
      if (expandedExperimentId && !list.some((experiment) => experiment.experiment_id === expandedExperimentId)) {
        closeExpandedRow()
      }
    } catch (requestError) {
      setError(readApiError(requestError, 'Failed to load research experiments.'))
    } finally {
      setLoadingExperiments(false)
    }
  }

  async function toggleExperiment(experimentId: string) {
    if (expandedExperimentId === experimentId) {
      closeExpandedRow()
      return
    }
    setExpandedExperimentId(experimentId)
    setLoadingDetail(true)
    setError(null)
    try {
      await loadExperimentDetail(experimentId)
    } finally {
      setLoadingDetail(false)
    }
  }

  async function loadExperimentDetail(experimentId: string) {
    const [eventsResult, artifactsResult] = await Promise.allSettled([
      requestClientJson(`/api/research/experiments/${encodeURIComponent(experimentId)}/events`),
      requestClientJson(`/api/research/experiments/${encodeURIComponent(experimentId)}/artifacts`),
    ])
    setEvents(eventsResult.status === 'fulfilled' ? normalizeEvents(eventsResult.value) : [])
    setArtifacts(artifactsResult.status === 'fulfilled' ? normalizeArtifacts(artifactsResult.value) : [])
    if (eventsResult.status === 'rejected' || artifactsResult.status === 'rejected') {
      setError('Experiment expanded, but one or more detail endpoints failed.')
    }
  }

  function closeExpandedRow() {
    setExpandedExperimentId(null)
    setEvents([])
    setArtifacts([])
  }

  async function handleCreated(result: CrossSectionalSubmissionResult) {
    await loadExperiments(0)
    if (result.submission_type === 'experiment' && result.experiment_id) {
      setExpandedExperimentId(result.experiment_id)
      setLoadingDetail(true)
      try {
        await loadExperimentDetail(result.experiment_id)
      } finally {
        setLoadingDetail(false)
      }
    }
  }

  const loadExperimentsEffect = useEffectEvent(() => {
    void loadExperiments()
  })

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadExperimentsEffect()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div className="page-stack">
      <div className="card">
        <div className="split-row">
          <div>
            <h1>Research</h1>
            <p className="small">Launch catalog-driven cross-sectional experiments and inspect experiment or batch runs from one queue.</p>
          </div>
          <div className="small">Admin: {adminEmail}</div>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      <CrossSectionalExperimentForm adminEmail={adminEmail} onCreated={handleCreated} />

      <div className="split-row">
        <div className="small">{loadingExperiments ? 'Refreshing runs...' : 'Sorted by started date descending. Batch rows drill into existing batch detail.'}</div>
        <div style={{ display: 'flex', gap: 8, minWidth: 320 }}>
          <select aria-label="Run type filter" value={runTypeFilter} onChange={(event) => setRunTypeFilter(event.target.value as typeof runTypeFilter)}>
            <option value="all">All run types</option>
            <option value="experiment">Experiments</option>
            <option value="batch">Batches</option>
          </select>
          <button className="secondary" type="button" onClick={() => void loadExperiments(offset)} disabled={loadingExperiments}>
            {loadingExperiments ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {!loadingExperiments && runTypeFilter === 'batch' && sortedExperiments.length === 0 ? (
        <EvidenceGap
          reason="Batch Results is currently empty because the backend batch store returns total:0."
          expected="Persisted batch rows from /analyst/research/batches; this is a backend persistence/wiring dependency, not a frontend failure."
          title="Batch run evidence unavailable"
        />
      ) : null}

      <ExperimentTable
        artifacts={artifacts}
        events={events}
        expandedExperimentId={expandedExperimentId}
        experiments={sortedExperiments}
        loadingDetail={loadingDetail}
        onToggle={(experimentId) => void toggleExperiment(experimentId)}
      />

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button className="secondary" type="button" disabled={loadingExperiments || offset === 0} onClick={() => void loadExperiments(Math.max(0, offset - 80))}>Previous page</button>
        <button className="secondary" type="button" disabled={loadingExperiments || !pagination?.has_more} onClick={() => void loadExperiments(offset + 80)}>Next page</button>
        {pagination ? <span className="small">Showing {experiments.length}. {pagination.total !== undefined ? `Total: ${pagination.total}` : ''}</span> : null}
      </div>
    </div>
  )
}

function normalizeExperiments(payload: unknown): ResearchExperiment[] {
  return unwrapList<ResearchExperiment>(payload, ['jobs', 'experiments', 'items', 'results']).filter(
    (item) => typeof item?.experiment_id === 'string'
  ).map((item) => ({ ...item, run_type: 'experiment' }))
}

function normalizeBatchesAsRuns(payload: unknown): ResearchExperiment[] {
  return unwrapList<Record<string, unknown>>(payload, ['batches', 'jobs', 'items', 'results']).map((row, index) => {
    const id = readStringValue(row.batch_id ?? row.id ?? row.job_id ?? row.research_batch_id) ?? `batch-${index}`
    return {
      ...row,
      experiment_id: id,
      batch_id: id,
      run_type: 'batch',
      experiment_name: readStringValue(row.batch_name ?? row.name) ?? 'Batch grid',
      strategy_family: readStringValue(row.strategy_family ?? row.family),
      universe: readStringValue(row.universe ?? row.symbols),
      status: readStringValue(row.status ?? row.state),
      created_at: readStringValue(row.created_at ?? row.submitted_at ?? row.started_at),
      started_at: readStringValue(row.started_at ?? row.created_at ?? row.submitted_at),
    }
  })
}

function normalizeEvents(payload: unknown): ResearchEvent[] {
  return unwrapList<ResearchEvent>(payload, ['events', 'items', 'results'])
}

function normalizeArtifacts(payload: unknown): ResearchArtifact[] {
  return unwrapList<ResearchArtifact>(payload, ['artifacts', 'items', 'results'])
}

function readStringValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return null
}

function toTimestamp(value?: string | null): number {
  if (!value) return 0
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

function initialRunTypeFilter(): 'all' | 'experiment' | 'batch' {
  if (typeof window === 'undefined') return 'all'
  const type = new URLSearchParams(window.location.search).get('type')
  return type === 'experiment' || type === 'batch' ? type : 'all'
}
