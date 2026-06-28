'use client'

import Link from 'next/link'
import { Fragment, useState, type CSSProperties } from 'react'
import { CopyableId } from '@/components/ui/CopyableId'
import { formatDate } from '@/lib/format'
import { EvidenceGap, JsonBlock } from '@/app/components/workspace-data'

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export type ResearchExperiment = {
  experiment_id: string
  run_type?: 'experiment' | 'batch'
  batch_id?: string | null
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
  payload_json?: unknown
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
        <h2>Launch & Runs library</h2>
        <span className="small">{experiments.length} runs</span>
      </div>
      <div className="table-wrap" style={{ marginTop: 12 }}>
        <table className="registry-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Type</th>
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
              const isBatch = experiment.run_type === 'batch'
              const expanded = expandedExperimentId === experiment.experiment_id
              return (
                <Fragment key={experiment.experiment_id}>
                  <tr
                    aria-expanded={expanded}
                    id={experimentAnchorId(experiment.experiment_id)}
                    onKeyDown={(event) => {
                      if (isBatch) return
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onToggle(experiment.experiment_id)
                      }
                    }}
                    onClick={() => {
                      if (!isBatch) onToggle(experiment.experiment_id)
                    }}
                    role={isBatch ? undefined : 'button'}
                    style={{ cursor: isBatch ? 'default' : 'pointer' }}
                    tabIndex={isBatch ? undefined : 0}
                  >
                    <td>
                      {experiment.run_type === 'batch' ? (
                        <span onClick={(event) => event.stopPropagation()}>
                          <Link className="text-link" href={`/research/batches/${encodeURIComponent(experiment.batch_id ?? experiment.experiment_id)}`}>
                            {experiment.batch_id ?? experiment.experiment_id}
                          </Link>
                        </span>
                      ) : (
                        <span onClick={(event) => event.stopPropagation()}>
                          <CopyableId id={experiment.experiment_id} maxLen={12} />
                        </span>
                      )}
                    </td>
                    <td><span className="badge queued">{experiment.run_type ?? 'experiment'}</span></td>
                    <td>{renderText(experiment.strategy_family ?? experiment.experiment_name)}</td>
                    <td>{tickerText(experiment)}</td>
                    <td>{renderText(experiment.horizon)}</td>
                    <td><StatusBadge status={experiment.status} /></td>
                    <td onClick={(event) => event.stopPropagation()}>
                      {isBatch ? (
                        <span title="Open the batch detail to inspect member candidates">—</span>
                      ) : (
                        <Link className="text-link" href={`/evaluation?candidate=research:${encodeURIComponent(experiment.experiment_id)}`}>
                          Evaluate →
                        </Link>
                      )}
                    </td>
                    <td>{formatDate(experiment.started_at ?? experiment.created_at ?? '')}</td>
                  </tr>
                  {expanded ? (
                    <tr key={`${experiment.experiment_id}-detail`}>
                      <td colSpan={8}>
                        <ExpandedExperimentDetail
                          artifacts={artifacts}
                          events={events}
                          experiment={experiment}
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
                <td colSpan={8}>
                  <EvidenceGap
                    reason="The research run contracts returned no experiment or batch rows."
                    expected="Rows from /analyst/research/experiments and /analyst/research/batches."
                    title="Research runs unavailable"
                  />
                </td>
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
  experiment,
  loading,
}: {
  artifacts: ResearchArtifact[]
  events: ResearchEvent[]
  experiment: ResearchExperiment
  loading: boolean
}) {
  if (loading) return <p className="small">Loading run detail...</p>
  const evalMetrics = readEvalMetrics(experiment)

  return (
    <div className="research-inline-detail" style={{ display: 'grid', gap: 16 }}>
      {evalMetrics.length > 0 ? (
        <div>
          <h4 style={{ marginBottom: 8 }}>Evaluation</h4>
          <div className="selection-summary">
            {evalMetrics.map((metric) => (
              <span key={metric.label}>{metric.label}: {formatMetric(metric.value)}</span>
            ))}
          </div>
        </div>
      ) : null}
      <div>
        <h4 style={{ marginBottom: 8 }}>Event log</h4>
        {events.length ? (
          <EventLog events={events} />
        ) : (
          <EvidenceGap
            reason="No event rows were returned for this run."
            expected="Rows from /analyst/research/experiments/{id}/events."
            title="Run events unavailable"
          />
        )}
      </div>
      <div>
        <h4 style={{ marginBottom: 8 }}>Artifacts</h4>
        {artifacts.length ? (
          <div style={{ display: 'grid', gap: 8 }}>
            {artifacts.map((artifact, index) => (
              <ArtifactRow artifact={artifact} key={artifact.artifact_id ?? `${artifact.artifact_ref}-${index}`} />
            ))}
          </div>
        ) : (
          <EvidenceGap
            reason="No artifact rows were returned for this run."
            expected="Rows from /analyst/research/experiments/{id}/artifacts."
            title="Run artifacts unavailable"
          />
        )}
      </div>
    </div>
  )
}

type EventLogItem =
  | { kind: 'step'; event: ResearchEvent }
  | { kind: 'error'; event: ResearchEvent }

const eventLogStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
}

