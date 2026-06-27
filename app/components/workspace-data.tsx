'use client'

import { asRecord, unwrapList, type RowRecord } from '@/lib/payload'

export { asRecord }

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

export function readString(row: unknown, keys: string[]): string {
  const record = asRecord(row)
  if (!record) return '—'
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  }
  return '—'
}

export function readArrayPayload(payload: unknown, key: string): unknown[] {
  return unwrapList(payload, [key])
}

export function formatUnknown(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

export function JsonBlock({ value }: { value: unknown }) {
  return <pre>{JSON.stringify(value, null, 2)}</pre>
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="empty-state small">{children}</p>
}

export function EvidenceGap({
  reason,
  expected,
  title = 'Evidence not wired yet',
}: {
  reason?: React.ReactNode
  expected?: React.ReactNode
  title?: string
}) {
  return (
    <div className="evidence-gap" role="note">
      <strong>{title}</strong>
      <div>{reason || 'The backend did not return evidence for this surface.'}</div>
      {expected ? <div className="small">Expected: {expected}</div> : null}
    </div>
  )
}

export function ApiErrorBox({ error }: { error: string | null }) {
  if (!error) return null
  return <div className="error">{error}</div>
}

export function DynamicTable({
  rows,
  columns,
  emptyLabel = 'No rows returned.',
}: {
  rows: unknown[]
  columns?: Array<{ key: string; label: string; keys?: string[] }>
  emptyLabel?: string
}) {
  if (rows.length === 0) {
    return <EmptyState>{emptyLabel}</EmptyState>
  }

  const inferredKeys = [...new Set(rows.flatMap((row) => Object.keys(asRecord(row) ?? {})))].slice(0, 12)
  const effectiveColumns = columns?.length
    ? columns
    : inferredKeys.map((key) => ({ key, label: key }))

  if (effectiveColumns.length === 0) {
    return <JsonBlock value={rows} />
  }

  return (
    <div className="table-wrap">
      <table className="registry-table">
        <thead>
          <tr>
            {effectiveColumns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
            <th>Raw</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={rowKey(row, index)}>
              {effectiveColumns.map((column) => (
                <td key={column.key}>{formatUnknown(readColumn(row, column))}</td>
              ))}
              <td>
                <details>
                  <summary>JSON</summary>
                  <JsonBlock value={row} />
                </details>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function readColumn(row: unknown, column: { key: string; keys?: string[] }): unknown {
  const record = asRecord(row)
  if (!record) return undefined
  const keys = column.keys ?? [column.key]
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key]
  }
  return undefined
}

function rowKey(row: unknown, index: number): string {
  const record = asRecord(row)
  const id = record?.id ?? record?.job_id ?? record?.ticker ?? record?.runId ?? record?.run_id
  return id === undefined || id === null ? String(index) : `${String(id)}-${index}`
}
