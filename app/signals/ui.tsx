'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { readApiError } from '@/lib/api-error'
import { requestClientJson } from '@/lib/client-json'
import { ApiErrorBox, DynamicTable, EmptyState, JsonBlock, asRecord, readArrayPayload } from '@/app/components/workspace-data'
import { CopyableId } from '@/components/ui/CopyableId'

type SourceFilter = 'all' | 'official' | 'research' | 'registry' | 'paper' | 'unknown'

type SignalEvaluationGap = {
  code?: string
  severity?: 'info' | 'warning' | 'blocked' | string
  source?: string | null
  message?: string
  expected?: string | null
  evidence_ref?: string | null
  metadata?: Record<string, unknown>
}

type SignalEvaluationSeries = {
  key?: string
  label?: string
  points?: Array<Record<string, unknown>>
  x_field?: string
  y_field?: string
  unit?: string | null
  source?: string | null
  gaps?: SignalEvaluationGap[]
}

type SignalEvaluationLinks = {
  research_experiment_id?: string | null
  backend_job_id?: string | null
  registry_candidate_id?: string | null
  bundle_id?: string | null
  readiness_report_ids?: string[]
  active_pointer_ids?: string[]
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
  metrics?: Record<string, number | null>
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
  metrics?: Record<string, number | null>
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
  source: SourceFilter
  sourceType: string
  label: string
  tickerUniverse: string
  horizon: string
  latestSignal: string
  confidence: string
  coverage: string
  icMean: string
  icLatest: string
  icTrend: string
  icDecay: string
  hitRate: string
  forwardReturn: string
  sharpeSortino: string
  maxDrawdown: string
  turnover: string
  stability: string
  dataQualityStatus: string
  evidenceStatus: string
  registryStatus: string
  lastUpdated: string
  actionHref?: string
  candidate: SignalEvaluationCandidateSummary
  raw: unknown
}

type MonitorState = {
  screener: unknown[]
  history: unknown[]
  lastFlips: Record<string, unknown>
  flips: unknown[]
  composition: unknown
}

const HISTORY_COLUMNS = [
  { key: 'signal_date', label: 'Date / As Of', keys: ['signal_date', 'signalDate', 'date', 'as_of_date'] },
  { key: 'direction', label: 'Signal / Direction', keys: ['direction', 'signal', 'stance'] },
  { key: 'signal_strength', label: 'Score / Strength', keys: ['signal_strength', 'score', 'conviction', 'prob_side'] },
  { key: 'prediction_horizon', label: 'Horizon', keys: ['prediction_horizon', 'predictionHorizon'] },
  { key: 'realized_return', label: 'Realized Return', keys: ['realized_return', 'forward_return'] },
  { key: 'model_version_id', label: 'Model / Version', keys: ['model_version_id', 'modelVersionId', 'retrain_id'] },
]

const SCREENER_COLUMNS = [
  { key: 'ticker', label: 'Ticker' },
  { key: 'name', label: 'Name' },
  { key: 'direction', label: 'Direction' },
  { key: 'conviction', label: 'Conviction' },
  { key: 'signalDate', label: 'Signal Date', keys: ['signalDate', 'signal_date'] },
  { key: 'predictionHorizon', label: 'Horizon', keys: ['predictionHorizon', 'prediction_horizon'] },
  { key: 'price', label: 'Price' },
  { key: 'changePercent', label: 'Change %', keys: ['changePercent', 'change_percent'] },
]

const FLIP_COLUMNS = [
  { key: 'ticker', label: 'Ticker' },
  { key: 'fromDirection', label: 'From', keys: ['fromDirection', 'from_direction'] },
  { key: 'toDirection', label: 'To', keys: ['toDirection', 'to_direction'] },
  { key: 'signalDate', label: 'Signal Date', keys: ['signalDate', 'signal_date'] },
  { key: 'conviction', label: 'Conviction' },
]

const COMPARISON_COLUMNS = [
  'Source',
  'Signal / Model / Candidate ID',
  'Ticker / Universe',
  'Horizon',
  'Latest signal',
  'Conviction / confidence',
  'Coverage',
  'IC mean',
  'IC latest',
  'IC trend',
  'IC decay',
  'Hit rate',
  'Forward return',
  'Sharpe / Sortino',
  'Max drawdown',
  'Turnover',
  'Stability / robustness',
  'Data quality status',
  'Evidence status',
  'Registry status',
  'Last updated',
  'Action / detail',
]

const CHART_SERIES = [
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
  'official_disagreement',
  'decay_divergence',
] as const