const compactLineStyle: CSSProperties = {
  alignItems: 'center',
  borderBottom: '1px solid #e2e8f0',
  display: 'flex',
  gap: 8,
  minHeight: 32,
  padding: '5px 0',
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

const eventRowStyle: CSSProperties = {
  alignItems: 'center',
  borderBottom: '1px solid #e2e8f0',
  display: 'grid',
  gap: 8,
  gridTemplateColumns: 'minmax(180px, 1fr) minmax(90px, 140px) minmax(150px, 190px)',
  minHeight: 32,
  padding: '5px 0',
}

const artifactDetailsStyle: CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 6,
  background: '#fff',
}

const artifactSummaryStyle: CSSProperties = {
  cursor: 'pointer',
  listStyle: 'none',
  padding: '8px 10px',
}

const artifactJsonStyle: CSSProperties = {
  borderTop: '1px solid #e2e8f0',
  maxHeight: 420,
  overflow: 'auto',
  padding: 10,
}

const compactDateStyle: CSSProperties = {
  marginLeft: 'auto',
  minWidth: 150,
  textAlign: 'right',
  whiteSpace: 'nowrap',
}

function artifactName(artifact: ResearchArtifact): string {
  const ref = artifact.artifact_ref ?? artifact.artifact_hash ?? artifact.artifact_type
  if (!ref) return 'Artifact'
  const text = String(ref)
  return text.split('/').filter(Boolean).at(-1) ?? text
}

function ArtifactRow({ artifact }: { artifact: ResearchArtifact }) {
  const [open, setOpen] = useState(false)
  const payload = artifactPayload(artifact)

  return (
    <details
      className="research-artifact-row"
      onToggle={(event) => setOpen(event.currentTarget.open)}
      style={artifactDetailsStyle}
    >
      <summary style={artifactSummaryStyle}>
        <div style={compactLineStyle}>
          <div style={compactTextStyle}>
            <strong>{renderText(artifact.artifact_type ?? artifactName(artifact))}</strong>
            <span style={mutedTruncateStyle}>{renderText(artifact.artifact_ref ?? artifact.artifact_hash)}</span>
          </div>
          <div className="small" style={compactDateStyle}>{formatDate(artifact.created_at ?? '')}</div>
        </div>
      </summary>
      {open ? (
        <div style={artifactJsonStyle}>
          {payload === undefined ? (
            <EvidenceGap
              reason="This artifact row did not include payload_json."
              expected="payload_json on the artifact row returned by /analyst/research/experiments/{id}/artifacts."
              title="Artifact payload unavailable"
            />
          ) : (
            <JsonBlock value={payload} />
          )}
        </div>
      ) : null}
    </details>
  )
}

function artifactPayload(artifact: ResearchArtifact): unknown {
  if ('payload_json' in artifact) return artifact.payload_json
  if ('payload' in artifact) return artifact.payload
  if ('json' in artifact) return artifact.json
  return undefined
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

function readEvalMetrics(experiment: ResearchExperiment): Array<{ label: string; value: number | string }> {
  if (!isCompletedStatus(experiment.status)) return []
  const detail = experimentDetail(experiment)
  const result = asRecord(detail?.result_json) ?? asRecord(detail?.result) ?? asRecord(experiment.result_json) ?? asRecord(experiment.result)
  const metricRecords = [
    result,
    asRecord(result?.metrics),
    asRecord(result?.metric_evidence),
    asRecord(result?.metrics_summary_json),
    asRecord(result?.evaluation),
    asRecord(result?.eval),
    asRecord(result?.diagnostics),
    detail,
  ]
  const backtestRecords = [
    asRecord(result?.backtest),
    asRecord(result?.backtest_result),
    asRecord(result?.backtest_summary),
    asRecord(result?.strategy_backtest),
    ...metricRecords.map((record) => asRecord(record?.backtest)),
  ]

  return [
    { label: 'rank-IC', value: readMetric(metricRecords, ['rank_ic', 'rankIC', 'ic_mean', 'mean_rank_ic']) },
    { label: 'IC IR', value: readMetric(metricRecords, ['rank_ic_ir', 'rankICIR', 'ic_ir']) },
    { label: 'Top-bottom', value: readMetric(metricRecords, ['top_bottom_spread', 'topBottomSpread', 'spread', 'long_short_spread']) },
    { label: 'MCPT p', value: readMetric(metricRecords, ['mcpt_p_value', 'mcptPValue', 'p_value', 'mcpt_p']) },
    { label: 'Backtest IR', value: readMetric(backtestRecords, ['information_ratio', 'ir', 'backtest_ir']) },
    { label: 'Return vs bench', value: readMetric(backtestRecords, ['return_vs_benchmark', 'excess_return', 'benchmark_excess_return']) },
    { label: 'Max drawdown', value: readMetric(backtestRecords, ['max_drawdown', 'maxDrawdown']) },
    { label: 'Avg turnover', value: readMetric(backtestRecords, ['avg_turnover', 'turnover', 'mean_turnover']) },
  ].filter((metric): metric is { label: string; value: number | string } => metric.value !== null)
}

function readMetric(records: Array<Record<string, unknown> | null>, keys: string[]): number | string | null {
  for (const record of records) {
    if (!record) continue
    for (const key of keys) {
      const value = record[key]
      if (typeof value === 'number' && Number.isFinite(value)) return value
      if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : value.trim()
      }
    }
  }
  return null
}

