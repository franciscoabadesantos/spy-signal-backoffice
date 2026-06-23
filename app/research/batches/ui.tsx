'use client'

import Link from 'next/link'
import { useEffect, useEffectEvent, useState } from 'react'
import { readApiError } from '@/lib/api-error'
import { requestClientJson } from '@/lib/client-json'
import { ApiErrorBox, DynamicTable, EmptyState, JsonBlock, asRecord, formatUnknown, readArrayPayload } from '@/app/components/workspace-data'

type AxisSpec = {
  key: string
  label: string
  description?: string
  options: string[]
  multiple: boolean
  raw: unknown
}

type BatchRow = Record<string, unknown>

export default function BatchSubmitWorkspace({ adminEmail }: { adminEmail: string }) {
  const [payload, setPayload] = useState<unknown>(null)
  const [batches, setBatches] = useState<BatchRow[]>([])
  const [axes, setAxes] = useState<AxisSpec[]>([])
  const [selected, setSelected] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [createdBatch, setCreatedBatch] = useState<BatchRow | null>(null)

  async function loadBatches() {
    setLoading(true)
    setError(null)
    try {
      const response = await requestClientJson('/api/research/batches?include_spec=true&limit=100')
      const nextAxes = normalizeAxes(response)
      setPayload(response)
      setBatches(normalizeBatches(response))
      setAxes(nextAxes)
      setSelected((current) => seedSelectedAxes(nextAxes, current))
    } catch (requestError) {
      setError(readApiError(requestError, 'Failed to load research batch contract.'))
    } finally {
      setLoading(false)
    }
  }

  const configCount = countSelectedConfigs(axes, selected)

  async function submitBatch() {
    setSubmitting(true)
    setSubmitError(null)
    setCreatedBatch(null)
    try {
      const axesPayload = Object.fromEntries(
        axes.map((axis) => [axis.key, selected[axis.key] ?? []])
      )
      const response = await requestClientJson('/api/research/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requested_by: adminEmail,
          batch_spec: {
            axes: axesPayload,
            config_count_preview: configCount,
          },
          axes: axesPayload,
          config_count_preview: configCount,
        }),
      })
      const created = normalizeCreatedBatch(response)
      setCreatedBatch(created ?? (asRecord(response) ?? { response }))
      await loadBatches()
    } catch (requestError) {
      setSubmitError(readApiError(requestError, 'Failed to submit research batch.'))
    } finally {
      setSubmitting(false)
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
      <ApiErrorBox error={submitError} />

      <div className="card">
        <div className="split-row">
          <div>
            <h2>Submit batch</h2>
            <p className="small">Axes are rendered from the backend contract response. Config count is a UI preview before submit.</p>
          </div>
          <div style={{ minWidth: 220 }}>
            <button className="primary" type="button" onClick={() => void submitBatch()} disabled={submitting || axes.length === 0 || configCount === 0}>
              {submitting ? 'Submitting...' : `Submit ${configCount || 0} configs`}
            </button>
          </div>
        </div>

        {loading ? <p className="small">Loading advertised axes...</p> : null}
        {axes.length > 0 ? (
          <div className="axis-grid">
            {axes.map((axis) => (
              <AxisPicker
                axis={axis}
                key={axis.key}
                selected={selected[axis.key] ?? []}
                onChange={(values) => setSelected((current) => ({ ...current, [axis.key]: values }))}
              />
            ))}
          </div>
        ) : (
          <EmptyState>No batch axes were advertised by the backend response.</EmptyState>
        )}

        <div className="metric-grid" style={{ marginTop: 12 }}>
          <div className="card compact-card">
            <label>Preview Config Count</label>
            <div className="metric-value">{configCount}</div>
          </div>
          <div className="card compact-card">
            <label>Advertised Axes</label>
            <div className="metric-value">{axes.length}</div>
          </div>
        </div>

        {createdBatch ? (
          <div className="success" style={{ marginTop: 12 }}>
            Batch submitted. {batchId(createdBatch) ? <Link className="text-link" href={`/research/batches/${encodeURIComponent(batchId(createdBatch) ?? '')}`}>Open results</Link> : null}
          </div>
        ) : null}
      </div>

      <div className="card">
        <div className="split-row">
          <div>
            <h2>Batch history</h2>
            <p className="small">Backend batch rows. Open a batch to inspect the leque distribution.</p>
          </div>
          <button className="secondary" type="button" onClick={() => void loadBatches()} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        {batches.length === 0 ? <EmptyState>No batches returned.</EmptyState> : <BatchTable rows={batches} />}
      </div>

      <details className="card">
        <summary>Raw batch contract payload</summary>
        <JsonBlock value={payload ?? {}} />
      </details>
    </div>
  )
}

