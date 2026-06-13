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
                    <td>
                      <span onClick={(event) => event.stopPropagation()}>
                        <CopyableId id={experiment.experiment_id} maxLen={12} />
                      </span>
                    </td>
                    <td>{renderText(experiment.strategy_family ?? experiment.experiment_name)}</td>
                    <td>{tickerText(experiment)}</td>
                    <td>{renderText(experiment.horizon)}</td>
                    <td><StatusBadge status={experiment.status} /></td>
                    <td onClick={(event) => event.stopPropagation()}>
                      {candidateId ? (
                        <Link className="text-link" href={`/signals?candidate=${encodeURIComponent(candidateId)}`}>
                          View in Signals →
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
                          failed={isFailedStatus(experiment.status)}
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
  failed,
  loading,
}: {
  artifacts: ResearchArtifact[]
  events: ResearchEvent[]
  failed: boolean
  loading: boolean
}) {
  if (loading) return <p className="small">Loading events and artifacts...</p>
  const highlightedEventIndex = failed ? highlightedFailureEventIndex(events) : -1

  return (
    <div className="research-inline-detail" style={{ display: 'grid', gap: 16 }}>
      <div>
        <h4 style={{ marginBottom: 8 }}>Event log</h4>
        {events.length ? (
          <div style={compactScrollStyle}>
            {events.map((event, index) => {
              const highlighted = index === highlightedEventIndex
              return (
                <div style={highlighted ? highlightedLineStyle : compactLineStyle} key={event.event_id ?? `${event.created_at}-${index}`}>
                  <span aria-hidden="true" style={eventDotStyle(event)} />
                  <div style={compactTextStyle}>
                    <strong>{renderText(event.event_type ?? event.step)}</strong>
                    <span style={highlighted ? errorDescriptionStyle : mutedTruncateStyle}>{renderText(event.message)}</span>
                  </div>
                  <div className="small" style={compactDateStyle}>{formatDate(event.created_at ?? '')}</div>
                </div>
              )
            })}
          </div>
        ) : <p className="small">No events returned.</p>}
      </div>
      <div>
        <h4 style={{ marginBottom: 8 }}>Artifacts</h4>
        {artifacts.length ? (
          <div style={{ display: 'grid', gap: 0 }}>
            {artifacts.map((artifact, index) => (
              <div style={compactLineStyle} key={artifact.artifact_id ?? `${artifact.artifact_ref}-${index}`}>
                <div style={compactTextStyle}>
                  <strong>{artifactName(artifact)}</strong>
                  <span style={mutedTruncateStyle}>{renderText(artifact.artifact_ref ?? artifact.artifact_hash)}</span>
                </div>
                <div className="small" style={compactDateStyle}>{formatDate(artifact.created_at ?? '')}</div>
              </div>
            ))}
          </div>
        ) : <p className="small">No artifacts returned.</p>}
      </div>
    </div>
  )
}

const compactScrollStyle: CSSProperties = {
  display: 'grid',
  gap: 0,
  maxHeight: 200,
  overflowY: 'scroll',
}

const compactLineStyle: CSSProperties = {
  alignItems: 'center',
  borderBottom: '1px solid #e2e8f0',
  display: 'flex',
  gap: 8,
  minHeight: 32,
  padding: '5px 0',
}

const highlightedLineStyle: CSSProperties = {
  ...compactLineStyle,
  background: '#fef2f2',
  borderBottom: '1px solid #fecaca',
  borderRadius: 6,
  padding: '5px 8px',
}

const compactTextStyle: CSSProperties = {
  alignItems: 'baseline',
  display: 'flex',
  flex: '1 1 auto',
  gap: 8,
  minWidth: 0,
  overflow: 'hidden',
}

const mutedTruncateStyle: CSSProperties = {
  color: '#64748b',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const errorDescriptionStyle: CSSProperties = {
  ...mutedTruncateStyle,
  color: '#b91c1c',
  fontWeight: 600,
}

const compactDateStyle: CSSProperties = {
  marginLeft: 'auto',
  minWidth: 150,
  textAlign: 'right',
  whiteSpace: 'nowrap',
}

function eventDotStyle(event: ResearchEvent): CSSProperties {
  return {
    background: eventDotColor(event),
    borderRadius: 999,
    flex: '0 0 auto',
    height: 8,
    width: 8,
  }
}

function eventDotColor(event: ResearchEvent): string {
  const name = String(event.event_type ?? event.step ?? '').trim().toLowerCase()
  const status = String(event.status ?? '').trim().toLowerCase()
  const text = `${name} ${status} ${String(event.message ?? '').toLowerCase()}`
  if (name.endsWith('_completed') || name.endsWith('_done') || ['completed', 'done', 'succeeded', 'success'].includes(status)) return '#16a34a'
  if (text.includes('failed') || text.includes('error')) return '#dc2626'
  if (name.endsWith('_started') || name.endsWith('_enqueued') || ['started', 'enqueued', 'queued', 'submitted', 'running'].includes(status)) return '#2563eb'
  return '#94a3b8'
}

function artifactName(artifact: ResearchArtifact): string {
  const ref = artifact.artifact_ref ?? artifact.artifact_hash ?? artifact.artifact_type
  if (!ref) return 'Artifact'
  const text = String(ref)
  return text.split('/').filter(Boolean).at(-1) ?? text
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
  const detail = experimentDetail(experiment)
  return firstNonEmptyString([
    detail?.candidate_id,
    detail?.output_candidate_id,
    detail?.registered_candidate_id,
    detail?.candidate,
    asRecord(detail?.output)?.candidate_id,
    asRecord(detail?.result)?.candidate_id,
  ])
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

function experimentDetail(experiment: ResearchExperiment): Record<string, unknown> | null {
  const response = asRecord(experiment.detail_response)
  return asRecord(response?.experiment) ?? response ?? asRecord(experiment)
}

function firstNonEmptyString(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return null
}

function isFailedStatus(status?: string | null): boolean {
  return ['failed', 'error', 'failure'].includes(String(status ?? '').trim().toLowerCase())
}

function highlightedFailureEventIndex(events: ResearchEvent[]): number {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (isFailureEventType(events[index])) return index
  }
  return events.length - 1
}

function isFailureEventType(event: ResearchEvent | undefined): boolean {
  const type = String(event?.event_type ?? event?.step ?? '').toLowerCase()
  return type.includes('error') || type.includes('failed') || type.includes('failure')
}