function formatMetric(value: number | string): string {
  if (typeof value === 'string') return value
  if (Math.abs(value) >= 100) return value.toFixed(1)
  return value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
}

function isCompletedStatus(status?: string | null): boolean {
  return ['done', 'completed', 'succeeded', 'success'].includes(String(status ?? '').trim().toLowerCase())
}

function EventLog({ events }: { events: ResearchEvent[] }) {
  const [expanded, setExpanded] = useState(false)
  const visibleEvents = expanded ? events : events.slice(0, 16)
  const hiddenCount = events.length - visibleEvents.length

  return (
    <div style={eventLogStyle}>
      {visibleEvents.map((event, index) => {
        const item: EventLogItem = isErrorEvent(event) ? { kind: 'error', event } : { kind: 'step', event }
        return item.kind === 'error'
          ? <EventErrorBlock item={item} key={event.event_id ?? `error-${index}`} />
          : <EventStepRow event={item.event} key={event.event_id ?? `event-${index}`} />
      })}
      {hiddenCount > 0 ? (
        <button className="text-link" type="button" onClick={() => setExpanded(true)} style={showMoreButtonStyle}>
          Show {hiddenCount} more steps
        </button>
      ) : null}
      {expanded && events.length > 16 ? (
        <button className="text-link" type="button" onClick={() => setExpanded(false)} style={showMoreButtonStyle}>
          Show fewer steps
        </button>
      ) : null}
    </div>
  )
}

function EventStepRow({ event }: { event: ResearchEvent }) {
  return (
    <div className="research-event-row" style={eventRowStyle}>
      <strong style={mutedTruncateStyle}>{renderText(event.step ?? event.event_type)}</strong>
      <span><StatusBadge status={event.status ?? event.event_type} /></span>
      <span className="small" style={compactDateStyle}>{formatDate(event.created_at ?? '')}</span>
    </div>
  )
}

function EventErrorBlock({ item }: { item: Extract<EventLogItem, { kind: 'error' }> }) {
  const [expanded, setExpanded] = useState(false)
  const message = renderText(item.event.message)
  const longMessage = isLongErrorMessage(message)

  return (
    <div style={errorBlockStyle}>
      <div style={errorHeaderStyle}>
        <span aria-hidden="true" style={errorDotStyle}>×</span>
        <strong style={errorTitleStyle}>{renderText(item.event.event_type ?? item.event.step)}</strong>
      </div>
      <div style={expanded ? errorMessageStyle : clampedErrorMessageStyle}>
        {message}
      </div>
      {longMessage ? (
        <button
          className="text-link"
          type="button"
          onClick={() => setExpanded((value) => !value)}
          style={showMoreButtonStyle}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      ) : null}
    </div>
  )
}

const errorBlockStyle: CSSProperties = {
  background: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: 6,
  display: 'grid',
  gap: 6,
  padding: 10,
}

const errorHeaderStyle: CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  gap: 8,
  minWidth: 0,
}

const errorDotStyle: CSSProperties = {
  alignItems: 'center',
  color: '#dc2626',
  display: 'inline-flex',
  flex: '0 0 auto',
  fontSize: 13,
  fontWeight: 800,
  height: 14,
  justifyContent: 'center',
  lineHeight: 1,
  width: 14,
}

const errorTitleStyle: CSSProperties = {
  color: '#b91c1c',
  overflowWrap: 'anywhere',
}

const errorMessageStyle: CSSProperties = {
  color: '#b91c1c',
  maxWidth: '100%',
  overflow: 'hidden',
  overflowWrap: 'anywhere',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
}

const clampedErrorMessageStyle: CSSProperties = {
  ...errorMessageStyle,
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 3,
}

const showMoreButtonStyle: CSSProperties = {
  justifySelf: 'start',
  padding: 0,
  width: 'auto',
}

function isErrorEvent(event: ResearchEvent): boolean {
  const text = `${eventName(event)} ${String(event.message ?? '').toLowerCase()}`
  return text.includes('_failed') || text.includes('_error') || text.includes('error') || text.includes('failed') || text.includes('failure')
}

function eventName(event: ResearchEvent): string {
  return String(event.event_type ?? event.step ?? '').trim().toLowerCase()
}

function isLongErrorMessage(message: string): boolean {
  return message.length > 220 || message.split('\n').length > 3
}
