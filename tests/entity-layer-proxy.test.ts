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

  it('proxies financial statements through an admin-only read route', () => {
    const source = readFileSync(join(process.cwd(), 'app/api/financial-statements/route.ts'), 'utf8')
    assert.match(source, /export async function GET/)
    assert.match(source, /withAdminRoute/)
    assert.match(source, /proxyBackendJson/)
    assert.match(source, /path: '\/analyst\/financial-statements'/)
    assert.doesNotMatch(source, /export async function (POST|PUT|PATCH|DELETE)/)
  })

  it('proxies market metrics through an admin-only read route', () => {
    const source = readFileSync(join(process.cwd(), 'app/api/market-metrics/route.ts'), 'utf8')
    assert.match(source, /export async function GET/)
    assert.match(source, /withAdminRoute/)
    assert.match(source, /proxyBackendJson/)
    assert.match(source, /path: '\/analyst\/market-metrics'/)
    assert.doesNotMatch(source, /export async function (POST|PUT|PATCH|DELETE)/)
  })

  it('proxies earnings events through an admin-only read route', () => {
    const source = readFileSync(join(process.cwd(), 'app/api/earnings-events/route.ts'), 'utf8')
    assert.match(source, /export async function GET/)
    assert.match(source, /withAdminRoute/)
    assert.match(source, /proxyBackendJson/)
    assert.match(source, /path: '\/analyst\/earnings-events'/)
    assert.doesNotMatch(source, /export async function (POST|PUT|PATCH|DELETE)/)
  })

  it('proxies latest enriched earnings through an admin-only read route', () => {
    const source = readFileSync(join(process.cwd(), 'app/api/earnings-events/latest/route.ts'), 'utf8')
    assert.match(source, /export async function GET/)
    assert.match(source, /withAdminRoute/)
    assert.match(source, /proxyBackendJson/)
    assert.match(source, /path: '\/analyst\/earnings-events\/latest'/)
    assert.doesNotMatch(source, /export async function (POST|PUT|PATCH|DELETE)/)
  })

  it('proxies corporate actions through an admin-only read route', () => {
    const source = readFileSync(join(process.cwd(), 'app/api/corporate-actions/route.ts'), 'utf8')
    assert.match(source, /export async function GET/)
    assert.match(source, /withAdminRoute/)
    assert.match(source, /proxyBackendJson/)
    assert.match(source, /path: '\/analyst\/corporate-actions'/)
    assert.doesNotMatch(source, /export async function (POST|PUT|PATCH|DELETE)/)
  })

  it('proxies filings through an admin-only read route', () => {
    const source = readFileSync(join(process.cwd(), 'app/api/filings/route.ts'), 'utf8')
    assert.match(source, /export async function GET/)
    assert.match(source, /withAdminRoute/)
    assert.match(source, /proxyBackendJson/)
    assert.match(source, /path: '\/analyst\/filings'/)
    assert.doesNotMatch(source, /export async function (POST|PUT|PATCH|DELETE)/)
  })

  it('labels entity-tail EAS market cap as latest metadata, not provider/local data', () => {
    const source = readFileSync(join(process.cwd(), 'components/entity-layer/EntityLayerWorkspace.tsx'), 'utf8')
    assert.match(source, /Latest metadata market cap/)
    assert.doesNotMatch(source, /Provider\/local market cap/)
  })
})
