import assert from 'node:assert/strict'
import test from 'node:test'
import {
  baseOnboardingRow,
  candidateKey,
  normalizeOnboardingRow,
  seedOnboardingRows,
  statusBadgeClass,
  type RelationshipMapOnboardingCandidate,
} from '../lib/relationship-map-onboarding'
import { tickerReadinessBadge } from '../lib/ticker-readiness'

const candidate: RelationshipMapOnboardingCandidate = {
  symbol: 'spcx',
  name: 'SPCX Corp',
  country: 'US',
  themes: ['space'],
  etfs: ['UFO'],
  adjacency: 0.1,
  score: 0.2,
  weight: 0.3,
  readiness: tickerReadinessBadge({
    coverageState: 'not_tracked',
    registryStatus: 'not_tracked',
  }),
}

test('manual and bulk onboarding rows use the same row model', () => {
  const manual = baseOnboardingRow(candidate, '2026-07-08T10:00:00.000Z', 'pending_validation')
  const bulk = baseOnboardingRow(candidate, '2026-07-08T10:00:00.000Z', 'pending_backfill')

  assert.deepEqual(Object.keys(bulk).sort(), Object.keys(manual).sort())
  assert.equal(manual.status, 'pending_validation')
  assert.equal(bulk.status, 'pending_backfill')
})

test('bulk onboarding seeds selected tickers immediately as pending backfill rows', () => {
  const rows = seedOnboardingRows({}, [candidate], {
    updatedAt: '2026-07-08T10:00:00.000Z',
    status: 'pending_backfill',
    loading: true,
  })
  const row = rows[candidateKey(candidate)]

  assert.equal(row.symbol, 'SPCX')
  assert.equal(row.status, 'pending_backfill')
  assert.equal(row.loading, true)
  assert.equal(row.readiness.label, 'Partial data')
  assert.equal(statusBadgeClass(row.status), 'queued')
})

test('status polling normalization preserves backfilling, ready, and rejected states', () => {
  const backfilling = normalizeOnboardingRow({ ticker: 'SPCX', region: 'us', status: 'backfilling' }, candidate, null)
  const ready = normalizeOnboardingRow({ ticker: 'SPCX', region: 'us', status: 'ready', is_tracked: true }, candidate, null)
  const rejected = normalizeOnboardingRow({ ticker: 'SPCX', region: 'us', status: 'rejected' }, candidate, null)

  assert.equal(backfilling.status, 'backfilling')
  assert.equal(backfilling.readiness.label, 'Partial data')
  assert.equal(statusBadgeClass(backfilling.status), 'running')
  assert.equal(ready.readiness.label, 'Tracked')
  assert.equal(statusBadgeClass(ready.status), 'completed')
  assert.equal(rejected.readiness.label, 'Rejected')
  assert.equal(statusBadgeClass(rejected.status), 'failed')
})
