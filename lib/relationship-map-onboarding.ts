import { asRecord, type RowRecord } from './payload'
import { tickerReadinessBadge, type TickerReadinessBadge } from './ticker-readiness'

export type RelationshipMapOnboardingCandidate = {
  symbol: string
  sourceSymbol?: string | null
  displaySymbol?: string | null
  name: string | null
  country: string
  providerSymbol?: string | null
  onboardSymbol?: string | null
  onboardRegion?: string | null
  onboardExchange?: string | null
  isOnboardable?: boolean | null
  notOnboardableReason?: string | null
  resolutionSource?: string | null
  alreadyTracked?: boolean | null
  readinessState?: string | null
  homeCountry?: string | null
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
  sourceSymbol: string | null
  displaySymbol: string | null
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
  return onboardingKey(candidateOnboardSymbol(candidate) || candidate.symbol, candidateOnboardRegion(candidate), candidateOnboardExchange(candidate))
}

export function onboardingKey(symbol: string, region: string, exchange: string | null): string {
  return `${symbol.trim().toUpperCase()}|${region.trim().toLowerCase() || 'us'}|${exchange?.trim().toUpperCase() || 'default'}`
}

export function candidateOnboardSymbol(candidate: RelationshipMapOnboardingCandidate): string {
  const symbol = String(candidate.onboardSymbol ?? candidate.symbol ?? '').trim().toUpperCase()
  return symbol
}

export function candidateOnboardRegion(candidate: RelationshipMapOnboardingCandidate): string {
  return String(candidate.onboardRegion ?? candidateRegion(candidate)).trim().toLowerCase() || 'us'
}

function explicitCandidateOnboardRegion(candidate: RelationshipMapOnboardingCandidate): string {
  return String(candidate.onboardRegion ?? '').trim().toLowerCase()
}

export function candidateOnboardExchange(candidate: RelationshipMapOnboardingCandidate): string | null {
  const exchange = String(candidate.onboardExchange ?? '').trim().toUpperCase()
  return exchange || null
}

export function isCandidateOnboardable(candidate: RelationshipMapOnboardingCandidate): boolean {
  return candidate.alreadyTracked !== true && candidate.isOnboardable === true && candidateOnboardSymbol(candidate).length > 0 && explicitCandidateOnboardRegion(candidate).length > 0
}

export type OnboardingRequestPayload = {
  ticker: string
  region: string
  exchange?: string
}

export function buildOnboardingRequestPayload(candidate: RelationshipMapOnboardingCandidate): OnboardingRequestPayload | null {
  if (!isCandidateOnboardable(candidate)) return null
  const exchange = candidateOnboardExchange(candidate)
  return {
    ticker: candidateOnboardSymbol(candidate),
    region: explicitCandidateOnboardRegion(candidate),
    ...(exchange ? { exchange } : {}),
  }
}

export type OnboardingPreviewPayload = {
  query: string | null
  candidates: RelationshipMapOnboardingCandidate[]
  reason: string | null
}

export function normalizeOnboardingPreview(payload: unknown): OnboardingPreviewPayload {
  const record = asRecord(payload) ?? {}
  const reason = readString(record, ['reason', 'not_onboardable_reason', 'notOnboardableReason'])
  return {
    query: readString(record, ['query', 'q']),
    candidates: readPreviewCandidates(payload),
    reason,
  }
}

export type BulkOnboardingGroup = {
  key: string
  region: string
  exchange: string | null
  tickers: string[]
  candidates: RelationshipMapOnboardingCandidate[]
}

export function groupCandidatesForBulkOnboard(candidates: RelationshipMapOnboardingCandidate[]): BulkOnboardingGroup[] {
  const groups = new Map<string, BulkOnboardingGroup>()
  for (const candidate of candidates) {
    const request = buildOnboardingRequestPayload(candidate)
    if (!request) continue
    const exchange = request.exchange ?? null
    const key = onboardingKey('__bulk__', request.region, exchange)
    const group = groups.get(key) ?? {
      key,
      region: request.region,
      exchange,
      tickers: [],
      candidates: [],
    }
    group.tickers.push(request.ticker)
    group.candidates.push(candidate)
    groups.set(key, group)
  }
  return Array.from(groups.values())
}

