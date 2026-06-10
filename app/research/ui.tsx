'use client'

import Link from 'next/link'
import { type ReactNode, useEffect, useEffectEvent, useMemo, useState } from 'react'
import { isProxyDiagnostic, readApiError } from '@/lib/api-error'

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

type ResearchExperiment = {
  experiment_id: string
  backend_job_id?: string | null
  worker_job_id?: string | null
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
  config_json?: JsonValue
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
  event_id?: string | null
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
  artifact_id?: string | null
  created_at?: string | null
  artifact_type?: string | null
  artifact_ref?: string | null
  artifact_hash?: string | null
  payload_json?: JsonValue
  payload?: JsonValue
  [key: string]: unknown
}

type ResearchAdminAction = 'cancel' | 'mark-failed'

type StageStatus = 'not started' | 'running' | 'completed' | 'failed' | 'warning' | 'unavailable'

type BuilderMode = 'new_signal_idea' | 'new_feature_set' | 'new_model_setup' | 'new_strategy_rule' | 'reuse_existing_lineage' | 'backtest_existing_candidate'
type UniverseMode = 'spy_only' | 'single_ticker' | 'watchlist' | 'custom_basket'
type RunMode = 'validate_only' | 'full_research_run'
type RegistryMode = 'do_not_register' | 'register_if_passes'

const ACTIVE_STATUSES = new Set(['queued', 'running', 'pending', 'submitted', 'created', 'in_progress'])
const ADMIN_ACTION_STATUSES = new Set(['queued', 'running'])
const DEFAULT_LIMIT = 200

const BUILDER_OPTIONS = {
  testKinds: [
    ['new_signal_idea', 'New signal idea'],
    ['new_feature_set', 'New feature set'],
    ['new_model_setup', 'New model setup'],
    ['new_strategy_rule', 'New strategy rule'],
    ['reuse_existing_lineage', 'Reuse existing lineage / run'],
    ['backtest_existing_candidate', 'Backtest existing candidate'],
  ] as Array<[BuilderMode, string]>,
  universes: [
    ['spy_only', 'SPY only'],
    ['single_ticker', 'Single ticker'],
    ['watchlist', 'Watchlist'],
    ['custom_basket', 'Custom basket'],
  ] as Array<[UniverseMode, string]>,
  horizons: ['5d', '20d', 'swing_daily'],
  dataWindows: ['Last 2 years', 'Last 5 years', 'Custom'],
  featureSets: ['Current baseline features', 'Existing feature snapshot', 'New feature recipe'],
  models: ['Baseline model', 'Existing ML run', 'New training run'],
  strategies: ['Q40/Q41', 'Track A', 'Track B', 'Custom rule'],
  backtests: ['Default costs', 'Conservative costs', 'Custom costs'],
}

function formatDate(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function toTimestamp(value?: string | null): number {
  if (!value) return 0
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
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

function trimOrNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed || null
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

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
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
  return readListPayload<ResearchExperiment>(payload, ['jobs', 'experiments', 'items', 'results']).filter(
    (item) => typeof item?.experiment_id === 'string'
  )
}

function normalizeEvents(payload: unknown): ResearchEvent[] {
  return readListPayload<ResearchEvent>(payload, ['events', 'items', 'results'])
}

function normalizeArtifacts(payload: unknown): ResearchArtifact[] {
  return readListPayload<ResearchArtifact>(payload, ['artifacts', 'items', 'results'])
}

function readExperimentRoots(experiment: ResearchExperiment): Array<Record<string, unknown>> {
  const top = asRecord(experiment)
  const topResult = asRecord(top?.result_json ?? top?.result)
  const output = asRecord(topResult?.output)
  const lineage = asRecord(topResult?.lineage ?? topResult?.source_refs ?? top?.lineage)
  return [top, topResult, output, lineage].filter((value): value is Record<string, unknown> => value !== null)
}

function readExperimentValue(experiment: ResearchExperiment, keys: string[]): unknown {
  for (const root of readExperimentRoots(experiment)) {
    for (const key of keys) {
      const value = root[key]
      if (value !== null && value !== undefined && value !== '') {
        return value
      }
    }
  }
  return null
}

function readCandidateId(experiment: ResearchExperiment): string | null {
  const value = readExperimentValue(experiment, ['candidate_id'])
  return typeof value === 'string' && value.trim() ? value : null
}

function readBundleId(experiment: ResearchExperiment): string | null {
  const value = readExperimentValue(experiment, ['bundle_id'])
  return typeof value === 'string' && value.trim() ? value : null
}

function readPayloadJson(value: ResearchEvent | ResearchArtifact): unknown {
  return value.payload_json ?? value.payload ?? null
}

function statusClass(value: unknown): string {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized === 'queued' || normalized === 'running' || normalized === 'completed' || normalized === 'failed') {
    return `badge ${normalized}`
  }
  if (normalized === 'cancelled' || normalized === 'canceled') {
    return 'badge cancelled'
  }
  return 'badge'
}

function isActiveStatus(value?: string | null): boolean {
  return ACTIVE_STATUSES.has(String(value ?? '').trim().toLowerCase())
}

function isAdminActionStatus(value?: string | null): boolean {
  return ADMIN_ACTION_STATUSES.has(String(value ?? '').trim().toLowerCase())
}

