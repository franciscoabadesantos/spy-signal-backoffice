'use client'

import Link from 'next/link'
import { useEffect, useEffectEvent, useMemo, useState } from 'react'
import { readApiError } from '@/lib/api-error'
import { requestClientJson } from '@/lib/client-json'
import { experimentAnchorId, type ResearchExperiment } from '@/components/research/ExperimentTable'

type Props = {
  adminEmail: string
  onCreated: (result: CrossSectionalSubmissionResult) => void | Promise<void>
}

type FeatureOption = {
  name: string
  family: string
  description?: string
}

type Capabilities = {
  models: string[]
  labels: string[]
  splits: string[]
  tasks: string[]
  feature_families: Record<string, FeatureOption[]>
  universe: {
    symbols: string[]
    by_region?: Record<string, unknown>
  }
}

type CrossSectionalSubmissionResult = {
  submission_type?: string | null
  experiment_id?: string | null
  batch_id?: string | null
  status?: string | null
  n_configs?: number | null
  [key: string]: unknown
}

const DEFAULT_FEATURES = [
  'daily_return',
  'log_return',
  'ret_5d',
  'ret_10d',
  'ret_20d',
  'z_ret_20d_252',
  'rsi_14',
  'rolling_vol_20',
  'rolling_vol_60',
  'atr_norm_14',
  'bb_zscore_20_2',
  'relative_volume_20',
  'dist_sma_200',
  'price_dist_z200',
  'kaufman_efficiency',
  'cs_rank_daily_return',
  'cs_rank_ret_5d',
  'cs_rank_ret_20d',
  'cs_rank_rolling_vol_20',
  'cs_rank_rsi_14',
  'cs_rank_dist_sma_200',
  'cs_rank_price_dist_z200',
  'cs_rank_kaufman_efficiency',
]

const DEFAULT_LABEL = 'cross_sectional_rank'
const DEFAULT_MODEL = 'ridge'
const DEFAULT_HORIZON = 21
const DEFAULT_TOP_K = 15
const DEFAULT_TRAIN_WINDOW = 756
const DEFAULT_TEST_WINDOW = 63
const DEFAULT_STEP = 63

