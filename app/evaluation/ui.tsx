'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { readApiError } from '@/lib/api-error'
import { requestClientJson } from '@/lib/client-json'
import { ApiErrorBox, EvidenceGap, JsonBlock, asRecord, readArrayPayload } from '@/app/components/workspace-data'
import { CopyableId } from '@/components/ui/CopyableId'

type SourceFilter = 'all' | 'official' | 'research' | 'registry' | 'user' | 'paper' | 'unknown'
type PrimaryChartSeries = 'equity_curve' | 'drawdown' | 'turnover' | 'ic_evolution' | 'rolling_ic' | 'cumulative_ic' | 'forward_returns' | 'signal_distribution' | 'confidence_calibration' | 'regime_breakdown' | 'decay_divergence'
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

type ChartPoint = {
  value: number
  xLabel: string
}

const SOURCE_TABS: Array<{ key: SourceFilter; label: string; disabled?: boolean }> = [
  { key: 'all', label: 'all' },
  { key: 'research', label: 'research' },
  { key: 'registry', label: 'registry' },
  { key: 'official', label: 'official' },
  { key: 'user', label: 'user', disabled: true },
]

const PRIMARY_CHART_SERIES: PrimaryChartSeries[] = [
  'equity_curve',
  'drawdown',
  'turnover',
  'ic_evolution',
  'rolling_ic',
  'cumulative_ic',
  'forward_returns',
  'signal_distribution',
  'confidence_calibration',
  'regime_breakdown',
  'decay_divergence',
]

const EVIDENCE_ITEMS: Array<{ key: EvidenceKey; label: string; short: string }> = [
  { key: 'equity', label: 'Equity curve', short: 'Eq' },
  { key: 'drawdown', label: 'Drawdown', short: 'DD' },
  { key: 'turnover', label: 'Turnover', short: 'To' },
  { key: 'ic', label: 'IC', short: 'IC' },
  { key: 'forward', label: 'Forward returns', short: 'Fw' },
]

function initialCandidateParam(): string | null {
  if (typeof window === 'undefined') return null
  const value = new URLSearchParams(window.location.search).get('candidate')
  return value?.trim() || null
}

export default function EvaluationWorkspace({ adminEmail }: { adminEmail: string }) {
  const [search, setSearch] = useState('')
  const [evaluationList, setEvaluationList] = useState<SignalEvaluationListResponse>({ candidates: [], sources: {}, gaps: [] })
  const [selectedReport, setSelectedReport] = useState<SignalEvaluationReport | null>(null)
  const [selectedRowId, setSelectedRowId] = useState<string | null>(() => initialCandidateParam())
  const [activeChartSeries, setActiveChartSeries] = useState<PrimaryChartSeries>('equity_curve')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reportError, setReportError] = useState<string | null>(null)

  const comparisonRows = useMemo(
    () => (evaluationList.candidates ?? []).map(candidateToRow),
    [evaluationList.candidates]
  )
  const filteredRows = useMemo(
    () => filterRows(comparisonRows, search).filter((row) => sourceFilter === 'all' || row.source === sourceFilter),
    [comparisonRows, search, sourceFilter]
  )
  const selectedRow = useMemo(
    () => comparisonRows.find((row) => row.id === selectedRowId) ?? null,
    [comparisonRows, selectedRowId]
  )
  const compareRows = useMemo(
    () => comparisonRows.filter((row) => compareIds.includes(row.id)).slice(0, 4),
    [comparisonRows, compareIds]
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
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const candidateParam = initialCandidateParam()
      if (candidateParam) setSelectedRowId(candidateParam)
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
    <div className="page-stack">
      <div className="card">
        <div className="split-row">
          <div>
            <h1>Evaluation</h1>
            <p className="small">Analyze candidate evidence, compare alternatives, and promote models from the same workspace.</p>
          </div>
          <div className="meta">
            <Link className="text-link" href="#compare">Compare</Link>
            <Link className="text-link" href="#promote">Promote</Link>
            <span className="small">Admin: {adminEmail}</span>
          </div>
        </div>
      </div>

      <ApiErrorBox error={error} />
      <ApiErrorBox error={reportError} />

      <section className="workspace-shell" aria-label="Evaluation workspace">
        <CandidateList
          compareIds={compareIds}
          loading={loading}
          rows={filteredRows}
          search={search}
          selectedReport={selectedReport}
          selectedRowId={selectedRow?.id ?? null}
          setCompareIds={setCompareIds}
          setSearch={setSearch}
          setSourceFilter={setSourceFilter}
          sourceFilter={sourceFilter}
          onSelect={setSelectedRowId}
        />
        <ChartWorkspace
          activeSeries={activeChartSeries}
          report={selectedReport}
          selectedRow={selectedRow}
          setActiveSeries={setActiveChartSeries}
        />
        <SelectedCandidatePanel
          adminEmail={adminEmail}
          loading={reportLoading}
          report={selectedReport}
          selectedRow={selectedRow}
        />
      </section>

      <CompareWorkspace rows={compareRows} />
    </div>
  )
}

