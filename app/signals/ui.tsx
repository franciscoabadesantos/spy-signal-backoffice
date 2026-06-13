'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { readApiError } from '@/lib/api-error'
import { requestClientJson } from '@/lib/client-json'
import { formatDate } from '@/lib/format'
import { ApiErrorBox, EmptyState, JsonBlock, asRecord, readArrayPayload } from '@/app/components/workspace-data'
import { CopyableId } from '@/components/ui/CopyableId'

type SourceFilter = 'official' | 'research' | 'registry' | 'paper' | 'unknown'
type PrimaryChartSeries = 'equity_curve' | 'drawdown' | 'turnover'
type EvidenceKey = 'equity' | 'drawdown' | 'turnover' | 'ic' | 'forward'

type SignalEvaluationGap = {
  code?: string
  severity?: 'info' | 'warning' | 'blocked' | string
  source?: string | null
  message?: string
  expected?: string | null
}

type SignalEvaluationSeries = {
  key?: string
  label?: string
  points?: Array<Record<string, unknown>>
  x_field?: string
  y_field?: string
  unit?: string | null
  gaps?: SignalEvaluationGap[]
}

type SignalEvaluationLinks = {
  research_experiment_id?: string | null
  registry_candidate_id?: string | null
  bundle_id?: string | null
  readiness_report_ids?: string[]
  artifact_refs?: Array<Record<string, unknown>>
}

type SignalEvaluationCandidateSummary = {
  candidate_id: string
  source_type: 'research_experiment' | 'registry_candidate' | 'official_signal' | 'readiness_report' | 'active_pointer'
  display_name?: string | null
  status?: string | null
  strategy_family?: string | null
  universe?: string | null
  symbols?: string[]
  horizon?: string | null
  created_at?: string | null
  updated_at?: string | null
  metrics?: Record<string, unknown>
  readiness?: Record<string, unknown>
  links?: SignalEvaluationLinks
  gaps?: SignalEvaluationGap[]
}

type SignalEvaluationListResponse = {
  candidates?: SignalEvaluationCandidateSummary[]
  limit?: number
  offset?: number
  total?: number | null
  sources?: Record<string, unknown>
  gaps?: SignalEvaluationGap[]
}

type SignalEvaluationReport = {
  candidate?: SignalEvaluationCandidateSummary
  metrics?: Record<string, unknown>
  metrics_summary_json?: Record<string, unknown>
  robustness_summary_json?: Record<string, unknown>
  readiness_reports?: Array<Record<string, unknown>>
  active_pointers?: Array<Record<string, unknown>>
  lineage?: Record<string, unknown>
  artifacts?: Array<Record<string, unknown>>
  series?: Record<string, SignalEvaluationSeries>
  gaps?: SignalEvaluationGap[]
  raw_evidence?: Record<string, unknown>
}

type ComparisonRow = {
  id: string
  displayId: string
  source: SourceFilter
  sourceType: string
  label: string
  ticker: string
  tickerUniverse: string
  horizon: string
  sharpe: string
  maxDrawdown: string
  annualReturn: string
  turnover: string
  candidate: SignalEvaluationCandidateSummary
  raw: unknown
}

type MonitorState = {
  history: unknown[]
  lastFlips: Record<string, unknown>
  flips: unknown[]
}

type ChartPoint = {
  value: number
  xLabel: string
}

const PRIMARY_CHART_SERIES: PrimaryChartSeries[] = ['equity_curve', 'drawdown', 'turnover']

const EVIDENCE_ITEMS: Array<{ key: EvidenceKey; label: string; short: string }> = [
  { key: 'equity', label: 'Equity curve', short: 'Eq' },
  { key: 'drawdown', label: 'Drawdown', short: 'DD' },
  { key: 'turnover', label: 'Turnover', short: 'To' },
  { key: 'ic', label: 'IC', short: 'IC' },
  { key: 'forward', label: 'Forward returns', short: 'Fw' },
]

const signalPageStyle = {
  display: 'grid',
  gap: 16,
  minWidth: 0,
} satisfies React.CSSProperties

const signalShellStyle = {
  display: 'grid',
  gridTemplateColumns: '260px minmax(0, 1fr) 220px',
  minHeight: 620,
  height: 'calc(100vh - 128px)',
  minWidth: 0,
  overflow: 'hidden',
  border: '1px solid #dbe3f0',
  borderRadius: 8,
  background: '#fff',
} satisfies React.CSSProperties