function stageClass(status: StageStatus): string {
  if (status === 'completed') return 'badge completed'
  if (status === 'running') return 'badge running'
  if (status === 'failed') return 'badge failed'
  if (status === 'warning') return 'badge queued'
  if (status === 'unavailable') return 'badge cancelled'
  return 'badge'
}

async function requestJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, { cache: 'no-store', ...init })
  const payload = await response.json()
  if (!response.ok) {
    throw payload
  }
  return payload
}

function deriveUniverseLabel(mode: UniverseMode, symbols: string[]): string {
  if (mode === 'spy_only') return 'spy-only'
  if (mode === 'single_ticker') return symbols[0] ?? 'single-ticker'
  if (mode === 'watchlist') return 'watchlist'
  return 'custom-basket'
}

function deriveStageChecks(experiment: ResearchExperiment, events: ResearchEvent[], artifacts: ResearchArtifact[]) {
  const loweredEvents = events.map((event) => ({
    status: String(event.status ?? '').toLowerCase(),
    text: `${String(event.event_type ?? '')} ${String(event.step ?? '')} ${String(event.message ?? '')}`.toLowerCase(),
  }))
  const loweredArtifacts = artifacts.map((artifact) => ({
    text: `${String(artifact.artifact_type ?? '')} ${String(artifact.artifact_ref ?? '')}`.toLowerCase(),
  }))

  function lookup(patterns: string[], completionFields: string[] = [], requested = true): { status: StageStatus; note: string } {
    const matches = loweredEvents.filter((event) => patterns.some((pattern) => event.text.includes(pattern)))
    const hasArtifact = loweredArtifacts.some((artifact) => patterns.some((pattern) => artifact.text.includes(pattern)))
    const hasCompletionField = completionFields.some((field) => readExperimentValue(experiment, [field]) !== null)
    const hasFailed = matches.some((event) => event.status === 'failed')
    const hasRunning = matches.some((event) => event.status === 'running' || event.status === 'queued')
    const hasWarning = matches.some((event) => event.status === 'warning')
    const hasCompleted = matches.some((event) => event.status === 'completed' || event.status === 'succeeded')

    if (hasFailed) return { status: 'failed', note: 'A stage event reported failure.' }
    if (hasCompletionField || hasArtifact || hasCompleted) return { status: 'completed', note: 'Stage evidence was returned by backend events, artifacts, or lineage fields.' }
    if (hasRunning) return { status: 'running', note: 'The backend is still reporting this stage in flight.' }
    if (hasWarning) return { status: 'warning', note: 'The backend returned a warning for this stage.' }
    if (!requested) return { status: 'unavailable', note: 'This stage was not requested for the run.' }
    if (experiment.status === 'queued') return { status: 'not started', note: 'The run is queued and no stage evidence is available yet.' }
    return { status: 'unavailable', note: 'Backend does not expose enough structured stage evidence to prove progress here yet.' }
  }

  return [
    {
      name: 'Preflight',
      ...lookup(['preflight', 'validate', 'validation', 'pit', 'leakage']),
      detail: 'Config validated, data availability checked, PIT/no-leakage constraints declared.',
    },
    {
      name: 'Feature Store',
      ...lookup(['feature', 'snapshot'], ['feature_snapshot_id', 'snapshot_name', 'snapshot_version']),
      detail: 'Feature snapshot and source-quality evidence.',
    },
    {
      name: 'ML Lab',
      ...lookup(['ml', 'model', 'prediction'], ['ml_run_id']),
      detail: 'Label config, split policy, ML run, and prediction panel.',
    },
    {
      name: 'Strategy Lab',
      ...lookup(['strategy', 'track a', 'track b', 'q40', 'q41'], ['strategy_run_id']),
      detail: 'Strategy rule execution and exposure intent output.',
    },
    {
      name: 'Backtest',
      ...lookup(['backtest', 'robustness', 'cost'], ['backtest_run_id']),
      detail: 'Backtest run, costs profile, metrics, and robustness summary.',
    },
    {
      name: 'Registry',
      ...lookup(['registry', 'candidate', 'bundle'], ['candidate_id', 'bundle_id'], Boolean(experiment.registry_registration_enabled)),
      detail: 'Candidate, bundle, and readiness-facing evidence.',
    },
  ]
}

function stageReachedText(experiment: ResearchExperiment, events: ResearchEvent[], artifacts: ResearchArtifact[]): string {
  const stages = deriveStageChecks(experiment, events, artifacts)
  const lastCompleted = [...stages].reverse().find((stage) => stage.status === 'completed' || stage.status === 'running' || stage.status === 'failed')
  return lastCompleted?.name ?? 'Not enough backend stage evidence yet'
}

