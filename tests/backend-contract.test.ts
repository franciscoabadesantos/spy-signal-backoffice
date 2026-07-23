import assert from 'node:assert/strict'
import test from 'node:test'
import { parseBackendContract } from '../lib/backend-contract'

test('accepts a complete backend contract manifest', () => {
  const contract = parseBackendContract({
    contract_version: '2026-07-23.1',
    api_version: '0.1.0',
    path_count: 1,
    operation_count: 1,
    operations: [
      {
        method: 'GET',
        path: '/admin/contracts',
        operation_id: 'get_api_contract_admin_contracts_get',
        summary: 'get api contract',
        audience: 'backoffice',
        auth: 'service-token',
        auth_notes: 'Authorization bearer token must match BACKEND_SERVICE_TOKEN.',
        owner: 'backend',
        status: 'stable',
        consumers: ['backoffice'],
      },
    ],
  })

  assert.equal(contract.operation_count, 1)
  assert.equal(contract.operations[0].path, '/admin/contracts')
})

test('rejects an incomplete backend contract manifest', () => {
  assert.throws(
    () => parseBackendContract({ contract_version: '2026-07-23.1', operations: [] }),
    /BACKEND_CONTRACT_INVALID/
  )
})
