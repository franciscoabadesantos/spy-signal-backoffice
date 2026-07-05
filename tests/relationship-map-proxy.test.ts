import { describe, it } from 'node:test'
import * as assert from 'node:assert'
import { GET as coverageGet } from '../app/api/relationship-map/coverage/route'
import { GET as sourceHealthGet } from '../app/api/relationship-map/source-health/route'

describe('Relationship Map Proxy Routes', () => {
  it('should export GET handlers for source health and coverage routes', () => {
    assert.strictEqual(typeof coverageGet, 'function')
    assert.strictEqual(typeof sourceHealthGet, 'function')
  })
})
