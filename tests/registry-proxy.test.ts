import { describe, it } from 'node:test'
import * as assert from 'node:assert'
import { GET as activePointersGet } from '../app/api/registry/active-pointers/route'
import { GET as bundlesGet } from '../app/api/registry/bundles/route'
import { GET as bundleDetailGet } from '../app/api/registry/bundles/[bundleId]/route'
import { GET as candidatesGet } from '../app/api/registry/candidates/route'
import { GET as candidateDetailGet } from '../app/api/registry/candidates/[candidateId]/route'
import { GET as evidenceGet } from '../app/api/registry/evidence/[evidenceId]/route'
import { GET as promotionEventsGet } from '../app/api/registry/promotion-events/route'
import { GET as readinessGet } from '../app/api/registry/readiness-reports/route'
import { GET as readinessDetailGet } from '../app/api/registry/readiness-reports/[reportId]/route'

describe('Registry Proxy Routes', () => {
  it('exports GET handlers for backend registry proxy routes', () => {
    assert.strictEqual(typeof candidatesGet, 'function')
    assert.strictEqual(typeof candidateDetailGet, 'function')
    assert.strictEqual(typeof readinessGet, 'function')
    assert.strictEqual(typeof readinessDetailGet, 'function')
    assert.strictEqual(typeof bundlesGet, 'function')
    assert.strictEqual(typeof bundleDetailGet, 'function')
    assert.strictEqual(typeof promotionEventsGet, 'function')
    assert.strictEqual(typeof activePointersGet, 'function')
    assert.strictEqual(typeof evidenceGet, 'function')
  })
})
