import assert from 'node:assert/strict'
import test from 'node:test'
import { tickerReadinessBadge } from '../lib/ticker-readiness'

test('SPCX-style raw-price candidate is visible as partial data', () => {
  const badge = tickerReadinessBadge({
    isTracked: false,
    coverageState: 'partial',
    hasPrices: true,
    hasTechnicals: false,
    hasScorecard: false,
  })

  assert.equal(badge.label, 'Missing technicals')
  assert.equal(badge.className, 'queued')
})

test('active registry row missing materialized prices is not generic ready', () => {
  const badge = tickerReadinessBadge({
    isTracked: true,
    registryStatus: 'active',
    coverageState: 'ready',
    hasPrices: false,
    hasTechnicals: true,
    hasScorecard: true,
  })

  assert.equal(badge.label, 'Missing prices')
})

test('active registry row missing scorecard is diagnostic', () => {
  const badge = tickerReadinessBadge({
    isTracked: true,
    registryStatus: 'active',
    coverageState: 'ready',
    hasPrices: true,
    hasTechnicals: true,
    hasScorecard: false,
  })

  assert.equal(badge.label, 'Missing scorecard')
})

test('fully materialized tracked row remains normal', () => {
  const badge = tickerReadinessBadge({
    isTracked: true,
    registryStatus: 'active',
    coverageState: 'ready',
    hasPrices: true,
    hasTechnicals: true,
    hasScorecard: true,
  })

  assert.equal(badge.label, 'Tracked')
  assert.equal(badge.className, 'completed')
})

test('rejected rows stay rejected even with partial data', () => {
  const badge = tickerReadinessBadge({
    isTracked: false,
    registryStatus: 'rejected',
    hasPrices: false,
  })

  assert.equal(badge.label, 'Rejected')
})
