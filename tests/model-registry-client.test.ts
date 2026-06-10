import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createModelRegistryClient,
  loadModelRegistryConfig,
  ModelRegistryClientError,
} from '../lib/model-registry-client'

test('registry API client parses summary response', async () => {
  const client = createModelRegistryClient({
    baseUrl: 'http://registry.local',
    fetchImpl: async (input) => {
      assert.equal(String(input), 'http://registry.local/dashboard/summary')
      return new Response(JSON.stringify({
        candidate_count: 1,
        bundle_count: 2,
        active_pointer_count: 3,
        promotion_event_count: 4,
        readiness_report_count: 5,
      }), {
        headers: { 'Content-Type': 'application/json' },
      })
    },
  })

  const summary = await client.getRegistrySummary()

  assert.equal(summary.candidate_count, 1)
  assert.equal(summary.readiness_report_count, 5)
})

test('registry API client handles stable registry error shape', async () => {
  const client = createModelRegistryClient({
    baseUrl: 'http://registry.local',
    fetchImpl: async () => new Response(JSON.stringify({
      error_code: 'not_found',
      message: 'Unknown candidate_id: missing',
      details: { candidate_id: 'missing' },
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    }),
  })

  await assert.rejects(
    () => client.getCandidate('missing'),
    (error) => {
      assert.ok(error instanceof ModelRegistryClientError)
      assert.equal(error.status, 404)
      assert.equal(error.errorCode, 'not_found')
      assert.equal(error.details.candidate_id, 'missing')
      return true
    }
  )
})

test('registry API client handles timeout response', async () => {
  const client = createModelRegistryClient({
    baseUrl: 'http://registry.local',
    timeoutSeconds: 0.001,
    fetchImpl: async (_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        const error = new Error('aborted')
        error.name = 'AbortError'
        reject(error)
      })
    }),
  })

  await assert.rejects(
    () => client.listCandidates(),
    (error) => {
      assert.ok(error instanceof ModelRegistryClientError)
      assert.equal(error.status, 504)
      assert.equal(error.errorCode, 'registry_api_timeout')
      return true
    }
  )
})

test('registry API client handles missing configuration', async () => {
  const client = createModelRegistryClient({ baseUrl: '' })

  await assert.rejects(
    () => client.listCandidates(),
    (error) => {
      assert.ok(error instanceof ModelRegistryClientError)
      assert.equal(error.errorCode, 'registry_api_not_configured')
      return true
    }
  )
})

test('registry API configuration reads env vars', () => {
  const config = loadModelRegistryConfig({
    MODEL_REGISTRY_API_URL: 'http://localhost:8000',
    MODEL_REGISTRY_API_TIMEOUT_SECONDS: '7',
  })

  assert.equal(config.baseUrl, 'http://localhost:8000')
  assert.equal(config.timeoutSeconds, 7)
})
