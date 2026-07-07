export type TickerReadinessLabel =
  | 'Tracked'
  | 'Partial data'
  | 'Missing prices'
  | 'Missing technicals'
  | 'Missing scorecard'
  | 'Rejected'

export type TickerReadinessBadge = {
  label: TickerReadinessLabel
  className: 'completed' | 'queued' | 'running' | 'failed' | 'muted'
  diagnostic: string | null
}

export type TickerReadinessInput = {
  isTracked?: boolean | null
  coverageState?: string | null
  hasPrices?: boolean | null
  hasTechnicals?: boolean | null
  hasScorecard?: boolean | null
  missingInputs?: string[] | null
  registryStatus?: string | null
  validationStatus?: string | null
  promotionStatus?: string | null
  scorecardReadiness?: string | null
}

const REJECTED_STATES = new Set(['rejected', 'invalid', 'blocked'])
const PARTIAL_STATES = new Set([
  'partial',
  'partial_data',
  'pending',
  'pending_build',
  'pending_backfill',
  'pending_validation',
  'backfilling',
  'validating',
  'not_tracked',
  'missing_inputs',
  'unavailable_missing_inputs',
])

function norm(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase()
}

function hasMissing(missingInputs: string[] | null | undefined, terms: string[]): boolean {
  const normalized = (missingInputs ?? []).map((item) => norm(item))
  return normalized.some((item) => terms.some((term) => item.includes(term)))
}

function badge(label: TickerReadinessLabel, className: TickerReadinessBadge['className'], diagnostic: string | null): TickerReadinessBadge {
  return { label, className, diagnostic }
}

export function tickerReadinessBadge(input: TickerReadinessInput): TickerReadinessBadge {
  const registryStatus = norm(input.registryStatus)
  const validationStatus = norm(input.validationStatus)
  const promotionStatus = norm(input.promotionStatus)
  const coverageState = norm(input.coverageState)
  const scorecardReadiness = norm(input.scorecardReadiness)

  if (
    REJECTED_STATES.has(registryStatus) ||
    REJECTED_STATES.has(validationStatus) ||
    REJECTED_STATES.has(promotionStatus) ||
    coverageState === 'rejected'
  ) {
    return badge('Rejected', 'failed', 'Rejected by registry validation')
  }

  if (input.hasPrices === false || hasMissing(input.missingInputs, ['price', 'ohlc'])) {
    return badge('Missing prices', 'queued', 'Needs materialized prices')
  }

  if (input.hasTechnicals === false || hasMissing(input.missingInputs, ['technical'])) {
    return badge('Missing technicals', 'queued', 'Needs materialized technical features')
  }

  if (
    input.hasScorecard === false ||
    hasMissing(input.missingInputs, ['scorecard', 'fundamental', 'earning']) ||
    (scorecardReadiness.length > 0 && scorecardReadiness !== 'ready' && scorecardReadiness !== 'scorecard_ready')
  ) {
    return badge('Missing scorecard', 'queued', 'Needs scorecard inputs or daily scorecard build')
  }

  if (input.isTracked === false || PARTIAL_STATES.has(coverageState) || PARTIAL_STATES.has(registryStatus)) {
    return badge('Partial data', 'running', 'Registry entry is not map-ready yet')
  }

  return badge('Tracked', 'completed', null)
}
