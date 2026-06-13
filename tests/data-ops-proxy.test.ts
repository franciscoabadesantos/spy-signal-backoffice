import { describe, it } from 'node:test'
import * as assert from 'node:assert'
import { GET as coverageGet } from '../app/api/data-ops/coverage/route'
import { GET as duplicatesGet } from '../app/api/data-ops/duplicates/route'
import { GET as freshnessGet } from '../app/api/data-ops/freshness/route'
import { GET as inventoryGet } from '../app/api/data-ops/inventory/route'
import { GET as sourceComparisonGet } from '../app/api/data-ops/source-comparison/route'
import { GET as macroReleaseGapsGet } from '../app/api/data-ops/macro-release-gaps/route'

describe('Data Ops Proxy Routes', () => {
  it('should export GET handlers for the new routes', () => {
    assert.strictEqual(typeof coverageGet, 'function')
    assert.strictEqual(typeof duplicatesGet, 'function')
    assert.strictEqual(typeof freshnessGet, 'function')
    assert.strictEqual(typeof inventoryGet, 'function')
    assert.strictEqual(typeof sourceComparisonGet, 'function')
    assert.strictEqual(typeof macroReleaseGapsGet, 'function')
  })
})
