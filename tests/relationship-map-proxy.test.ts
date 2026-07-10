import { describe, it } from 'node:test'
import * as assert from 'node:assert'
import { GET as coverageGet } from '../app/api/relationship-map/coverage/route'
import { GET as frontierGet } from '../app/api/relationship-map/frontier/route'
import { GET as sourceHealthGet } from '../app/api/relationship-map/source-health/route'
import { POST as tickerRemovePost } from '../app/api/tickers/remove/route'
import { POST as tickerRequestPost } from '../app/api/tickers/request/route'
import { GET as tickerStatusGet } from '../app/api/tickers/status/route'
import { GET as tickerOnboardingPreviewGet } from '../app/api/tickers/onboarding-preview/route'

describe('Relationship Map Proxy Routes', () => {
  it('should export GET handlers for relationship-map routes', () => {
    assert.strictEqual(typeof coverageGet, 'function')
    assert.strictEqual(typeof frontierGet, 'function')
    assert.strictEqual(typeof sourceHealthGet, 'function')
    assert.strictEqual(typeof tickerRequestPost, 'function')
    assert.strictEqual(typeof tickerStatusGet, 'function')
    assert.strictEqual(typeof tickerRemovePost, 'function')
    assert.strictEqual(typeof tickerOnboardingPreviewGet, 'function')
  })
})