const columnStyle = {
  minWidth: 0,
  minHeight: 0,
  overflowY: 'auto',
  overflowX: 'hidden',
} satisfies React.CSSProperties

export default function SignalsWorkspace({ adminEmail }: { adminEmail: string }) {
  const [search, setSearch] = useState('')
  const [evaluationList, setEvaluationList] = useState<SignalEvaluationListResponse>({ candidates: [], sources: {}, gaps: [] })
  const [monitor, setMonitor] = useState<MonitorState>({ history: [], lastFlips: {}, flips: [] })
  const [selectedReport, setSelectedReport] = useState<SignalEvaluationReport | null>(null)
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [activeChartSeries, setActiveChartSeries] = useState<PrimaryChartSeries>('equity_curve')
  const [loading, setLoading] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reportError, setReportError] = useState<string | null>(null)
  const [monitorError, setMonitorError] = useState<string | null>(null)

  const comparisonRows = useMemo(
    () => (evaluationList.candidates ?? []).map(candidateToRow),
    [evaluationList.candidates]
  )
  const filteredRows = useMemo(
    () => filterRows(comparisonRows, search),
    [comparisonRows, search]
  )
  const selectedRow = useMemo(
    () => comparisonRows.find((row) => row.id === selectedRowId) ?? filteredRows[0] ?? null,
    [comparisonRows, filteredRows, selectedRowId]
  )

  async function loadEvaluation() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '200', offset: '0', include_official: 'true' })
      const payload = await requestClientJson(`/api/signal-evaluation/candidates?${params.toString()}`)
      const record = asRecord(payload)
      setEvaluationList({
        candidates: readArrayPayload(payload, 'candidates') as SignalEvaluationCandidateSummary[],
        limit: readNumber(record?.limit),
        offset: readNumber(record?.offset),
        total: readNullableNumber(record?.total),
        sources: asRecord(record?.sources) ?? {},
        gaps: readArrayPayload(payload, 'gaps') as SignalEvaluationGap[],
      })
    } catch (err) {
      setError(readApiError(err, 'Failed to load Signal Evaluation V1 candidates.'))
    } finally {
      setLoading(false)
    }
  }

  async function loadMonitor() {
    setMonitorError(null)
    const today = new Date().toISOString().slice(0, 10)
    const [historyResult, lastFlipsResult, flipsResult] = await Promise.allSettled([
      requestClientJson('/api/signals/history/SPY?limit=200'),
      requestClientJson('/api/signals/last-flips?tickers=SPY'),
      requestClientJson(`/api/signals/flips?date=${encodeURIComponent(today)}&tickers=SPY`),
    ])

    const failures = [historyResult, lastFlipsResult, flipsResult].filter((result) => result.status === 'rejected')
    if (failures.length > 0) {
      setMonitorError('One or more signal monitor endpoints failed.')
    }

    setMonitor({
      history: historyResult.status === 'fulfilled' && Array.isArray(historyResult.value) ? historyResult.value : [],
      lastFlips: lastFlipsResult.status === 'fulfilled' ? asRecord(lastFlipsResult.value) ?? {} : {},
      flips: flipsResult.status === 'fulfilled' && Array.isArray(flipsResult.value) ? flipsResult.value : [],
    })
  }

  async function loadReport(candidateId: string) {
    setReportLoading(true)
    setReportError(null)
    try {
      const payload = await requestClientJson(`/api/signal-evaluation/candidates/${encodeURIComponent(candidateId)}/report`)
      setSelectedReport(asRecord(payload) as SignalEvaluationReport)
    } catch (err) {
      setReportError(readApiError(err, 'Failed to load Signal Evaluation V1 report.'))
      setSelectedReport(null)
    } finally {
      setReportLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadEvaluation()
      void loadMonitor()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!selectedRow?.id) {
      const timer = window.setTimeout(() => setSelectedReport(null), 0)
      return () => window.clearTimeout(timer)
    }
    const timer = window.setTimeout(() => {
      void loadReport(selectedRow.id)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [selectedRow?.id])

  return (
    <div style={signalPageStyle}>
      <ApiErrorBox error={error} />
      <ApiErrorBox error={reportError} />

      <section style={signalShellStyle} aria-label="Signals workspace">
        <CandidateList
          loading={loading}
          rows={filteredRows}
          search={search}
          selectedReport={selectedReport}
          selectedRowId={selectedRow?.id ?? null}
          setSearch={setSearch}
          onSelect={setSelectedRowId}
        />
        <ChartWorkspace
          activeSeries={activeChartSeries}
          report={selectedReport}
          selectedRow={selectedRow}
          setActiveSeries={setActiveChartSeries}
        />
        <SelectedCandidatePanel
          loading={reportLoading}
          report={selectedReport}
          selectedRow={selectedRow}
        />
      </section>

      <SignalMonitor monitor={monitor} error={monitorError} selectedTicker={selectedRow?.ticker || 'SPY'} />
      <div className="small">Admin: {adminEmail}</div>
    </div>
  )
}

function CandidateList({
  loading,
  rows,
  search,
  selectedReport,
  selectedRowId,
  setSearch,
  onSelect,
}: {
  loading: boolean
  rows: ComparisonRow[]
  search: string
  selectedReport: SignalEvaluationReport | null
  selectedRowId: string | null
  setSearch: (value: string) => void
  onSelect: (rowId: string) => void
}) {
  return (
    <aside style={{ ...columnStyle, borderRight: '1px solid #e2e8f0', background: '#f8fafc' }}>
      <div style={{ padding: 12, borderBottom: '1px solid #e2e8f0', display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 14 }}>Candidates</h2>
          <span className="small">{loading ? 'Loading' : rows.length}</span>
        </div>
        <input
          aria-label="Filter candidates by ticker or ID"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search ticker or ID"
        />
        <div className="small" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {EVIDENCE_ITEMS.map((item) => (
            <span key={item.key} style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
              <EvidenceDot present={true} label={item.label} />
              {item.short}
            </span>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid' }}>
        {rows.map((row) => {
          const selected = row.id === selectedRowId
          const evidence = selected ? evidenceFromReport(selectedReport, row.candidate) : evidenceFromCandidate(row.candidate)
          return (
            <button
              key={row.id}
              onClick={() => onSelect(row.id)}
              type="button"
              style={{
                display: 'grid',
                gridTemplateColumns: '44px minmax(0, 1fr) 52px',
                gap: 8,
                alignItems: 'center',
                width: '100%',
                border: 0,
                borderBottom: '1px solid #e2e8f0',
                borderRadius: 0,
                padding: '9px 10px',
                background: selected ? '#eff6ff' : '#fff',
                color: '#0f172a',
                textAlign: 'left',
              }}
            >
              <strong style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.ticker}</strong>
              <span style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                <span title={row.id}>
                  <CopyableId id={row.displayId} maxLen={12} />
                </span>
                <span style={{ display: 'flex', gap: 4 }}>
                  {EVIDENCE_ITEMS.map((item) => (
                    <EvidenceDot key={item.key} present={evidence[item.key]} label={item.label} />
                  ))}
                </span>
              </span>
              <span style={{ justifySelf: 'end', fontFamily: 'IBM Plex Mono, SFMono-Regular, Consolas, monospace', fontSize: 12 }}>{row.sharpe}</span>
            </button>
          )
        })}
        {!loading && rows.length === 0 ? (
          <div style={{ padding: 12 }}><EmptyState>No candidates match the current search.</EmptyState></div>
        ) : null}
      </div>
    </aside>
  )
}

function ChartWorkspace({
  activeSeries,
  report,
  selectedRow,
  setActiveSeries,
}: {
  activeSeries: PrimaryChartSeries
  report: SignalEvaluationReport | null
  selectedRow: ComparisonRow | null
  setActiveSeries: (series: PrimaryChartSeries) => void
}) {
  return (
    <main style={{ ...columnStyle, padding: 16 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }} role="tablist" aria-label="Signal evidence charts">
        {PRIMARY_CHART_SERIES.map((series) => (
          <button
            key={series}
            aria-selected={activeSeries === series}
            onClick={() => setActiveSeries(series)}
            role="tab"
            type="button"
            style={{
              width: 'auto',
              minHeight: 34,
              borderColor: activeSeries === series ? '#0f172a' : '#cbd5e1',
              background: activeSeries === series ? '#0f172a' : '#fff',
              color: activeSeries === series ? '#fff' : '#475569',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {labelFromKey(series)}
          </button>
        ))}
      </div>
      <ChartPanel seriesKey={activeSeries} report={report} />
      <MetricsRow report={report} selectedRow={selectedRow} />
    </main>
  )
}

function ChartPanel({ seriesKey, report }: { seriesKey: PrimaryChartSeries; report: SignalEvaluationReport | null }) {
  const series = report?.series?.[seriesKey]
  const points = Array.isArray(series?.points) ? series.points : []
  const chartPoints = pointsToChartPoints(points, series?.x_field, series?.y_field)

  return (
    <section style={{ minWidth: 0, width: '100%', minHeight: 360, display: 'grid', alignContent: 'stretch' }}>
      {chartPoints.length > 0 ? (
        <MiniSeriesChart points={chartPoints} />
      ) : (
        <div style={{ minHeight: 320, display: 'grid', placeItems: 'center', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 8 }}>
          No data available for this series
        </div>
      )}
    </section>
  )
}

function MiniSeriesChart({ points }: { points: ChartPoint[] }) {
  const width = 760
  const height = 300
  const margin = { top: 18, right: 16, bottom: 38, left: 56 }
  const plotWidth = width - margin.left - margin.right
  const plotHeight = height - margin.top - margin.bottom
  const values = points.map((point) => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const polyline = points.map((point, index) => {
    const x = margin.left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth)
    const y = margin.top + plotHeight - ((point.value - min) / span) * plotHeight
    return `${x},${y}`
  }).join(' ')
  const middleIndex = Math.floor((points.length - 1) / 2)
  const xLabels = [
    { x: margin.left, label: points[0]?.xLabel ?? '' },
    { x: margin.left + plotWidth / 2, label: points[middleIndex]?.xLabel ?? '' },
    { x: margin.left + plotWidth, label: points[points.length - 1]?.xLabel ?? '' },
  ]

  return (
    <svg aria-label="Signal evidence chart" role="img" viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 320, display: 'block', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff' }}>
      <line x1={margin.left} x2={margin.left} y1={margin.top} y2={margin.top + plotHeight} stroke="#94a3b8" />
      <line x1={margin.left} x2={margin.left + plotWidth} y1={margin.top + plotHeight} y2={margin.top + plotHeight} stroke="#94a3b8" />
      <text x={margin.left - 10} y={margin.top + 4} textAnchor="end" fill="#64748b" fontSize="11">{formatAxisValue(max)}</text>
      <text x={margin.left - 10} y={margin.top + plotHeight} textAnchor="end" fill="#64748b" fontSize="11">{formatAxisValue(min)}</text>
      {xLabels.map((item, index) => (
        <text key={`${item.label}-${index}`} x={item.x} y={height - 14} textAnchor={index === 0 ? 'start' : index === 1 ? 'middle' : 'end'} fill="#64748b" fontSize="11">
          {item.label}
        </text>
      ))}
      <polyline fill="none" points={polyline} stroke="#2563eb" strokeWidth="3" />
    </svg>
  )
}

function MetricsRow({ report, selectedRow }: { report: SignalEvaluationReport | null; selectedRow: ComparisonRow | null }) {
  const metrics = report?.metrics ?? selectedRow?.candidate.metrics ?? {}
  const items = [
    ['Sharpe', metricText(metrics, ['sharpe'])],
    ['Max DD', metricText(metrics, ['max_drawdown', 'drawdown'])],
    ['Ann. return', metricText(metrics, ['annual_return', 'ann_return', 'cagr'])],
    ['Turnover', metricText(metrics, ['turnover'])],
  ]
  const metricsUnavailable = Boolean(report) && items.every(([, value]) => value === '—')
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginTop: 12 }}>
        {items.map(([label, value]) => (
          <div key={label} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, background: '#f8fafc' }}>
            <label>{label}</label>
            <div style={{ fontFamily: 'IBM Plex Mono, SFMono-Regular, Consolas, monospace', fontSize: 14 }}>{value}</div>
          </div>
        ))}
      </div>
      {metricsUnavailable ? (
        <p className="small" style={{ marginTop: 8, color: '#64748b' }}>Metrics not yet available for this candidate</p>
      ) : null}
    </>
  )
}

