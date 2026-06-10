'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { readApiError } from '@/lib/api-error'
import { requestClientJson } from '@/lib/client-json'
import { ApiErrorBox, DynamicTable, EmptyState, JsonBlock, asRecord } from '@/app/components/workspace-data'

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

const OFFICIAL_SIGNAL_GAPS = [
  'active official candidate/model lineage',
  'paper/shadow candidate signals',
  'forward return after signal',
  'signal-vs-model/version linkage',
  'candidate vs current official comparison',
  'decay/replacement proposals',
]

type SignalState = {
  screener: unknown[]
  history: unknown[]
  lastFlips: Record<string, unknown>
  flips: unknown[]
  composition: unknown
}

export default function SignalsWorkspace({ adminEmail }: { adminEmail: string }) {
  const [tickerText, setTickerText] = useState('SPY')
  const [historyTicker, setHistoryTicker] = useState('SPY')
  const [flipDate, setFlipDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [lookbackRows, setLookbackRows] = useState(90)
  const [data, setData] = useState<SignalState>({
    screener: [],
    history: [],
    lastFlips: {},
    flips: [],
    composition: {},
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tickers = useMemo(() => parseTickers(tickerText), [tickerText])
  const selectedHistoryTicker = (historyTicker.trim().toUpperCase() || tickers[0] || 'SPY')

  async function loadSignals() {
    const normalizedTickers = tickers.length > 0 ? tickers : ['SPY']
    const tickerParam = normalizedTickers.join(',')
    setLoading(true)
    setError(null)
    try {
      const [screenerPayload, historyPayload, lastFlipsPayload, flipsPayload, compositionPayload] = await Promise.all([
        requestClientJson(`/api/screener/signals?tickers=${encodeURIComponent(tickerParam)}&limit=100`),
        requestClientJson(`/api/signals/history/${encodeURIComponent(selectedHistoryTicker)}?limit=100`),
        requestClientJson(`/api/signals/last-flips?tickers=${encodeURIComponent(tickerParam)}`),
        requestClientJson(`/api/signals/flips?date=${encodeURIComponent(flipDate)}&tickers=${encodeURIComponent(tickerParam)}`),
        requestClientJson(`/api/signals/composition?tickers=${encodeURIComponent(tickerParam)}&lookback_rows=${encodeURIComponent(String(lookbackRows))}`),
      ])
      setData({
        screener: Array.isArray(screenerPayload) ? screenerPayload : [],
        history: Array.isArray(historyPayload) ? historyPayload : [],
        lastFlips: asRecord(lastFlipsPayload) ?? {},
        flips: Array.isArray(flipsPayload) ? flipsPayload : [],
        composition: compositionPayload,
      })
    } catch (err) {
      setError(readApiError(err, 'Failed to load signal workspace data.'))
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
          <p className="eyebrow">Official Signals Control Room</p>
          <h1>Inspect signal behavior without pretending registry promotion or official evaluation exists yet.</h1>
          <p className="hero-copy">
            Uses existing finance-backend signal contracts for current screener signals, history, flips, and composition. Official model lineage and forward evaluation remain explicit backend gaps.
          </p>
        </div>
        <div className="hero-actions">
          <div className="small">Admin: {adminEmail}</div>
        </div>
      </div>

      <form className="card" onSubmit={onSubmit}>
        <h2>Ticker Selector</h2>
        <div className="row">
          <div>
            <label>Tickers</label>
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
          <button className="primary" type="submit" disabled={loading}>{loading ? 'Loading...' : 'Refresh signals'}</button>
        </div>
        <ApiErrorBox error={error} />
      </form>

      <div className="card">
        <h2>Latest / Screener Signal Table</h2>
        <p className="small">Backend: GET /screener/signals. Fields are rendered as returned; unknown fields remain available in each raw JSON row.</p>
        <DynamicTable rows={data.screener} columns={SCREENER_COLUMNS} />
      </div>

      <div className="card">
        <h2>Signal History: {selectedHistoryTicker}</h2>
        <p className="small">Backend: GET /signals/history/{'{ticker}'}. This panel shows known signal/history fields and keeps the full raw row available.</p>
        <DynamicTable rows={data.history} columns={HISTORY_COLUMNS} emptyLabel="No signal history returned." />
      </div>

      <div className="feature-grid">
        <div className="card compact-card">
          <h2>Last Flips</h2>
          <p className="small">Backend: GET /signals/last-flips.</p>
          <DynamicTable rows={lastFlipRows} columns={[{ key: 'ticker', label: 'Ticker' }, { key: 'lastFlipDate', label: 'Last Flip Date' }]} />
        </div>
        <div className="card compact-card">
          <h2>Flip Events By Date</h2>
          <p className="small">Backend: GET /signals/flips.</p>
          <DynamicTable rows={data.flips} columns={FLIP_COLUMNS} />
        </div>
      </div>

      <div className="card">
        <h2>Signal Composition</h2>
        <p className="small">Backend: GET /signals/composition. Known composition fields are tabulated; raw structured payload is preserved below.</p>
        <DynamicTable rows={compositionRows} />
        {compositionRows.length === 0 ? <EmptyState>No composition returned.</EmptyState> : null}
        <details className="details-block">
          <summary>Raw composition payload</summary>
          <JsonBlock value={data.composition} />
        </details>
      </div>

      <div className="card">
        <h2>Official Evaluation Gaps</h2>
        <p className="small">These are required before Backoffice can call this a complete official-signal evaluation surface.</p>
        <ul className="plain-list">
          {OFFICIAL_SIGNAL_GAPS.map((gap) => (
            <li key={gap}>{gap}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function parseTickers(value: string): string[] {
  return [...new Set(value.split(',').map((ticker) => ticker.trim().toUpperCase()).filter(Boolean))]
}
