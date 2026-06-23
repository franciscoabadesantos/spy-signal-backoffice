import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildActivateCandidatePayload,
  buildPromoteCandidatePayload,
} from '../app/registry/promotion-payloads'

test('promote payload matches backend contract exactly', () => {
  const result = buildPromoteCandidatePayload({
    toStatus: 'promotion_ready',
    bundleId: 'bundle-1',
    actor: 'admin@example.com',
    reason: 'Reviewed rank-IC and FDR evidence.',
    confirmed: true,
  })

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(result.payload, {
    to_status: 'promotion_ready',
    bundle_id: 'bundle-1',
    actor: 'admin@example.com',
    reason: 'Reviewed rank-IC and FDR evidence.',
    confirmed: true,
  })
  assert.equal(Object.hasOwn(result.payload, 'candidate_id'), false)
})

test('promote payload is gated by confirmation and bundle_id', () => {
  const result = buildPromoteCandidatePayload({
    toStatus: 'promotion_ready',
    bundleId: '',
    actor: 'admin@example.com',
    reason: 'Reviewed evidence.',
    confirmed: false,
  })

  assert.equal(result.ok, false)
  if (result.ok) return
  assert.deepEqual(result.errors, [
    'bundle_id is required.',
    'confirmed must be true.',
  ])
})

test('activation payload matches backend contract exactly', () => {
  const result = buildActivateCandidatePayload({
    strategyFamily: 'cross_sectional_equity',
    universe: 'sp500',
    environment: 'production',
    candidateId: 'candidate-1',
    bundleId: 'bundle-1',
    actor: 'admin@example.com',
    reason: 'Promoted candidate is ready for production pointer.',
    confirmed: true,
  })

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(result.payload, {
    strategy_family: 'cross_sectional_equity',
    universe: 'sp500',
    environment: 'production',
    candidate_id: 'candidate-1',
    bundle_id: 'bundle-1',
    actor: 'admin@example.com',
    reason: 'Promoted candidate is ready for production pointer.',
    confirmed: true,
  })
})

test('activation payload is gated by confirmation and required lineage fields', () => {
  const result = buildActivateCandidatePayload({
    strategyFamily: '',
    universe: '',
    environment: 'production',
    candidateId: 'candidate-1',
    bundleId: 'bundle-1',
    actor: 'admin@example.com',
    reason: '',
    confirmed: false,
  })

  assert.equal(result.ok, false)
  if (result.ok) return
  assert.deepEqual(result.errors, [
    'strategy_family is required.',
    'universe is required.',
    'reason is required.',
    'confirmed must be true.',
  ])
})
