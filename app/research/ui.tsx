'use client'

import Link from 'next/link'
import { useEffect, useEffectEvent, useMemo, useState } from 'react'

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

type ResearchExperiment = {
  experiment_id: string
  backend_job_id?: string | null
  status?: string | null
  requested_by?: string | null
  experiment_name?: string | null
  experiment_version?: string | null
  strategy_family?: string | null
  universe?: string | null
  symbols?: string[] | null
  horizon?: string | null
  orchestrator_config_ref?: string | null
  orchestrator_config_hash?: string | null
  registry_registration_enabled?: boolean | null
  dry_run?: boolean | null
  created_at?: string | null
  started_at?: string | null
  finished_at?: string | null
  error_message?: string | null
  result_json?: JsonValue
  result?: JsonValue
  candidate_id?: string | null
  bundle_id?: string | null
  feature_snapshot_id?: string | number | null
  snapshot_name?: string | null
  snapshot_version?: string | null
  ml_run_id?: string | number | null
  strategy_run_id?: string | number | null
  backtest_run_id?: string | number | null
  [key: string]: unknown
}

type ResearchEvent = {
  created_at?: string | null
  event_type?: string | null
  step?: string | null
  status?: string | null
  message?: string | null
  payload_json?: JsonValue
  payload?: JsonValue
  [key: string]: unknown
}

type ResearchArtifact = {
  created_at?: string | null
  artifact_type?: string | null
  artifact_ref?: string | null
  artifact_hash?: string | null
  payload_json?: JsonValue
  payload?: JsonValue
  [key: string]: unknown
}

type CreateExperimentInput = {
  requested_by: string
  experiment_name: string
  experiment_version: string
  strategy_family: string
  universe: string
  symbols: string
  horizon: string
  orchestrator_config_ref: string
  orchestrator_config_hash: string
  registry_registration_enabled: boolean
  dry_run: boolean
  config_json: string
}

const ACTIVE_STATUSES = new Set(['queued', 'running', 'pending', 'submitted', 'created', 'in_progress'])

