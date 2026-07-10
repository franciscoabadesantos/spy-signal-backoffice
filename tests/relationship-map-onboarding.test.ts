import assert from 'node:assert/strict'
import test from 'node:test'
import {
  baseOnboardingRow,
  buildOnboardingRequestPayload,
  candidateKey,
  groupCandidatesForBulkOnboard,
  inferManualListing,
  isCandidateOnboardable,
  manualCandidateForSymbol,
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

test('frontier onboarding uses canonical onboard symbol instead of raw holding symbol', () => {
  const vestas: RelationshipMapOnboardingCandidate = {
    ...candidate,
    symbol: 'VWS',
    sourceSymbol: 'VWS',
    displaySymbol: 'VWS',
    name: 'Vestas Wind Systems A/S',
    country: 'DK',
    onboardSymbol: 'VWS.CO',
    onboardRegion: 'eu',
    onboardExchange: 'XCSE',
    isOnboardable: true,
  }

  assert.equal(isCandidateOnboardable(vestas), true)
  assert.deepEqual(buildOnboardingRequestPayload(vestas), {
    ticker: 'VWS.CO',
    region: 'eu',
    exchange: 'XCSE',
  })

  const seeded = baseOnboardingRow(vestas, '2026-07-08T10:00:00.000Z')
  assert.equal(seeded.symbol, 'VWS.CO')
  assert.equal(seeded.sourceSymbol, 'VWS')
  assert.equal(candidateKey(vestas), 'VWS.CO|eu|XCSE')

  const refreshed = normalizeOnboardingRow({ status: 'backfilling' }, vestas, null)
  assert.equal(refreshed.symbol, 'VWS.CO')
  assert.equal(refreshed.region, 'eu')
  assert.equal(refreshed.exchange, 'XCSE')
})

test('non-onboardable frontier candidates do not produce onboarding payloads', () => {
  const blocked: RelationshipMapOnboardingCandidate = {
    ...candidate,
    symbol: 'BAD',
    onboardSymbol: '',
    onboardRegion: 'us',
    isOnboardable: false,
    notOnboardableReason: 'missing canonical identity',
  }

  assert.equal(isCandidateOnboardable(blocked), false)
  assert.equal(buildOnboardingRequestPayload(blocked), null)
  assert.deepEqual(groupCandidatesForBulkOnboard([blocked]), [])
})

test('bulk onboarding groups canonical symbols by region and exchange', () => {
  const groups = groupCandidatesForBulkOnboard([
    {
      ...candidate,
      symbol: '9766',
      onboardSymbol: '9766.T',
      onboardRegion: 'apac',
      onboardExchange: 'XTKS',
      isOnboardable: true,
    },
    {
      ...candidate,
      symbol: 'ZEAL',
      onboardSymbol: 'ZEAL.CO',
      onboardRegion: 'eu',
      onboardExchange: 'XCSE',
      isOnboardable: true,
    },
    {
      ...candidate,
      symbol: 'U',
      onboardSymbol: 'U',
      onboardRegion: 'us',
      onboardExchange: null,
      isOnboardable: true,
    },
  ])

  assert.deepEqual(
    groups.map((group) => ({ region: group.region, exchange: group.exchange, tickers: group.tickers })),
    [
      { region: 'apac', exchange: 'XTKS', tickers: ['9766.T'] },
      { region: 'eu', exchange: 'XCSE', tickers: ['ZEAL.CO'] },
      { region: 'us', exchange: null, tickers: ['U'] },
    ],
  )
})

test('manual provider-qualified symbols infer listing region and exchange', () => {
  const zeal = manualCandidateForSymbol('ZEAL.CO', null)
  const tokyo = manualCandidateForSymbol('9766.T', null)

  assert.deepEqual(inferManualListing('ZEAL.CO'), {
    symbol: 'ZEAL.CO',
    hasExchangeSuffix: true,
    providerQualified: true,
    region: 'eu',
    exchange: 'CPH',
  })
  assert.deepEqual(buildOnboardingRequestPayload(zeal), {
    ticker: 'ZEAL.CO',
    region: 'eu',
    exchange: 'CPH',
  })
  assert.deepEqual(buildOnboardingRequestPayload(tokyo), {
    ticker: '9766.T',
    region: 'apac',
    exchange: 'TSE',
  })
})

test('manual bare symbols are blocked until a listing region is explicitly selected', () => {
  const unresolved = manualCandidateForSymbol('VWS', null)
  const userSelectedUs = manualCandidateForSymbol('MBX', 'us')

  assert.equal(isCandidateOnboardable(unresolved), false)
  assert.equal(buildOnboardingRequestPayload(unresolved), null)
  assert.equal(unresolved.notOnboardableReason, 'Choose a market/listing for symbols without an exchange suffix.')

  assert.equal(isCandidateOnboardable(userSelectedUs), true)
  assert.deepEqual(buildOnboardingRequestPayload(userSelectedUs), {
    ticker: 'MBX',
    region: 'us',
  })
})

test('manual unknown exchange suffixes are not routed as selected bare listings', () => {
  const unresolved = manualCandidateForSymbol('ABC.X', 'us')

  assert.deepEqual(inferManualListing('ABC.X'), {
    symbol: 'ABC.X',
    hasExchangeSuffix: true,
    providerQualified: false,
    region: null,
    exchange: null,
  })
  assert.equal(isCandidateOnboardable(unresolved), false)
  assert.equal(buildOnboardingRequestPayload(unresolved), null)
  assert.equal(unresolved.notOnboardableReason, 'Exchange suffix is not recognized.')
})