export function CrossSectionalExperimentForm({ adminEmail, onCreated }: Props) {
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null)
  const [loadingCapabilities, setLoadingCapabilities] = useState(false)
  const [labelValues, setLabelValues] = useState<string[]>([DEFAULT_LABEL])
  const [modelValues, setModelValues] = useState<string[]>([DEFAULT_MODEL])
  const [horizonValues, setHorizonValues] = useState<string[]>([String(DEFAULT_HORIZON)])
  const [topKValues, setTopKValues] = useState<string[]>([String(DEFAULT_TOP_K)])
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(DEFAULT_FEATURES)
  const [featureSets, setFeatureSets] = useState<string[][]>([DEFAULT_FEATURES])
  const [compareFeatureSets, setCompareFeatureSets] = useState(false)
  const [trainWindowDays, setTrainWindowDays] = useState(String(DEFAULT_TRAIN_WINDOW))
  const [testWindowDays, setTestWindowDays] = useState(String(DEFAULT_TEST_WINDOW))
  const [stepDays, setStepDays] = useState(String(DEFAULT_STEP))
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [dryRun, setDryRun] = useState(false)
  const [registryRegistrationEnabled, setRegistryRegistrationEnabled] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<CrossSectionalSubmissionResult | null>(null)

  const availableFeatureNames = useMemo(() => {
    const names = new Set<string>()
    for (const members of Object.values(capabilities?.feature_families ?? {})) {
      for (const member of members) names.add(member.name)
    }
    return names
  }, [capabilities])

  const selectedFeatureSet = useMemo(
    () => selectedFeatures.filter((feature) => availableFeatureNames.size === 0 || availableFeatureNames.has(feature)),
    [availableFeatureNames, selectedFeatures]
  )

  const featureSetAxis = compareFeatureSets
    ? featureSets.map((set) => set.filter((feature) => availableFeatureNames.size === 0 || availableFeatureNames.has(feature))).filter((set) => set.length > 0)
    : [selectedFeatureSet]

  const configCount = countConfigs([labelValues, modelValues, horizonValues, topKValues, featureSetAxis])
  const isGrid = configCount > 1
  const labels = capabilities?.labels ?? []
  const models = capabilities?.models ?? []
  const universeSymbols = capabilities?.universe.symbols ?? []

  const loadCapabilitiesEffect = useEffectEvent(async () => {
    setLoadingCapabilities(true)
    setError(null)
    try {
      const payload = await requestClientJson('/api/research/capabilities')
      const normalized = normalizeCapabilities(payload)
      setCapabilities(normalized)
      setLabelValues((current) => seedCatalogSelection(current, normalized.labels, DEFAULT_LABEL))
      setModelValues((current) => seedCatalogSelection(current, normalized.models, DEFAULT_MODEL))
      setSelectedFeatures((current) => seedFeatureSelection(current, normalized))
      setFeatureSets((current) => seedFeatureSets(current, normalized))
    } catch (requestError) {
      setError(readApiError(requestError, 'Failed to load research capabilities.'))
    } finally {
      setLoadingCapabilities(false)
    }
  })

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCapabilitiesEffect()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  function addFeatureSet() {
    setCompareFeatureSets(true)
    setFeatureSets((current) => [...current, selectedFeatureSet])
  }

  async function submit() {
    const validationError = validateForm({
      labelValues,
      modelValues,
      horizonValues,
      topKValues,
      selectedFeatureSet,
      featureSetAxis,
      trainWindowDays,
      testWindowDays,
      stepDays,
    })
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    setError(null)
    setCreated(null)
    try {
      const payload: Record<string, unknown> = {
        requested_by: adminEmail,
        label: axisPayload(labelValues),
        horizon_days: numericAxisPayload(horizonValues),
        model: axisPayload(modelValues),
        features: featureSetAxis.length > 1 ? featureSetAxis : featureSetAxis[0],
        top_k: numericAxisPayload(topKValues),
        train_window_days: Number(trainWindowDays),
        test_window_days: Number(testWindowDays),
        step_days: Number(stepDays),
        dry_run: dryRun,
        registry_registration_enabled: registryRegistrationEnabled,
      }
      if (startDate.trim()) payload.start_date = startDate.trim()
      if (endDate.trim()) payload.end_date = endDate.trim()

      const response = await requestClientJson('/api/research/experiments/cross-sectional', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = normalizeSubmissionResult(response)
      setCreated(result)
      await onCreated(result)
    } catch (requestError) {
      setError(readApiError(requestError, 'Failed to launch cross-sectional experiment.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card">
      <div className="split-row">
        <div>
          <h2>Launch cross-sectional run</h2>
          <p className="small">Catalog-driven builder for the validated global 96-symbol preset.</p>
        </div>
        <div style={{ minWidth: 220 }}>
          <button className="primary" type="button" onClick={() => void submit()} disabled={submitting || loadingCapabilities || !capabilities}>
            {submitting ? 'Launching...' : isGrid ? `Launch ${configCount} configs` : 'Launch experiment'}
          </button>
        </div>
      </div>

      {loadingCapabilities ? <p className="small">Loading catalog...</p> : null}
      {error ? <div className="error">{error}</div> : null}

      <div className="metric-grid" style={{ marginTop: 12 }}>
        <div className="card compact-card">
          <label>Preview Config Count</label>
          <div className="metric-value">{configCount}</div>
          <div className="small">{isGrid ? 'Batch grid' : 'Single experiment'}</div>
        </div>
        <div className="card compact-card">
          <label>Universe</label>
          <div className="metric-value">{universeSymbols.length || 96}</div>
          <div className="small">Fixed in v1</div>
        </div>
        <div className="card compact-card">
          <label>Selected Features</label>
          <div className="metric-value">{selectedFeatureSet.length}</div>
          <div className="small">{compareFeatureSets ? `${featureSetAxis.length} feature sets` : 'Current feature set'}</div>
        </div>
      </div>

      <div className="axis-grid">
        <MultiSelectField label="Label" options={labels} values={labelValues} onChange={setLabelValues} />
        <MultiSelectField label="Model" options={models} values={modelValues} onChange={setModelValues} />
        <CsvNumberField label="Horizon days" values={horizonValues} onChange={setHorizonValues} />
        <CsvNumberField label="Top K" values={topKValues} onChange={setTopKValues} />
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <div>
          <label htmlFor="trainWindowDays">Train window days</label>
          <input id="trainWindowDays" inputMode="numeric" value={trainWindowDays} onChange={(event) => setTrainWindowDays(event.target.value)} />
        </div>
        <div>
          <label htmlFor="testWindowDays">Test window days</label>
          <input id="testWindowDays" inputMode="numeric" value={testWindowDays} onChange={(event) => setTestWindowDays(event.target.value)} />
        </div>
        <div>
          <label htmlFor="stepDays">Step days</label>
          <input id="stepDays" inputMode="numeric" value={stepDays} onChange={(event) => setStepDays(event.target.value)} />
        </div>
        <div>
          <label htmlFor="startDate">Start date</label>
          <input id="startDate" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        </div>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <div>
          <label htmlFor="endDate">End date</label>
          <input id="endDate" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        </div>
        <label className="check-row" style={{ alignSelf: 'end', minHeight: 38 }}>
          <input checked={dryRun} onChange={(event) => setDryRun(event.target.checked)} type="checkbox" />
          <span>Dry run</span>
        </label>
        <label className="check-row" style={{ alignSelf: 'end', minHeight: 38 }}>
          <input checked={registryRegistrationEnabled} onChange={(event) => setRegistryRegistrationEnabled(event.target.checked)} type="checkbox" />
          <span>Register candidate</span>
        </label>
      </div>

      <section style={{ marginTop: 16 }}>
        <div className="split-row">
          <div>
            <h3>Features</h3>
            <p className="small">Grouped by backend feature family. The validated 23-feature set is checked by default.</p>
          </div>
          <div className="meta" style={{ minWidth: 260 }}>
            <button className="secondary" type="button" onClick={() => setSelectedFeatures(DEFAULT_FEATURES.filter((feature) => availableFeatureNames.size === 0 || availableFeatureNames.has(feature)))}>
              Reset 23
            </button>
            <button className="secondary" type="button" onClick={addFeatureSet}>
              Add feature set
            </button>
          </div>
        </div>
        <div className="axis-grid" style={{ marginTop: 12 }}>
          {Object.entries(capabilities?.feature_families ?? {}).map(([family, members]) => (
            <FeatureFamilyPicker
              family={family}
              key={family}
              members={members}
              selected={selectedFeatures}
              onChange={setSelectedFeatures}
            />
          ))}
        </div>
        {compareFeatureSets ? (
          <FeatureSetGridEditor
            featureSets={featureSets}
            options={[...availableFeatureNames]}
            onChange={setFeatureSets}
            onRemove={() => setCompareFeatureSets(false)}
          />
        ) : null}
      </section>

      <details className="details-block">
        <summary>Fixed universe symbols</summary>
        <p className="small">Universe selection lands in v2 and needs snapshot creation.</p>
        <div className="selection-summary" style={{ marginTop: 8 }}>
          {universeSymbols.map((symbol) => <span key={symbol}>{symbol}</span>)}
        </div>
      </details>

      {created ? (
        <div className="success" style={{ marginTop: 12 }}>
          {created.submission_type === 'batch' && created.batch_id ? (
            <>
              Batch submitted with {created.n_configs ?? configCount} configs.{' '}
              <Link className="text-link" href={`/research/batches/${encodeURIComponent(created.batch_id)}`}>Open batch results</Link>
            </>
          ) : created.experiment_id ? (
            <>
              Created experiment {created.experiment_id}.{' '}
              <Link className="text-link" href={`#${experimentAnchorId(created.experiment_id)}`}>View in table</Link>
            </>
          ) : 'Submission created.'}
        </div>
      ) : null}
    </div>
  )
}

function MultiSelectField({
  label,
  options,
  values,
  onChange,
}: {
  label: string
  options: string[]
  values: string[]
  onChange: (values: string[]) => void
}) {
  return (
    <section className="card compact-card">
      <div className="split-row">
        <h3>{label}</h3>
        <span className="badge queued">{values.length > 1 ? 'grid' : 'single'}</span>
      </div>
      <div className="option-grid">
        {options.map((option) => (
          <label className="check-row" key={option}>
            <input
              checked={values.includes(option)}
              onChange={() => onChange(toggleValue(values, option))}
              type="checkbox"
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </section>
  )
}

function CsvNumberField({
  label,
  values,
  onChange,
}: {
  label: string
  values: string[]
  onChange: (values: string[]) => void
}) {
  return (
    <section className="card compact-card">
      <div className="split-row">
        <h3>{label}</h3>
        <span className="badge queued">{values.length > 1 ? 'grid' : 'single'}</span>
      </div>
      <label htmlFor={`axis-${label}`}>Values</label>
      <input
        id={`axis-${label}`}
        inputMode="numeric"
        value={values.join(', ')}
        onChange={(event) => onChange(parseCsvValues(event.target.value))}
        placeholder="comma-separated"
      />
    </section>
  )
}

function FeatureFamilyPicker({
  family,
  members,
  selected,
  onChange,
}: {
  family: string
  members: FeatureOption[]
  selected: string[]
  onChange: (values: string[]) => void
}) {
  return (
    <section className="card compact-card">
      <h3>{family}</h3>
      <div className="option-grid" style={{ marginTop: 8 }}>
        {members.map((member) => (
          <label className="check-row" key={member.name} title={member.description}>
            <input
              checked={selected.includes(member.name)}
              onChange={() => onChange(toggleValue(selected, member.name))}
              type="checkbox"
            />
            <span>{member.name}</span>
          </label>
        ))}
      </div>
    </section>
  )
}

function FeatureSetGridEditor({
  featureSets,
  options,
  onChange,
  onRemove,
}: {
  featureSets: string[][]
  options: string[]
  onChange: (sets: string[][]) => void
  onRemove: () => void
}) {
  return (
    <div className="card compact-card" style={{ marginTop: 12 }}>
      <div className="split-row">
        <div>
          <h3>Feature-set grid</h3>
          <p className="small">Each populated set becomes a grid axis value.</p>
        </div>
        <button className="secondary" type="button" onClick={onRemove} style={{ maxWidth: 180 }}>Use one set</button>
      </div>
      <div className="axis-grid" style={{ marginTop: 12 }}>
        {featureSets.map((set, index) => (
          <section className="card compact-card" key={`feature-set-${index}`}>
            <div className="split-row">
              <h4>Set {index + 1}</h4>
              <span className="badge queued">{set.length}</span>
            </div>
            <div className="option-grid" style={{ marginTop: 8 }}>
              {options.map((option) => (
                <label className="check-row" key={option}>
                  <input
                    checked={set.includes(option)}
                    onChange={() => {
                      const next = featureSets.map((candidate, candidateIndex) => (
                        candidateIndex === index ? toggleValue(candidate, option) : candidate
                      ))
                      onChange(next)
                    }}
                    type="checkbox"
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function normalizeCapabilities(payload: unknown): Capabilities {
  const record = asRecord(payload) ?? {}
  const featureFamilies: Record<string, FeatureOption[]> = {}
  const rawFamilies = asRecord(record.feature_families) ?? {}
  for (const [family, rawMembers] of Object.entries(rawFamilies)) {
    featureFamilies[family] = normalizeFeatureMembers(rawMembers, family)
  }
  const rawUniverse = asRecord(record.universe) ?? {}
  return {
    models: readStringList(record.models),
    labels: readStringList(record.labels),
    splits: readStringList(record.splits),
    tasks: readStringList(record.tasks),
    feature_families: featureFamilies,
    universe: {
      symbols: readStringList(rawUniverse.symbols),
      by_region: asRecord(rawUniverse.by_region) ?? undefined,
    },
  }
}

function normalizeFeatureMembers(value: unknown, fallbackFamily: string): FeatureOption[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const record = asRecord(item)
    if (record) {
      return {
        name: readString(record.name) ?? '',
        family: readString(record.family) ?? fallbackFamily,
        description: readString(record.description) ?? undefined,
      }
    }
    return {
      name: readString(item) ?? '',
      family: fallbackFamily,
    }
  }).filter((member) => member.name)
}

function seedCatalogSelection(current: string[], options: string[], preferred: string): string[] {
  const filtered = current.filter((value) => options.includes(value))
  if (filtered.length > 0) return filtered
  if (options.includes(preferred)) return [preferred]
  return options.slice(0, 1)
}

function seedFeatureSelection(current: string[], capabilities: Capabilities): string[] {
  const names = new Set(Object.values(capabilities.feature_families).flatMap((members) => members.map((member) => member.name)))
  const defaults = DEFAULT_FEATURES.filter((feature) => names.has(feature))
  if (defaults.length > 0) return defaults
  const filtered = current.filter((feature) => names.has(feature))
  return filtered.length > 0 ? filtered : [...names].slice(0, 1)
}

function seedFeatureSets(current: string[][], capabilities: Capabilities): string[][] {
  const seeded = seedFeatureSelection(DEFAULT_FEATURES, capabilities)
  const names = new Set(Object.values(capabilities.feature_families).flatMap((members) => members.map((member) => member.name)))
  const existing = current.map((set) => set.filter((feature) => names.has(feature))).filter((set) => set.length > 0)
  return existing.length > 0 ? existing : [seeded]
}

function validateForm({
  labelValues,
  modelValues,
  horizonValues,
  topKValues,
  selectedFeatureSet,
  featureSetAxis,
  trainWindowDays,
  testWindowDays,
  stepDays,
}: {
  labelValues: string[]
  modelValues: string[]
  horizonValues: string[]
  topKValues: string[]
  selectedFeatureSet: string[]
  featureSetAxis: string[][]
  trainWindowDays: string
  testWindowDays: string
  stepDays: string
}): string | null {
  if (labelValues.length === 0) return 'Choose at least one label.'
  if (modelValues.length === 0) return 'Choose at least one model.'
  if (!validPositiveIntegers(horizonValues)) return 'Horizon values must be positive integers.'
  if (!validPositiveIntegers(topKValues)) return 'Top K values must be positive integers.'
  if (selectedFeatureSet.length === 0 || featureSetAxis.length === 0) return 'Choose at least one feature.'
  if (![trainWindowDays, testWindowDays, stepDays].every((value) => isPositiveInteger(value))) {
    return 'Split windows must be positive integers.'
  }
  return null
}

function countConfigs(axes: unknown[][]): number {
  return axes.reduce((count, values) => count * Math.max(1, values.length), 1)
}

function axisPayload(values: string[]): string | string[] {
  return values.length === 1 ? values[0] : values
}

function numericAxisPayload(values: string[]): number | number[] {
  const parsed = values.map((value) => Number(value))
  return parsed.length === 1 ? parsed[0] : parsed
}

function parseCsvValues(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

function validPositiveIntegers(values: string[]): boolean {
  return values.length > 0 && values.every(isPositiveInteger)
}

function isPositiveInteger(value: string): boolean {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0
}

function toggleValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

function normalizeSubmissionResult(payload: unknown): CrossSectionalSubmissionResult {
  return asRecord(payload) ?? { response: payload }
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(readString).filter((item): item is string => Boolean(item))
}

function readString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export type { CrossSectionalSubmissionResult }