export default function SignalsWorkspace({ adminEmail }: { adminEmail: string }) {
  const [tickerText, setTickerText] = useState('SPY')
  const [historyTicker, setHistoryTicker] = useState('SPY')
  const [flipDate, setFlipDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [lookbackRows, setLookbackRows] = useState(90)
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [strategyFamilyFilter, setStrategyFamilyFilter] = useState('')
  const [universeFilter, setUniverseFilter] = useState('')
  const [horizonFilter, setHorizonFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [limit, setLimit] = useState(200)
  const [offset, setOffset] = useState(0)
  const [includeOfficial, setIncludeOfficial] = useState(true)
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [testTicker, setTestTicker] = useState('SPY')
  const [testHorizon, setTestHorizon] = useState('20d')
  const [modelFamily, setModelFamily] = useState('binary_directional')
  const [featureSet, setFeatureSet] = useState('operator_selected')
  const [evaluationMode, setEvaluationMode] = useState('backtest')
  const [compareAgainst, setCompareAgainst] = useState('current_official')
  const [outputTarget, setOutputTarget] = useState('research_run')
  const [evaluationList, setEvaluationList] = useState<SignalEvaluationListResponse>({ candidates: [], sources: {}, gaps: [] })
  const [monitor, setMonitor] = useState<MonitorState>({ screener: [], history: [], lastFlips: {}, flips: [], composition: {} })
  const [selectedReport, setSelectedReport] = useState<SignalEvaluationReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)
  const [monitorError, setMonitorError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reportError, setReportError] = useState<string | null>(null)

  const tickers = useMemo(() => parseTickers(tickerText), [tickerText])
  const selectedHistoryTicker = historyTicker.trim().toUpperCase() || tickers[0] || 'SPY'
  const comparisonRows = useMemo(
    () => (evaluationList.candidates ?? []).map(candidateToRow),
    [evaluationList.candidates]
  )
  const filteredRows = useMemo(
    () => filterRows(comparisonRows, { search, horizonFilter }),
    [comparisonRows, search, horizonFilter]
  )
  const selectedRow = useMemo(
    () => comparisonRows.find((row) => row.id === selectedRowId) ?? filteredRows[0] ?? null,
    [comparisonRows, filteredRows, selectedRowId]
  )

  async function loadEvaluation() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      const ticker = tickers[0]
      if (ticker) params.set('ticker', ticker)
      if (sourceFilter !== 'all') params.set('source', sourceFilter)
      if (strategyFamilyFilter.trim()) params.set('strategy_family', strategyFamilyFilter.trim())
      if (universeFilter.trim()) params.set('universe', universeFilter.trim())
      if (statusFilter.trim()) params.set('status', statusFilter.trim())
      params.set('limit', String(Math.max(1, Math.min(500, limit || 200))))
      params.set('offset', String(Math.max(0, offset || 0)))
      params.set('include_official', String(includeOfficial))
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
    const normalizedTickers = tickers.length > 0 ? tickers : ['SPY']
    const tickerParam = normalizedTickers.join(',')
    setMonitorError(null)
    try {
      const [screenerPayload, historyPayload, lastFlipsPayload, flipsPayload, compositionPayload] = await Promise.all([
        requestClientJson(`/api/screener/signals?tickers=${encodeURIComponent(tickerParam)}&limit=200`),
        requestClientJson(`/api/signals/history/${encodeURIComponent(selectedHistoryTicker)}?limit=200`),
        requestClientJson(`/api/signals/last-flips?tickers=${encodeURIComponent(tickerParam)}`),
        requestClientJson(`/api/signals/flips?date=${encodeURIComponent(flipDate)}&tickers=${encodeURIComponent(tickerParam)}`),
        requestClientJson(`/api/signals/composition?tickers=${encodeURIComponent(tickerParam)}&lookback_rows=${encodeURIComponent(String(lookbackRows))}`),
      ])
      setMonitor({
        screener: Array.isArray(screenerPayload) ? screenerPayload : [],
        history: Array.isArray(historyPayload) ? historyPayload : [],
        lastFlips: asRecord(lastFlipsPayload) ?? {},
        flips: Array.isArray(flipsPayload) ? flipsPayload : [],
        composition: compositionPayload,
      })
    } catch (err) {
      setMonitorError(readApiError(err, 'Signal monitor endpoints failed. Evaluation results may still be usable.'))
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

  function refreshAll() {
    void loadEvaluation()
    void loadMonitor()
  }

  useEffect(() => {
    const timer = window.setTimeout(refreshAll, 0)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedRow?.id) {
      const timer = window.setTimeout(() => {
        setSelectedReport(null)
      }, 0)
      return () => window.clearTimeout(timer)
    }
    const timer = window.setTimeout(() => {
      void loadReport(selectedRow.id)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [selectedRow?.id])

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    refreshAll()
  }

  const lastFlipRows = Object.entries(monitor.lastFlips).map(([ticker, lastFlipDate]) => ({ ticker, lastFlipDate }))
  const compositionRows = Object.entries(asRecord(monitor.composition) ?? {}).map(([ticker, payload]) => ({
    ticker,
    ...(asRecord(payload) ?? { payload }),
  }))

  return (
    <div className="page-stack">
      <div className="hero-panel">
        <div>
          <p className="eyebrow">Signal Evaluation Lab</p>
          <h1>Compare backend-normalized signal evaluation candidates without inventing evaluation data.</h1>
          <p className="hero-copy">
            The workbench and selected model report now use finance-backend Signal Evaluation V1. The monitor section still shows raw current signal endpoints for operational context.
          </p>
        </div>
        <div className="hero-actions">
          <div className="small">Admin: {adminEmail}</div>
          <Link className="hero-link" href="/research">Open Research Lab</Link>
          <Link className="hero-link secondary-link" href="/contracts">Signal Contracts</Link>
        </div>
      </div>

      <form className="card evaluation-controls" onSubmit={onSubmit}>
        <div>
          <h2>Evaluation Scope</h2>
          <p className="small">Candidate comparison loads from GET /analyst/signal-evaluation/candidates. Signal monitor data loads separately and does not drive the evaluation workbench.</p>
        </div>
        <div className="field-grid">
          <div>
            <label>Tickers / universe symbols</label>
            <input value={tickerText} onChange={(event) => setTickerText(event.target.value)} placeholder="SPY, AAPL, MSFT" />
          </div>
          <div>
            <label>Source</label>
            <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as SourceFilter)}>
              <option value="all">All sources</option>
              <option value="official">Official</option>
              <option value="research">Research</option>
              <option value="registry">Registry</option>
              <option value="paper">Paper</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
          <div>
            <label>Strategy family</label>
            <input value={strategyFamilyFilter} onChange={(event) => setStrategyFamilyFilter(event.target.value)} placeholder="optional" />
          </div>
          <div>
            <label>Universe</label>
            <input value={universeFilter} onChange={(event) => setUniverseFilter(event.target.value)} placeholder="optional" />
          </div>
          <div>
            <label>Status</label>
            <input value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} placeholder="optional" />
          </div>
          <div>
            <label>Limit / Offset</label>
            <div className="inline-pair">
              <input type="number" min={1} max={500} value={limit} onChange={(event) => setLimit(Number(event.target.value) || 200)} />
              <input type="number" min={0} value={offset} onChange={(event) => setOffset(Number(event.target.value) || 0)} />
            </div>
          </div>
          <div>
            <label>History ticker</label>
            <input value={historyTicker} onChange={(event) => setHistoryTicker(event.target.value)} placeholder="SPY" />
          </div>
          <div>
            <label>Flip date / lookback</label>
            <div className="inline-pair">
              <input type="date" value={flipDate} onChange={(event) => setFlipDate(event.target.value)} />
              <input type="number" min={20} max={250} value={lookbackRows} onChange={(event) => setLookbackRows(Number(event.target.value) || 90)} />
            </div>
          </div>
        </div>
        <label className="checkbox-inline">
          <input checked={includeOfficial} onChange={(event) => setIncludeOfficial(event.target.checked)} type="checkbox" />
          Include official signal rows when ticker is provided
        </label>
        <div className="admin-action-row">
          <button className="primary" type="submit" disabled={loading}>{loading ? 'Loading...' : 'Refresh evaluation data'}</button>
        </div>
        <ApiErrorBox error={error} />
      </form>

      <section className="card">
        <div className="split-row">
          <div>
            <p className="eyebrow">Candidate / Model Comparison Workbench</p>
            <h2>Backend-normalized comparison table</h2>
            <p className="small">Designed for 200+ rows. Rows come from Signal Evaluation V1 candidates and keep backend-provided gaps instead of client-side source merging.</p>
          </div>
          <div className="metric-value">{filteredRows.length}</div>
        </div>
        <div className="feature-grid">
          <div className="card compact-card">
            <label>Sources metadata</label>
            <JsonBlock value={evaluationList.sources ?? {}} />
          </div>
        </div>
        <div className="field-grid">
          <div>
            <label>Search returned rows</label>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="candidate, ticker, family, status" />
          </div>
          <div>
            <label>Horizon contains</label>
            <input value={horizonFilter} onChange={(event) => setHorizonFilter(event.target.value)} placeholder="20d, 1d, medium" />
          </div>
        </div>
        <ComparisonTable rows={filteredRows} selectedRowId={selectedRow?.id ?? null} onSelect={setSelectedRowId} />
      </section>

      <section className="evaluation-layout">
        <div className="card">
          <p className="eyebrow">Evaluation Charts</p>
          <h2>Backend report series</h2>
          <p className="small">Charts use report.series.* from Signal Evaluation V1. Empty panels render backend-provided series gaps.</p>
          <ApiErrorBox error={reportError} />
          <div className="chart-grid">
            {CHART_SERIES.map((seriesKey) => (
              <ChartPanel key={seriesKey} seriesKey={seriesKey} report={selectedReport} />
            ))}
          </div>
        </div>
        <SelectedDetailPanel
          loading={reportLoading}
          report={selectedReport}
          selectedRow={selectedRow}
          topLevelGaps={evaluationList.gaps ?? []}
        />
      </section>

      <RunSignalTestPanel
        testTicker={testTicker}
        setTestTicker={setTestTicker}
        testHorizon={testHorizon}
        setTestHorizon={setTestHorizon}
        modelFamily={modelFamily}
        setModelFamily={setModelFamily}
        featureSet={featureSet}
        setFeatureSet={setFeatureSet}
        evaluationMode={evaluationMode}
        setEvaluationMode={setEvaluationMode}
        compareAgainst={compareAgainst}
        setCompareAgainst={setCompareAgainst}
        outputTarget={outputTarget}
        setOutputTarget={setOutputTarget}
        selectedRow={selectedRow}
      />

      <section className="card monitor-section">
        <p className="eyebrow">Signal Monitor</p>
        <h2>Current endpoint-backed signal behavior</h2>
        <p className="small">This remains operational context from existing signal endpoints. It no longer drives the comparison/evaluation workbench.</p>
        <ApiErrorBox error={monitorError} />
        <div className="feature-grid">
          <div className="card compact-card">
            <h3>Latest / Screener Signals</h3>
            <DynamicTable rows={monitor.screener} columns={SCREENER_COLUMNS} />
          </div>
          <div className="card compact-card">
            <h3>Signal History: {selectedHistoryTicker}</h3>
            <DynamicTable rows={monitor.history} columns={HISTORY_COLUMNS} emptyLabel="No signal history returned." />
          </div>
          <div className="card compact-card">
            <h3>Last Flips</h3>
            <DynamicTable rows={lastFlipRows} columns={[{ key: 'ticker', label: 'Ticker' }, { key: 'lastFlipDate', label: 'Last Flip Date' }]} />
          </div>
          <div className="card compact-card">
            <h3>Flip Events By Date</h3>
            <DynamicTable rows={monitor.flips} columns={FLIP_COLUMNS} />
          </div>
        </div>
        <div className="card compact-card signal-composition-card">
          <h3>Signal Composition</h3>
          <DynamicTable rows={compositionRows} />
          <details className="details-block">
            <summary>Raw composition payload</summary>
            <JsonBlock value={monitor.composition} />
          </details>
        </div>
      </section>

    </div>
  )
}

