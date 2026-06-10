import assert from 'node:assert/strict'
import test from 'node:test'
import { requestClientJson } from '../lib/client-json'

test('client JSON helper returns payload on success', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

  try {
    const payload = await requestClientJson('/api/example')
    assert.deepEqual(payload, { ok: true })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('client JSON helper throws parsed JSON payload on JSON error response', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'BROKEN', message: 'Nope' }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' },
  })

  try {
    await assert.rejects(
      () => requestClientJson('/api/example'),
      (error) => {
        assert.deepEqual(error, { error: 'BROKEN', message: 'Nope' })
        return true
      }
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('client JSON helper throws structured diagnostic on HTML response', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response('<!DOCTYPE html><title>500</title>', {
    status: 500,
    headers: { 'Content-Type': 'text/html' },
  })

  try {
    await assert.rejects(
      () => requestClientJson('/api/example'),
      (error) => {
        const payload = error as Record<string, unknown>
        assert.equal(payload.error, 'CLIENT_NON_JSON_RESPONSE')
        assert.equal(payload.statusCode, 500)
        assert.equal(payload.upstreamContentType, 'text/html')
        assert.match(String(payload.upstreamBodyPreview), /DOCTYPE html/)
        return true
      }
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('client JSON helper throws structured diagnostic on invalid JSON body', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response('{not-valid-json', {
    status: 500,
    headers: { 'Content-Type': 'application/json' },
  })

  try {
    await assert.rejects(
      () => requestClientJson('/api/example'),
      (error) => {
        const payload = error as Record<string, unknown>
        assert.equal(payload.error, 'CLIENT_INVALID_JSON_RESPONSE')
        assert.equal(payload.statusCode, 500)
        assert.equal(payload.upstreamContentType, 'application/json')
        assert.match(String(payload.upstreamBodyPreview), /not-valid-json/)
        return true
      }
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})