function SelectedCandidatePanel({ loading, report, selectedRow }: { loading: boolean; report: SignalEvaluationReport | null; selectedRow: ComparisonRow | null }) {
  if (!selectedRow) {
    return (
      <aside style={{ ...columnStyle, borderLeft: '1px solid #e2e8f0', padding: 12 }}>
        <EmptyState>Select a candidate.</EmptyState>
      </aside>
    )
  }

  const candidate = report?.candidate ?? selectedRow.candidate
  const links = candidate.links ?? {}
  const evidence = evidenceFromReport(report, candidate)
  const missing = EVIDENCE_ITEMS.filter((item) => !evidence[item.key])

  return (
    <aside style={{ ...columnStyle, borderLeft: '1px solid #e2e8f0', padding: 12, display: 'grid', gap: 14, alignContent: 'start' }}>
      <div style={{ display: 'grid', gap: 8 }}>
        <CopyableId id={candidate.candidate_id} maxLen={candidate.candidate_id.length} />
        <div className="meta">
          <span className={`badge ${sourceBadgeClass(sourceFromType(candidate.source_type))}`}>{candidate.source_type}</span>
          <span className="badge queued">{candidate.status ?? '—'}</span>
        </div>
        {loading ? <p className="small">Loading report...</p> : null}
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <DetailRow label="Ticker" value={selectedRow.ticker} />
        <DetailRow label="Horizon" value={candidate.horizon ?? '—'} />
        <DetailRow label="Scope" value={scopeText(candidate)} />
        <DetailRow
          label="Research experiment"
          value={links.research_experiment_id ? <Link className="text-link" href={`/research?experiment_id=${encodeURIComponent(links.research_experiment_id)}`}>{links.research_experiment_id}</Link> : '—'}
        />
        <DetailRow
          label="Registry candidate"
          value={links.registry_candidate_id ? <Link className="text-link" href={`/registry/candidates/${encodeURIComponent(links.registry_candidate_id)}`}>{links.registry_candidate_id}</Link> : '—'}
        />
      </div>

      <section>
        <h3 style={{ fontSize: 13, margin: '0 0 8px' }}>Evidence</h3>
        <div style={{ display: 'grid', gap: 6 }}>
          {EVIDENCE_ITEMS.map((item) => (
            <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12 }}>
              <span>{item.label}</span>
              <span aria-label={evidence[item.key] ? 'present' : 'missing'}>{evidence[item.key] ? '✓' : '○'}</span>
            </div>
          ))}
        </div>
      </section>

      <div style={{ padding: 10, borderRadius: 8, border: `1px solid ${missing.length ? '#fde68a' : '#a7f3d0'}`, background: missing.length ? '#fffbeb' : '#ecfdf5', color: missing.length ? '#92400e' : '#065f46', fontSize: 12, fontWeight: 700 }}>
        {missing.length ? `Blocked — ${missing.map((item) => item.label).join(', ')} missing` : 'Ready — all required evidence present'}
      </div>

      <details style={{ marginTop: 4 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>Debug</summary>
        <JsonBlock value={{ report: report ?? {}, candidate: candidate ?? {} }} />
      </details>
    </aside>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
      <label style={{ margin: 0 }}>{label}</label>
      <div style={{ minWidth: 0, overflowWrap: 'anywhere', fontSize: 12 }}>{value}</div>
    </div>
  )
}

