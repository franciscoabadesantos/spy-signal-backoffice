'use client'

import Link from 'next/link'
import { useEffect, useEffectEvent, useState } from 'react'
import { readApiError } from '@/lib/api-error'
import { requestClientJson } from '@/lib/client-json'
import { ApiErrorBox, DynamicTable, EmptyState, JsonBlock, formatUnknown, readArrayPayload } from '@/app/components/workspace-data'

type BatchRow = Record<string, unknown>

export default function BatchResultsWorkspace() {
  const [payload, setPayload] = useState<unknown>(null)
  const [batches, setBatches] = useState<BatchRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadBatches() {
    setLoading(true)
    setError(null)
    try {
      const response = await requestClientJson('/api/research/batches?limit=100')
      setPayload(response)
      setBatches(normalizeBatches(response))
    } catch (requestError) {
      setError(readApiError(requestError, 'Failed to load research batches.'))
    } finally {
      setLoading(false)
    }
  }

  const loadBatchesEffect = useEffectEvent(() => {
    void loadBatches()
  })

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadBatchesEffect()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div className="page-stack">
      <ApiErrorBox error={error} />

      <div className="card">
        <div className="split-row">
          <div>
            <h2>Batch results</h2>
            <p className="small">Research batch history. Launch new grids from Research.</p>
          </div>
          <button className="secondary" type="button" onClick={() => void loadBatches()} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        {loading ? <p className="small">Loading batches...</p> : null}
        {batches.length === 0 ? <EmptyState>No batches returned.</EmptyState> : <BatchTable rows={batches} />}
      </div>

      <details className="card">
        <summary>Raw batch payload</summary>
        <JsonBlock value={payload ?? {}} />
      </details>
    </div>
  )
}

function BatchTable({ rows }: { rows: BatchRow[] }) {
  const compactRows = rows.map((row) => ({
    batch: batchId(row),
    status: row.status,
    configs: row.config_count ?? row.n_configs ?? row.member_count,
    created: row.created_at ?? row.submitted_at ?? row.started_at,
    raw: row,
  }))

  return (
    <>
      <div className="table-wrap">
        <table className="registry-table">
          <thead>
            <tr>
              <th>Batch</th>
              <th>Status</th>
              <th>Configs</th>
              <th>Created</th>
              <th>Raw</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const id = batchId(row)
              return (
                <tr key={id ?? index}>
                  <td>
                    {id ? <Link href={`/research/batches/${encodeURIComponent(id)}`}>{id}</Link> : formatUnknown(row.id ?? row.batch_name)}
                  </td>
                  <td>{formatUnknown(row.status)}</td>
                  <td>{formatUnknown(row.config_count ?? row.n_configs ?? row.member_count)}</td>
                  <td>{formatUnknown(row.created_at ?? row.submitted_at ?? row.started_at)}</td>
                  <td>
                    <details>
                      <summary>JSON</summary>
                      <JsonBlock value={row} />
                    </details>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <details className="details-block">
        <summary>Compact table data</summary>
        <DynamicTable rows={compactRows} />
      </details>
    </>
  )
}

function normalizeBatches(payload: unknown): BatchRow[] {
  for (const key of ['batches', 'jobs', 'items', 'results']) {
    const rows = readArrayPayload(payload, key) as BatchRow[]
    if (rows.length > 0) return rows
  }
  return []
}

function batchId(row: BatchRow): string | null {
  return readStringValue(row.batch_id ?? row.id ?? row.job_id ?? row.research_batch_id)
}

function readStringValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return null
}