export function baseOnboardingRow(
  candidate: RelationshipMapOnboardingCandidate,
  updatedAt = new Date().toISOString(),
  status: OnboardingSeedStatus = 'pending_validation',
): OnboardingRow {
  const symbol = candidateOnboardSymbol(candidate) || candidate.symbol.trim().toUpperCase()
  const region = candidateOnboardRegion(candidate)
  const exchange = candidateOnboardExchange(candidate)
  return {
    key: candidateKey(candidate),
    symbol,
    sourceSymbol: readCleanString(candidate.sourceSymbol) ?? null,
    displaySymbol: readCleanString(candidate.displaySymbol) ?? null,
    name: candidate.name,
    region,
    exchange,
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
  const symbol = readString(record, ['ticker', 'symbol'])?.toUpperCase() || candidateOnboardSymbol(candidate) || candidate.symbol.trim().toUpperCase()
  const region = readString(record, ['region'])?.toLowerCase() ?? candidateOnboardRegion(candidate)
  const exchange = readString(record, ['exchange']) ?? candidateOnboardExchange(candidate)
  const status = readString(record, ['status']) ?? 'pending_validation'
  return {
    key: onboardingKey(symbol, region, exchange),
    symbol,
    sourceSymbol: readCleanString(candidate.sourceSymbol) ?? null,
    displaySymbol: readCleanString(candidate.displaySymbol) ?? null,
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
    sourceSymbol: row.sourceSymbol,
    displaySymbol: row.displaySymbol,
    name: row.name,
    country: row.region.toUpperCase(),
    onboardSymbol: row.symbol,
    onboardRegion: row.region,
    onboardExchange: row.exchange,
    isOnboardable: true,
    alreadyTracked: row.status === 'ready',
    themes: [],
    etfs: [],
    adjacency: 0,
    score: 0,
    weight: 0,
    readiness: row.readiness,
  }
}

function readPreviewCandidates(payload: unknown): RelationshipMapOnboardingCandidate[] {
  const record = asRecord(payload)
  const value = Array.isArray(payload) ? payload : record?.candidates
  if (!Array.isArray(value)) return []
  return value.map(normalizePreviewCandidate).filter((candidate): candidate is RelationshipMapOnboardingCandidate => Boolean(candidate))
}

function normalizePreviewCandidate(row: unknown): RelationshipMapOnboardingCandidate | null {
  const record = asRecord(row)
  if (!record) return null
  const onboardSymbol = readString(record, ['onboard_symbol', 'onboardSymbol'])
  const symbol = readString(record, ['symbol', 'display_symbol', 'displaySymbol', 'source_symbol', 'sourceSymbol', 'provider_symbol', 'providerSymbol']) ?? onboardSymbol
  if (!symbol) return null
  const alreadyTracked = readBoolean(record, ['already_tracked', 'alreadyTracked', 'is_tracked', 'isTracked', 'tracked'])
  const readinessState = readString(record, ['readiness_state', 'readinessState', 'readiness'])
  const isOnboardable = readBoolean(record, ['is_onboardable', 'isOnboardable'])
  const country = readString(record, ['home_country', 'homeCountry', 'source_country', 'sourceCountry', 'country']) ?? 'UNKNOWN'
  const candidate: RelationshipMapOnboardingCandidate = {
    symbol,
    sourceSymbol: readString(record, ['source_symbol', 'sourceSymbol']),
    displaySymbol: readString(record, ['display_symbol', 'displaySymbol']),
    name: readString(record, ['name']),
    country,
    providerSymbol: readString(record, ['provider_symbol', 'providerSymbol']),
    onboardSymbol,
    onboardRegion: readString(record, ['onboard_region', 'onboardRegion']),
    onboardExchange: readString(record, ['onboard_exchange', 'onboardExchange']),
    isOnboardable: isOnboardable ?? alreadyTracked !== true,
    notOnboardableReason: readString(record, ['not_onboardable_reason', 'notOnboardableReason']),
    resolutionSource: readString(record, ['resolution_source', 'resolutionSource']),
    alreadyTracked,
    readinessState,
    homeCountry: readString(record, ['home_country', 'homeCountry']),
    themes: [],
    etfs: [],
    adjacency: 0,
    score: 0,
    weight: 0,
    readiness: readinessFromRecord(record, readinessState),
  }
  return candidate
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

function readCleanString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
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