function RequestErrorCard({ error }: { error: unknown }) {
  if (!error) return null

  if (isProxyDiagnostic(error)) {
    const upstreamStatus = typeof error.upstreamStatus === 'number' ? error.upstreamStatus : null
    return (
      <div className="error">
        <strong>{String(error.error)}</strong>
        <div>{String(error.message)}</div>
        {upstreamStatus ? <div className="small">Upstream status: {upstreamStatus}</div> : null}
        {typeof error.upstreamContentType === 'string' ? <div className="small">Content-Type: {error.upstreamContentType}</div> : null}
        {typeof error.upstreamBodyPreview === 'string' && error.upstreamBodyPreview ? (
          <pre>{error.upstreamBodyPreview}</pre>
        ) : null}
      </div>
    )
  }

  const message = error instanceof Error ? error.message : readApiError(error, 'Request failed.')
  return <div className="error">{message}</div>
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
  const [whatTesting, setWhatTesting] = useState<BuilderMode>('new_signal_idea')
  const [hypothesisName, setHypothesisName] = useState('')
  const [runVersion, setRunVersion] = useState('v1')
  const [universeMode, setUniverseMode] = useState<UniverseMode>('spy_only')
  const [tickers, setTickers] = useState('SPY')
  const [predictionHorizon, setPredictionHorizon] = useState('5d')
  const [dataWindow, setDataWindow] = useState('Last 2 years')
  const [customDataWindow, setCustomDataWindow] = useState('')
  const [featureSet, setFeatureSet] = useState('Current baseline features')
  const [modelSetup, setModelSetup] = useState('Baseline model')
  const [strategyTemplate, setStrategyTemplate] = useState('Q40/Q41')
  const [backtestProfile, setBacktestProfile] = useState('Default costs')
  const [runMode, setRunMode] = useState<RunMode>('validate_only')
  const [registryMode, setRegistryMode] = useState<RegistryMode>('do_not_register')
  const [reuseReference, setReuseReference] = useState('')
  const [candidateReference, setCandidateReference] = useState('')
  const [advancedMode, setAdvancedMode] = useState(false)
  const [advancedConfigJson, setAdvancedConfigJson] = useState('')
  const [advancedStrategyFamily, setAdvancedStrategyFamily] = useState('')
  const [advancedUniverse, setAdvancedUniverse] = useState('')
  const [advancedOrchestratorConfigRef, setAdvancedOrchestratorConfigRef] = useState('')
  const [advancedOrchestratorConfigHash, setAdvancedOrchestratorConfigHash] = useState('')

  const [experiments, setExperiments] = useState<ResearchExperiment[]>([])
  const [selectedExperimentId, setSelectedExperimentId] = useState<string | null>(null)
  const [compareExperimentId, setCompareExperimentId] = useState<string | null>(null)
  const [currentExperiment, setCurrentExperiment] = useState<ResearchExperiment | null>(null)
  const [events, setEvents] = useState<ResearchEvent[]>([])
  const [artifacts, setArtifacts] = useState<ResearchArtifact[]>([])
  const [loadingExperiments, setLoadingExperiments] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [adminActionReason, setAdminActionReason] = useState('')
  const [adminActionSubmitting, setAdminActionSubmitting] = useState<ResearchAdminAction | null>(null)

  const [statusFilter, setStatusFilter] = useState('')
  const [createdByFilter, setCreatedByFilter] = useState('')
  const [universeFilter, setUniverseFilter] = useState('')
  const [strategyFilter, setStrategyFilter] = useState('')
  const [textFilter, setTextFilter] = useState('')
  const [dateFromFilter, setDateFromFilter] = useState('')
  const [dateToFilter, setDateToFilter] = useState('')
  const [hasCandidateOnly, setHasCandidateOnly] = useState(false)
  const [hasBundleOnly, setHasBundleOnly] = useState(false)

  const parsedSymbols = useMemo(() => parseSymbols(tickers), [tickers])

  const generatedConfig = useMemo(() => ({
    ui_contract_version: 'backoffice_simple_builder_v1',
    hypothesis: {
      type: whatTesting,
      name: hypothesisName || null,
      created_by: adminEmail,
    },
    universe: {
      mode: universeMode,
      symbols: parsedSymbols,
    },
    research_scope: {
      prediction_horizon: predictionHorizon,
      data_window: dataWindow === 'Custom' ? customDataWindow || 'custom-window-not-specified' : dataWindow,
    },
    feature_set: featureSet,
    model_setup: modelSetup,
    strategy: strategyTemplate,
    backtest: backtestProfile,
    run_mode: runMode,
    registry_mode: registryMode,
    references: {
      reuse_run_or_lineage: reuseReference || null,
      candidate_id: candidateReference || null,
    },
  }), [
    adminEmail,
    backtestProfile,
    candidateReference,
    customDataWindow,
    dataWindow,
    featureSet,
    hypothesisName,
    modelSetup,
    parsedSymbols,
    predictionHorizon,
    registryMode,
    reuseReference,
    runMode,
    strategyTemplate,
    universeMode,
    whatTesting,
  ])

  const generatedPayload = useMemo(() => ({
    requested_by: adminEmail,
    experiment_name: hypothesisName.trim() || `${slugify(whatTesting)}-${slugify(strategyTemplate)}-${predictionHorizon}`,
    experiment_version: runVersion.trim() || 'v1',
    strategy_family: advancedStrategyFamily.trim() || slugify(strategyTemplate) || 'research-run',
    universe: advancedUniverse.trim() || deriveUniverseLabel(universeMode, parsedSymbols),
    symbols: parsedSymbols,
    horizon: predictionHorizon,
    dry_run: runMode === 'validate_only',
    registry_registration_enabled: registryMode === 'register_if_passes',
    orchestrator_config_ref: trimOrNull(advancedOrchestratorConfigRef),
    orchestrator_config_hash: trimOrNull(advancedOrchestratorConfigHash),
    config_json: generatedConfig,
  }), [
    adminEmail,
    advancedOrchestratorConfigHash,
    advancedOrchestratorConfigRef,
    advancedStrategyFamily,
    advancedUniverse,
    generatedConfig,
    hypothesisName,
    parsedSymbols,
    predictionHorizon,
    registryMode,
    runMode,
    runVersion,
    strategyTemplate,
    universeMode,
    whatTesting,
  ])

  const sortedExperiments = useMemo(
    () => [...experiments].sort((a, b) => toTimestamp(b.created_at) - toTimestamp(a.created_at)),
    [experiments]
  )

  const filteredExperiments = useMemo(() => {
    return sortedExperiments.filter((experiment) => {
      if (statusFilter && String(experiment.status ?? '').toLowerCase() !== statusFilter.toLowerCase()) return false
      if (createdByFilter && !String(experiment.requested_by ?? '').toLowerCase().includes(createdByFilter.toLowerCase())) return false
      if (universeFilter) {
        const haystack = `${String(experiment.universe ?? '')} ${(experiment.symbols ?? []).join(',')}`.toLowerCase()
        if (!haystack.includes(universeFilter.toLowerCase())) return false
      }
      if (strategyFilter && !String(experiment.strategy_family ?? '').toLowerCase().includes(strategyFilter.toLowerCase())) return false
      if (textFilter) {
        const haystack = `${String(experiment.experiment_name ?? '')} ${String(experiment.experiment_id ?? '')} ${String(experiment.experiment_version ?? '')}`.toLowerCase()
        if (!haystack.includes(textFilter.toLowerCase())) return false
      }
      if (dateFromFilter && toTimestamp(experiment.created_at) < toTimestamp(dateFromFilter)) return false
      if (dateToFilter && toTimestamp(experiment.created_at) > toTimestamp(`${dateToFilter}T23:59:59Z`)) return false
      if (hasCandidateOnly && !readCandidateId(experiment)) return false
      if (hasBundleOnly && !readBundleId(experiment)) return false
      return true
    })
  }, [
    createdByFilter,
    dateFromFilter,
    dateToFilter,
    hasBundleOnly,
    hasCandidateOnly,
    sortedExperiments,
    statusFilter,
    strategyFilter,
    textFilter,
    universeFilter,
  ])

  const selectedCompareExperiment = useMemo(
    () => experiments.find((experiment) => experiment.experiment_id === compareExperimentId) ?? null,
    [compareExperimentId, experiments]
  )

  const loadExperimentsEffect = useEffectEvent(() => {
    void loadExperiments()
  })

  const loadSelectedDetailEffect = useEffectEvent((experimentId: string) => {
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
      loadSelectedDetailEffect(selectedExperimentId)
    }, 0)
    return () => clearTimeout(timer)
  }, [selectedExperimentId])

  useEffect(() => {
    if (!selectedExperimentId || !isActiveStatus(currentExperiment?.status)) return
    const timer = setInterval(() => {
      loadExperimentsEffect()
      loadSelectedDetailEffect(selectedExperimentId)
    }, 4000)
    return () => clearInterval(timer)
  }, [currentExperiment?.status, selectedExperimentId])

  async function loadExperiments() {
    setLoadingExperiments(true)
    setError(null)
    try {
      const payload = await requestJson(`/api/research/experiments?limit=${DEFAULT_LIMIT}`)
      const list = normalizeExperiments(payload)
      setExperiments(list)
      if (selectedExperimentId && !list.some((experiment) => experiment.experiment_id === selectedExperimentId)) {
        setSelectedExperimentId(null)
      }
      if (compareExperimentId && !list.some((experiment) => experiment.experiment_id === compareExperimentId)) {
        setCompareExperimentId(null)
      }
    } catch (requestError) {
      setError(requestError)
    } finally {
      setLoadingExperiments(false)
    }
  }

  async function loadExperimentDetail(experimentId: string) {
    const payload = await requestJson(`/api/research/experiments/${encodeURIComponent(experimentId)}`)
    const experiment = normalizeExperiment(payload)
    if (!experiment) {
      throw new Error('Experiment detail response was missing experiment data.')
    }
    return experiment
  }

  async function loadExperimentEvents(experimentId: string) {
    const payload = await requestJson(`/api/research/experiments/${encodeURIComponent(experimentId)}/events`)
    return normalizeEvents(payload)
  }

  async function loadExperimentArtifacts(experimentId: string) {
    const payload = await requestJson(`/api/research/experiments/${encodeURIComponent(experimentId)}/artifacts`)
    return normalizeArtifacts(payload)
  }

  async function loadExperimentBundle(experimentId: string) {
    setLoadingDetail(true)
    setError(null)
    try {
      const [experiment, loadedEvents, loadedArtifacts] = await Promise.all([
        loadExperimentDetail(experimentId),
        loadExperimentEvents(experimentId),
        loadExperimentArtifacts(experimentId),
      ])
      setCurrentExperiment(experiment)
      setEvents(loadedEvents.sort((a, b) => toTimestamp(a.created_at) - toTimestamp(b.created_at)))
      setArtifacts(loadedArtifacts.sort((a, b) => toTimestamp(b.created_at) - toTimestamp(a.created_at)))
    } catch (requestError) {
      setError(requestError)
    } finally {
      setLoadingDetail(false)
    }
  }

  async function submitExperiment() {
    setSubmitting(true)
    setError(null)
    try {
      let configJson: JsonValue = generatedPayload.config_json as JsonValue
      if (advancedMode && advancedConfigJson.trim()) {
        configJson = JSON.parse(advancedConfigJson) as JsonValue
      }

      const payload = {
        ...generatedPayload,
        config_json: configJson,
      }

      const created = await requestJson('/api/research/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const createdExperiment = normalizeExperiment(created)
      await loadExperiments()
      if (createdExperiment) {
        setSelectedExperimentId(createdExperiment.experiment_id)
      }
    } catch (requestError) {
      if (requestError instanceof SyntaxError) {
        setError({ error: 'INVALID_ADVANCED_JSON', message: 'Advanced JSON mode must contain valid JSON.', statusCode: 400 })
      } else {
        setError(requestError)
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function submitExperimentAdminAction(action: ResearchAdminAction) {
    if (!currentExperiment) return
    const reason = adminActionReason.trim()
    if (!reason) {
      setError({ error: 'ADMIN_REASON_REQUIRED', message: 'A reason is required before changing a run status.', statusCode: 400 })
      return
    }

    setAdminActionSubmitting(action)
    setError(null)
    try {
      await requestJson(`/api/research/experiments/${encodeURIComponent(currentExperiment.experiment_id)}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor: adminEmail, reason }),
      })
      await loadExperiments()
      await loadExperimentBundle(currentExperiment.experiment_id)
      setAdminActionReason('')
    } catch (requestError) {
      setError(requestError)
    } finally {
      setAdminActionSubmitting(null)
    }
  }

  function loadExperimentIntoBuilder(experiment: ResearchExperiment) {
    setHypothesisName(String(experiment.experiment_name ?? ''))
    setRunVersion(String(experiment.experiment_version ?? 'v1'))
    setTickers(Array.isArray(experiment.symbols) ? experiment.symbols.join(', ') : '')
    setPredictionHorizon(String(experiment.horizon ?? '5d'))
    setAdvancedMode(true)
    setAdvancedStrategyFamily(String(experiment.strategy_family ?? ''))
    setAdvancedUniverse(String(experiment.universe ?? ''))
    setAdvancedOrchestratorConfigRef(String(experiment.orchestrator_config_ref ?? ''))
    setAdvancedOrchestratorConfigHash(String(experiment.orchestrator_config_hash ?? ''))
    setAdvancedConfigJson(JSON.stringify(readExperimentValue(experiment, ['config_json']) ?? {}, null, 2))
    setRunMode(experiment.dry_run ? 'validate_only' : 'full_research_run')
    setRegistryMode(experiment.registry_registration_enabled ? 'register_if_passes' : 'do_not_register')
  }

  const stageChecks = currentExperiment ? deriveStageChecks(currentExperiment, events, artifacts) : []
  const compareExperiment = selectedCompareExperiment
  const currentCandidateId = currentExperiment ? readCandidateId(currentExperiment) : null
  const currentBundleId = currentExperiment ? readBundleId(currentExperiment) : null
  const currentConfigJson = currentExperiment ? readExperimentValue(currentExperiment, ['config_json']) : null
  const currentResultJson = currentExperiment ? readExperimentValue(currentExperiment, ['result_json', 'result']) : null

  function closeDetail() {
    setSelectedExperimentId(null)
    setCurrentExperiment(null)
    setEvents([])
    setArtifacts([])
  }

  return (
    <div className="page-stack">
      <div className="card">
        <div className="split-row">
          <div>
            <h2>Research Lab</h2>
            <p className="small">Default flow: describe the theory, choose data and strategy options, then let the backoffice generate the backend payload. Advanced JSON stays available for power users and smoke tests.</p>
          </div>
          <div className="small">Admin: {adminEmail}</div>
        </div>
      </div>

      <div className="card">
        <div className="split-row">
          <div>
            <h3>Simple Experiment Builder</h3>
            <p className="small">What are we testing, which data should power it, and should the run stay dry-run or go all the way through research?</p>
          </div>
          <div style={{ minWidth: 220 }}>
            <button className="primary" type="button" onClick={() => void submitExperiment()} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Launch run'}
            </button>
          </div>
        </div>

        <div className="row">
          <div>
            <label htmlFor="hypothesisName">Hypothesis / experiment group</label>
            <input id="hypothesisName" value={hypothesisName} onChange={(event) => setHypothesisName(event.target.value)} placeholder="mean reversion after earnings drift" />
          </div>
          <div>
            <label htmlFor="runVersion">Run name / version</label>
            <input id="runVersion" value={runVersion} onChange={(event) => setRunVersion(event.target.value)} placeholder="v1" />
          </div>
          <div>
            <label htmlFor="whatTesting">What do you want to test?</label>
            <select id="whatTesting" value={whatTesting} onChange={(event) => setWhatTesting(event.target.value as BuilderMode)}>
              {BUILDER_OPTIONS.testKinds.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="universeMode">Universe</label>
            <select id="universeMode" value={universeMode} onChange={(event) => setUniverseMode(event.target.value as UniverseMode)}>
              {BUILDER_OPTIONS.universes.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="row" style={{ marginTop: 10 }}>
          <div>
            <label htmlFor="tickers">Ticker(s)</label>
            <input id="tickers" value={tickers} onChange={(event) => setTickers(event.target.value)} placeholder="AAPL, MSFT, NVDA" />
          </div>
          <div>
            <label htmlFor="predictionHorizon">Prediction horizon</label>
            <select id="predictionHorizon" value={predictionHorizon} onChange={(event) => setPredictionHorizon(event.target.value)}>
              {BUILDER_OPTIONS.horizons.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="dataWindow">Data window</label>
            <select id="dataWindow" value={dataWindow} onChange={(event) => setDataWindow(event.target.value)}>
              {BUILDER_OPTIONS.dataWindows.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="customDataWindow">Custom window note</label>
            <input id="customDataWindow" value={customDataWindow} onChange={(event) => setCustomDataWindow(event.target.value)} placeholder="2020-01-01 to 2025-12-31" />
          </div>
        </div>

        <div className="row" style={{ marginTop: 10 }}>
          <div>
            <label htmlFor="featureSet">Feature set</label>
            <select id="featureSet" value={featureSet} onChange={(event) => setFeatureSet(event.target.value)}>
              {BUILDER_OPTIONS.featureSets.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="modelSetup">Model</label>
            <select id="modelSetup" value={modelSetup} onChange={(event) => setModelSetup(event.target.value)}>
              {BUILDER_OPTIONS.models.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="strategyTemplate">Strategy</label>
            <select id="strategyTemplate" value={strategyTemplate} onChange={(event) => setStrategyTemplate(event.target.value)}>
              {BUILDER_OPTIONS.strategies.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="backtestProfile">Backtest / cost profile</label>
            <select id="backtestProfile" value={backtestProfile} onChange={(event) => setBacktestProfile(event.target.value)}>
              {BUILDER_OPTIONS.backtests.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="row" style={{ marginTop: 10 }}>
          <div>
            <label htmlFor="runMode">Run mode</label>
            <select id="runMode" value={runMode} onChange={(event) => setRunMode(event.target.value as RunMode)}>
              <option value="validate_only">Validate only / dry run</option>
              <option value="full_research_run">Full research run</option>
            </select>
          </div>
          <div>
            <label htmlFor="registryMode">Registry</label>
            <select id="registryMode" value={registryMode} onChange={(event) => setRegistryMode(event.target.value as RegistryMode)}>
              <option value="do_not_register">Do not register candidate</option>
              <option value="register_if_passes">Register candidate if run passes</option>
            </select>
          </div>
          <div>
            <label htmlFor="reuseReference">Reuse existing lineage / run</label>
            <input id="reuseReference" value={reuseReference} onChange={(event) => setReuseReference(event.target.value)} placeholder="feature_snapshot_id=2, ml_run_id=29" />
          </div>
          <div>
            <label htmlFor="candidateReference">Existing candidate</label>
            <input id="candidateReference" value={candidateReference} onChange={(event) => setCandidateReference(event.target.value)} placeholder="candidate_2026_06_10_a" />
          </div>
        </div>

        <div className="split-row" style={{ marginTop: 14 }}>
          <label style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={advancedMode} onChange={(event) => setAdvancedMode(event.target.checked)} style={{ width: 'auto' }} />
            Advanced JSON / backend fields
          </label>
          <div className="small">Generated backend request stays visible even when advanced mode is off.</div>
        </div>

        {advancedMode ? (
          <div className="card research-subpanel">
            <div className="row">
              <div>
                <label htmlFor="advancedStrategyFamily">strategy_family</label>
                <input id="advancedStrategyFamily" value={advancedStrategyFamily} onChange={(event) => setAdvancedStrategyFamily(event.target.value)} />
              </div>
              <div>
                <label htmlFor="advancedUniverse">universe</label>
                <input id="advancedUniverse" value={advancedUniverse} onChange={(event) => setAdvancedUniverse(event.target.value)} />
              </div>
              <div>
                <label htmlFor="advancedConfigRef">orchestrator_config_ref</label>
                <input id="advancedConfigRef" value={advancedOrchestratorConfigRef} onChange={(event) => setAdvancedOrchestratorConfigRef(event.target.value)} />
              </div>
              <div>
                <label htmlFor="advancedConfigHash">orchestrator_config_hash</label>
                <input id="advancedConfigHash" value={advancedOrchestratorConfigHash} onChange={(event) => setAdvancedOrchestratorConfigHash(event.target.value)} />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label htmlFor="advancedConfigJson">Advanced config_json override</label>
              <textarea id="advancedConfigJson" rows={10} value={advancedConfigJson} onChange={(event) => setAdvancedConfigJson(event.target.value)} placeholder={JSON.stringify(generatedConfig, null, 2)} />
            </div>
          </div>
        ) : null}

        <div className="card research-subpanel">
          <h4>Generated backend request preview</h4>
          <pre>{JSON.stringify(generatedPayload, null, 2)}</pre>
        </div>
      </div>

      <RequestErrorCard error={error} />

      <div className="card">
        <div className="split-row">
          <div>
            <h3>Run Library</h3>
            <p className="small">Filter by status, owner, universe, strategy, date, candidate, and bundle. Artifact and readiness filters are not yet possible because the backend list endpoint does not expose those summary flags.</p>
          </div>
          <div style={{ minWidth: 220 }}>
            <button className="secondary" type="button" onClick={() => void loadExperiments()} disabled={loadingExperiments}>
              {loadingExperiments ? 'Refreshing...' : 'Refresh library'}
            </button>
          </div>
        </div>

        <div className="row">
          <div>
            <label htmlFor="statusFilter">Status</label>
            <select id="statusFilter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">All</option>
              <option value="queued">queued</option>
              <option value="running">running</option>
              <option value="completed">completed</option>
              <option value="failed">failed</option>
              <option value="cancelled">cancelled</option>
            </select>
          </div>
          <div>
            <label htmlFor="createdByFilter">Created by</label>
            <input id="createdByFilter" value={createdByFilter} onChange={(event) => setCreatedByFilter(event.target.value)} placeholder="admin@example.com" />
          </div>
          <div>
            <label htmlFor="universeFilter">Ticker / universe</label>
            <input id="universeFilter" value={universeFilter} onChange={(event) => setUniverseFilter(event.target.value)} placeholder="SPY, AAPL, watchlist" />
          </div>
          <div>
            <label htmlFor="strategyFilter">Strategy template / family</label>
            <input id="strategyFilter" value={strategyFilter} onChange={(event) => setStrategyFilter(event.target.value)} placeholder="q40, track-a" />
          </div>
        </div>

        <div className="row" style={{ marginTop: 10 }}>
          <div>
            <label htmlFor="textFilter">Text search</label>
            <input id="textFilter" value={textFilter} onChange={(event) => setTextFilter(event.target.value)} placeholder="hypothesis, run id, version" />
          </div>
          <div>
            <label htmlFor="dateFromFilter">Date from</label>
            <input id="dateFromFilter" type="date" value={dateFromFilter} onChange={(event) => setDateFromFilter(event.target.value)} />
          </div>
          <div>
            <label htmlFor="dateToFilter">Date to</label>
            <input id="dateToFilter" type="date" value={dateToFilter} onChange={(event) => setDateToFilter(event.target.value)} />
          </div>
          <div className="checkbox-row">
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={hasCandidateOnly} onChange={(event) => setHasCandidateOnly(event.target.checked)} style={{ width: 'auto' }} />
              Has candidate
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={hasBundleOnly} onChange={(event) => setHasBundleOnly(event.target.checked)} style={{ width: 'auto' }} />
              Has bundle
            </label>
          </div>
        </div>

        <div className="table-wrap" style={{ marginTop: 14 }}>
          <table className="registry-table">
            <thead>
              <tr>
                <th>Experiment group</th>
                <th>Run</th>
                <th>Status</th>
                <th>Universe / tickers</th>
                <th>Stage reached</th>
                <th>Candidate / bundle</th>
                <th>Created by</th>
                <th>Created at</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExperiments.map((experiment) => (
                <tr key={experiment.experiment_id}>
                  <td>
                    <strong>{renderText(experiment.experiment_name)}</strong>
                    <div className="small">{experiment.experiment_id}</div>
                  </td>
                  <td>{renderText(experiment.experiment_version)}</td>
                  <td><span className={statusClass(experiment.status)}>{renderText(experiment.status)}</span></td>
                  <td>
                    <div>{renderText(experiment.universe)}</div>
                    <div className="small">{Array.isArray(experiment.symbols) ? experiment.symbols.join(', ') : '—'}</div>
                  </td>
                  <td>{stageReachedText(experiment, [], [])}</td>
                  <td>
                    <div>{readCandidateId(experiment) ?? '—'}</div>
                    <div className="small">{readBundleId(experiment) ?? '—'}</div>
                  </td>
                  <td>{renderText(experiment.requested_by)}</td>
                  <td>{formatDate(experiment.created_at)}</td>
                  <td>
                    <div className="table-actions">
                      <button className="secondary" type="button" onClick={() => setSelectedExperimentId(experiment.experiment_id)}>Open</button>
                      <button className="secondary" type="button" onClick={() => setCompareExperimentId(experiment.experiment_id)}>Compare</button>
                      <button className="secondary" type="button" onClick={() => loadExperimentIntoBuilder(experiment)}>Duplicate</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loadingExperiments && filteredExperiments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="small">No runs matched the current filters.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {selectedExperimentId && currentExperiment ? (
        <>
          <div aria-hidden="true" className="drawer-backdrop" onClick={closeDetail} />
          <aside aria-label="Research run detail" className="drawer-shell">
            <div className="drawer-header">
              <div>
                <h3 style={{ marginBottom: 6 }}>Run detail</h3>
                <div className="meta">
                  <span className={statusClass(currentExperiment.status)}>{renderText(currentExperiment.status)}</span>
                  <span className="small">{currentExperiment.experiment_id}</span>
                </div>
              </div>
              <button className="secondary drawer-close" type="button" onClick={closeDetail}>Close</button>
            </div>

            {loadingDetail ? <p className="small">Loading detail...</p> : null}

            {isAdminActionStatus(currentExperiment.status) ? (
              <div className="card compact-card">
                <h4>Run controls</h4>
                <div style={{ marginTop: 10 }}>
                  <label htmlFor="researchAdminActionReason">Reason</label>
                  <textarea id="researchAdminActionReason" rows={3} value={adminActionReason} onChange={(event) => setAdminActionReason(event.target.value)} />
                </div>
                <div className="admin-action-row">
                  <button className="secondary" type="button" onClick={() => void submitExperimentAdminAction('cancel')} disabled={!adminActionReason.trim() || adminActionSubmitting !== null}>
                    {adminActionSubmitting === 'cancel' ? 'Cancelling...' : 'Cancel run'}
                  </button>
                  <button className="danger" type="button" onClick={() => void submitExperimentAdminAction('mark-failed')} disabled={!adminActionReason.trim() || adminActionSubmitting !== null}>
                    {adminActionSubmitting === 'mark-failed' ? 'Marking failed...' : 'Mark failed'}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="card compact-card">
              <h4>Pipeline stages</h4>
              <div className="list-stack">
                {stageChecks.map((stage) => (
                  <div className="list-row" key={stage.name}>
                    <div>
                      <strong>{stage.name}</strong>
                      <div className="small">{stage.detail}</div>
                    </div>
                    <div style={{ minWidth: 260 }}>
                      <div><span className={stageClass(stage.status)}>{stage.status}</span></div>
                      <div className="small" style={{ marginTop: 6 }}>{stage.note}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card compact-card">
              <h4>Run summary</h4>
              <div className="field-grid">
                <Field label="Hypothesis / group" value={currentExperiment.experiment_name} />
                <Field label="Run version" value={currentExperiment.experiment_version} />
                <Field label="Created by" value={currentExperiment.requested_by} />
                <Field label="Universe" value={currentExperiment.universe} />
                <Field label="Tickers" value={Array.isArray(currentExperiment.symbols) ? currentExperiment.symbols.join(', ') : '—'} />
                <Field label="Horizon" value={currentExperiment.horizon} />
                <Field label="Strategy family" value={currentExperiment.strategy_family} />
                <Field label="Run mode" value={currentExperiment.dry_run ? 'Validate only / dry run' : 'Full research run'} />
                <Field label="Created at" value={formatDate(currentExperiment.created_at)} />
                <Field label="Started at" value={formatDate(currentExperiment.started_at)} />
                <Field label="Finished at" value={formatDate(currentExperiment.finished_at)} />
                <Field label="Backend job" value={currentExperiment.backend_job_id} />
              </div>
            </div>

            <div className="card compact-card">
              <h4>Evidence and lineage</h4>
              <div className="field-grid">
                <Field label="Feature snapshot" value={renderText(readExperimentValue(currentExperiment, ['feature_snapshot_id', 'snapshot_name']))} />
                <Field label="Snapshot version" value={renderText(readExperimentValue(currentExperiment, ['snapshot_version']))} />
                <Field label="ML run" value={renderText(readExperimentValue(currentExperiment, ['ml_run_id']))} />
                <Field label="Strategy run" value={renderText(readExperimentValue(currentExperiment, ['strategy_run_id']))} />
                <Field label="Backtest run" value={renderText(readExperimentValue(currentExperiment, ['backtest_run_id']))} />
                <Field
                  label="Candidate"
                  value={currentCandidateId ? <Link href={`/registry/candidates/${encodeURIComponent(currentCandidateId)}`}>{currentCandidateId}</Link> : '—'}
                />
                <Field
                  label="Bundle"
                  value={currentBundleId ? <Link href={`/registry/bundles/${encodeURIComponent(currentBundleId)}`}>{currentBundleId}</Link> : '—'}
                />
              </div>
            </div>

            {compareExperiment ? (
              <div className="card compact-card">
                <h4>Compare runs</h4>
                <div className="compare-grid">
                  <CompareColumn title="Current run" experiment={currentExperiment} />
                  <CompareColumn title="Compare target" experiment={compareExperiment} />
                </div>
              </div>
            ) : null}

            {currentExperiment.error_message ? <div className="error">{currentExperiment.error_message}</div> : null}

            <div className="card compact-card">
              <h4>Raw evidence</h4>
              <JsonDetails title="config_json" value={currentConfigJson} />
              <JsonDetails title="result_json" value={currentResultJson} />
              <JsonDetails title="events" value={events} />
              <JsonDetails title="artifacts" value={artifacts} />
            </div>

            <div className="card compact-card">
              <h4>Backend gaps for a fuller stage checklist</h4>
              <ul className="plain-list">
                <li>The experiment list endpoint does not expose artifact counts, readiness-report presence, or a structured stage summary.</li>
                <li>Preflight proof is incomplete because the backend does not emit explicit config-validation, data-availability, or PIT declarations as structured stage fields.</li>
                <li>The registry stage cannot prove readiness reports because research detail does not currently return registry readiness links or report IDs.</li>
              </ul>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  )
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <label>{label}</label>
      <div className="field-value">{value}</div>
    </div>
  )
}

function CompareColumn({ title, experiment }: { title: string; experiment: ResearchExperiment }) {
  return (
    <div className="card compact-card">
      <h5 style={{ marginTop: 0, marginBottom: 10 }}>{title}</h5>
      <div className="field-grid compare-field-grid">
        <Field label="Run" value={experiment.experiment_id} />
        <Field label="Status" value={<span className={statusClass(experiment.status)}>{renderText(experiment.status)}</span>} />
        <Field label="Universe" value={renderText(experiment.universe)} />
        <Field label="Tickers" value={Array.isArray(experiment.symbols) ? experiment.symbols.join(', ') : '—'} />
        <Field label="Strategy" value={renderText(experiment.strategy_family)} />
        <Field label="Candidate" value={readCandidateId(experiment) ?? '—'} />
        <Field label="Bundle" value={readBundleId(experiment) ?? '—'} />
        <Field label="Finished" value={formatDate(experiment.finished_at)} />
      </div>
    </div>
  )
}