function CandidateList({
  compareIds,
  loading,
  rows,
  search,
  selectedReport,
  selectedRowId,
  setCompareIds,
  setSearch,
  setSourceFilter,
  sourceFilter,
  onSelect,
}: {
  compareIds: string[]
  loading: boolean
  rows: ComparisonRow[]
  search: string
  selectedReport: SignalEvaluationReport | null
  selectedRowId: string | null
  setCompareIds: (value: string[]) => void
  setSearch: (value: string) => void
  setSourceFilter: (value: SourceFilter) => void
  sourceFilter: SourceFilter
  onSelect: (rowId: string) => void
}) {
  function toggleCompare(rowId: string) {
    if (compareIds.includes(rowId)) {
      setCompareIds(compareIds.filter((id) => id !== rowId))
      return
    }
    setCompareIds([...compareIds, rowId].slice(-4))
  }

  return (
    <aside className="workspace-column evaluation-list-panel">
      <div className="evaluation-list-header">
        <div className="evaluation-list-title">
          <h2>Candidates</h2>
          <span className="small">{loading ? 'Loading' : `${rows.length} rows`}</span>
        </div>
        <div className="compare-count-row">
          <span className="badge queued">{compareIds.length} selected for compare</span>
          {compareIds.length > 0 ? (
            <button className="text-link" onClick={() => setCompareIds([])} type="button">Clear</button>
          ) : null}
        </div>
        <input
          aria-label="Filter candidates by ticker or ID"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search ticker or ID"
        />
        <div className="candidate-source-tabs" role="tablist" aria-label="Candidate sources">
          {SOURCE_TABS.map((tab) => (
            <button
              aria-selected={sourceFilter === tab.key}
              className={sourceFilter === tab.key ? 'primary' : 'secondary'}
              disabled={tab.disabled}
              key={tab.key}
              onClick={() => setSourceFilter(tab.key)}
              role="tab"
              type="button"
              title={tab.disabled ? 'Future user-built model candidate source' : undefined}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="workspace-list">
        {rows.map((row) => {
          const selected = row.id === selectedRowId
          const evidence = selected ? evidenceFromReport(selectedReport, row.candidate) : evidenceFromCandidate(row.candidate)
          return (
            <div
              className={selected ? 'candidate-row active' : 'candidate-row'}
              key={row.id}
            >
              <strong className="candidate-ticker">{row.ticker}</strong>
              <span className="candidate-main">
                <span className="candidate-controls">
                  <label className="compare-check" onClick={(event) => event.stopPropagation()}>
                    <input
                      aria-label={`Compare ${row.displayId}`}
                      checked={compareIds.includes(row.id)}
                      onChange={() => toggleCompare(row.id)}
                      type="checkbox"
                    />
                    <span>Compare</span>
                  </label>
                  <button className="candidate-select-button" onClick={() => onSelect(row.id)} title={row.id} type="button">
                    {row.displayId}
                  </button>
                  {EVIDENCE_ITEMS.map((item) => (
                    <EvidenceDot key={item.key} present={evidence[item.key]} label={item.label} />
                  ))}
                </span>
              </span>
              <span className="candidate-score">{row.sharpe}</span>
            </div>
          )
        })}
        {!loading && rows.length === 0 ? (
          <div className="workspace-pane">
            <EvidenceGap
              reason={sourceFilter === 'user' ? 'User-built model candidates are reserved for a future backend contract.' : 'No candidates matched the current source and search filters.'}
              expected={sourceFilter === 'user' ? 'A future user candidate source on /analyst/signal-evaluation/candidates.' : 'Candidate rows from /analyst/signal-evaluation/candidates.'}
              title="Candidate evidence unavailable"
            />
          </div>
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
    <main className="workspace-column workspace-pane">
      <div className="chart-selector-row">
        <div>
          <h2>{selectedRow ? labelFromKey(activeSeries) : 'Evidence chart'}</h2>
          <p className="small">Full chart for the active evidence series.</p>
        </div>
        <span className="small">{selectedRow ? selectedRow.displayId : 'Select a candidate'}</span>
      </div>
      <ChartPanel seriesKey={activeSeries} report={report} selectedRow={selectedRow} />
      {selectedRow ? <MetricsRow report={report} selectedRow={selectedRow} /> : null}
      {selectedRow ? (
        <section className="series-scanner">
          <div className="series-scanner-heading">
            <h3>Series scanner</h3>
            <p className="small">Click a preview to change the full chart.</p>
          </div>
          <EvidenceSeriesGrid
            activeSeries={activeSeries}
            report={report}
            selectedRow={selectedRow}
            setActiveSeries={setActiveSeries}
          />
        </section>
      ) : null}
    </main>
  )
}

function EvidenceSeriesGrid({
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
  if (!selectedRow) return null

  return (
    <div className="series-grid" aria-label="Evidence series previews">
      {PRIMARY_CHART_SERIES.map((seriesKey) => {
        const series = report?.series?.[seriesKey]
        const chartPoints = pointsToChartPoints(Array.isArray(series?.points) ? series.points : [], series?.x_field, series?.y_field)
        const gap = gapForSeries(report, seriesKey)
        const active = seriesKey === activeSeries
        return (
          <button
            aria-pressed={active}
            className={active ? 'series-tile active' : 'series-tile'}
            key={seriesKey}
            onClick={() => setActiveSeries(seriesKey)}
            type="button"
          >
            <span className="series-tile-title">{labelFromKey(seriesKey)}</span>
            {chartPoints.length > 0 ? (
              <SparklinePreview points={chartPoints} />
            ) : (
              <span className="series-gap-card">
                <span>No data</span>
                <small>{gap?.message ?? 'No series points returned.'}</small>
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function SparklinePreview({ points }: { points: ChartPoint[] }) {
  const width = 160
  const height = 54
  const margin = 4
  const values = points.map((point) => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const plotWidth = width - margin * 2
  const plotHeight = height - margin * 2
  const polyline = points.map((point, index) => {
    const x = margin + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth)
    const y = margin + plotHeight - ((point.value - min) / span) * plotHeight
    return `${x},${y}`
  }).join(' ')
  return (
    <svg aria-hidden="true" className="series-sparkline" viewBox={`0 0 ${width} ${height}`}>
      <polyline fill="none" points={polyline} stroke="#2563eb" strokeWidth="3" />
    </svg>
  )
}

function ChartPanel({
  seriesKey,
  report,
  selectedRow,
}: {
  seriesKey: PrimaryChartSeries
  report: SignalEvaluationReport | null
  selectedRow: ComparisonRow | null
}) {
  if (!selectedRow) {
    return (
      <section className="chart-panel">
        <SelectionPrompt />
      </section>
    )
  }

  const series = report?.series?.[seriesKey]
  const points = Array.isArray(series?.points) ? series.points : []
  const chartPoints = pointsToChartPoints(points, series?.x_field, series?.y_field)
  const gap = gapForSeries(report, seriesKey)

  return (
    <section className="chart-panel">
      {chartPoints.length > 0 ? (
        <MiniSeriesChart points={chartPoints} />
      ) : (
        <div className="chart-empty">
          <EvidenceGap
            reason={gap?.message ?? 'The backend returned an empty series container for this candidate.'}
            expected={gap?.expected ?? labelFromKey(seriesKey)}
            title={`${labelFromKey(seriesKey)} unavailable`}
          />
        </div>
      )}
    </section>
  )
}

function SelectionPrompt() {
  return (
    <div className="small selection-prompt">
      Select a candidate from the list
    </div>
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
  const xLabels = buildChartTicks(points, plotWidth, margin.left)

  return (
    <svg aria-label="Signal evidence chart" className="mini-series-chart" role="img" viewBox={`0 0 ${width} ${height}`}>
      <line x1={margin.left} x2={margin.left} y1={margin.top} y2={margin.top + plotHeight} stroke="#94a3b8" />
      <line x1={margin.left} x2={margin.left + plotWidth} y1={margin.top + plotHeight} y2={margin.top + plotHeight} stroke="#94a3b8" />
      <text x={margin.left - 10} y={margin.top + 4} textAnchor="end" fill="#64748b" fontSize="11">{formatAxisValue(max)}</text>
      <text x={margin.left - 10} y={margin.top + plotHeight} textAnchor="end" fill="#64748b" fontSize="11">{formatAxisValue(min)}</text>
      {xLabels.map((item, index) => (
        <text key={`${item.label}-${index}`} x={item.x} y={height - 14} textAnchor={item.anchor} fill="#64748b" fontSize="10">
          {item.label}
        </text>
      ))}
      <polyline fill="none" points={polyline} stroke="#2563eb" strokeWidth="3" />
    </svg>
  )
}

function buildChartTicks(points: ChartPoint[], plotWidth: number, left: number): Array<{ x: number; label: string; anchor: 'start' | 'middle' | 'end' }> {
  if (points.length === 0) return []
  const tickCount = Math.min(6, points.length)
  const indexes = new Set<number>()
  for (let index = 0; index < tickCount; index += 1) {
    indexes.add(Math.round((index / Math.max(1, tickCount - 1)) * (points.length - 1)))
  }
  return [...indexes].sort((a, b) => a - b).map((pointIndex, tickIndex, all) => {
    const x = left + (points.length === 1 ? plotWidth / 2 : (pointIndex / (points.length - 1)) * plotWidth)
    return {
      x,
      label: points[pointIndex]?.xLabel ?? '',
      anchor: tickIndex === 0 ? 'start' : tickIndex === all.length - 1 ? 'end' : 'middle',
    }
  })
}

function MetricsRow({ report, selectedRow }: { report: SignalEvaluationReport | null; selectedRow: ComparisonRow | null }) {
  const metricRecords = [
    report?.metrics,
    report?.metrics_summary_json,
    report?.robustness_summary_json,
    selectedRow?.candidate.metrics,
  ]
  const items = [
    ['Rank IC', metricTextFromRecords(metricRecords, ['rank_ic', 'mean_rank_ic', 'ic_mean', 'mean_ic', 'ic_latest'])],
    ['IC IR', metricTextFromRecords(metricRecords, ['rank_ic_ir', 'rankICIR', 'ic_ir'])],
    ['Top-bottom spread', metricTextFromRecords(metricRecords, ['top_bottom_spread', 'topBottomSpread', 'long_short_spread', 'spread'])],
    ['MCPT p-value', metricTextFromRecords(metricRecords, ['mcpt_p_value', 'mcptPValue', 'mcpt_p', 'p_value'])],
    ['Hit rate', metricTextFromRecords(metricRecords, ['hit_rate', 'mean_hit_rate', 'directional_hit_rate'])],
    ['Fold +IC fraction', metricTextFromRecords(metricRecords, ['fold_positive_ic_fraction', 'folds_positive_ic_fraction', 'positive_ic_fraction', 'positive_fold_fraction'])],
    ['Sharpe', metricTextFromRecords(metricRecords, ['sharpe'])],
    ['Max DD', metricTextFromRecords(metricRecords, ['max_drawdown', 'drawdown'])],
    ['Ann. return', metricTextFromRecords(metricRecords, ['annual_return', 'ann_return', 'cagr'])],
    ['Turnover', metricTextFromRecords(metricRecords, ['turnover', 'avg_turnover', 'mean_turnover'])],
  ]
  const metricsUnavailable = Boolean(report) && items.every(([, value]) => value === '—')
  return (
    <>
      <div className="evaluation-metric-grid">
        {items.map(([label, value]) => (
          <div className="evaluation-metric-card" key={label}>
            <label>{label}</label>
            <div>{value}</div>
          </div>
        ))}
      </div>
      {metricsUnavailable ? (
        <div className="evaluation-gap-spacing">
          <EvidenceGap
            reason={gapForMetrics(report)?.message ?? 'Metrics are not present on this candidate report.'}
            expected={gapForMetrics(report)?.expected ?? 'metrics_summary_json and robustness_summary_json populated by backend evidence plumbing.'}
            title="Metrics unavailable"
          />
        </div>
      ) : null}
      {report ? <SummaryPanels report={report} /> : null}
    </>
  )
}

function SelectedCandidatePanel({ adminEmail, loading, report, selectedRow }: { adminEmail: string; loading: boolean; report: SignalEvaluationReport | null; selectedRow: ComparisonRow | null }) {
  if (!selectedRow) {
    return (
      <aside className="workspace-column evaluation-detail-empty">
        <SelectionPrompt />
      </aside>
    )
  }

  const candidate = report?.candidate ?? selectedRow.candidate
  const links = candidate.links ?? {}
  const evidence = evidenceFromReport(report, candidate)
  const missing = EVIDENCE_ITEMS.filter((item) => !evidence[item.key])

  return (
    <aside className="workspace-column evaluation-detail-panel">
      <div className="evaluation-detail-stack">
        <CopyableId id={candidate.candidate_id} maxLen={candidate.candidate_id.length} />
        <div className="meta">
          <span className={`badge ${sourceBadgeClass(sourceFromType(candidate.source_type))}`}>{candidate.source_type}</span>
          <span className="badge queued">{candidate.status ?? '—'}</span>
        </div>
        {loading ? <p className="small">Loading report...</p> : null}
      </div>

      <div className="evaluation-detail-stack">
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
        <h3 className="evidence-heading">Evidence</h3>
        <div className="evidence-list">
          {EVIDENCE_ITEMS.map((item) => (
            <div className="evidence-row" key={item.key}>
              <span>{item.label}</span>
              <span aria-label={evidence[item.key] ? 'present' : 'missing'}>{evidence[item.key] ? '✓' : '○'}</span>
            </div>
          ))}
        </div>
      </section>

      <div className={missing.length ? 'readiness-banner blocked' : 'readiness-banner ready'}>
        {missing.length ? `Blocked — ${missing.map((item) => item.label).join(', ')} missing` : 'Ready — all required evidence present'}
      </div>

      {missing.length ? (
        <EvidenceGap
          reason={firstGapMessage(report) ?? 'Some candidate evidence is structurally absent in the backend report.'}
          expected="Evaluation series and metrics evidence populated for this source type."
        />
      ) : null}

      <PromoteToEnvironment adminEmail={adminEmail} candidate={candidate} />

      <details className="debug-details">
        <summary>Debug</summary>
        <JsonBlock value={{ report: report ?? {}, candidate: candidate ?? {} }} />
      </details>
    </aside>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="detail-field">
      <label>{label}</label>
      <div>{value}</div>
    </div>
  )
}

function CompareWorkspace({ rows }: { rows: ComparisonRow[] }) {
  if (rows.length < 2) {
    return (
      <section className="card" id="compare">
        <h2>Compare</h2>
        <EvidenceGap
          reason="Select at least two candidates from the Candidates pane."
          expected="Side-by-side candidate metrics and common evidence surfaces."
          title="Comparison not ready"
        />
      </section>
    )
  }

  return (
    <section className="card" id="compare">
      <div className="split-row">
        <div>
          <h2>Compare</h2>
          <p className="small">Selected candidates, normalized to the metrics already returned by the candidate list.</p>
        </div>
        <span className="small">{rows.length} selected</span>
      </div>
      <div className="comparison-grid">
        {rows.map((row) => (
          <div className="card compact-card" key={row.id}>
            <div className="split-row">
              <div>
                <h3>{row.ticker}</h3>
                <CopyableId id={row.displayId} maxLen={12} />
              </div>
              <span className={`badge ${sourceBadgeClass(row.source)}`}>{row.sourceType}</span>
            </div>
            <div className="field-grid evaluation-summary-grid">
              <MetricField label="Sharpe" value={row.sharpe} />
              <MetricField label="Max DD" value={row.maxDrawdown} />
              <MetricField label="Annual return" value={row.annualReturn} />
              <MetricField label="Turnover" value={row.turnover} />
              <MetricField label="Horizon" value={row.horizon} />
              <MetricField label="Scope" value={row.tickerUniverse} />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function MetricField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label>{label}</label>
      <div className="field-value">{value}</div>
    </div>
  )
}

function SummaryPanels({ report }: { report: SignalEvaluationReport }) {
  const metricsSummary = report.metrics_summary_json
  const robustnessSummary = report.robustness_summary_json
  if (!metricsSummary && !robustnessSummary) {
    return (
      <div className="evaluation-summary-grid">
        <EvidenceGap
          reason={gapForMetrics(report)?.message ?? 'The report did not include metrics_summary_json or robustness_summary_json.'}
          expected={gapForMetrics(report)?.expected ?? 'Backend metrics and robustness summary evidence for this candidate.'}
          title="Summary evidence unavailable"
        />
      </div>
    )
  }

  return (
    <div className="feature-grid evaluation-summary-grid">
      <SummaryCard title="Metrics summary" value={metricsSummary} />
      <SummaryCard title="Robustness summary" value={robustnessSummary} />
    </div>
  )
}

function SummaryCard({ title, value }: { title: string; value?: Record<string, unknown> }) {
  return (
    <div className="card compact-card">
      <h3>{title}</h3>
      {value ? (
        <div className="field-grid">
          {Object.entries(value).slice(0, 6).map(([key, item]) => (
            <MetricField key={key} label={key} value={formatMetricValue(item)} />
          ))}
        </div>
      ) : (
        <EvidenceGap reason="This summary object was absent from the backend report." expected={title} />
      )}
    </div>
  )
}

function PromoteToEnvironment({ adminEmail, candidate }: { adminEmail: string; candidate: SignalEvaluationCandidateSummary }) {
  const [environment, setEnvironment] = useState('paper')
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [response, setResponse] = useState<unknown>(null)
  const registryCandidateId = candidate.links?.registry_candidate_id ?? candidate.candidate_id
  const bundleId = candidate.links?.bundle_id ?? ''
  const missingBundle = !bundleId

  async function submit() {
    setSubmitting(true)
    setError(null)
    setResponse(null)
    try {
      const promotion = await requestClientJson(`/api/registry/candidates/${encodeURIComponent(registryCandidateId)}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_status: environment === 'production' ? 'production_candidate' : 'promotion_ready',
          bundle_id: bundleId || null,
          actor: adminEmail,
          reason,
          confirmed,
        }),
      })
      setResponse({ promotion })
      if (environment) {
        const activation = await requestClientJson('/api/registry/active-pointers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            strategy_family: candidate.strategy_family,
            universe: candidate.universe,
            environment,
            active_candidate_id: registryCandidateId,
            active_bundle_id: bundleId || null,
            activated_by: adminEmail,
            activation_reason: reason,
            confirmed,
          }),
        })
        setResponse({ promotion, activation })
      }
    } catch (requestError) {
      setError(readApiError(requestError, 'Failed to submit promotion action.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="card compact-card" id="promote">
      <h3>Promote to environment</h3>
      <p className="small">Uses the existing registry promotion and active-pointer proxy routes.</p>
      {missingBundle ? (
        <EvidenceGap
          reason="No bundle_id is linked on this evaluation candidate."
          expected="candidate.links.bundle_id from Signal Evaluation or registry lineage before promotion can be safely submitted."
          title="Promotion blocked"
        />
      ) : null}
      <label htmlFor="promoteEnvironment">Environment</label>
      <select id="promoteEnvironment" value={environment} onChange={(event) => setEnvironment(event.target.value)}>
        <option value="paper">paper</option>
        <option value="production">production</option>
      </select>
      <label className="evaluation-gap-spacing" htmlFor="promoteReason">Reason</label>
      <textarea id="promoteReason" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
      <label className="check-row evaluation-gap-spacing">
        <input checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} type="checkbox" />
        <span>confirmed: I reviewed the evidence and want to submit this promotion.</span>
      </label>
      <button className="primary" disabled={submitting || missingBundle || !confirmed || !reason.trim()} onClick={() => void submit()} type="button">
        {submitting ? 'Submitting...' : 'Submit'}
      </button>
      <ApiErrorBox error={error} />
      {response ? <div className="success"><JsonBlock value={response} /></div> : null}
    </section>
  )
}

function EvidenceDot({ present, label }: { present: boolean; label: string }) {
  return (
    <span
      aria-label={`${label}: ${present ? 'present' : 'missing'}`}
      className={present ? 'evidence-dot present' : 'evidence-dot'}
      title={`${label}: ${present ? 'present' : 'missing'}`}
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
  const raw = candidate.candidate_id
  const lastHyphenSegment = raw.split('-').map((segment) => segment.trim()).filter(Boolean).at(-1)
  if (lastHyphenSegment && lastHyphenSegment !== raw) return lastHyphenSegment
  return raw.length > 8 ? raw.slice(-8) : raw
}

function evidenceFromCandidate(candidate: SignalEvaluationCandidateSummary): Record<EvidenceKey, boolean> {
  const metrics = candidate.metrics ?? {}
  return {
    equity: hasAny(metrics, ['equity', 'equity_curve', 'equity_points', 'cumulative_return']),
    drawdown: hasAny(metrics, ['drawdown', 'max_drawdown']),
    turnover: hasAny(metrics, ['turnover']),
    ic: hasAny(metrics, ['rank_ic', 'rank_ic_ir', 'ic', 'ic_mean', 'mean_ic', 'ic_latest']),
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
    ic: hasSeries(series.ic_evolution) || hasSeries(series.rolling_ic) || hasSeries(series.cumulative_ic) || hasAny(metrics, ['rank_ic', 'rank_ic_ir', 'ic', 'ic_mean', 'mean_ic', 'ic_latest']),
    forward: hasSeries(series.forward_returns) || hasAny(metrics, ['forward_return', 'mean_forward_return', 'forward_returns']),
  }
}

function gapForSeries(report: SignalEvaluationReport | null, seriesKey: string): SignalEvaluationGap | null {
  const series = report?.series?.[seriesKey]
  const seriesGap = Array.isArray(series?.gaps) ? series.gaps[0] : null
  if (seriesGap) return seriesGap
  const reportGaps = Array.isArray(report?.gaps) ? report.gaps : []
  return reportGaps.find((gap) => {
    const haystack = `${gap.source ?? ''} ${gap.code ?? ''} ${gap.message ?? ''}`.toLowerCase()
    return haystack.includes(seriesKey.toLowerCase()) || haystack.includes(labelFromKey(seriesKey).toLowerCase())
  }) ?? reportGaps[0] ?? null
}

function gapForMetrics(report: SignalEvaluationReport | null): SignalEvaluationGap | null {
  const reportGaps = Array.isArray(report?.gaps) ? report.gaps : []
  return reportGaps.find((gap) => {
    const haystack = `${gap.source ?? ''} ${gap.code ?? ''} ${gap.message ?? ''} ${gap.expected ?? ''}`.toLowerCase()
    return haystack.includes('metric') || haystack.includes('robustness')
  }) ?? reportGaps[0] ?? null
}

function firstGapMessage(report: SignalEvaluationReport | null): string | null {
  const gap = Array.isArray(report?.gaps) ? report.gaps[0] : null
  return gap?.message ?? null
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
      xLabel: formatChartDate(xValue),
    }
  }).filter((point): point is ChartPoint => Boolean(point))
}

function primaryTicker(candidate: SignalEvaluationCandidateSummary): string {
  const symbols = Array.isArray(candidate.symbols) ? candidate.symbols.filter(Boolean) : []
  if (symbols.length === 1) return symbols[0]
  if (symbols.length > 1) return multiSymbolLabel(candidate, symbols.length)
  if (candidate.universe) return candidate.universe
  return '—'
}

function scopeText(candidate: SignalEvaluationCandidateSummary): string {
  const symbols = Array.isArray(candidate.symbols) ? candidate.symbols.filter(Boolean) : []
  if (symbols.length === 1) return symbols[0]
  if (symbols.length > 1) return `${candidate.universe ?? candidate.strategy_family ?? 'Universe'} (${symbols.length} tickers)`
  return candidate.universe || '—'
}

function multiSymbolLabel(candidate: SignalEvaluationCandidateSummary, count: number): string {
  const strategy = candidate.strategy_family?.trim() || 'Strategy'
  const universe = candidate.universe?.trim() || 'Universe'
  return `${strategy} / ${universe} / ${count} tickers`
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

function metricTextFromRecords(records: Array<Record<string, unknown> | null | undefined>, keys: string[]): string {
  for (const record of records) {
    const value = readMetricValue(record, keys)
    if (value !== null) return formatMetricValue(value)
  }
  return '—'
}

function readMetricValue(record: Record<string, unknown> | null | undefined, keys: string[], depth = 0): unknown | null {
  if (!record || depth > 3) return null
  for (const key of keys) {
    const value = record[key]
    if (value !== null && value !== undefined && value !== '') return value
  }
  for (const value of Object.values(record)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue
    const nested = readMetricValue(value as Record<string, unknown>, keys, depth + 1)
    if (nested !== null) return nested
  }
  return null
}

function labelFromKey(key: string): string {
  const labels: Record<string, string> = {
    equity_curve: 'Equity curve',
    drawdown: 'Drawdown',
    turnover: 'Turnover',
    ic_evolution: 'IC evolution',
    rolling_ic: 'Rolling IC',
    cumulative_ic: 'Cumulative IC',
    forward_returns: 'Forward returns',
    signal_distribution: 'Signal distribution',
    confidence_calibration: 'Confidence calibration',
    regime_breakdown: 'Regime breakdown',
    decay_divergence: 'Decay divergence',
  }
  return labels[key] ?? key
}

function formatMetricValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(4)
  if (typeof value === 'string' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function formatAxisValue(value: number): string {
  if (Math.abs(value) >= 100) return value.toFixed(0)
  if (Math.abs(value) >= 10) return value.toFixed(1)
  return value.toFixed(2)
}

function formatChartDate(value: unknown): string {
  if (typeof value === 'number') return String(value)
  if (typeof value !== 'string') return String(value ?? '')
  const trimmed = value.trim()
  if (!trimmed) return ''
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return trimmed
  return parsed.toISOString().slice(0, 10)
}
