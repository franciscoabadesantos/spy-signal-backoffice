export type RegistryActionResult<T> =
  | { ok: true; payload: T }
  | { ok: false; errors: string[] }

export type PromoteCandidatePayload = {
  to_status: string
  bundle_id: string
  actor: string
  reason: string
  confirmed: true
}

export type ActivateCandidatePayload = {
  strategy_family: string
  universe: string
  environment: string
  candidate_id: string
  bundle_id: string
  actor: string
  reason: string
  confirmed: true
}

export function buildPromoteCandidatePayload(input: {
  toStatus: unknown
  bundleId: unknown
  actor: unknown
  reason: unknown
  confirmed: unknown
}): RegistryActionResult<PromoteCandidatePayload> {
  const toStatus = readRequiredString(input.toStatus)
  const bundleId = readRequiredString(input.bundleId)
  const actor = readRequiredString(input.actor)
  const reason = readRequiredString(input.reason)
  const errors: string[] = []

  if (!toStatus) errors.push('to_status is required.')
  if (!bundleId) errors.push('bundle_id is required.')
  if (!actor) errors.push('actor is required.')
  if (!reason) errors.push('reason is required.')
  if (input.confirmed !== true) errors.push('confirmed must be true.')
  if (errors.length > 0) return { ok: false, errors }

  return {
    ok: true,
    payload: {
      to_status: toStatus,
      bundle_id: bundleId,
      actor,
      reason,
      confirmed: true,
    },
  }
}

export function buildActivateCandidatePayload(input: {
  strategyFamily: unknown
  universe: unknown
  environment: unknown
  candidateId: unknown
  bundleId: unknown
  actor: unknown
  reason: unknown
  confirmed: unknown
}): RegistryActionResult<ActivateCandidatePayload> {
  const strategyFamily = readRequiredString(input.strategyFamily)
  const universe = readRequiredString(input.universe)
  const environment = readRequiredString(input.environment)
  const candidateId = readRequiredString(input.candidateId)
  const bundleId = readRequiredString(input.bundleId)
  const actor = readRequiredString(input.actor)
  const reason = readRequiredString(input.reason)
  const errors: string[] = []

  if (!strategyFamily) errors.push('strategy_family is required.')
  if (!universe) errors.push('universe is required.')
  if (!environment) errors.push('environment is required.')
  if (!candidateId) errors.push('candidate_id is required.')
  if (!bundleId) errors.push('bundle_id is required.')
  if (!actor) errors.push('actor is required.')
  if (!reason) errors.push('reason is required.')
  if (input.confirmed !== true) errors.push('confirmed must be true.')
  if (errors.length > 0) return { ok: false, errors }

  return {
    ok: true,
    payload: {
      strategy_family: strategyFamily,
      universe,
      environment,
      candidate_id: candidateId,
      bundle_id: bundleId,
      actor,
      reason,
      confirmed: true,
    },
  }
}

function readRequiredString(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}