function AxisPicker({
  axis,
  selected,
  onChange,
}: {
  axis: AxisSpec
  selected: string[]
  onChange: (values: string[]) => void
}) {
  const [customText, setCustomText] = useState('')

  function toggle(value: string) {
    if (axis.multiple) {
      onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value])
      return
    }
    onChange([value])
  }

  function applyCustom() {
    const values = customText.split(',').map((item) => item.trim()).filter(Boolean)
    if (values.length > 0) onChange(axis.multiple ? values : [values[0]])
  }

  return (
    <section className="card compact-card">
      <div className="split-row">
        <div>
          <h3>{axis.label}</h3>
          {axis.description ? <p className="small">{axis.description}</p> : null}
        </div>
        <span className="badge queued">{axis.multiple ? 'multi' : 'single'}</span>
      </div>

      {axis.options.length > 0 ? (
        <div className="option-grid">
          {axis.options.map((option) => (
            <label className="check-row" key={option}>
              <input
                checked={selected.includes(option)}
                name={`axis-${axis.key}`}
                onChange={() => toggle(option)}
                type={axis.multiple ? 'checkbox' : 'radio'}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      ) : (
        <div>
          <label htmlFor={`custom-${axis.key}`}>Values</label>
          <input id={`custom-${axis.key}`} value={customText} onChange={(event) => setCustomText(event.target.value)} placeholder="comma-separated values" />
          <button className="secondary" type="button" style={{ marginTop: 8 }} onClick={applyCustom}>Apply values</button>
        </div>
      )}

      <div className="small" style={{ marginTop: 8 }}>Selected: {selected.join(', ') || 'none'}</div>
    </section>
  )
}

function BatchTable({ rows }: { rows: BatchRow[] }) {
  return (
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
  )
}

function normalizeBatches(payload: unknown): BatchRow[] {
  for (const key of ['batches', 'jobs', 'items', 'results']) {
    const rows = readArrayPayload(payload, key) as BatchRow[]
    if (rows.length > 0) return rows
  }
  return []
}

function normalizeAxes(payload: unknown): AxisSpec[] {
  const record = asRecord(payload)
  const candidate = record?.batch_spec_axes
    ?? record?.advertised_axes
    ?? record?.axis_options
    ?? record?.axes
    ?? asRecord(record?.spec)?.axes
    ?? asRecord(record?.batch_spec)?.axes
    ?? asRecord(record?.contract)?.axes

  if (Array.isArray(candidate)) {
    return candidate.map(axisFromArrayEntry).filter((axis): axis is AxisSpec => Boolean(axis))
  }

  const axisRecord = asRecord(candidate)
  if (!axisRecord) return []
  return Object.entries(axisRecord).map(([key, value]) => axisFromRecordEntry(key, value))
}

function axisFromArrayEntry(value: unknown): AxisSpec | null {
  const record = asRecord(value)
  if (!record) return null
  const key = readStringValue(record.key ?? record.name ?? record.axis)
  if (!key) return null
  return {
    key,
    label: readStringValue(record.label) ?? key,
    description: readStringValue(record.description) ?? undefined,
    options: normalizeOptions(record.options ?? record.values ?? record.allowed_values),
    multiple: record.multiple !== false && record.kind !== 'single',
    raw: value,
  }
}

function axisFromRecordEntry(key: string, value: unknown): AxisSpec {
  const record = asRecord(value)
  return {
    key,
    label: readStringValue(record?.label) ?? key,
    description: readStringValue(record?.description) ?? undefined,
    options: normalizeOptions(record?.options ?? record?.values ?? record?.allowed_values ?? value),
    multiple: record?.multiple !== false && record?.kind !== 'single',
    raw: value,
  }
}

function normalizeOptions(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => readStringValue(item)).filter((item): item is string => Boolean(item))
  const record = asRecord(value)
  if (record) return Object.keys(record)
  return []
}

function seedSelectedAxes(axes: AxisSpec[], current: Record<string, string[]>): Record<string, string[]> {
  const next: Record<string, string[]> = {}
  for (const axis of axes) {
    const existing = current[axis.key]
    next[axis.key] = existing?.length ? existing : axis.options.slice(0, axis.multiple ? Math.min(2, axis.options.length) : 1)
  }
  return next
}

function countSelectedConfigs(axes: AxisSpec[], selected: Record<string, string[]>): number {
  if (axes.length === 0) return 0
  return axes.reduce((count, axis) => count * Math.max(1, selected[axis.key]?.length ?? 0), 1)
}

function normalizeCreatedBatch(payload: unknown): BatchRow | null {
  const record = asRecord(payload)
  return asRecord(record?.batch) ?? asRecord(record?.job) ?? record
}

function batchId(row: BatchRow): string | null {
  return readStringValue(row.batch_id ?? row.id ?? row.job_id ?? row.research_batch_id)
}

function readStringValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return null
}
