'use client'

import { useState } from 'react'
import Link from 'next/link'
import { readApiError } from '@/lib/api-error'
import { requestClientJson } from '@/lib/client-json'
import { experimentAnchorId, type ResearchExperiment } from '@/components/research/ExperimentTable'

type Props = {
  adminEmail: string
  onCreated: (experiment: ResearchExperiment) => void | Promise<void>
}

type EvaluationMode = 'backtest' | 'dry_run'

export function NewExperimentForm({ adminEmail, onCreated }: Props) {
  const [tickerText, setTickerText] = useState('SPY')
  const [horizon, setHorizon] = useState('20d')
  const [customHorizon, setCustomHorizon] = useState('')
  const [modelFamily, setModelFamily] = useState('')
  const [featureSet, setFeatureSet] = useState('')
  const [evaluationMode, setEvaluationMode] = useState<EvaluationMode>('backtest')
  const [runMode, setRunMode] = useState('single')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdExperiment, setCreatedExperiment] = useState<ResearchExperiment | null>(null)

  async function submit() {
    setSubmitting(true)
    setError(null)
    setCreatedExperiment(null)
    try {
      const symbols = parseSymbols(tickerText)
      const normalizedHorizon = horizon === 'custom' ? customHorizon.trim() : horizon
      const strategy = modelFamily.trim()
      const payload = {
        requested_by: adminEmail,
        experiment_name: [strategy || 'experiment', symbols.join('-') || 'universe', normalizedHorizon || 'horizon'].join('-'),
        experiment_version: 'v1',
        strategy_family: strategy || null,
        universe: symbols.join(',') || tickerText.trim() || null,
        symbols,
        horizon: normalizedHorizon || null,
        dry_run: evaluationMode === 'dry_run',
        registry_registration_enabled: false,
        config_json: {
          ticker_or_universe: tickerText.trim(),
          horizon: normalizedHorizon || null,
          model_strategy_family: strategy || null,
          feature_set: featureSet.trim() || null,
          evaluation_mode: evaluationMode,
          run_mode: runMode,
        },
      }

      const response = await requestClientJson('/api/research/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const experiment = normalizeExperiment(response)
      if (!experiment) {
        throw new Error('Backend response did not include an experiment ID.')
      }
      setCreatedExperiment(experiment)
      await onCreated(experiment)
    } catch (requestError) {
      setError(readApiError(requestError, 'Failed to launch experiment.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card">
      <div className="split-row">
        <div>
          <h2>New experiment</h2>
          <p className="small">Launch a backend research run using free-text model and feature inputs.</p>
        </div>
        <div style={{ minWidth: 220 }}>
          <button className="primary" type="button" onClick={() => void submit()} disabled={submitting || !tickerText.trim()}>
            {submitting ? 'Launching...' : 'Launch experiment'}
          </button>
        </div>
      </div>

      <div className="row">
        <div>
          <label htmlFor="researchTicker">Ticker / universe</label>
          <input id="researchTicker" value={tickerText} onChange={(event) => setTickerText(event.target.value)} placeholder="SPY" />
        </div>
        <div>
          <label htmlFor="researchHorizon">Horizon</label>
          <select id="researchHorizon" value={horizon} onChange={(event) => setHorizon(event.target.value)}>
            <option value="5d">5d</option>
            <option value="10d">10d</option>
            <option value="20d">20d</option>
            <option value="60d">60d</option>
            <option value="custom">custom</option>
          </select>
        </div>
        <div>
          <label htmlFor="researchCustomHorizon">Custom horizon</label>
          <input id="researchCustomHorizon" value={customHorizon} onChange={(event) => setCustomHorizon(event.target.value)} disabled={horizon !== 'custom'} placeholder="30d" />
        </div>
        <div>
          <label htmlFor="researchModelFamily">Model / strategy family</label>
          <input id="researchModelFamily" value={modelFamily} onChange={(event) => setModelFamily(event.target.value)} placeholder="free text" />
        </div>
      </div>

      <div className="row" style={{ marginTop: 10 }}>
        <div>
          <label htmlFor="researchFeatureSet">Feature set</label>
          <input id="researchFeatureSet" value={featureSet} onChange={(event) => setFeatureSet(event.target.value)} placeholder="optional" />
        </div>
        <div>
          <label htmlFor="researchEvaluationMode">Evaluation mode</label>
          <select id="researchEvaluationMode" value={evaluationMode} onChange={(event) => setEvaluationMode(event.target.value as EvaluationMode)}>
            <option value="backtest">Backtest</option>
            <option value="dry_run">Dry run</option>
          </select>
        </div>
        <div>
          <label htmlFor="researchRunMode">Run mode</label>
          <select id="researchRunMode" value={runMode} onChange={(event) => setRunMode(event.target.value)}>
            <option value="single">Single run</option>
            <option value="campaign" disabled title="coming soon">Campaign — coming soon</option>
          </select>
        </div>
      </div>

      {createdExperiment ? (
        <div className="success" style={{ marginTop: 12 }}>
          Created experiment {createdExperiment.experiment_id}.{' '}
          <Link className="text-link" href={`#${experimentAnchorId(createdExperiment.experiment_id)}`}>
            View in table
          </Link>
        </div>
      ) : null}
      {error ? <div className="error" style={{ marginTop: 12 }}>{error}</div> : null}
    </div>
  )
}

function parseSymbols(value: string): string[] {
  const seen = new Set<string>()
  return value
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter((item) => {
      if (!item || seen.has(item)) return false
      seen.add(item)
      return true
    })
}

function normalizeExperiment(payload: unknown): ResearchExperiment | null {
  const record = asRecord(payload)
  const nested = asRecord(record?.experiment)
  if (typeof nested?.experiment_id === 'string') return nested as ResearchExperiment
  if (typeof record?.experiment_id === 'string') return record as ResearchExperiment
  return null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}
