'use client'

import { useEffect, useEffectEvent, useMemo, useState } from 'react'
import { readApiError } from '@/lib/api-error'
import { requestClientJson } from '@/lib/client-json'
import { ApiErrorBox, EvidenceGap, JsonBlock, asRecord, formatUnknown } from '@/app/components/workspace-data'

type MemberRow = Record<string, unknown>
type SortKey = 'rank_ic' | 'rank_ic_ir' | 'top_bottom_spread' | 'mcpt_p_value' | 'turnover' | 'net_return'

type NormalizedMember = {
  id: string
  raw: MemberRow
  axes: Record<string, unknown>
  metrics: Record<string, unknown>
  selectionSummary: Record<string, unknown> | null
  values: Record<SortKey, number | null>
}

const SORT_KEYS: Array<{ key: SortKey; label: string; descending: boolean }> = [
  { key: 'rank_ic', label: 'rank-IC', descending: true },
  { key: 'rank_ic_ir', label: 'IC IR', descending: true },
  { key: 'top_bottom_spread', label: 'Top-bottom spread', descending: true },
  { key: 'mcpt_p_value', label: 'MCPT p', descending: false },
  { key: 'turnover', label: 'Turnover', descending: false },
  { key: 'net_return', label: 'Net return', descending: true },
]

