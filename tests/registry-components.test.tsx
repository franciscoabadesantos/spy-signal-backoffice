import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { CandidateOverview, JsonSection, RegistryErrorState } from '../app/registry/components'
import { RegistryBackendError } from '../lib/registry-backend'

test('registry unavailable state renders safe operator copy', () => {
  const markup = renderToStaticMarkup(
    <RegistryErrorState error={new RegistryBackendError(
      'Registry evidence is not available through finance-backend yet.',
      503,
      'registry_unavailable'
    )} />
  )

  assert.match(markup, /Registry evidence is not available through finance-backend yet\./)
  assert.doesNotMatch(markup, /MODEL_REGISTRY_API_URL/)
})

test('candidate overview preserves Q40\/Q41 diagnostics in rendered JSON', () => {
  const markup = renderToStaticMarkup(
    <CandidateOverview
      candidate={{
        candidate_id: 'cand-1',
        robustness_summary_json: {
          q40_q41_diagnostics: { paired: true },
          core_overlay_attribution: { delta: 0.18 },
          state_persistence_attribution: { delta: 0.07 },
          q41_floor_guardrail: { active: true },
        },
      }}
    />
  )

  assert.match(markup, /q40_q41_diagnostics/)
  assert.match(markup, /core_overlay_attribution/)
  assert.match(markup, /state_persistence_attribution/)
  assert.match(markup, /q41_floor_guardrail/)
})

test('read-only JSON section preserves diagnostic-only evidence fields', () => {
  const markup = renderToStaticMarkup(
    <JsonSection
      title="Current Contract Evidence"
      value={{
        diagnostic_only: true,
        do_not_tune_from_single_run: true,
      }}
    />
  )

  assert.match(markup, /diagnostic_only/)
  assert.match(markup, /do_not_tune_from_single_run/)
})
