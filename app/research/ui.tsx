'use client'

import { useEffect, useEffectEvent, useMemo, useState } from 'react'
import { readApiError } from '@/lib/api-error'
import { requestClientJson } from '@/lib/client-json'
import { ExperimentTable, type ResearchArtifact, type ResearchEvent, type ResearchExperiment } from '@/components/research/ExperimentTable'
import { NewExperimentForm } from '@/components/research/NewExperimentForm'

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
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [offset, setOffset] = useState(0)

  const sortedExperiments = useMemo(
    () => [...experiments].sort((a, b) => toTimestamp(b.started_at ?? b.created_at) - toTimestamp(a.started_at ?? a.created_at)),
    [experiments]
  )

  async function loadExperiments(newOffset = 0) {
    setLoadingExperiments(true)
    setError(null)
    try {
      const query = new URLSearchParams({ limit: '80', offset: String(newOffset) })
      const payload = await requestClientJson(`/api/research/experiments?${query.toString()}`)
      const list = normalizeExperiments(payload)
      setExperiments(list)
      const page = asRecord(asRecord(payload)?.pagination)
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
      const [eventsResult, artifactsResult] = await Promise.allSettled([
        requestClientJson(`/api/research/experiments/${encodeURIComponent(experimentId)}/events`),
        requestClientJson(`/api/research/experiments/${encodeURIComponent(experimentId)}/artifacts`),
      ])
      setEvents(eventsResult.status === 'fulfilled' ? normalizeEvents(eventsResult.value) : [])
      setArtifacts(artifactsResult.status === 'fulfilled' ? normalizeArtifacts(artifactsResult.value) : [])
      if (eventsResult.status === 'rejected' || artifactsResult.status === 'rejected') {
        setError('Experiment expanded, but one or more detail endpoints failed.')
      }
    } finally {
      setLoadingDetail(false)
    }
  }

  function closeExpandedRow() {
    setExpandedExperimentId(null)
    setEvents([])
    setArtifacts([])
  }

  async function handleCreated(experiment: ResearchExperiment) {
    await loadExperiments(0)
    setExpandedExperimentId(experiment.experiment_id)
    setEvents([])
    setArtifacts([])
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
            <p className="small">Official experiment pipeline and candidate-producing research runs.</p>
          </div>
          <div className="small">Admin: {adminEmail}</div>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      <div className="split-row">
        <div className="small">{loadingExperiments ? 'Refreshing experiments...' : 'Sorted by started date descending.'}</div>
        <div style={{ minWidth: 180 }}>
          <button className="secondary" type="button" onClick={() => void loadExperiments(offset)} disabled={loadingExperiments}>
            {loadingExperiments ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

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

      <NewExperimentForm adminEmail={adminEmail} onCreated={handleCreated} />
    </div>
  )
}

function normalizeExperiments(payload: unknown): ResearchExperiment[] {
  return readListPayload<ResearchExperiment>(payload, ['jobs', 'experiments', 'items', 'results']).filter(
    (item) => typeof item?.experiment_id === 'string'
  )
}

function normalizeEvents(payload: unknown): ResearchEvent[] {
  return readListPayload<ResearchEvent>(payload, ['events', 'items', 'results'])
}

function normalizeArtifacts(payload: unknown): ResearchArtifact[] {
  return readListPayload<ResearchArtifact>(payload, ['artifacts', 'items', 'results'])
}

function readListPayload<T>(payload: unknown, keys: string[]): T[] {
  if (Array.isArray(payload)) return payload as T[]
  const record = asRecord(payload)
  if (!record) return []
  for (const key of keys) {
    if (Array.isArray(record[key])) return record[key] as T[]
  }
  return []
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function toTimestamp(value?: string | null): number {
  if (!value) return 0
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}
