import assert from 'node:assert/strict'
import test from 'node:test'
import {
  baseOnboardingRow,
  buildOnboardingRequestPayload,
  candidateKey,
  groupCandidatesForBulkOnboard,
  isCandidateOnboardable,
  normalizeOnboardingRow,
  normalizeOnboardingPreview,
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

test('status polling normalization preserves lifecycle states and canonical asset type', () => {
  const backfilling = normalizeOnboardingRow({ ticker: 'SPCX', region: 'us', status: 'backfilling' }, candidate, null)
  const ready = normalizeOnboardingRow({ ticker: 'SPCX', region: 'us', status: 'ready', is_tracked: true, asset: { assetType: 'etf' } }, candidate, null)
  const rejected = normalizeOnboardingRow({ ticker: 'SPCX', region: 'us', status: 'rejected' }, candidate, null)

  assert.equal(backfilling.status, 'backfilling')
  assert.equal(backfilling.readiness.label, 'Partial data')
  assert.equal(statusBadgeClass(backfilling.status), 'running')
  assert.equal(ready.readiness.label, 'Tracked')
  assert.equal(ready.assetType, 'etf')
  assert.equal(statusBadgeClass(ready.status), 'completed')
  assert.equal(rejected.readiness.label, 'Rejected')
  assert.equal(statusBadgeClass(rejected.status), 'failed')
})

test('status polling keeps old backend payloads compatible when asset is absent', () => {
  const row = normalizeOnboardingRow({ ticker: 'SPCX', region: 'us', status: 'ready' }, candidate, null)

  assert.equal(row.assetType, null)
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

test('manual onboarding preview normalizes VWS to canonical VWS.CO and blocks duplicate submit when tracked', () => {
  const preview = normalizeOnboardingPreview({
    q: 'VWS',
    candidates: [{
      symbol: 'VWS',
      source_symbol: 'VWS',
      display_symbol: 'VWS',
      name: 'Vestas Wind Systems A/S',
      onboard_symbol: 'VWS.CO',
      onboard_region: 'eu',
      onboard_exchange: 'CPH',
      home_country: 'DK',
      is_onboardable: true,
      already_tracked: true,
      readiness_state: 'tracked',
    }],
  })
  const [vestas] = preview.candidates

  assert.equal(vestas.symbol, 'VWS')
  assert.equal(vestas.onboardSymbol, 'VWS.CO')
  assert.equal(vestas.onboardRegion, 'eu')
  assert.equal(vestas.onboardExchange, 'CPH')
  assert.equal(vestas.homeCountry, 'DK')
  assert.equal(vestas.alreadyTracked, true)
  assert.equal(isCandidateOnboardable(vestas), false)
  assert.equal(buildOnboardingRequestPayload(vestas), null)
})

test('manual onboarding preview submits only backend canonical candidate identity', () => {
  const preview = normalizeOnboardingPreview({
    q: '9766.T',
    candidates: [{
      symbol: '9766.T',
      name: 'Konami Group Corp',
      onboard_symbol: '9766.T',
      onboard_region: 'apac',
      onboard_exchange: 'TSE',
      home_country: 'JP',
      is_onboardable: true,
      already_tracked: false,
      readiness_state: 'not_tracked',
    }, {
      symbol: 'MBX',
      name: 'MBX Biosciences Inc',
      onboard_symbol: 'MBX',
      onboard_region: 'us',
      onboard_exchange: null,
      home_country: 'US',
      is_onboardable: true,
      already_tracked: false,
    }],
  })

  assert.deepEqual(buildOnboardingRequestPayload(preview.candidates[0]), {
    ticker: '9766.T',
    region: 'apac',
    exchange: 'TSE',
  })
  assert.deepEqual(buildOnboardingRequestPayload(preview.candidates[1]), {
    ticker: 'MBX',
    region: 'us',
  })
})

test('manual onboarding preview no-match cannot produce a request payload', () => {
  const preview = normalizeOnboardingPreview({
    q: 'NO_SUCH_TICKER_123',
    candidates: [],
    reason: 'no_canonical_identity_match',
  })

  assert.equal(preview.candidates.length, 0)
  assert.equal(preview.reason, 'no_canonical_identity_match')
})
