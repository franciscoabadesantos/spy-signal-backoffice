import { asRecord, type RowRecord } from './payload'
import { tickerReadinessBadge, type TickerReadinessBadge } from './ticker-readiness'

export type RelationshipMapOnboardingCandidate = {
  symbol: string
  name: string | null
  country: string
  themes: string[]
  etfs: string[]
  adjacency: number
  score: number
  weight: number
  readiness: TickerReadinessBadge
}

export type OnboardingRow = {
  key: string
  symbol: string
  name: string | null
  region: string
  exchange: string | null
  status: string
  readiness: TickerReadinessBadge
  registryKey: string | null
  normalizedSymbol: string | null
  validationReason: string | null
  validationFlowRunId: string | null
  backfillFlowRunId: string | null
  result: string | null
  loading: boolean
  error: string | null
  updatedAt: string
}

export type OnboardingSeedStatus = 'pending_validation' | 'pending_backfill'

export function candidateRegion(candidate: RelationshipMapOnboardingCandidate): string {
  const country = String(candidate.country || '').trim().toLowerCase()
  return country && country !== 'unknown' ? country : 'global'
}

export function candidateKey(candidate: RelationshipMapOnboardingCandidate): string {
  return onboardingKey(candidate.symbol, candidateRegion(candidate), null)
}

export function onboardingKey(symbol: string, region: string, exchange: string | null): string {
  return `${symbol.trim().toUpperCase()}|${region.trim().toLowerCase() || 'us'}|${exchange?.trim().toUpperCase() || 'default'}`
}

export function baseOnboardingRow(
  candidate: RelationshipMapOnboardingCandidate,
  updatedAt = new Date().toISOString(),
  status: OnboardingSeedStatus = 'pending_validation',
): OnboardingRow {
  const region = candidateRegion(candidate)
  return {
    key: candidateKey(candidate),
    symbol: candidate.symbol.trim().toUpperCase(),
    name: candidate.name,
    region,
    exchange: null,
    status,
    readiness: tickerReadinessBadge({
      coverageState: status,
      registryStatus: status,
    }),
    registryKey: null,
    normalizedSymbol: null,
    validationReason: null,
    validationFlowRunId: null,
    backfillFlowRunId: null,
    result: null,
    loading: false,
    error: null,
    updatedAt,
  }
}

export function seedOnboardingRows(
  current: Record<string, OnboardingRow>,
  targets: RelationshipMapOnboardingCandidate[],
  options: {
    updatedAt?: string
    status?: OnboardingSeedStatus
    loading?: boolean
    error?: string | null
  } = {},
): Record<string, OnboardingRow> {
  const updatedAt = options.updatedAt ?? new Date().toISOString()
  const status = options.status ?? 'pending_validation'
  const next = { ...current }
  for (const candidate of targets) {
    const key = candidateKey(candidate)
    const existing = next[key]
    next[key] = {
      ...(existing ?? baseOnboardingRow(candidate, updatedAt, status)),
      status: existing?.status ?? status,
      loading: options.loading ?? false,
      error: options.error ?? null,
      updatedAt,
    }
  }
  return next
}

export function normalizeOnboardingRow(payload: unknown, candidate: RelationshipMapOnboardingCandidate, resultFallback: string | null): OnboardingRow {
  const record = asRecord(payload) ?? {}
  const symbol = readString(record, ['ticker', 'symbol'])?.toUpperCase() ?? candidate.symbol.trim().toUpperCase()
  const region = readString(record, ['region'])?.toLowerCase() ?? candidateRegion(candidate)
  const exchange = readString(record, ['exchange'])
  const status = readString(record, ['status']) ?? 'pending_validation'
  return {
    key: onboardingKey(symbol, region, exchange),
    symbol,
    name: candidate.name,
    region,
    exchange,
    status,
    readiness: readinessFromRecord(record, status),
    registryKey: readString(record, ['registry_key', 'registryKey']),
    normalizedSymbol: readString(record, ['normalized_symbol', 'normalizedSymbol']),
    validationReason: readString(record, ['validation_reason', 'validationReason']),
    validationFlowRunId: readString(record, ['validation_flow_run_id', 'validationFlowRunId']),
    backfillFlowRunId: readString(record, ['backfill_flow_run_id', 'backfillFlowRunId']),
    result: readString(record, ['result']) ?? resultFallback,
    loading: false,
    error: null,
    updatedAt: new Date().toISOString(),
  }
}

export function rowToCandidate(row: OnboardingRow): RelationshipMapOnboardingCandidate {
  return {
    symbol: row.symbol,
    name: row.name,
    country: row.region.toUpperCase(),
    themes: [],
    etfs: [],
    adjacency: 0,
    score: 0,
    weight: 0,
    readiness: row.readiness,
  }
}

export function isRemovableOnboardingStatus(status: string): boolean {
  return ['pending_validation', 'validating', 'pending_backfill', 'backfilling'].includes(status)
}

export function statusBadgeClass(status: string): string {
  if (status === 'ready') return 'completed'
  if (status === 'rejected') return 'failed'
  if (status === 'validating' || status === 'backfilling') return 'running'
  if (status === 'pending_validation' || status === 'pending_backfill') return 'queued'
  return 'muted'
}

export function readinessFromRecord(record: RowRecord | null | undefined, fallbackStatus?: string | null): TickerReadinessBadge {
  return tickerReadinessBadge({
    isTracked: readBoolean(record, ['isTracked', 'is_tracked', 'tracked']),
    coverageState: readString(record, ['coverageState', 'coverage_state', 'readiness', 'readiness_state']),
    hasPrices: readBoolean(record, ['hasPrices', 'has_prices', 'pricesReady', 'prices_ready']),
    hasTechnicals: readBoolean(record, ['hasTechnicals', 'has_technicals', 'technicalsReady', 'technicals_ready']),
    hasScorecard: readBoolean(record, ['hasScorecard', 'has_scorecard', 'scorecardReady', 'scorecard_ready']),
    missingInputs: readStringList(record?.missingInputs ?? record?.missing_inputs),
    registryStatus: readString(record, ['registryStatus', 'registry_status', 'status']) ?? fallbackStatus,
    validationStatus: readString(record, ['validationStatus', 'validation_status', 'validationResult', 'validation_result']),
    promotionStatus: readString(record, ['promotionStatus', 'promotion_status']),
    scorecardReadiness: readString(record, ['scorecardReadiness', 'scorecard_readiness', 'buildStatus', 'build_status']),
  })
}

function readString(record: RowRecord | null | undefined, keys: string[]): string | null {
  if (!record) return null
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  }
  return null
}

function readBoolean(record: RowRecord | null | undefined, keys: string[]): boolean | null {
  if (!record) return null
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value !== 0
    if (typeof value === 'string' && value.trim()) {
      const normalized = value.trim().toLowerCase()
      if (['true', '1', 'yes', 'y'].includes(normalized)) return true
      if (['false', '0', 'no', 'n'].includes(normalized)) return false
    }
  }
  return null
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item).trim()).filter(Boolean)
}
