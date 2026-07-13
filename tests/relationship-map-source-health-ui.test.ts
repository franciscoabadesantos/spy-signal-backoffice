import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('components/relationship-map/RelationshipMapHealthWorkspace.tsx', 'utf8')

test('relationship map source health renders readiness-gated coverage labels', () => {
  assert.match(source, /pending coverage: \{countLabel\(rollup\.pendingCoverage/)
  assert.match(source, /pending coverage<\/span>/)
  assert.match(source, /technicalConstituentCount/)
  assert.match(source, /pricedConstituentCount/)
  assert.match(source, /coverageRatio/)
  assert.match(source, /relationshipMapEligible/)
  assert.match(source, /relationshipMapIneligibleReason/)
})

test('relationship map source health no longer labels weekly freshness as ran today', () => {
  assert.equal(source.includes('ran today'), false)
  assert.match(source, /Fresh within \$\{windowLabel\}/)
  assert.match(source, /expectedBuildWindowHours/)
})
