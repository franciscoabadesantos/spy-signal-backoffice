'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { readApiError } from '@/lib/api-error'
import { requestClientJson } from '@/lib/client-json'
import { ApiErrorBox, DynamicTable, EmptyState, JsonBlock, asRecord, readArrayPayload } from '@/app/components/workspace-data'

type SourceFilter = 'all' | 'official' | 'research' | 'registry' | 'paper' | 'unknown'

type ComparisonRow = {
  id: string
  source: 'official' | 'research' | 'registry' | 'paper' | 'unknown'
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
  metrics: Record<string, unknown>
  robustness: Record<string, unknown>
  raw: unknown
  refs: {
    experimentId?: string
    registryCandidateId?: string
    readinessReportId?: string
    activePointerId?: string
  }
}

type SignalState = {
  screener: unknown[]
  history: unknown[]
  lastFlips: Record<string, unknown>
  flips: unknown[]
  composition: unknown
  researchExperiments: unknown[]
  registryCandidates: unknown[]
  readinessReports: unknown[]
  activePointers: unknown[]
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

const CHART_PANELS = [
  {
    title: 'IC evolution',
    keys: ['ic_series', 'information_coefficient_series', 'icEvolution'],
    need: 'Need backend to expose ic_series or artifact-derived IC time series for selected model/candidate.',
  },
  {
    title: 'Rolling IC',
    keys: ['rolling_ic_series', 'rollingIc', 'rolling_information_coefficient'],
    need: 'Need rolling_ic_series for the selected signal/model.',
  },
  {
    title: 'Cumulative IC',
    keys: ['cumulative_ic_series', 'cumulativeIc'],
    need: 'Need cumulative_ic_series for selected candidate/model evidence.',
  },
  {
    title: 'Forward returns by horizon',
    keys: ['forward_return_series', 'forward_returns_by_horizon', 'forwardReturns'],
    need: 'Need forward returns by signal date and horizon.',
  },
  {
    title: 'Equity / cumulative return',
    keys: ['equity_curve', 'cumulative_return_series', 'cumulativeReturns'],
    need: 'Need equity_curve or cumulative_return_series from backtest/live evaluation artifacts.',
  },
  {
    title: 'Drawdown',
    keys: ['drawdown_series', 'drawdowns'],
    need: 'Need drawdown_series for selected candidate/model.',
  },
  {
    title: 'Turnover over time',
    keys: ['turnover_series', 'turnoverOverTime'],
    need: 'Need turnover_series from strategy/backtest evaluation.',
  },
  {
    title: 'Signal distribution',
    keys: ['signal_distribution', 'signalDistribution'],
    need: 'Need signal distribution buckets or counts for the selected signal/model.',
  },
  {
    title: 'Confidence calibration',
    keys: ['calibration_series', 'confidence_calibration', 'calibration'],
    need: 'Need confidence calibration bins comparing predicted confidence to realized outcomes.',
  },
  {
    title: 'Regime breakdown',
    keys: ['regime_breakdown', 'regimeBreakdown'],
    need: 'Need regime breakdown by market regime, volatility regime, or macro regime.',
  },
  {
    title: 'Candidate vs official disagreement performance',
    keys: ['official_disagreement_series', 'candidate_vs_official_disagreement'],
    need: 'Need candidate-vs-current-official disagreement performance by date/horizon.',
  },
  {
    title: 'Decay / live-vs-backtest divergence',
    keys: ['decay_series', 'live_vs_backtest_divergence', 'decay'],
    need: 'Need decay/live-vs-backtest divergence series for production and paper signals.',
  },
]

const SIGNAL_EVALUATION_GAPS = [
  'normalized model evaluation summary endpoint',
  'candidate/model comparison endpoint',
  'IC time-series endpoint',
  'forward-return evaluation endpoint',
  'decay/live-vs-backtest divergence endpoint',
  'paper/shadow signal stream',
  'official active model/candidate lineage',
  'campaign/model-template launch endpoint',
  'artifact-to-chart extraction contract',
]

export default function SignalsWorkspace({ adminEmail }: { adminEmail: string }) {
  const [tickerText, setTickerText] = useState('SPY')
  const [historyTicker, setHistoryTicker] = useState('SPY')
  const [flipDate, setFlipDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [lookbackRows, setLookbackRows] = useState(90)
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [horizonFilter, setHorizonFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [testTicker, setTestTicker] = useState('SPY')
  const [testHorizon, setTestHorizon] = useState('20d')
  const [modelFamily, setModelFamily] = useState('binary_directional')
  const [featureSet, setFeatureSet] = useState('operator_selected')
  const [evaluationMode, setEvaluationMode] = useState('backtest')
  const [compareAgainst, setCompareAgainst] = useState('current_official')
  const [outputTarget, setOutputTarget] = useState('research_run')
  const [data, setData] = useState<SignalState>({
    screener: [],
    history: [],
    lastFlips: {},
    flips: [],
    composition: {},
    researchExperiments: [],
    registryCandidates: [],
    readinessReports: [],
    activePointers: [],
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tickers = useMemo(() => parseTickers(tickerText), [tickerText])
  const selectedHistoryTicker = historyTicker.trim().toUpperCase() || tickers[0] || 'SPY'
  const comparisonRows = useMemo(() => buildComparisonRows(data), [data])
  const filteredRows = useMemo(
    () => filterRows(comparisonRows, { search, sourceFilter, horizonFilter, statusFilter }),
    [comparisonRows, search, sourceFilter, horizonFilter, statusFilter]
  )
  const selectedRow = useMemo(
    () => comparisonRows.find((row) => row.id === selectedRowId) ?? filteredRows[0] ?? null,
    [comparisonRows, filteredRows, selectedRowId]
  )

  async function loadSignals() {
    const normalizedTickers = tickers.length > 0 ? tickers : ['SPY']
    const tickerParam = normalizedTickers.join(',')
    setLoading(true)
    setError(null)
    try {
      const [
        screenerPayload,
        historyPayload,
        lastFlipsPayload,
        flipsPayload,
        compositionPayload,
        researchPayload,
        candidatesPayload,
        readinessPayload,
        activePointersPayload,
      ] = await Promise.all([
        requestClientJson(`/api/screener/signals?tickers=${encodeURIComponent(tickerParam)}&limit=200`),
        requestClientJson(`/api/signals/history/${encodeURIComponent(selectedHistoryTicker)}?limit=200`),
        requestClientJson(`/api/signals/last-flips?tickers=${encodeURIComponent(tickerParam)}`),
        requestClientJson(`/api/signals/flips?date=${encodeURIComponent(flipDate)}&tickers=${encodeURIComponent(tickerParam)}`),
        requestClientJson(`/api/signals/composition?tickers=${encodeURIComponent(tickerParam)}&lookback_rows=${encodeURIComponent(String(lookbackRows))}`),
        requestClientJson('/api/research/experiments?limit=200'),
        requestClientJson('/api/registry/candidates?limit=200'),
        requestClientJson('/api/registry/readiness-reports?limit=200'),
        requestClientJson('/api/registry/active-pointers'),
      ])
      setData({
        screener: Array.isArray(screenerPayload) ? screenerPayload : [],
        history: Array.isArray(historyPayload) ? historyPayload : [],
        lastFlips: asRecord(lastFlipsPayload) ?? {},
        flips: Array.isArray(flipsPayload) ? flipsPayload : [],
        composition: compositionPayload,
        researchExperiments: readArrayPayload(researchPayload, 'jobs'),
        registryCandidates: readArrayPayload(candidatesPayload, 'candidates'),
        readinessReports: readArrayPayload(readinessPayload, 'readiness_reports'),
        activePointers: readArrayPayload(activePointersPayload, 'active_pointers'),
      })
    } catch (err) {
      setError(readApiError(err, 'Failed to load Signal Evaluation Lab data.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSignals()
    }, 0)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void loadSignals()
  }

  const lastFlipRows = Object.entries(data.lastFlips).map(([ticker, lastFlipDate]) => ({ ticker, lastFlipDate }))
  const compositionRows = Object.entries(asRecord(data.composition) ?? {}).map(([ticker, payload]) => ({
    ticker,
    ...(asRecord(payload) ?? { payload }),
  }))

  return (
    <div className="page-stack">
      <div className="hero-panel">
        <div>
          <p className="eyebrow">Signal Evaluation Lab</p>
          <h1>Compare official signals, research runs, and registry candidates without inventing evaluation data.</h1>
          <p className="hero-copy">
            Choose a ticker or universe, monitor current signal behavior, compare candidate/model evidence, inspect evaluation gaps, and route operators toward research tests when backend launch contracts are still missing.
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
          <p className="small">Start with ticker/universe and horizon. Backoffice loads current signal monitor data plus research and registry evidence available through finance-backend.</p>
        </div>
        <div className="field-grid">
          <div>
            <label>Tickers / universe symbols</label>
            <input value={tickerText} onChange={(event) => setTickerText(event.target.value)} placeholder="SPY, AAPL, MSFT" />
          </div>
          <div>
            <label>History ticker</label>
            <input value={historyTicker} onChange={(event) => setHistoryTicker(event.target.value)} placeholder="SPY" />
          </div>
          <div>
            <label>Flip event date</label>
            <input type="date" value={flipDate} onChange={(event) => setFlipDate(event.target.value)} />
          </div>
          <div>
            <label>Composition lookback rows</label>
            <input type="number" min={20} max={250} value={lookbackRows} onChange={(event) => setLookbackRows(Number(event.target.value) || 90)} />
          </div>
        </div>
        <div className="admin-action-row">
          <button className="primary" type="submit" disabled={loading}>{loading ? 'Loading...' : 'Refresh evaluation data'}</button>
        </div>
        <ApiErrorBox error={error} />
      </form>

      <section className="card">
        <div className="split-row">
          <div>
            <p className="eyebrow">Candidate / Model Comparison Workbench</p>
            <h2>Dense comparison table</h2>
            <p className="small">Designed for 200+ rows. Sources currently include latest official/screener signals, research experiment evidence, registry candidates, readiness reports, and active pointers where available.</p>
          </div>
          <div className="metric-value">{filteredRows.length}</div>
        </div>
        <div className="field-grid">
          <div>
            <label>Search</label>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="candidate, ticker, family, status" />
          </div>
          <div>
            <label>Source</label>
            <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as SourceFilter)}>
              <option value="all">All sources</option>
              <option value="official">Official / screener</option>
              <option value="research">Research</option>
              <option value="registry">Registry</option>
              <option value="paper">Paper</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
          <div>
            <label>Horizon contains</label>
            <input value={horizonFilter} onChange={(event) => setHorizonFilter(event.target.value)} placeholder="20d, 1d, medium" />
          </div>
          <div>
            <label>Status contains</label>
            <input value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} placeholder="completed, paper, pass" />
          </div>
        </div>
        <ComparisonTable rows={filteredRows} selectedRowId={selectedRow?.id ?? null} onSelect={setSelectedRowId} />
      </section>

      <section className="evaluation-layout">
        <div className="card">
          <p className="eyebrow">Evaluation Charts</p>
          <h2>Evidence time series</h2>
          <p className="small">Charts render only when selected row payloads contain usable series arrays. Otherwise each panel names the backend/artifact contract needed.</p>
          <div className="chart-grid">
            {CHART_PANELS.map((panel) => (
              <ChartPanel key={panel.title} panel={panel} selectedRow={selectedRow} />
            ))}
          </div>
        </div>
        <SelectedDetailPanel selectedRow={selectedRow} />
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
        <p className="small">This is monitoring input for evaluation, not the whole product. Raw JSON stays available as fallback.</p>
        <div className="feature-grid">
          <div className="card compact-card">
            <h3>Latest / Screener Signals</h3>
            <DynamicTable rows={data.screener} columns={SCREENER_COLUMNS} />
          </div>
          <div className="card compact-card">
            <h3>Signal History: {selectedHistoryTicker}</h3>
            <DynamicTable rows={data.history} columns={HISTORY_COLUMNS} emptyLabel="No signal history returned." />
          </div>
          <div className="card compact-card">
            <h3>Last Flips</h3>
            <DynamicTable rows={lastFlipRows} columns={[{ key: 'ticker', label: 'Ticker' }, { key: 'lastFlipDate', label: 'Last Flip Date' }]} />
          </div>
          <div className="card compact-card">
            <h3>Flip Events By Date</h3>
            <DynamicTable rows={data.flips} columns={FLIP_COLUMNS} />
          </div>
        </div>
        <div className="card compact-card signal-composition-card">
          <h3>Signal Composition</h3>
          <DynamicTable rows={compositionRows} />
          <details className="details-block">
            <summary>Raw composition payload</summary>
            <JsonBlock value={data.composition} />
          </details>
        </div>
      </section>

      <section className="card">
        <h2>Backend Gaps for Signal Evaluation</h2>
        <p className="small">These gaps block the full model-quality, decay, and multi-candidate evaluation workflow.</p>
        <ul className="plain-list">
          {SIGNAL_EVALUATION_GAPS.map((gap) => (
            <li key={gap}>{gap}</li>
          ))}
        </ul>
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
    return (
      <div className="gap-note">
        No comparison rows returned. Need candidate/model universe list or existing official/research/registry rows from finance-backend.
      </div>
    )
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
              <td><span className={`badge ${row.source === 'official' ? 'completed' : row.source === 'registry' ? 'queued' : 'running'}`}>{row.source}</span></td>
              <td>{row.label}</td>
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

function ChartPanel({
  panel,
  selectedRow,
}: {
  panel: { title: string; keys: string[]; need: string }
  selectedRow: ComparisonRow | null
}) {
  const series = selectedRow ? findNumericSeries(selectedRow.raw, panel.keys) : null
  return (
    <div className="chart-panel">
      <div className="split-row">
        <strong>{panel.title}</strong>
        <span className={series ? 'badge completed' : 'badge backend-gap'}>{series ? 'available' : 'missing contract'}</span>
      </div>
      {series ? (
        <MiniSeriesChart values={series} />
      ) : (
        <p className="small">{panel.title} unavailable. {panel.need}</p>
      )}
    </div>
  )
}

function MiniSeriesChart({ values }: { values: number[] }) {
  const width = 220
  const height = 72
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const points = values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width
    const y = height - ((value - min) / span) * height
    return `${x},${y}`
  }).join(' ')
  return (
    <svg aria-label="Available evaluation series chart" className="mini-chart" role="img" viewBox={`0 0 ${width} ${height}`}>
      <polyline fill="none" points={points} stroke="#0f766e" strokeWidth="3" />
    </svg>
  )
}

function SelectedDetailPanel({ selectedRow }: { selectedRow: ComparisonRow | null }) {
  if (!selectedRow) {
    return (
      <div className="card detail-panel">
        <h2>Selected Signal / Model Detail</h2>
        <EmptyState>Select a row from the comparison table to inspect identity, lineage, metrics, robustness, evidence, and missing contracts.</EmptyState>
      </div>
    )
  }

  return (
    <div className="card detail-panel">
      <p className="eyebrow">Selected Signal / Model Detail</p>
      <h2>{selectedRow.label}</h2>
      <div className="field-grid">
        <DetailField label="Source" value={selectedRow.source} />
        <DetailField label="Ticker / Universe" value={selectedRow.tickerUniverse} />
        <DetailField label="Horizon" value={selectedRow.horizon} />
        <DetailField label="Latest signal" value={selectedRow.latestSignal} />
        <DetailField label="Research experiment" value={selectedRow.refs.experimentId ?? '—'} />
        <DetailField label="Registry candidate" value={selectedRow.refs.registryCandidateId ?? '—'} />
        <DetailField label="Readiness report" value={selectedRow.refs.readinessReportId ?? '—'} />
        <DetailField label="Active pointer" value={selectedRow.refs.activePointerId ?? '—'} />
      </div>
      <div className="details-grid">
        <details open>
          <summary>Metrics summary</summary>
          {Object.keys(selectedRow.metrics).length > 0 ? <JsonBlock value={selectedRow.metrics} /> : <EmptyState>No metrics summary returned.</EmptyState>}
        </details>
        <details>
          <summary>Robustness summary</summary>
          {Object.keys(selectedRow.robustness).length > 0 ? <JsonBlock value={selectedRow.robustness} /> : <EmptyState>No robustness summary returned.</EmptyState>}
        </details>
        <details>
          <summary>Artifacts / raw JSON</summary>
          <JsonBlock value={selectedRow.raw} />
        </details>
      </div>
      <div className="gap-note">
        <strong>Missing evidence checklist:</strong> IC series, rolling IC, forward returns by horizon, drawdown series, turnover series, calibration bins, regime breakdown, official disagreement performance, and live-vs-backtest divergence are shown only if the selected payload already exposes them.
      </div>
    </div>
  )
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label>{label}</label>
      <div>{value}</div>
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

function buildComparisonRows(data: SignalState): ComparisonRow[] {
  const rows: ComparisonRow[] = []

  for (const row of data.screener) {
    const record = asRecord(row) ?? {}
    const ticker = readText(record, ['ticker'])
    rows.push({
      id: `official:${ticker}:${readText(record, ['signalDate', 'signal_date'])}`,
      source: 'official',
      label: ticker || 'official-signal',
      tickerUniverse: ticker,
      horizon: readText(record, ['predictionHorizon', 'prediction_horizon']),
      latestSignal: readText(record, ['direction']),
      confidence: readText(record, ['conviction']),
      coverage: '—',
      icMean: '—',
      icLatest: '—',
      icTrend: '—',
      icDecay: '—',
      hitRate: '—',
      forwardReturn: '—',
      sharpeSortino: '—',
      maxDrawdown: '—',
      turnover: '—',
      stability: '—',
      dataQualityStatus: 'missing contract',
      evidenceStatus: 'signal row only',
      registryStatus: '—',
      lastUpdated: readText(record, ['signalDate', 'signal_date']),
      metrics: {},
      robustness: {},
      raw: row,
      refs: {},
    })
  }

  for (const experiment of data.researchExperiments) {
    const record = asRecord(experiment) ?? {}
    const result = asRecord(record.result_json) ?? asRecord(record.result) ?? {}
    const metrics = asRecord(result.metrics_summary_json) ?? asRecord(record.metrics_summary_json) ?? {}
    const robustness = asRecord(result.robustness_summary_json) ?? asRecord(record.robustness_summary_json) ?? {}
    const experimentId = readText(record, ['experiment_id'])
    rows.push({
      id: `research:${experimentId}`,
      source: 'research',
      label: experimentId || readText(record, ['experiment_name']),
      tickerUniverse: readUniverse(record),
      horizon: readText(record, ['horizon']),
      latestSignal: readText(result, ['latest_signal', 'direction', 'signal']),
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
      stability: metricText(robustness, ['stability', 'stable', 'robustness_score']),
      dataQualityStatus: readText(record, ['status']),
      evidenceStatus: Object.keys(metrics).length > 0 || Object.keys(robustness).length > 0 ? 'summary available' : 'metrics missing',
      registryStatus: readText(result, ['candidate_status']),
      lastUpdated: readText(record, ['finished_at', 'created_at']),
      actionHref: experimentId ? `/research?experiment_id=${encodeURIComponent(experimentId)}` : undefined,
      metrics,
      robustness,
      raw: experiment,
      refs: {
        experimentId,
        registryCandidateId: readText(record, ['candidate_id']) || readText(result, ['candidate_id']),
      },
    })
  }

  for (const candidate of data.registryCandidates) {
    const record = asRecord(candidate) ?? {}
    const metrics = asRecord(record.metrics_summary_json) ?? {}
    const robustness = asRecord(record.robustness_summary_json) ?? {}
    const candidateId = readText(record, ['candidate_id'])
    rows.push({
      id: `registry:${candidateId}`,
      source: readText(record, ['status']).includes('paper') ? 'paper' : 'registry',
      label: candidateId || readText(record, ['candidate_name']),
      tickerUniverse: readUniverse(record),
      horizon: readText(record, ['horizon']),
      latestSignal: metricText(metrics, ['latest_signal', 'direction', 'signal']),
      confidence: metricText(metrics, ['confidence', 'conviction']),
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
      stability: metricText(robustness, ['stability', 'stable', 'robustness_score']),
      dataQualityStatus: metricText(robustness, ['data_quality_status', 'data_readiness']),
      evidenceStatus: Object.keys(metrics).length > 0 || Object.keys(robustness).length > 0 ? 'summary available' : 'metrics missing',
      registryStatus: readText(record, ['status']),
      lastUpdated: readText(record, ['created_at']),
      actionHref: candidateId ? `/registry/candidates/${encodeURIComponent(candidateId)}` : undefined,
      metrics,
      robustness,
      raw: candidate,
      refs: {
        registryCandidateId: candidateId,
        experimentId: readText(record, ['experiment_id']),
      },
    })
  }

  for (const report of data.readinessReports) {
    const record = asRecord(report) ?? {}
    const metrics = asRecord(record.metric_evidence) ?? {}
    const reportId = readText(record, ['report_id'])
    rows.push({
      id: `readiness:${reportId}`,
      source: 'registry',
      label: reportId || readText(record, ['candidate_id']),
      tickerUniverse: readText(record, ['candidate_id']),
      horizon: '—',
      latestSignal: '—',
      confidence: metricText(metrics, ['confidence', 'conviction']),
      coverage: metricText(metrics, ['coverage', 'coverage_ratio', 'sample_count', 'symbol_count']),
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
      dataQualityStatus: '—',
      evidenceStatus: readText(record, ['overall_status']),
      registryStatus: readText(record, ['target_status', 'target']),
      lastUpdated: readText(record, ['created_at']),
      actionHref: reportId ? `/registry/readiness/${encodeURIComponent(reportId)}` : undefined,
      metrics,
      robustness: {},
      raw: report,
      refs: {
        readinessReportId: reportId,
        registryCandidateId: readText(record, ['candidate_id']),
      },
    })
  }

  for (const pointer of data.activePointers) {
    const record = asRecord(pointer) ?? {}
    const activeCandidateId = readText(record, ['active_candidate_id'])
    rows.push({
      id: `active:${readText(record, ['active_pointer_id'])}`,
      source: 'registry',
      label: activeCandidateId || readText(record, ['active_pointer_id']),
      tickerUniverse: `${readText(record, ['strategy_family'])} / ${readText(record, ['universe'])}`,
      horizon: '—',
      latestSignal: 'active pointer',
      confidence: '—',
      coverage: '—',
      icMean: '—',
      icLatest: '—',
      icTrend: '—',
      icDecay: '—',
      hitRate: '—',
      forwardReturn: '—',
      sharpeSortino: '—',
      maxDrawdown: '—',
      turnover: '—',
      stability: '—',
      dataQualityStatus: '—',
      evidenceStatus: 'active lineage pointer',
      registryStatus: readText(record, ['environment']),
      lastUpdated: readText(record, ['activated_at']),
      actionHref: activeCandidateId ? `/registry/candidates/${encodeURIComponent(activeCandidateId)}` : undefined,
      metrics: {},
      robustness: {},
      raw: pointer,
      refs: {
        activePointerId: readText(record, ['active_pointer_id']),
        registryCandidateId: activeCandidateId,
      },
    })
  }

  return rows
}

function filterRows(
  rows: ComparisonRow[],
  filters: { search: string; sourceFilter: SourceFilter; horizonFilter: string; statusFilter: string }
): ComparisonRow[] {
  const query = filters.search.trim().toLowerCase()
  const horizon = filters.horizonFilter.trim().toLowerCase()
  const status = filters.statusFilter.trim().toLowerCase()
  return rows.filter((row) => {
    if (filters.sourceFilter !== 'all' && row.source !== filters.sourceFilter) return false
    if (horizon && !row.horizon.toLowerCase().includes(horizon)) return false
    if (status && !`${row.registryStatus} ${row.evidenceStatus} ${row.dataQualityStatus}`.toLowerCase().includes(status)) return false
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

function findNumericSeries(raw: unknown, keys: string[]): number[] | null {
  const candidates = flattenRecords(raw)
  for (const record of candidates) {
    for (const key of keys) {
      const value = record[key]
      const series = coerceSeries(value)
      if (series && series.length >= 2) return series
    }
  }
  return null
}

function flattenRecords(value: unknown): Record<string, unknown>[] {
  const output: Record<string, unknown>[] = []
  const visit = (item: unknown) => {
    const record = asRecord(item)
    if (!record) return
    output.push(record)
    for (const nested of Object.values(record)) {
      if (asRecord(nested)) visit(nested)
    }
  }
  visit(value)
  return output
}

function coerceSeries(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null
  const numbers = value.map((item) => {
    if (typeof item === 'number') return item
    const record = asRecord(item)
    const possible = record?.value ?? record?.y ?? record?.metric ?? record?.return ?? record?.ic
    return typeof possible === 'number' ? possible : null
  }).filter((item): item is number => item !== null && Number.isFinite(item))
  return numbers.length >= 2 ? numbers : null
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

function readUniverse(record: Record<string, unknown>): string {
  const symbols = record.symbols
  if (Array.isArray(symbols) && symbols.length > 0) return symbols.map(String).join(', ')
  return readText(record, ['ticker', 'universe', 'symbol'])
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
