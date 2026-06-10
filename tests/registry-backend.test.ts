import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import {
  getCandidateDetail,
  getReadinessReport,
  listCandidates,
  RegistryBackendError,
} from '../lib/registry-backend'

test('registry backend helper calls finance-backend proxy routes', async () => {
  const originalBaseUrl = process.env.BACKEND_BASE_URL
  const originalToken = process.env.BACKEND_SERVICE_TOKEN
  const originalFetch = globalThis.fetch

  process.env.BACKEND_BASE_URL = 'http://backend.local'
  process.env.BACKEND_SERVICE_TOKEN = 'test-token'
  globalThis.fetch = async (input, init) => {
    assert.equal(
      String(input),
      'http://backend.local/analyst/registry/candidates?status=paper_candidate&strategy_family=spy_signal&universe=spy'
    )
    const headers = new Headers(init?.headers)
    assert.equal(headers.get('authorization'), 'Bearer test-token')
    return new Response(JSON.stringify({ candidates: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const candidates = await listCandidates({
      status: 'paper_candidate',
      strategyFamily: 'spy_signal',
      universe: 'spy',
    })
    assert.deepEqual(candidates, [])
  } finally {
    process.env.BACKEND_BASE_URL = originalBaseUrl
    process.env.BACKEND_SERVICE_TOKEN = originalToken
    globalThis.fetch = originalFetch
  }
})

test('registry backend helper converts registry_unavailable into safe error', async () => {
  const originalBaseUrl = process.env.BACKEND_BASE_URL
  const originalToken = process.env.BACKEND_SERVICE_TOKEN
  const originalFetch = globalThis.fetch

  process.env.BACKEND_BASE_URL = 'http://backend.local'
  process.env.BACKEND_SERVICE_TOKEN = 'test-token'
  globalThis.fetch = async () => new Response(JSON.stringify({
    status: 'unavailable',
    error_code: 'registry_unavailable',
    message: 'Registry API is not configured for this environment.',
    details: {},
  }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  })

  try {
    await assert.rejects(
      () => listCandidates(),
      (error) => {
        assert.ok(error instanceof RegistryBackendError)
        assert.equal(error.status, 503)
        assert.equal(error.errorCode, 'registry_unavailable')
        assert.equal(error.message, 'Registry evidence is not available through finance-backend yet.')
        return true
      }
    )
  } finally {
    process.env.BACKEND_BASE_URL = originalBaseUrl
    process.env.BACKEND_SERVICE_TOKEN = originalToken
    globalThis.fetch = originalFetch
  }
})

test('candidate detail preserves robustness summary and research evidence payloads', async () => {
  const originalBaseUrl = process.env.BACKEND_BASE_URL
  const originalToken = process.env.BACKEND_SERVICE_TOKEN
  const originalFetch = globalThis.fetch

  process.env.BACKEND_BASE_URL = 'http://backend.local'
  process.env.BACKEND_SERVICE_TOKEN = 'test-token'
  globalThis.fetch = async () => new Response(JSON.stringify({
    candidate: {
      candidate_id: 'cand-1',
      robustness_summary_json: {
        q40_q41_diagnostics: { mode: 'paired_validation' },
        core_overlay_attribution: { value: 0.18 },
        state_persistence_attribution: { value: 0.07 },
        q41_floor_guardrail: { active: true },
      },
    },
    research_artifact_evidence: {
      diagnostic_only: true,
      do_not_tune_from_single_run: true,
    },
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

  try {
    const payload = await getCandidateDetail('cand-1')
    assert.equal(payload.candidate.candidate_id, 'cand-1')
    assert.deepEqual(payload.candidate.robustness_summary_json, {
      q40_q41_diagnostics: { mode: 'paired_validation' },
      core_overlay_attribution: { value: 0.18 },
      state_persistence_attribution: { value: 0.07 },
      q41_floor_guardrail: { active: true },
    })
    assert.deepEqual(payload.research_artifact_evidence, {
      diagnostic_only: true,
      do_not_tune_from_single_run: true,
    })
  } finally {
    process.env.BACKEND_BASE_URL = originalBaseUrl
    process.env.BACKEND_SERVICE_TOKEN = originalToken
    globalThis.fetch = originalFetch
  }
})

test('readiness detail preserves current contract evidence payloads', async () => {
  const originalBaseUrl = process.env.BACKEND_BASE_URL
  const originalToken = process.env.BACKEND_SERVICE_TOKEN
  const originalFetch = globalThis.fetch

  process.env.BACKEND_BASE_URL = 'http://backend.local'
  process.env.BACKEND_SERVICE_TOKEN = 'test-token'
  globalThis.fetch = async () => new Response(JSON.stringify({
    readiness_report: {
      report_id: 'rr-1',
      overall_status: 'warning',
    },
    current_contract_evidence: {
      q40_q41_diagnostics: { gaps: [] },
      diagnostic_only: true,
      do_not_tune_from_single_run: true,
    },
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

  try {
    const payload = await getReadinessReport('rr-1')
    assert.equal(payload.readiness_report.report_id, 'rr-1')
    assert.deepEqual(payload.current_contract_evidence, {
      q40_q41_diagnostics: { gaps: [] },
      diagnostic_only: true,
      do_not_tune_from_single_run: true,
    })
  } finally {
    process.env.BACKEND_BASE_URL = originalBaseUrl
    process.env.BACKEND_SERVICE_TOKEN = originalToken
    globalThis.fetch = originalFetch
  }
})

test('backoffice user-facing docs no longer mention direct registry env vars', () => {
  const readme = fs.readFileSync(path.join(process.cwd(), 'README.md'), 'utf8')
  const envExample = fs.readFileSync(path.join(process.cwd(), '.env.example'), 'utf8')

  assert.doesNotMatch(readme, /MODEL_REGISTRY_API_URL/)
  assert.doesNotMatch(readme, /finance-model-registry/)
  assert.doesNotMatch(envExample, /MODEL_REGISTRY_API_URL/)
})