function SignalMonitor({ monitor, error, selectedTicker }: { monitor: MonitorState; error: string | null; selectedTicker: string }) {
  const historyRows = monitor.history.map((row) => {
    const record = asRecord(row) ?? {}
    return {
      date: formatDate(readText(record, ['signal_date', 'signalDate', 'date', 'as_of_date'])),
      direction: readText(record, ['direction', 'signal', 'stance']),
      score: readText(record, ['signal_strength', 'score', 'conviction', 'prob_side']),
    }
  })
  const lastFlipRows = Object.entries(monitor.lastFlips).map(([ticker, lastFlipDate]) => ({
    ticker,
    date: formatDate(String(lastFlipDate ?? '')),
  }))
  const flipRows = monitor.flips.map((row) => {
    const record = asRecord(row) ?? {}
    return {
      ticker: readText(record, ['ticker', 'symbol']),
      from: readText(record, ['fromDirection', 'from_direction']),
      to: readText(record, ['toDirection', 'to_direction']),
      date: formatDate(readText(record, ['signalDate', 'signal_date', 'date'])),
      conviction: readText(record, ['conviction', 'score']),
    }
  })

  return (
    <section className="card monitor-section">
      <div className="split-row">
        <div>
          <h2>Signal monitor</h2>
          <p className="small">Current endpoint-backed signal behavior.</p>
        </div>
        <span className="small">{selectedTicker}</span>
      </div>
      <ApiErrorBox error={error} />
      <div className="feature-grid">
        <SimpleTable title={`Signal history: ${selectedTicker}`} rows={historyRows} columns={[
          ['date', 'Date'],
          ['direction', 'Direction'],
          ['score', 'Score / strength'],
        ]} emptyLabel="No signal history returned." />
        <SimpleTable title="Last flips" rows={lastFlipRows} columns={[
          ['ticker', 'Ticker'],
          ['date', 'Last flip date'],
        ]} emptyLabel="No last flips returned." />
        {flipRows.length > 0 ? (
          <SimpleTable title="Flip events by date" rows={flipRows} columns={[
            ['ticker', 'Ticker'],
            ['from', 'From'],
            ['to', 'To'],
            ['date', 'Date'],
            ['conviction', 'Conviction'],
          ]} />
        ) : null}
      </div>
    </section>
  )
}