function ComparisonTable({
  rows,
  selectedRowId,
  onSelect,
}: {
  rows: ComparisonRow[]
  selectedRowId: string | null
  onSelect: (rowId: string) => void
}) {
  if (rows.length === 0) {
    return <div className="gap-note">No Signal Evaluation V1 candidates returned for the current filters.</div>
  }

  return (
    <div className="comparison-table-wrap">
      <table className="comparison-table">
        <thead>
          <tr>
            <th className="sticky-col">Select</th>
            {COMPARISON_COLUMNS.map((column) => (
              <th key={column}>{column}</th>
            ))}
            <th>Raw</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className={row.id === selectedRowId ? 'selected-row' : undefined} key={row.id}>
              <td className="sticky-col">
                <input
                  aria-label={`Select ${row.label}`}
                  checked={row.id === selectedRowId}
                  name="selectedSignalRow"
                  onChange={() => onSelect(row.id)}
                  type="radio"
                />
              </td>
              <td><span className={`badge ${sourceBadgeClass(row.source)}`}>{row.sourceType}</span></td>
              <td>
                <div className="id-cell">
                  {row.label !== row.id ? <span>{row.label}</span> : null}
                  <CopyableId id={row.id} maxLen={16} />
                </div>
              </td>
              <td>{row.tickerUniverse}</td>
              <td>{row.horizon}</td>
              <td>{row.latestSignal}</td>
              <td>{row.confidence}</td>
              <td>{row.coverage}</td>
              <td>{row.icMean}</td>
              <td>{row.icLatest}</td>
              <td>{row.icTrend}</td>
              <td>{row.icDecay}</td>
              <td>{row.hitRate}</td>
              <td>{row.forwardReturn}</td>
              <td>{row.sharpeSortino}</td>
              <td>{row.maxDrawdown}</td>
              <td>{row.turnover}</td>
              <td>{row.stability}</td>
              <td>{row.dataQualityStatus}</td>
              <td>{row.evidenceStatus}</td>
              <td>{row.registryStatus}</td>
              <td>{row.lastUpdated}</td>
              <td>{row.actionHref ? <Link className="text-link" href={row.actionHref}>Open</Link> : '—'}</td>
              <td>
                <details>
                  <summary>JSON</summary>
                  <JsonBlock value={row.raw} />
                </details>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ChartPanel({ seriesKey, report }: { seriesKey: string; report: SignalEvaluationReport | null }) {
  const series = report?.series?.[seriesKey]
  const points = Array.isArray(series?.points) ? series.points : []
  const values = pointsToValues(points, series?.y_field)
  const unit = seriesUnitLabel(seriesKey, series?.unit)
  return (
    <div className="chart-panel">
      <div className="split-row">
        <strong>{series?.label ?? labelFromKey(seriesKey)}</strong>
        <span className={values.length > 0 ? 'badge completed' : 'badge backend-gap'}>{values.length > 0 ? 'available' : 'gap-backed'}</span>
      </div>
      {unit ? <p className="small">Unit: {unit}</p> : null}
      {values.length > 0 ? (
        <>
          <MiniSeriesChart values={values} />
          <details>
            <summary>Series points</summary>
            <JsonBlock value={points} />
          </details>
        </>
      ) : (
        <div className="chart-empty">No points returned. Missing evidence is summarized below the selected detail.</div>
      )}
    </div>
  )
}

function MiniSeriesChart({ values }: { values: number[] }) {
  const width = 320
  const height = 160
  const margin = { top: 14, right: 12, bottom: 28, left: 40 }
  const plotWidth = width - margin.left - margin.right
  const plotHeight = height - margin.top - margin.bottom
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const points = values.map((value, index) => {
    const x = margin.left + (values.length === 1 ? plotWidth / 2 : (index / (values.length - 1)) * plotWidth)
    const y = margin.top + plotHeight - ((value - min) / span) * plotHeight
    return `${x},${y}`
  }).join(' ')
  return (
    <svg aria-label="Available evaluation series chart" className="mini-chart" role="img" viewBox={`0 0 ${width} ${height}`}>
      <line className="mini-chart-axis" x1={margin.left} x2={margin.left} y1={margin.top} y2={margin.top + plotHeight} />
      <line className="mini-chart-axis" x1={margin.left} x2={margin.left + plotWidth} y1={margin.top + plotHeight} y2={margin.top + plotHeight} />
      <text className="mini-chart-label" x={margin.left - 8} y={margin.top + 4} textAnchor="end">{formatAxisValue(max)}</text>
      <text className="mini-chart-label" x={margin.left - 8} y={margin.top + plotHeight} textAnchor="end">{formatAxisValue(min)}</text>
      <text className="mini-chart-label" x={margin.left} y={height - 8}>0</text>
      <text className="mini-chart-label" x={margin.left + plotWidth} y={height - 8} textAnchor="end">{values.length - 1}</text>
      <polyline fill="none" points={points} stroke="#0f766e" strokeWidth="3" />
    </svg>
  )
}

function SelectedDetailPanel({
  loading,
  report,
  selectedRow,
  topLevelGaps,
}: {
  loading: boolean
  report: SignalEvaluationReport | null
  selectedRow: ComparisonRow | null
  topLevelGaps: SignalEvaluationGap[]
}) {
  if (!selectedRow) {
    return (
      <div className="card detail-panel">
        <h2>Selected Signal / Model Detail</h2>
        <EmptyState>Select a row from the comparison table to load the backend Signal Evaluation V1 report.</EmptyState>
      </div>
    )
  }

  const candidate = report?.candidate ?? selectedRow.candidate
  const links = candidate.links ?? {}
  const missingEvidence = collectMissingEvidence(candidate, report, topLevelGaps)
  return (
    <div className="card detail-panel">
      <p className="eyebrow">Selected Signal / Model Detail</p>
      <h2>{candidate.display_name ?? candidate.candidate_id}</h2>
      {loading ? <p className="small">Loading report...</p> : null}
      <div className="field-grid">
        <DetailField label="Candidate ID" value={candidate.candidate_id} copy />
        <DetailField label="Source" value={candidate.source_type} />
        <DetailField label="Status" value={candidate.status ?? '—'} />
        <DetailField label="Scope" value={scopeText(candidate)} />
        <DetailField label="Horizon" value={candidate.horizon ?? '—'} />
        <DetailField label="Research experiment" value={links.research_experiment_id ?? '—'} copy={Boolean(links.research_experiment_id)} />
        <DetailField label="Registry candidate" value={links.registry_candidate_id ?? '—'} copy={Boolean(links.registry_candidate_id)} />
        <DetailField label="Bundle" value={links.bundle_id ?? '—'} copy={Boolean(links.bundle_id)} />
      </div>
      <div className="details-grid">
        <details open>
          <summary>Metrics</summary>
          <JsonBlock value={report?.metrics ?? candidate.metrics ?? {}} />
        </details>
        <details>
          <summary>Metrics summary</summary>
          <JsonBlock value={report?.metrics_summary_json ?? {}} />
        </details>
        <details>
          <summary>Robustness summary</summary>
          <JsonBlock value={report?.robustness_summary_json ?? {}} />
        </details>
        <details>
          <summary>Lineage</summary>
          <JsonBlock value={report?.lineage ?? {}} />
        </details>
        <details>
          <summary>Readiness</summary>
          <JsonBlock value={{ candidate_readiness: candidate.readiness ?? {}, readiness_reports: report?.readiness_reports ?? [] }} />
        </details>
        <details>
          <summary>Artifacts</summary>
          <JsonBlock value={report?.artifacts ?? links.artifact_refs ?? []} />
        </details>
        <details>
          <summary>Raw refs / evidence</summary>
          <JsonBlock value={report?.raw_evidence ?? selectedRow.raw} />
        </details>
        <details>
          <summary>Raw report JSON</summary>
          <JsonBlock value={report ?? {}} />
        </details>
      </div>
      <MissingEvidenceDetails gaps={missingEvidence} />
    </div>
  )
}

function DetailField({ label, value, copy = false }: { label: string; value: string; copy?: boolean }) {
  return (
    <div>
      <label>{label}</label>
      <div>{copy && value !== '—' ? <CopyableId id={value} maxLen={value.length} /> : value}</div>
    </div>
  )
}

function RunSignalTestPanel({
  testTicker,
  setTestTicker,
  testHorizon,
  setTestHorizon,
  modelFamily,
  setModelFamily,
  featureSet,
  setFeatureSet,
  evaluationMode,
  setEvaluationMode,
  compareAgainst,
  setCompareAgainst,
  outputTarget,
  setOutputTarget,
  selectedRow,
}: {
  testTicker: string
  setTestTicker: (value: string) => void
  testHorizon: string
  setTestHorizon: (value: string) => void
  modelFamily: string
  setModelFamily: (value: string) => void
  featureSet: string
  setFeatureSet: (value: string) => void
  evaluationMode: string
  setEvaluationMode: (value: string) => void
  compareAgainst: string
  setCompareAgainst: (value: string) => void
  outputTarget: string
  setOutputTarget: (value: string) => void
  selectedRow: ComparisonRow | null
}) {
  const dynamicLaunchBlocked = evaluationMode !== 'backtest' || outputTarget !== 'research_run'
  return (
    <section className="card">
      <p className="eyebrow">Run / Test Signal Models</p>
      <h2>Launch Research Workflow</h2>
      <p className="small">Backoffice can route an operator to the existing Research Lab for single experiment creation. Dynamic model templates, campaign expansion, paper/live-shadow launch, and candidate-comparison output targets need backend contracts.</p>
      <div className="field-grid">
        <div>
          <label>Ticker / universe</label>
          <input value={testTicker} onChange={(event) => setTestTicker(event.target.value)} placeholder="SPY or SPY,AAPL,MSFT" />
        </div>
        <div>
          <label>Horizon</label>
          <select value={testHorizon} onChange={(event) => setTestHorizon(event.target.value)}>
            <option value="1d">1d</option>
            <option value="5d">5d</option>
            <option value="20d">20d</option>
            <option value="60d">60d</option>
            <option value="custom">custom</option>
          </select>
        </div>
        <div>
          <label>Model / strategy family</label>
          <select value={modelFamily} onChange={(event) => setModelFamily(event.target.value)}>
            <option value="binary_directional">Binary directional</option>
            <option value="ranking">Cross-sectional ranking</option>
            <option value="mean_reversion">Mean reversion</option>
            <option value="momentum">Momentum</option>
            <option value="volatility_regime">Volatility/regime aware</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div>
          <label>Feature set</label>
          <select value={featureSet} onChange={(event) => setFeatureSet(event.target.value)}>
            <option value="operator_selected">Operator selected</option>
            <option value="market_only">Market only</option>
            <option value="market_macro">Market + macro</option>
            <option value="market_fundamental">Market + fundamental</option>
            <option value="existing_candidate_lineage">Existing candidate lineage</option>
          </select>
        </div>
        <div>
          <label>Evaluation mode</label>
          <select value={evaluationMode} onChange={(event) => setEvaluationMode(event.target.value)}>
            <option value="backtest">Backtest</option>
            <option value="paper">Paper</option>
            <option value="live-shadow">Live-shadow</option>
          </select>
        </div>
        <div>
          <label>Compare against</label>
          <select value={compareAgainst} onChange={(event) => setCompareAgainst(event.target.value)}>
            <option value="current_official">Current official</option>
            <option value="benchmark">Benchmark</option>
            <option value="selected_candidate">Selected candidate</option>
          </select>
        </div>
        <div>
          <label>Output target</label>
          <select value={outputTarget} onChange={(event) => setOutputTarget(event.target.value)}>
            <option value="research_run">Research run</option>
            <option value="candidate_comparison">Candidate comparison</option>
          </select>
        </div>
        <div>
          <label>Selected row</label>
          <div>{selectedRow?.label ?? '—'}</div>
        </div>
      </div>
      <div className="admin-action-row">
        <Link className="hero-link card-link" href="/research">Open Research Lab</Link>
        <button className="secondary" disabled={dynamicLaunchBlocked} type="button">
          {dynamicLaunchBlocked ? 'Backend launch contract missing' : 'Use Research Lab for single run'}
        </button>
      </div>
      {dynamicLaunchBlocked ? (
        <div className="gap-note">Dynamic launch for {evaluationMode} / {outputTarget} needs campaign/model-template catalog, launch signal test endpoint, and candidate comparison output contracts.</div>
      ) : null}
    </section>
  )
}

function MissingEvidenceDetails({ gaps }: { gaps: SignalEvaluationGap[] }) {
  if (!gaps.length) {
    return (
      <details className="missing-evidence-details">
        <summary>Missing evidence (0)</summary>
        <p className="small">No missing evidence returned for the selected candidate.</p>
      </details>
    )
  }

  return (
    <details className="missing-evidence-details">
      <summary>Missing evidence ({gaps.length})</summary>
      <ul className="plain-list missing-evidence-list">
        {gaps.map((gap, index) => (
          <li key={`${gap.code ?? 'gap'}-${index}`}>{formatGapSummary(gap)}</li>
        ))}
      </ul>
    </details>
  )
}

function collectMissingEvidence(
  candidate: SignalEvaluationCandidateSummary,
  report: SignalEvaluationReport | null,
  topLevelGaps: SignalEvaluationGap[]
): SignalEvaluationGap[] {
  const seriesGaps = Object.values(report?.series ?? {}).flatMap((series) => series.gaps ?? [])
  const gaps = [
    ...topLevelGaps,
    ...(candidate.gaps ?? []),
    ...(report?.gaps ?? []),
    ...seriesGaps,
  ]
  const seen = new Set<string>()
  return gaps.filter((gap) => {
    const key = `${gap.code ?? ''}|${gap.message ?? ''}|${gap.source ?? ''}|${gap.expected ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function formatGapSummary(gap: SignalEvaluationGap): string {
  const label = gapLabel(gap)
  const reason = gap.expected || gap.message || 'backend contract not yet available'
  return `${label} — ${reason}`
}

function gapLabel(gap: SignalEvaluationGap): string {
  const code = gap.code?.trim()
  const source = gap.source?.trim()
  const message = gap.message?.trim()
  if (code) return labelFromKey(code)
  if (source) return labelFromKey(source)
  if (message) return message
  return 'Evidence'
}

function candidateToRow(candidate: SignalEvaluationCandidateSummary): ComparisonRow {
  const metrics = candidate.metrics ?? {}
  const readiness = candidate.readiness ?? {}
  const source = sourceFromType(candidate.source_type)
  return {
    id: candidate.candidate_id,
    source,
    sourceType: candidate.source_type,
    label: candidate.display_name ?? candidate.candidate_id,
    tickerUniverse: scopeText(candidate),
    horizon: candidate.horizon ?? '—',
    latestSignal: metricText(metrics, ['latest_signal', 'direction', 'signal']),
    confidence: metricText(metrics, ['confidence', 'conviction', 'prob_side']),
    coverage: metricText(metrics, ['coverage', 'coverage_ratio', 'sample_count']),
    icMean: metricText(metrics, ['ic_mean', 'mean_ic', 'information_coefficient_mean']),
    icLatest: metricText(metrics, ['ic_latest', 'latest_ic']),
    icTrend: metricText(metrics, ['ic_trend', 'rolling_ic_trend']),
    icDecay: metricText(metrics, ['ic_decay', 'decay']),
    hitRate: metricText(metrics, ['hit_rate', 'accuracy']),
    forwardReturn: metricText(metrics, ['forward_return', 'mean_forward_return']),
    sharpeSortino: joinMetric(metrics, ['sharpe', 'sortino']),
    maxDrawdown: metricText(metrics, ['max_drawdown', 'drawdown']),
    turnover: metricText(metrics, ['turnover']),
    stability: metricText(metrics, ['stability', 'stable', 'robustness_score']),
    dataQualityStatus: readText(readiness, ['data_quality_status', 'data_readiness']),
    evidenceStatus: candidate.gaps?.length ? 'gap-backed' : 'available',
    registryStatus: candidate.status ?? '—',
    lastUpdated: candidate.updated_at ?? candidate.created_at ?? '—',
    actionHref: actionHref(candidate),
    candidate,
    raw: candidate,
  }
}

function filterRows(rows: ComparisonRow[], filters: { search: string; horizonFilter: string }): ComparisonRow[] {
  const query = filters.search.trim().toLowerCase()
  const horizon = filters.horizonFilter.trim().toLowerCase()
  return rows.filter((row) => {
    if (horizon && !row.horizon.toLowerCase().includes(horizon)) return false
    if (!query) return true
    return JSON.stringify({
      label: row.label,
      source: row.source,
      tickerUniverse: row.tickerUniverse,
      horizon: row.horizon,
      registryStatus: row.registryStatus,
      evidenceStatus: row.evidenceStatus,
    }).toLowerCase().includes(query)
  })
}

function parseTickers(value: string): string[] {
  return [...new Set(value.split(',').map((ticker) => ticker.trim().toUpperCase()).filter(Boolean))]
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

function joinMetric(record: Record<string, unknown>, keys: string[]): string {
  const values = keys.map((key) => metricText(record, [key])).filter((value) => value !== '—')
  return values.length > 0 ? values.join(' / ') : '—'
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

function actionHref(candidate: SignalEvaluationCandidateSummary): string | undefined {
  const links = candidate.links ?? {}
  if (links.registry_candidate_id) return `/registry/candidates/${encodeURIComponent(links.registry_candidate_id)}`
  if (links.research_experiment_id) return `/research?experiment_id=${encodeURIComponent(links.research_experiment_id)}`
  const readinessReportId = links.readiness_report_ids?.[0]
  if (readinessReportId) return `/registry/readiness/${encodeURIComponent(readinessReportId)}`
  return undefined
}

function pointsToValues(points: Array<Record<string, unknown>>, yField = 'value'): number[] {
  return points.map((point) => {
    const value = point[yField] ?? point.value ?? point.y
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  }).filter((value): value is number => value !== null)
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
    official_disagreement: 'Official disagreement',
    decay_divergence: 'Decay divergence',
  }
  if (labels[key]) return labels[key]
  const text = key.replace(/[_-]+/g, ' ').trim()
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Evidence'
}

function seriesUnitLabel(seriesKey: string, unit?: string | null): string {
  const normalizedUnit = unit?.trim()
  if (normalizedUnit) return normalizedUnit
  if (seriesKey === 'equity_curve') return 'cumulative/equity value'
  if (seriesKey === 'drawdown') return 'negative or zero ratio/percentage'
  if (seriesKey === 'turnover') return 'ratio/percentage'
  return ''
}

function formatAxisValue(value: number): string {
  if (Math.abs(value) >= 100) return value.toFixed(0)
  if (Math.abs(value) >= 10) return value.toFixed(1)
  return value.toFixed(2)
}