function formatDate(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
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

function readListPayload<T>(payload: unknown, keys: string[]): T[] {
  if (Array.isArray(payload)) return payload as T[]
  const record = asRecord(payload)
  if (!record) return []
  for (const key of keys) {
    if (Array.isArray(record[key])) {
      return record[key] as T[]
    }
  }
  return []
}

function normalizeExperiment(payload: unknown): ResearchExperiment | null {
  const record = asRecord(payload)
  if (!record) return null
  const nested = asRecord(record.experiment)
  if (nested && typeof nested.experiment_id === 'string') {
    return nested as ResearchExperiment
  }
  if (typeof record.experiment_id === 'string') {
    return record as ResearchExperiment
  }
  return null
}

function normalizeExperiments(payload: unknown): ResearchExperiment[] {
  return readListPayload<ResearchExperiment>(payload, ['experiments', 'items', 'results']).filter(
    (item) => typeof item?.experiment_id === 'string'
  )
}

function normalizeEvents(payload: unknown): ResearchEvent[] {
  return readListPayload<ResearchEvent>(payload, ['events', 'items', 'results'])
}

function normalizeArtifacts(payload: unknown): ResearchArtifact[] {
  return readListPayload<ResearchArtifact>(payload, ['artifacts', 'items', 'results'])
}

function toTimestamp(value?: string | null): number {
  if (!value) return 0
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

function isActiveStatus(value?: string | null): boolean {
  return ACTIVE_STATUSES.has(String(value ?? '').trim().toLowerCase())
}

function trimOrNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed || null
}

function parseSymbols(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
}

function rootsForExperiment(experiment: ResearchExperiment): Array<Record<string, unknown>> {
  const top = asRecord(experiment)
  const topResult = asRecord(top?.result_json ?? top?.result)
  const topSourceRefs = asRecord(top?.source_refs ?? top?.lineage ?? top?.lineage_ids)
  const resultOutput = asRecord(topResult?.output)
  const resultLineage = asRecord(topResult?.lineage ?? topResult?.lineage_ids ?? topResult?.source_refs)

  return [top, topSourceRefs, topResult, resultOutput, resultLineage].filter(
    (value): value is Record<string, unknown> => value !== null
  )
}

function readExperimentValue(experiment: ResearchExperiment, keys: string[]): unknown {
  for (const root of rootsForExperiment(experiment)) {
    for (const key of keys) {
      const value = root[key]
      if (value !== null && value !== undefined && value !== '') {
        return value
      }
    }
  }
  return null
}

function readExperimentJson(experiment: ResearchExperiment): unknown {
  return readExperimentValue(experiment, ['result_json', 'result'])
}

function readPayloadJson(value: ResearchEvent | ResearchArtifact): unknown {
  return value.payload_json ?? value.payload ?? null
}

function readBackendJobId(experiment: ResearchExperiment): string {
  return renderText(readExperimentValue(experiment, ['backend_job_id', 'job_id']))
}

function readCandidateId(experiment: ResearchExperiment): string | null {
  const value = readExperimentValue(experiment, ['candidate_id'])
  return typeof value === 'string' && value.trim() ? value : null
}

function readBundleId(experiment: ResearchExperiment): string | null {
  const value = readExperimentValue(experiment, ['bundle_id'])
  return typeof value === 'string' && value.trim() ? value : null
}

function readLineageField(experiment: ResearchExperiment, kind: 'feature_snapshot_id' | 'snapshot_name' | 'snapshot_version' | 'ml_run_id' | 'strategy_run_id' | 'backtest_run_id'): unknown {
  if (kind === 'feature_snapshot_id') {
    return readExperimentValue(experiment, ['feature_snapshot_id'])
  }
  if (kind === 'snapshot_name') {
    return readExperimentValue(experiment, ['snapshot_name', 'source_feature_snapshot_name'])
  }
  if (kind === 'snapshot_version') {
    return readExperimentValue(experiment, ['snapshot_version', 'source_feature_snapshot_version'])
  }
  if (kind === 'ml_run_id') {
    return readExperimentValue(experiment, ['ml_run_id', 'source_ml_run_id'])
  }
  if (kind === 'strategy_run_id') {
    return readExperimentValue(experiment, ['strategy_run_id', 'source_strategy_run_id'])
  }
  return readExperimentValue(experiment, ['backtest_run_id', 'source_backtest_run_id'])
}

function statusClass(value: unknown): string {
  return `badge ${String(value ?? '').trim().toLowerCase()}`
}

function JsonDetails({ title, value }: { title: string; value: unknown }) {
  if (value === null || value === undefined || value === '') {
    return <p className="small">{title}: none</p>
  }

  return (
    <details>
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{title}</summary>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </details>
  )
}

export default function ResearchConsole({ adminEmail }: { adminEmail: string }) {
  const [requestedBy, setRequestedBy] = useState(adminEmail)
  const [experimentName, setExperimentName] = useState('')
  const [experimentVersion, setExperimentVersion] = useState('')
  const [strategyFamily, setStrategyFamily] = useState('')
  const [universe, setUniverse] = useState('')
  const [symbols, setSymbols] = useState('')
  const [horizon, setHorizon] = useState('')
  const [orchestratorConfigRef, setOrchestratorConfigRef] = useState('')
  const [orchestratorConfigHash, setOrchestratorConfigHash] = useState('')
  const [registryRegistrationEnabled, setRegistryRegistrationEnabled] = useState(false)
  const [dryRun, setDryRun] = useState(true)
  const [configJson, setConfigJson] = useState('')

  const [experiments, setExperiments] = useState<ResearchExperiment[]>([])
  const [currentExperiment, setCurrentExperiment] = useState<ResearchExperiment | null>(null)
  const [events, setEvents] = useState<ResearchEvent[]>([])
  const [artifacts, setArtifacts] = useState<ResearchArtifact[]>([])
  const [selectedExperimentId, setSelectedExperimentId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingExperiments, setLoadingExperiments] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function loadExperiments(options: { preferredExperimentId?: string | null } = {}) {
    setLoadingExperiments(true)
    try {
      const response = await fetch('/api/research/experiments?limit=50', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Failed to load experiments')
      }

      const list = normalizeExperiments(payload)
      setExperiments(list)

      const preferredExperimentId = options.preferredExperimentId ?? selectedExperimentId ?? currentExperiment?.experiment_id ?? null
      const hasPreferred = preferredExperimentId ? list.some((experiment) => experiment.experiment_id === preferredExperimentId) : false
      const nextExperiment = hasPreferred
        ? list.find((experiment) => experiment.experiment_id === preferredExperimentId) ?? null
        : (list[0] ?? null)

      setSelectedExperimentId(nextExperiment?.experiment_id ?? null)
      if (!nextExperiment) {
        setCurrentExperiment(null)
        setEvents([])
        setArtifacts([])
      } else if (!currentExperiment || currentExperiment.experiment_id !== nextExperiment.experiment_id) {
        setCurrentExperiment(nextExperiment)
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to load experiments')
    } finally {
      setLoadingExperiments(false)
    }
  }

  async function loadExperimentDetail(experimentId: string) {
    const response = await fetch(`/api/research/experiments/${encodeURIComponent(experimentId)}`, { cache: 'no-store' })
    const payload = await response.json()
    if (!response.ok) {
      throw new Error(payload?.error ?? 'Failed to load experiment detail')
    }

    const experiment = normalizeExperiment(payload)
    if (!experiment) {
      throw new Error('Experiment detail response was missing experiment data.')
    }

    return experiment
  }

  async function loadExperimentEvents(experimentId: string) {
    const response = await fetch(`/api/research/experiments/${encodeURIComponent(experimentId)}/events`, { cache: 'no-store' })
    const payload = await response.json()
    if (!response.ok) {
      throw new Error(payload?.error ?? 'Failed to load experiment events')
    }
    return normalizeEvents(payload)
  }

  async function loadExperimentArtifacts(experimentId: string) {
    const response = await fetch(`/api/research/experiments/${encodeURIComponent(experimentId)}/artifacts`, { cache: 'no-store' })
    const payload = await response.json()
    if (!response.ok) {
      throw new Error(payload?.error ?? 'Failed to load experiment artifacts')
    }
    return normalizeArtifacts(payload)
  }

  async function loadExperimentBundle(experimentId: string) {
    setLoadingDetail(true)
    try {
      const [experiment, loadedEvents, loadedArtifacts] = await Promise.all([
        loadExperimentDetail(experimentId),
        loadExperimentEvents(experimentId),
        loadExperimentArtifacts(experimentId),
      ])

      setCurrentExperiment(experiment)
      setEvents(loadedEvents)
      setArtifacts(loadedArtifacts)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to load experiment detail')
    } finally {
      setLoadingDetail(false)
    }
  }

  async function submitExperiment(input: CreateExperimentInput) {
    setSubmitting(true)
    setError(null)

    let parsedConfigJson: JsonValue | null = null
    if (input.config_json.trim()) {
      try {
        parsedConfigJson = JSON.parse(input.config_json) as JsonValue
      } catch {
        setSubmitting(false)
        setError('config_json must be valid JSON.')
        return
      }
    }

    try {
      const payload = {
        requested_by: trimOrNull(input.requested_by),
        experiment_name: trimOrNull(input.experiment_name),
        experiment_version: trimOrNull(input.experiment_version),
        strategy_family: trimOrNull(input.strategy_family),
        universe: trimOrNull(input.universe),
        symbols: parseSymbols(input.symbols),
        horizon: trimOrNull(input.horizon),
        orchestrator_config_ref: trimOrNull(input.orchestrator_config_ref),
        orchestrator_config_hash: trimOrNull(input.orchestrator_config_hash),
        registry_registration_enabled: input.registry_registration_enabled,
        dry_run: input.dry_run,
        config_json: parsedConfigJson,
      }

      const response = await fetch('/api/research/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await response.json()
      if (!response.ok) {
        throw new Error(body?.error ?? 'Failed to create experiment')
      }

      const createdExperiment = normalizeExperiment(body)
      const preferredExperimentId = createdExperiment?.experiment_id ?? null
      if (createdExperiment) {
        setCurrentExperiment(createdExperiment)
      }
      await loadExperiments({ preferredExperimentId })
      if (preferredExperimentId) {
        setSelectedExperimentId(preferredExperimentId)
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to create experiment')
    } finally {
      setSubmitting(false)
    }
  }

  function resetForm() {
    setExperimentName('')
    setExperimentVersion('')
    setStrategyFamily('')
    setUniverse('')
    setSymbols('')
    setHorizon('')
    setOrchestratorConfigRef('')
    setOrchestratorConfigHash('')
    setRegistryRegistrationEnabled(false)
    setDryRun(true)
    setConfigJson('')
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await submitExperiment({
      requested_by: requestedBy,
      experiment_name: experimentName,
      experiment_version: experimentVersion,
      strategy_family: strategyFamily,
      universe,
      symbols,
      horizon,
      orchestrator_config_ref: orchestratorConfigRef,
      orchestrator_config_hash: orchestratorConfigHash,
      registry_registration_enabled: registryRegistrationEnabled,
      dry_run: dryRun,
      config_json: configJson,
    })
  }

  const loadExperimentsEffect = useEffectEvent((options?: { preferredExperimentId?: string | null }) => {
    void loadExperiments(options)
  })

  const loadExperimentBundleEffect = useEffectEvent((experimentId: string) => {
    void loadExperimentBundle(experimentId)
  })

  useEffect(() => {
    const timer = setTimeout(() => {
      loadExperimentsEffect()
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!selectedExperimentId) return
    const timer = setTimeout(() => {
      loadExperimentBundleEffect(selectedExperimentId)
    }, 0)
    return () => clearTimeout(timer)
  }, [selectedExperimentId])

  useEffect(() => {
    if (!selectedExperimentId || !isActiveStatus(currentExperiment?.status)) return
    const timer = setInterval(() => {
      loadExperimentsEffect({ preferredExperimentId: selectedExperimentId })
      loadExperimentBundleEffect(selectedExperimentId)
    }, 4000)
    return () => clearInterval(timer)
  }, [selectedExperimentId, currentExperiment?.status])

  const sortedExperiments = useMemo(() => {
    return [...experiments].sort((a, b) => toTimestamp(b.created_at) - toTimestamp(a.created_at))
  }, [experiments])

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => toTimestamp(a.created_at) - toTimestamp(b.created_at))
  }, [events])

  const sortedArtifacts = useMemo(() => {
    return [...artifacts].sort((a, b) => toTimestamp(b.created_at) - toTimestamp(a.created_at))
  }, [artifacts])

  const candidateId = currentExperiment ? readCandidateId(currentExperiment) : null
  const bundleId = currentExperiment ? readBundleId(currentExperiment) : null
  const resultJson = currentExperiment ? readExperimentJson(currentExperiment) : null

  return (
    <div>
      <div className="card">
        <h2>Research Experiments</h2>
        <p className="small">Admin: {adminEmail}</p>
        <p className="small">Launches and inspects experiments through finance-backend. Execution remains outside the backoffice.</p>
      </div>

      <div className="card">
        <div className="split-row">
          <div>
            <h3>Create Experiment</h3>
            <p className="small">Submit a broad experiment request plus optional config JSON. The backend/orchestrator owns execution.</p>
          </div>
          <div style={{ minWidth: 180 }}>
            <button className="secondary" type="button" onClick={resetForm}>
              Clear Form
            </button>
          </div>
        </div>
        <form onSubmit={onSubmit}>
          <div className="row">
            <div>
              <label htmlFor="requestedBy">requested_by</label>
              <input id="requestedBy" value={requestedBy} onChange={(event) => setRequestedBy(event.target.value)} required />
            </div>
            <div>
              <label htmlFor="experimentName">experiment_name</label>
              <input id="experimentName" value={experimentName} onChange={(event) => setExperimentName(event.target.value)} />
            </div>
            <div>
              <label htmlFor="experimentVersion">experiment_version</label>
              <input id="experimentVersion" value={experimentVersion} onChange={(event) => setExperimentVersion(event.target.value)} />
            </div>
            <div>
              <label htmlFor="strategyFamily">strategy_family</label>
              <input id="strategyFamily" value={strategyFamily} onChange={(event) => setStrategyFamily(event.target.value)} />
            </div>
          </div>

          <div className="row" style={{ marginTop: 10 }}>
            <div>
              <label htmlFor="universe">universe</label>
              <input id="universe" value={universe} onChange={(event) => setUniverse(event.target.value)} />
            </div>
            <div>
              <label htmlFor="symbols">symbols</label>
              <input id="symbols" value={symbols} onChange={(event) => setSymbols(event.target.value)} placeholder="SPY, AAPL, MSFT" />
            </div>
            <div>
              <label htmlFor="horizon">horizon</label>
              <input id="horizon" value={horizon} onChange={(event) => setHorizon(event.target.value)} placeholder="swing_daily" />
            </div>
            <div>
              <label htmlFor="orchestratorConfigRef">orchestrator_config_ref</label>
              <input id="orchestratorConfigRef" value={orchestratorConfigRef} onChange={(event) => setOrchestratorConfigRef(event.target.value)} />
            </div>
          </div>

          <div className="row" style={{ marginTop: 10 }}>
            <div>
              <label htmlFor="orchestratorConfigHash">orchestrator_config_hash</label>
              <input id="orchestratorConfigHash" value={orchestratorConfigHash} onChange={(event) => setOrchestratorConfigHash(event.target.value)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'end' }}>
              <label style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={registryRegistrationEnabled}
                  onChange={(event) => setRegistryRegistrationEnabled(event.target.checked)}
                  style={{ width: 'auto' }}
                />
                registry_registration_enabled
              </label>
            </div>
            <div style={{ display: 'flex', alignItems: 'end' }}>
              <label style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(event) => setDryRun(event.target.checked)}
                  style={{ width: 'auto' }}
                />
                dry_run
              </label>
            </div>
            <div style={{ display: 'flex', alignItems: 'end' }}>
              <button className="primary" type="submit" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Launch Experiment'}
              </button>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label htmlFor="configJson">config_json</label>
            <textarea
              id="configJson"
              rows={10}
              value={configJson}
              onChange={(event) => setConfigJson(event.target.value)}
              placeholder={'{\n  "feature_set": "spy_meta_v2"\n}'}
            />
          </div>
        </form>
      </div>

      {error ? <div className="error">{error}</div> : null}

      <div className="card">
        <div className="split-row">
          <div>
            <h3>Recent Experiments</h3>
            <p className="small">Select an experiment to load detail, events, and artifacts.</p>
          </div>
          <div style={{ minWidth: 180 }}>
            <button className="secondary" type="button" onClick={() => void loadExperiments({ preferredExperimentId: selectedExperimentId })}>
              Refresh Experiments
            </button>
          </div>
        </div>

        {loadingExperiments ? <p className="small">Loading experiments...</p> : null}
        {!loadingExperiments && sortedExperiments.length === 0 ? <p className="small">No experiments found.</p> : null}
        {sortedExperiments.length > 0 ? (
          <div className="table-wrap">
            <table className="registry-table">
              <thead>
                <tr>
                  <th>Experiment</th>
                  <th>Status</th>
                  <th>Backend Job</th>
                  <th>Family / Universe</th>
                  <th>Created</th>
                  <th>Finished</th>
                  <th>Candidate / Bundle</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sortedExperiments.map((experiment) => {
                  const experimentCandidateId = readCandidateId(experiment)
                  const experimentBundleId = readBundleId(experiment)

                  return (
                    <tr key={experiment.experiment_id}>
                      <td>
                        <strong>{experiment.experiment_id}</strong>
                        <div className="small">{renderText(experiment.experiment_name)}</div>
                      </td>
                      <td><span className={statusClass(experiment.status)}>{renderText(experiment.status)}</span></td>
                      <td>{readBackendJobId(experiment)}</td>
                      <td>{renderText(experiment.strategy_family)} / {renderText(experiment.universe)}</td>
                      <td>{formatDate(experiment.created_at)}</td>
                      <td>{formatDate(experiment.finished_at)}</td>
                      <td>
                        <div>{experimentCandidateId ?? '—'}</div>
                        <div className="small">{experimentBundleId ?? '—'}</div>
                      </td>
                      <td>
                        <button
                          className="secondary"
                          type="button"
                          onClick={() => {
                            setCurrentExperiment(experiment)
                            setSelectedExperimentId(experiment.experiment_id)
                          }}
                        >
                          {selectedExperimentId === experiment.experiment_id ? 'Selected' : 'Open'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <div className="card">
        <h3>Experiment Detail</h3>
        {loadingDetail ? <p className="small">Loading detail...</p> : null}
        {!currentExperiment ? (
          <p className="small">Select an experiment to inspect it.</p>
        ) : (
          <>
            <div className="meta">
              <span className={statusClass(currentExperiment.status)}>{renderText(currentExperiment.status)}</span>
              <span className="small">experiment_id: {currentExperiment.experiment_id}</span>
              <span className="small">backend_job_id: {readBackendJobId(currentExperiment)}</span>
            </div>

            <div className="field-grid" style={{ marginTop: 12 }}>
              <div>
                <label>requested_by</label>
                <div className="field-value">{renderText(currentExperiment.requested_by)}</div>
              </div>
              <div>
                <label>experiment_name</label>
                <div className="field-value">{renderText(currentExperiment.experiment_name)}</div>
              </div>
              <div>
                <label>experiment_version</label>
                <div className="field-value">{renderText(currentExperiment.experiment_version)}</div>
              </div>
              <div>
                <label>strategy_family</label>
                <div className="field-value">{renderText(currentExperiment.strategy_family)}</div>
              </div>
              <div>
                <label>universe</label>
                <div className="field-value">{renderText(currentExperiment.universe)}</div>
              </div>
              <div>
                <label>symbols</label>
                <div className="field-value">{Array.isArray(currentExperiment.symbols) ? currentExperiment.symbols.join(', ') : '—'}</div>
              </div>
              <div>
                <label>created_at</label>
                <div className="field-value">{formatDate(currentExperiment.created_at)}</div>
              </div>
              <div>
                <label>started_at</label>
                <div className="field-value">{formatDate(currentExperiment.started_at)}</div>
              </div>
              <div>
                <label>finished_at</label>
                <div className="field-value">{formatDate(currentExperiment.finished_at)}</div>
              </div>
            </div>

            {currentExperiment.error_message ? (
              <div className="error">{currentExperiment.error_message}</div>
            ) : null}

            <div className="card compact-card" style={{ marginTop: 16 }}>
              <h4>Lineage IDs</h4>
              <div className="field-grid">
                <div>
                  <label>feature_snapshot_id</label>
                  <div className="field-value">{renderText(readLineageField(currentExperiment, 'feature_snapshot_id'))}</div>
                </div>
                <div>
                  <label>snapshot_name</label>
                  <div className="field-value">{renderText(readLineageField(currentExperiment, 'snapshot_name'))}</div>
                </div>
                <div>
                  <label>snapshot_version</label>
                  <div className="field-value">{renderText(readLineageField(currentExperiment, 'snapshot_version'))}</div>
                </div>
                <div>
                  <label>ml_run_id</label>
                  <div className="field-value">{renderText(readLineageField(currentExperiment, 'ml_run_id'))}</div>
                </div>
                <div>
                  <label>strategy_run_id</label>
                  <div className="field-value">{renderText(readLineageField(currentExperiment, 'strategy_run_id'))}</div>
                </div>
                <div>
                  <label>backtest_run_id</label>
                  <div className="field-value">{renderText(readLineageField(currentExperiment, 'backtest_run_id'))}</div>
                </div>
                <div>
                  <label>candidate_id</label>
                  <div className="field-value">
                    {candidateId ? <Link href={`/registry/candidates/${encodeURIComponent(candidateId)}`}>{candidateId}</Link> : '—'}
                  </div>
                </div>
                <div>
                  <label>bundle_id</label>
                  <div className="field-value">
                    {bundleId ? <Link href={`/registry/bundles/${encodeURIComponent(bundleId)}`}>{bundleId}</Link> : '—'}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <JsonDetails title="result_json" value={resultJson} />
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h3>Events</h3>
        {!currentExperiment ? (
          <p className="small">Select an experiment to inspect events.</p>
        ) : sortedEvents.length === 0 ? (
          <p className="small">No events returned.</p>
        ) : (
          <div className="list-stack">
            {sortedEvents.map((event, index) => (
              <div className="list-row" key={`${event.created_at ?? 'event'}-${event.event_type ?? 'type'}-${index}`}>
                <div>
                  <div>
                    <strong>{renderText(event.event_type)}</strong> · {renderText(event.step)}
                  </div>
                  <div className="small">{formatDate(event.created_at)} · {renderText(event.status)}</div>
                  <div>{renderText(event.message)}</div>
                </div>
                <div style={{ minWidth: 220 }}>
                  <JsonDetails title="payload_json" value={readPayloadJson(event)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h3>Artifacts</h3>
        {!currentExperiment ? (
          <p className="small">Select an experiment to inspect artifacts.</p>
        ) : sortedArtifacts.length === 0 ? (
          <p className="small">No artifacts returned.</p>
        ) : (
          <div className="list-stack">
            {sortedArtifacts.map((artifact, index) => (
              <div className="list-row" key={`${artifact.created_at ?? 'artifact'}-${artifact.artifact_ref ?? 'ref'}-${index}`}>
                <div>
                  <div>
                    <strong>{renderText(artifact.artifact_type)}</strong> · {renderText(artifact.artifact_ref)}
                  </div>
                  <div className="small">{formatDate(artifact.created_at)}</div>
                  <div className="small">artifact_hash: {renderText(artifact.artifact_hash)}</div>
                </div>
                <div style={{ minWidth: 220 }}>
                  <JsonDetails title="payload_json" value={readPayloadJson(artifact)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
