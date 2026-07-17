import { describe, it } from 'node:test'
import * as assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const routes = [
  ['summary', '/analyst/entity-layer/summary'],
  ['dedup', '/analyst/entity-layer/dedup'],
  ['tail', '/analyst/entity-layer/tail'],
  ['source-health', '/analyst/entity-layer/source-health'],
  ['entities', '/analyst/entity-layer/entities'],
  ['review', '/analyst/entity-layer/review'],
] as const

describe('Entity Layer Proxy Routes', () => {
  it('should proxy all read-only analyst routes behind admin auth', () => {
    for (const [route, backendPath] of routes) {
      const source = readFileSync(join(process.cwd(), 'app/api/entity-layer', route, 'route.ts'), 'utf8')
      assert.match(source, /export async function GET/)
      assert.match(source, /withAdminRoute/)
      assert.match(source, /proxyBackendJson/)
      assert.match(source, new RegExp(`path: '${backendPath}'`))
      assert.doesNotMatch(source, /export async function (POST|PUT|PATCH|DELETE)/)
    }
  })
})