function SimpleTable({
  title,
  rows,
  columns,
  emptyLabel = 'No rows returned.',
}: {
  title: string
  rows: Array<Record<string, string>>
  columns: Array<[string, string]>
  emptyLabel?: string
}) {
  return (
    <div className="card compact-card">
      <h3>{title}</h3>
      <div className="table-wrap">
        <table className="registry-table">
          <thead>
            <tr>
              {columns.map(([, label]) => <th key={label}>{label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {columns.map(([key]) => <td key={key}>{row[key] || '—'}</td>)}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="small">{emptyLabel}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function EvidenceDot({ present, label }: { present: boolean; label: string }) {
  return (
    <span
      aria-label={`${label}: ${present ? 'present' : 'missing'}`}
      title={`${label}: ${present ? 'present' : 'missing'}`}
      style={{
        display: 'inline-block',
        width: 7,
        height: 7,
        borderRadius: 999,
        border: '1px solid #64748b',
        background: present ? '#0f172a' : 'transparent',
      }}
    />
  )
}

function candidateToRow(candidate: SignalEvaluationCandidateSummary): ComparisonRow {
  const metrics = candidate.metrics ?? {}
  const source = sourceFromType(candidate.source_type)
  const ticker = primaryTicker(candidate)
  return {
    id: candidate.candidate_id,
    displayId: candidateDisplayId(candidate),
    source,
    sourceType: candidate.source_type,
    label: candidate.display_name ?? candidate.candidate_id,
    ticker,
    tickerUniverse: scopeText(candidate),
    horizon: candidate.horizon ?? '—',
    sharpe: metricText(metrics, ['sharpe']),
    maxDrawdown: metricText(metrics, ['max_drawdown', 'drawdown']),
    annualReturn: metricText(metrics, ['annual_return', 'ann_return', 'cagr']),
    turnover: metricText(metrics, ['turnover']),
    candidate,
    raw: candidate,
  }
}

function filterRows(rows: ComparisonRow[], search: string): ComparisonRow[] {
  const query = search.trim().toLowerCase()
  if (!query) return rows
  return rows.filter((row) => (
    row.id.toLowerCase().includes(query)
    || row.displayId.toLowerCase().includes(query)
    || row.ticker.toLowerCase().includes(query)
    || row.tickerUniverse.toLowerCase().includes(query)
  ))
}

function candidateDisplayId(candidate: SignalEvaluationCandidateSummary): string {
  const record = candidate as SignalEvaluationCandidateSummary & Record<string, unknown>
  const preferred = [
    record.short_id,
    record.shortId,
    record.candidate_short_id,
    record.candidateShortId,
    record.name,
    record.candidate_name,
    candidate.display_name,
  ].find((value) => typeof value === 'string' && value.trim())

  if (typeof preferred === 'string' && preferred.trim()) return preferred.trim()

  const raw = candidate.candidate_id
  const segments = raw.split(/[:/|#]+/).map((segment) => segment.trim()).filter(Boolean)
  const last = segments.at(-1)
  if (last && last !== raw) return last

  const experimentMatch = raw.match(/(?:experiment|exp)[_-]?([a-z0-9]+)$/i)
  if (experimentMatch?.[1]) return `exp-${experimentMatch[1]}`

  return raw
}

function evidenceFromCandidate(candidate: SignalEvaluationCandidateSummary): Record<EvidenceKey, boolean> {
  const metrics = candidate.metrics ?? {}
  return {
    equity: hasAny(metrics, ['equity', 'equity_curve', 'equity_points', 'cumulative_return']),
    drawdown: hasAny(metrics, ['drawdown', 'max_drawdown']),
    turnover: hasAny(metrics, ['turnover']),
    ic: hasAny(metrics, ['ic', 'ic_mean', 'mean_ic', 'ic_latest']),
    forward: hasAny(metrics, ['forward_return', 'mean_forward_return', 'forward_returns']),
  }
}

function evidenceFromReport(report: SignalEvaluationReport | null, candidate: SignalEvaluationCandidateSummary): Record<EvidenceKey, boolean> {
  const fallback = evidenceFromCandidate(candidate)
  const series = report?.series ?? {}
  const metrics = { ...(candidate.metrics ?? {}), ...(report?.metrics ?? {}) }
  return {
    equity: hasSeries(series.equity_curve) || fallback.equity,
    drawdown: hasSeries(series.drawdown) || fallback.drawdown,
    turnover: hasSeries(series.turnover) || fallback.turnover,
    ic: hasSeries(series.ic_evolution) || hasSeries(series.rolling_ic) || hasSeries(series.cumulative_ic) || hasAny(metrics, ['ic', 'ic_mean', 'mean_ic', 'ic_latest']),
    forward: hasSeries(series.forward_returns) || hasAny(metrics, ['forward_return', 'mean_forward_return', 'forward_returns']),
  }
}

function hasSeries(series?: SignalEvaluationSeries): boolean {
  return Array.isArray(series?.points) && series.points.length > 0
}

function hasAny(record: Record<string, unknown>, keys: string[]): boolean {
  return keys.some((key) => {
    const value = record[key]
    return value !== null && value !== undefined && value !== ''
  })
}

function pointsToChartPoints(points: Array<Record<string, unknown>>, xField = 'date', yField = 'value'): ChartPoint[] {
  return points.map((point, index) => {
    const value = point[yField] ?? point.value ?? point.y
    if (typeof value !== 'number' || !Number.isFinite(value)) return null
    const xValue = point[xField] ?? point.date ?? point.signal_date ?? point.as_of_date ?? point.timestamp ?? String(index + 1)
    return {
      value,
      xLabel: typeof xValue === 'string' ? formatDate(xValue) : String(xValue),
    }
  }).filter((point): point is ChartPoint => Boolean(point))
}

function primaryTicker(candidate: SignalEvaluationCandidateSummary): string {
  const symbols = Array.isArray(candidate.symbols) ? candidate.symbols.filter(Boolean) : []
  if (symbols[0]) return symbols[0]
  if (candidate.universe) return candidate.universe
  return '—'
}

function scopeText(candidate: SignalEvaluationCandidateSummary): string {
  const symbols = Array.isArray(candidate.symbols) ? candidate.symbols.join(', ') : ''
  return symbols || candidate.universe || '—'
}

function sourceFromType(sourceType: SignalEvaluationCandidateSummary['source_type']): SourceFilter {
  if (sourceType === 'official_signal') return 'official'
  if (sourceType === 'research_experiment') return 'research'
  if (sourceType === 'registry_candidate' || sourceType === 'readiness_report' || sourceType === 'active_pointer') return 'registry'
  return 'unknown'
}

function sourceBadgeClass(source: SourceFilter): string {
  if (source === 'official') return 'completed'
  if (source === 'registry') return 'queued'
  if (source === 'paper') return 'cancelled'
  if (source === 'research') return 'running'
  return 'backend-gap'
}

function readText(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key]
    if (value === null || value === undefined || value === '') continue
    if (Array.isArray(value)) return value.join(', ')
    return String(value)
  }
  return '—'
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined
}

function readNullableNumber(value: unknown): number | null | undefined {
  if (value === null) return null
  return typeof value === 'number' ? value : undefined
}

function metricText(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key]
    if (value === null || value === undefined || value === '') continue
    if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(4)
    return String(value)
  }
  return '—'
}

function labelFromKey(key: string): string {
  const labels: Record<string, string> = {
    equity_curve: 'Equity curve',
    drawdown: 'Drawdown',
    turnover: 'Turnover',
  }
  return labels[key] ?? key
}

function formatAxisValue(value: number): string {
  if (Math.abs(value) >= 100) return value.toFixed(0)
  if (Math.abs(value) >= 10) return value.toFixed(1)
  return value.toFixed(2)
}