export default function BatchResultsWorkspace({ adminEmail, batchId }: { adminEmail: string; batchId: string }) {
  const [detail, setDetail] = useState<unknown>(null)
  const [results, setResults] = useState<unknown>(null)
  const [members, setMembers] = useState<NormalizedMember[]>([])
  const [sortKey, setSortKey] = useState<SortKey>('rank_ic')
  const [sortDescending, setSortDescending] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedMember, setSelectedMember] = useState<NormalizedMember | null>(null)

  async function loadResults() {
    setLoading(true)
    setError(null)
    try {
      const [detailPayload, resultsPayload] = await Promise.all([
        requestClientJson(`/api/research/batches/${encodeURIComponent(batchId)}`),
        requestClientJson(`/api/research/batches/${encodeURIComponent(batchId)}/results`),
      ])
      setDetail(detailPayload)
      setResults(resultsPayload)
      setMembers(normalizeMembers(resultsPayload, detailPayload))
    } catch (requestError) {
      setError(readApiError(requestError, 'Failed to load batch results.'))
    } finally {
      setLoading(false)
    }
  }

  const loadResultsEffect = useEffectEvent(() => {
    void loadResults()
  })

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadResultsEffect()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [batchId])

  const sortedMembers = useMemo(() => {
    const direction = sortDescending ? -1 : 1
    return [...members].sort((a, b) => {
      const av = a.values[sortKey]
      const bv = b.values[sortKey]
      if (av === null && bv === null) return a.id.localeCompare(b.id)
      if (av === null) return 1
      if (bv === null) return -1
      return (av - bv) * direction
    })
  }, [members, sortDescending, sortKey])

  const axisSummaries = useMemo(() => buildAxisSummaries(members), [members])

  return (
    <div className="page-stack">
      <ApiErrorBox error={error} />

      <div className="card">
        <div className="split-row">
          <div>
            <h2>{batchId}</h2>
            <p className="small">This view displays backend-returned aggregate and member metrics; no metric is recomputed here.</p>
          </div>
          <button className="secondary" type="button" onClick={() => void loadResults()} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="metric-grid">
        <Metric label="Configs" value={members.length} />
        <Metric label="Median rank-IC" value={formatNumber(median(valuesFor(members, 'rank_ic')))} />
        <Metric label="Median spread" value={formatNumber(median(valuesFor(members, 'top_bottom_spread')))} />
        <Metric label="Median turnover" value={formatNumber(median(valuesFor(members, 'turnover')))} />
      </div>

      {members.length === 0 ? (
        <div className="card">
          <EvidenceGap
            reason="The batch results endpoint returned no member rows."
            expected="Persisted batch member results from /analyst/research/batches/{batch_id}/results; the empty batch store is a documented backend dependency."
            title="Batch member evidence unavailable"
          />
        </div>
      ) : (
        <>
          <div className="leque-grid">
            <DistributionCard title="Rank-IC Distribution" values={valuesFor(members, 'rank_ic')} />
            <DistributionCard title="Top-Bottom Spread Distribution" values={valuesFor(members, 'top_bottom_spread')} />
            <DistributionCard title="Decay Distribution" values={decayValues(members)} />
            <ScatterCard members={members} />
          </div>

          <div className="card">
            <h2>Sensitivity by Axis</h2>
            <p className="small">Average rank-IC grouped by axis values advertised in each member config.</p>
            {axisSummaries.length === 0 ? (
              <EvidenceGap
                reason="Member rows did not include axis metadata."
                expected="Axis fields on persisted batch member rows."
                title="Batch axis evidence unavailable"
              />
            ) : (
              <div className="axis-summary-grid">
                {axisSummaries.map((summary) => (
                  <AxisSummaryChart key={summary.axis} summary={summary} />
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="split-row">
              <div>
                <h2>Members</h2>
                <p className="small">Sortable config table with multiple-testing selection evidence visible before registry selection.</p>
              </div>
              <div className="meta">
                <label htmlFor="memberSort">Sort</label>
                <select id="memberSort" value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
                  {SORT_KEYS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                </select>
                <button className="secondary" type="button" onClick={() => setSortDescending((value) => !value)}>
                  {sortDescending ? 'Desc' : 'Asc'}
                </button>
              </div>
            </div>
            <MemberTable members={sortedMembers} onSelect={setSelectedMember} />
          </div>
        </>
      )}

      <details className="card">
        <summary>Raw detail and results payloads</summary>
        <JsonBlock value={{ detail, results }} />
      </details>

      {selectedMember ? (
        <SelectMemberDialog
          adminEmail={adminEmail}
          batchId={batchId}
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
        />
      ) : null}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="card compact-card">
      <label>{label}</label>
      <div className="metric-value">{formatUnknown(value)}</div>
    </div>
  )
}

function DistributionCard({ title, values }: { title: string; values: number[] }) {
  return (
    <div className="card compact-card">
      <h3>{title}</h3>
      {values.length > 0 ? <Histogram values={values} /> : (
        <EvidenceGap reason="No numeric values were returned for this axis." expected="Numeric batch result fields." title="Histogram evidence unavailable" />
      )}
    </div>
  )
}

function Histogram({ values }: { values: number[] }) {
  const width = 440
  const height = 190
  const margin = { top: 16, right: 14, bottom: 30, left: 38 }
  const plotWidth = width - margin.left - margin.right
  const plotHeight = height - margin.top - margin.bottom
  const min = Math.min(...values)
  const max = Math.max(...values)
  const binCount = Math.min(12, Math.max(4, Math.ceil(Math.sqrt(values.length))))
  const span = max - min || 1
  const bins = Array.from({ length: binCount }, (_, index) => ({
    index,
    count: 0,
    start: min + (index / binCount) * span,
  }))
  for (const value of values) {
    const index = Math.min(binCount - 1, Math.max(0, Math.floor(((value - min) / span) * binCount)))
    bins[index].count += 1
  }
  const maxCount = Math.max(...bins.map((bin) => bin.count), 1)
  const barGap = 3
  const barWidth = plotWidth / binCount - barGap

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={titleForValues(values)} className="mini-chart">
      <line x1={margin.left} x2={margin.left} y1={margin.top} y2={margin.top + plotHeight} stroke="#94a3b8" />
      <line x1={margin.left} x2={margin.left + plotWidth} y1={margin.top + plotHeight} y2={margin.top + plotHeight} stroke="#94a3b8" />
      {bins.map((bin) => {
        const h = (bin.count / maxCount) * plotHeight
        const x = margin.left + bin.index * (plotWidth / binCount) + barGap / 2
        const y = margin.top + plotHeight - h
        return <rect key={bin.index} x={x} y={y} width={barWidth} height={h} fill="#2563eb" rx="2" />
      })}
      <text x={margin.left} y={height - 10} fontSize="11" fill="#64748b" textAnchor="start">{formatNumber(min)}</text>
      <text x={margin.left + plotWidth} y={height - 10} fontSize="11" fill="#64748b" textAnchor="end">{formatNumber(max)}</text>
    </svg>
  )
}

function ScatterCard({ members }: { members: NormalizedMember[] }) {
  const points = members
    .map((member) => ({ x: member.values.turnover, y: member.values.net_return, id: member.id }))
    .filter((point): point is { x: number; y: number; id: string } => point.x !== null && point.y !== null)
  return (
    <div className="card compact-card">
      <h3>Turnover vs Net Return</h3>
      {points.length > 0 ? <ScatterPlot points={points} /> : (
        <EvidenceGap reason="No paired numeric values were returned for this axis pair." expected="Numeric batch result fields for both axes." title="Scatter evidence unavailable" />
      )}
    </div>
  )
}

function ScatterPlot({ points }: { points: Array<{ x: number; y: number; id: string }> }) {
  const width = 440
  const height = 190
  const margin = { top: 16, right: 14, bottom: 34, left: 42 }
  const plotWidth = width - margin.left - margin.right
  const plotHeight = height - margin.top - margin.bottom
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const xSpan = maxX - minX || 1
  const ySpan = maxY - minY || 1
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Turnover versus net return scatter" className="mini-chart">
      <line x1={margin.left} x2={margin.left} y1={margin.top} y2={margin.top + plotHeight} stroke="#94a3b8" />
      <line x1={margin.left} x2={margin.left + plotWidth} y1={margin.top + plotHeight} y2={margin.top + plotHeight} stroke="#94a3b8" />
      {points.map((point) => {
        const cx = margin.left + ((point.x - minX) / xSpan) * plotWidth
        const cy = margin.top + plotHeight - ((point.y - minY) / ySpan) * plotHeight
        return <circle key={point.id} cx={cx} cy={cy} r="4" fill="#0f766e"><title>{point.id}</title></circle>
      })}
      <text x={margin.left} y={height - 10} fontSize="11" fill="#64748b" textAnchor="start">turnover {formatNumber(minX)}</text>
      <text x={margin.left + plotWidth} y={height - 10} fontSize="11" fill="#64748b" textAnchor="end">{formatNumber(maxX)}</text>
      <text x={margin.left - 8} y={margin.top + 8} fontSize="11" fill="#64748b" textAnchor="end">net {formatNumber(maxY)}</text>
    </svg>
  )
}

function AxisSummaryChart({ summary }: { summary: { axis: string; groups: Array<{ value: string; average: number; count: number }> } }) {
  const max = Math.max(...summary.groups.map((group) => Math.abs(group.average)), 1)
  return (
    <section className="card compact-card">
      <h3>{summary.axis}</h3>
      <div className="bar-list">
        {summary.groups.map((group) => (
          <div className="bar-row" key={group.value}>
            <span title={group.value}>{group.value}</span>
            <div className="bar-track">
              <div className={group.average < 0 ? 'bar-fill negative' : 'bar-fill'} style={{ width: `${Math.max(3, (Math.abs(group.average) / max) * 100)}%` }} />
            </div>
            <code>{formatNumber(group.average)} ({group.count})</code>
          </div>
        ))}
      </div>
    </section>
  )
}

function MemberTable({ members, onSelect }: { members: NormalizedMember[]; onSelect: (member: NormalizedMember) => void }) {
  return (
    <div className="table-wrap">
      <table className="registry-table">
        <thead>
          <tr>
            <th>Member</th>
            <th>rank-IC</th>
            <th>IC IR</th>
            <th>Spread</th>
            <th>MCPT p</th>
            <th>Turnover</th>
            <th>Selection summary</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id}>
              <td>
                <strong>{member.id}</strong>
                <details>
                  <summary>Axes</summary>
                  <JsonBlock value={member.axes} />
                </details>
              </td>
              <td>{formatNumber(member.values.rank_ic)}</td>
              <td>{formatNumber(member.values.rank_ic_ir)}</td>
              <td>{formatNumber(member.values.top_bottom_spread)}</td>
              <td>{formatNumber(member.values.mcpt_p_value)}</td>
              <td>{formatNumber(member.values.turnover)}</td>
              <td><SelectionSummary summary={member.selectionSummary} /></td>
              <td>
                <button className="secondary" type="button" onClick={() => onSelect(member)}>Select for registry</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SelectionSummary({ summary }: { summary: Record<string, unknown> | null }) {
  if (!summary) return <span className="small">No selection summary</span>
  return (
    <div className="selection-summary">
      <span>n={formatUnknown(summary.n_configs ?? summary.config_count)}</span>
      <span>rank={formatUnknown(summary.selection_rank ?? summary.rank)}</span>
      <span>FDR p={formatUnknown(summary.fdr_adjusted_p_value ?? summary.fdr_p_value ?? summary.q_value)}</span>
    </div>
  )
}

function SelectMemberDialog({
  adminEmail,
  batchId,
  member,
  onClose,
}: {
  adminEmail: string
  batchId: string
  member: NormalizedMember
  onClose: () => void
}) {
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [response, setResponse] = useState<unknown>(null)

  async function submitSelection() {
    setSubmitting(true)
    setError(null)
    setResponse(null)
    try {
      const payload = await requestClientJson(`/api/research/batches/${encodeURIComponent(batchId)}/members/${encodeURIComponent(member.id)}/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requested_by: adminEmail,
          reason,
          confirmed,
          batch_id: batchId,
          member_id: member.id,
          selection_summary: member.selectionSummary,
        }),
      })
      setResponse(payload)
    } catch (requestError) {
      setError(readApiError(requestError, 'Failed to select member for registry.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="selectMemberTitle">
        <div className="split-row">
          <div>
            <h2 id="selectMemberTitle">Select for registry</h2>
            <p className="small">This creates the registry registration request through the backend. Evidence must stay visible before confirmation.</p>
          </div>
          <button className="secondary" type="button" onClick={onClose}>Close</button>
        </div>
        <div className="metric-grid">
          <Metric label="Member" value={member.id} />
          <Metric label="rank-IC" value={formatNumber(member.values.rank_ic)} />
          <Metric label="Spread" value={formatNumber(member.values.top_bottom_spread)} />
          <Metric label="MCPT p" value={formatNumber(member.values.mcpt_p_value)} />
        </div>
        <div className="card compact-card">
          <h3>Multiple-testing evidence</h3>
          <SelectionSummary summary={member.selectionSummary} />
          <JsonBlock value={member.selectionSummary ?? {}} />
        </div>
        <label htmlFor="selectionReason">Reason</label>
        <textarea id="selectionReason" value={reason} onChange={(event) => setReason(event.target.value)} rows={3} placeholder="Why this region/member is being selected" />
        <label className="check-row" style={{ marginTop: 10 }}>
          <input checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} type="checkbox" />
          <span>Confirmed: selection evidence has been reviewed.</span>
        </label>
        <ApiErrorBox error={error} />
        {response ? <div className="success"><JsonBlock value={response} /></div> : null}
        <div className="split-row" style={{ marginTop: 12 }}>
          <button className="secondary" type="button" onClick={onClose}>Cancel</button>
          <button className="primary" type="button" onClick={() => void submitSelection()} disabled={submitting || !confirmed || !reason.trim()}>
            {submitting ? 'Selecting...' : 'Confirm selection'}
          </button>
        </div>
      </div>
    </div>
  )
}

function normalizeMembers(resultsPayload: unknown, detailPayload: unknown): NormalizedMember[] {
  const rawMembers = firstArray(resultsPayload, ['members', 'configs', 'config_results', 'results', 'items'])
    || firstArray(asRecord(resultsPayload)?.batch_results, ['members', 'configs', 'items'])
    || firstArray(detailPayload, ['members', 'configs', 'items'])
    || []
  return rawMembers.map((row, index) => normalizeMember(row, index))
}

function normalizeMember(row: unknown, index: number): NormalizedMember {
  const record = asRecord(row) ?? { value: row }
  const metrics = asRecord(record.metrics) ?? asRecord(record.metric_evidence) ?? asRecord(record.metrics_summary_json) ?? record
  const axes = asRecord(record.axes) ?? asRecord(record.config_axes) ?? asRecord(record.config_json) ?? asRecord(record.config) ?? {}
  const selectionSummary = asRecord(record.selection_summary) ?? asRecord(record.selection_summary_json)
  const id = readStringValue(record.member_id ?? record.config_id ?? record.candidate_id ?? record.id) ?? `member-${index + 1}`
  return {
    id,
    raw: record,
    axes,
    metrics,
    selectionSummary,
    values: {
      rank_ic: readNumber(metrics, ['rank_ic', 'rankIC', 'ic_mean', 'mean_rank_ic']),
      rank_ic_ir: readNumber(metrics, ['rank_ic_ir', 'rankICIR', 'ic_ir']),
      top_bottom_spread: readNumber(metrics, ['top_bottom_spread', 'topBottomSpread', 'spread', 'long_short_spread']),
      mcpt_p_value: readNumber(metrics, ['mcpt_p_value', 'mcptPValue', 'p_value', 'mcpt_p']),
      turnover: readNumber(metrics, ['turnover', 'avg_turnover', 'mean_turnover']),
      net_return: readNumber(metrics, ['net_return', 'netReturn', 'annualized_net_return', 'mean_net_return']),
    },
  }
}

function buildAxisSummaries(members: NormalizedMember[]) {
  const axisNames = [...new Set(members.flatMap((member) => Object.keys(member.axes)))]
  return axisNames.map((axis) => {
    const groups = new Map<string, number[]>()
    for (const member of members) {
      const rankIc = member.values.rank_ic
      if (rankIc === null) continue
      const values = Array.isArray(member.axes[axis]) ? member.axes[axis] as unknown[] : [member.axes[axis]]
      for (const rawValue of values) {
        const value = formatUnknown(rawValue)
        const current = groups.get(value) ?? []
        current.push(rankIc)
        groups.set(value, current)
      }
    }
    return {
      axis,
      groups: [...groups.entries()]
        .map(([value, items]) => ({ value, average: average(items), count: items.length }))
        .sort((a, b) => b.average - a.average),
    }
  }).filter((summary) => summary.groups.length > 0)
}

function valuesFor(members: NormalizedMember[], key: SortKey): number[] {
  return members.map((member) => member.values[key]).filter((value): value is number => value !== null)
}

function decayValues(members: NormalizedMember[]): number[] {
  return members.map((member) => {
    const metrics = member.metrics
    return readNumber(metrics, ['decay', 'decay_delta', 'recent_vs_full_delta', 'rank_ic_decay'])
  }).filter((value): value is number => value !== null)
}

function firstArray(payload: unknown, keys: string[]): unknown[] | null {
  if (Array.isArray(payload)) return payload
  const record = asRecord(payload)
  if (!record) return null
  for (const key of keys) {
    if (Array.isArray(record[key])) return record[key] as unknown[]
  }
  return null
}

function readNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)
}

function formatNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) return String(value)
  return Math.abs(number) >= 100 ? number.toFixed(1) : number.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
}

function titleForValues(values: number[]): string {
  return `Distribution chart with ${values.length} values`
}

function readStringValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return null
}
