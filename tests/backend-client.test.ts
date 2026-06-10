import assert from 'node:assert/strict'
import test from 'node:test'
import { BackendProxyError, requestBackendJson, toBackendProxyErrorPayload } from '../lib/backend-client'

test('backend client parses upstream JSON', async () => {
  const originalBaseUrl = process.env.BACKEND_BASE_URL
  const originalFetch = globalThis.fetch

  process.env.BACKEND_BASE_URL = 'http://backend.local'
  globalThis.fetch = async (input) => {
    assert.equal(String(input), 'http://backend.local/health')
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const { payload, upstream } = await requestBackendJson({ path: '/health' })
    assert.equal(upstream.status, 200)
    assert.deepEqual(payload, { ok: true })
  } finally {
    process.env.BACKEND_BASE_URL = originalBaseUrl
    globalThis.fetch = originalFetch
  }
})

test('backend client converts HTML upstream into structured diagnostic', async () => {
  const originalBaseUrl = process.env.BACKEND_BASE_URL
  const originalFetch = globalThis.fetch

  process.env.BACKEND_BASE_URL = 'http://backend.local'
  globalThis.fetch = async () => new Response('<!DOCTYPE html><title>404</title>', {
    status: 404,
    headers: { 'Content-Type': 'text/html' },
  })

  try {
    await assert.rejects(
      () => requestBackendJson({ path: '/analyst/jobs' }),
      (error) => {
        assert.ok(error instanceof BackendProxyError)
        assert.equal(error.code, 'UPSTREAM_NON_JSON_RESPONSE')
        const payload = toBackendProxyErrorPayload(error)
        assert.equal(payload.upstreamStatus, 404)
        assert.equal(payload.upstreamContentType, 'text/html')
        assert.match(String(payload.upstreamBodyPreview), /DOCTYPE html/)
        return true
      }
    )
  } finally {
    process.env.BACKEND_BASE_URL = originalBaseUrl
    globalThis.fetch = originalFetch
  }
})
