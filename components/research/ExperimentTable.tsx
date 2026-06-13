'use client'

import Link from 'next/link'
import { Fragment, type CSSProperties } from 'react'
import { CopyableId } from '@/components/ui/CopyableId'
import { formatDate } from '@/lib/format'

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export type ResearchExperiment = {
  experiment_id: string
  status?: string | null
  experiment_name?: string | null
  strategy_family?: string | null
  universe?: string | null
  symbols?: string[] | null
  horizon?: string | null
  created_at?: string | null
  started_at?: string | null
  finished_at?: string | null
  result_json?: JsonValue
  result?: JsonValue
  candidate_id?: string | null
  [key: string]: unknown
}

export type ResearchEvent = {
  event_id?: string | null
  created_at?: string | null
  event_type?: string | null
  step?: string | null
  status?: string | null
  message?: string | null
  [key: string]: unknown
}

export type ResearchArtifact = {
  artifact_id?: string | null
  created_at?: string | null
  artifact_type?: string | null
  artifact_ref?: string | null
  artifact_hash?: string | null
  [key: string]: unknown
}

type Props = {
  experiments: ResearchExperiment[]
  expandedExperimentId: string | null
  events: ResearchEvent[]
  artifacts: ResearchArtifact[]
  loadingDetail: boolean
  onToggle: (experimentId: string) => void
}

export function ExperimentTable({
  experiments,
  expandedExperimentId,
  events,
  artifacts,
  loadingDetail,
  onToggle,
}: Props) {
  return (
    <div className="card">
      <div className="split-row">
        <h2>Experiment library</h2>
        <span className="small">{experiments.length} experiments</span>
      </div>
      <div className="table-wrap" style={{ marginTop: 12 }}>
        <table className="registry-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Model / strategy</th>
              <th>Ticker</th>
              <th>Horizon</th>
              <th>Status</th>
              <th>Output</th>
              <th>Started</th>
            </tr>
          </thead>
          <tbody>
            {experiments.map((experiment) => {
              const candidateId = readCandidateId(experiment)
              const expanded = expandedExperimentId === experiment.experiment_id
              return (
                <Fragment key={experiment.experiment_id}>
                  <tr
                    aria-expanded={expanded}
                    id={experimentAnchorId(experiment.experiment_id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onToggle(experiment.experiment_id)
                      }
                    }}
                    onClick={() => onToggle(experiment.experiment_id)}
                    role="button"
                    style={{ cursor: 'pointer' }}
                    tabIndex={0}
                  >
                    <td onClick={(event) => event.stopPropagation()}>
                      <CopyableId id={experiment.experiment_id} maxLen={12} />
                    </td>
                    <td>{renderText(experiment.strategy_family ?? experiment.experiment_name)}</td>
                    <td>{tickerText(experiment)}</td>
                    <td>{renderText(experiment.horizon)}</td>
                    <td><StatusBadge status={experiment.status} /></td>
                    <td onClick={(event) => event.stopPropagation()}>
                      {candidateId ? (
                        <Link className="text-link" href={`/signals?candidate_id=${encodeURIComponent(candidateId)}`}>
                          View candidate →
                        </Link>
                      ) : '—'}
                    </td>
                    <td>{formatDate(experiment.started_at ?? experiment.created_at ?? '')}</td>
                  </tr>
                  {expanded ? (
                    <tr key={`${experiment.experiment_id}-detail`}>
                      <td colSpan={7}>
                        <ExpandedExperimentDetail
                          artifacts={artifacts}
                          events={events}
                          loading={loadingDetail}
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
            {experiments.length === 0 ? (
              <tr>
                <td className="small" colSpan={7}>No experiments returned.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ExpandedExperimentDetail({
  artifacts,
  events,
  loading,
}: {
  artifacts: ResearchArtifact[]
  events: ResearchEvent[]
  loading: boolean
}) {
  if (loading) return <p className="small">Loading events and artifacts...</p>

  return (
    <div className="research-inline-detail">
      <div>
        <h4>Event log</h4>
        {events.length ? (
          <div className="list-stack">
            {events.map((event, index) => (
              <div className="list-row" key={event.event_id ?? `${event.created_at}-${index}`}>
                <div>
                  <strong>{renderText(event.event_type ?? event.step)}</strong>
                  <div className="small">{renderText(event.message)}</div>
                </div>
                <div className="small">{formatDate(event.created_at ?? '')}</div>
              </div>
            ))}
          </div>
        ) : <p className="small">No events returned.</p>}
      </div>
      <div>
        <h4>Artifacts</h4>
        {artifacts.length ? (
          <div className="list-stack">
            {artifacts.map((artifact, index) => (
              <div className="list-row" key={artifact.artifact_id ?? `${artifact.artifact_ref}-${index}`}>
                <div>
                  <strong>{renderText(artifact.artifact_type)}</strong>
                  <div className="small">{renderText(artifact.artifact_ref ?? artifact.artifact_hash)}</div>
                </div>
                <div className="small">{formatDate(artifact.created_at ?? '')}</div>
              </div>
            ))}
          </div>
        ) : <p className="small">No artifacts returned.</p>}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status?: string | null }) {
  const normalized = String(status ?? '').trim().toLowerCase()
  const style = statusStyle(normalized)
  return <span className="badge" style={style}>{renderText(status)}</span>
}

function statusStyle(status: string): CSSProperties {
  if (['running', 'queued', 'pending', 'submitted', 'in_progress'].includes(status)) return { background: '#dbeafe', color: '#1d4ed8' }
  if (['done', 'completed', 'succeeded', 'success'].includes(status)) return { background: '#dcfce7', color: '#166534' }
  if (status === 'failed' || status === 'error') return { background: '#fee2e2', color: '#991b1b' }
  if (status === 'cancelled' || status === 'canceled') return { background: '#e5e7eb', color: '#4b5563' }
  return { background: '#e5e7eb', color: '#4b5563' }
}

function tickerText(experiment: ResearchExperiment): string {
  if (Array.isArray(experiment.symbols) && experiment.symbols.length > 0) return experiment.symbols.join(', ')
  return renderText(experiment.universe)
}

export function readCandidateId(experiment: ResearchExperiment): string | null {
  const roots = [
    experiment,
    asRecord(experiment.result_json),
    asRecord(experiment.result),
    asRecord(asRecord(experiment.result_json)?.output),
    asRecord(asRecord(experiment.result)?.output),
  ].filter((value): value is Record<string, unknown> => Boolean(value))

  for (const root of roots) {
    const value = root.candidate_id ?? root.candidateId
    if (typeof value === 'string' && value.trim()) return value
  }
  return null
}

export function experimentAnchorId(experimentId: string): string {
  return `experiment-${encodeURIComponent(experimentId)}`
}

function renderText(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}
