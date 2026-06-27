'use client'

import { useEffect, useMemo, useState } from 'react'
import { readApiError } from '@/lib/api-error'
import { requestClientJson } from '@/lib/client-json'
import { asRecord, unwrapList } from '@/lib/payload'
import { ApiErrorBox, EvidenceGap, JsonBlock, formatUnknown } from '@/app/components/workspace-data'

type RowRecord = Record<string, unknown>

const SURFACES = ['rank_ic_live', 'top_bottom_spread_live', 'drift', 'backtest_live_divergence', 'decay_report_freshness']

export default function RegistryMonitoringWorkspace({ adminEmail }: { adminEmail: string }) {
  const [snapshotsPayload, setSnapshotsPayload] = useState<unknown>(null)
  const [alertsPayload, setAlertsPayload] = useState<unknown>(null)
  const [pointersPayload, setPointersPayload] = useState<unknown>(null)
  const [snapshots, setSnapshots] = useState<RowRecord[]>([])
  const [alerts, setAlerts] = useState<RowRecord[]>([])
  const [pointers, setPointers] = useState<RowRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rollbackPointer, setRollbackPointer] = useState<RowRecord | null>(null)

  async function loadMonitoring() {
    setLoading(true)
    setError(null)
    try {
      const [snapshotResponse, alertResponse, pointerResponse] = await Promise.all([
        requestClientJson('/api/registry/monitoring/snapshots?latest=true'),
        requestClientJson('/api/registry/monitoring/alerts?limit=100'),
        requestClientJson('/api/registry/active-pointers'),
      ])
      setSnapshotsPayload(snapshotResponse)
      setAlertsPayload(alertResponse)
      setPointersPayload(pointerResponse)
      setSnapshots(normalizeList(snapshotResponse, ['snapshots', 'monitoring_snapshots', 'items', 'results']))
      setAlerts(normalizeList(alertResponse, ['alerts', 'monitoring_alerts', 'items', 'results']))
      setPointers(normalizeList(pointerResponse, ['active_pointers', 'pointers', 'items', 'results']))
    } catch (requestError) {
      setError(readApiError(requestError, 'Failed to load registry monitoring.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadMonitoring()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const degradedCount = useMemo(() => snapshots.filter(hasDegraded).length + alerts.filter(hasDegraded).length, [alerts, snapshots])

  return (
    <div className="page-stack">
      <ApiErrorBox error={error} />

      {degradedCount > 0 ? (
        <div className="degraded-banner">
          <strong>Degraded monitoring state detected</strong>
          <span>{degradedCount} degraded snapshot or alert rows require attention.</span>
        </div>
      ) : null}

      <div className="split-row">
        <div className="small">{loading ? 'Refreshing monitoring...' : 'Latest active-pointer monitoring view.'}</div>
        <button className="secondary" type="button" onClick={() => void loadMonitoring()} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</button>
      </div>

      <div className="card">
        <h2>Latest snapshots by active pointer</h2>
        {snapshots.length === 0 ? (
          <EvidenceGap
            reason="No monitoring snapshots were returned by the registry monitoring contract."
            expected="Rows from /analyst/registry/monitoring/snapshots."
            title="Monitoring snapshots unavailable"
          />
        ) : <SnapshotGrid snapshots={snapshots} />}
      </div>

      <div className="card">
        <h2>Alerts</h2>
        {alerts.length === 0 ? (
          <EvidenceGap
            reason="No alerts were returned by the registry monitoring contract."
            expected="Rows from /analyst/registry/monitoring/alerts."
            title="Monitoring alerts unavailable"
          />
        ) : <AlertsTable alerts={alerts} />}
      </div>

      <div className="card">
        <h2>Rollback controls</h2>
        <p className="small">Rollback is never automatic. Choose an active pointer, review current and target fields, provide a reason, and confirm.</p>
        {pointers.length === 0 ? (
          <EvidenceGap
            reason="No active pointers were returned, so rollback controls have no target."
            expected="Rows from /analyst/registry/active-pointers."
            title="Rollback controls unavailable"
          />
        ) : <PointerRollbackTable pointers={pointers} onRollback={setRollbackPointer} />}
      </div>

      <details className="card">
        <summary>Raw monitoring payloads</summary>
        <JsonBlock value={{ snapshots: snapshotsPayload, alerts: alertsPayload, active_pointers: pointersPayload }} />
      </details>

      {rollbackPointer ? (
        <RollbackDialog
          adminEmail={adminEmail}
          pointer={rollbackPointer}
          onClose={() => setRollbackPointer(null)}
          onRolledBack={() => void loadMonitoring()}
        />
      ) : null}
    </div>
  )
}

function SnapshotGrid({ snapshots }: { snapshots: RowRecord[] }) {
  return (
    <div className="monitoring-grid">
      {snapshots.map((snapshot, index) => (
        <section className={hasDegraded(snapshot) ? 'monitoring-card degraded' : 'monitoring-card'} key={`${formatUnknown(snapshot.active_pointer_id ?? snapshot.pointer_id)}-${index}`}>
          <div className="split-row">
            <div>
              <h3>{formatUnknown(snapshot.active_pointer_id ?? snapshot.pointer_id ?? snapshot.strategy_family)}</h3>
              <p className="small">{formatUnknown(snapshot.strategy_family)} / {formatUnknown(snapshot.universe)} / {formatUnknown(snapshot.environment)}</p>
            </div>
            <StatusPill value={readOverallStatus(snapshot)} />
          </div>
          <div className="surface-grid">
            {SURFACES.map((surface) => {
              const reading = readSurface(snapshot, surface)
              return (
                <div className={statusClass(reading.status)} key={surface}>
                  <label>{surface}</label>
                  <strong>{formatUnknown(reading.value)}</strong>
                  <span>{formatUnknown(reading.status)}</span>
                </div>
              )
            })}
          </div>
          <details>
            <summary>Snapshot JSON</summary>
            <JsonBlock value={snapshot} />
          </details>
        </section>
      ))}
    </div>
  )
}

function AlertsTable({ alerts }: { alerts: RowRecord[] }) {
  return (
    <div className="table-wrap">
      <table className="registry-table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Pointer</th>
            <th>Surface</th>
            <th>Message</th>
            <th>Created</th>
            <th>Raw</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((alert, index) => (
            <tr key={`${formatUnknown(alert.alert_id ?? alert.id)}-${index}`} className={hasDegraded(alert) ? 'danger-row' : undefined}>
              <td><StatusPill value={readOverallStatus(alert)} /></td>
              <td>{formatUnknown(alert.active_pointer_id ?? alert.pointer_id)}</td>
              <td>{formatUnknown(alert.surface ?? alert.metric ?? alert.check_name)}</td>
              <td>{formatUnknown(alert.message ?? alert.reason ?? alert.description)}</td>
              <td>{formatUnknown(alert.created_at ?? alert.detected_at)}</td>
              <td>
                <details>
                  <summary>JSON</summary>
                  <JsonBlock value={alert} />
                </details>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PointerRollbackTable({ pointers, onRollback }: { pointers: RowRecord[]; onRollback: (pointer: RowRecord) => void }) {
  return (
    <div className="table-wrap">
      <table className="registry-table">
        <thead>
          <tr>
            <th>Environment</th>
            <th>Family / Universe</th>
            <th>Current candidate</th>
            <th>Current bundle</th>
            <th>Rollback target</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {pointers.map((pointer, index) => (
            <tr key={`${formatUnknown(pointer.active_pointer_id)}-${index}`}>
              <td>{formatUnknown(pointer.environment)}</td>
              <td>{formatUnknown(pointer.strategy_family)} / {formatUnknown(pointer.universe)}</td>
              <td>{formatUnknown(pointer.active_candidate_id)}</td>
              <td>{formatUnknown(pointer.active_bundle_id)}</td>
              <td>{formatUnknown(pointer.rollback_candidate_id ?? pointer.previous_candidate_id ?? pointer.rollback_bundle_id ?? pointer.previous_bundle_id)}</td>
              <td><button className="danger" type="button" onClick={() => onRollback(pointer)}>Rollback...</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RollbackDialog({
  adminEmail,
  pointer,
  onClose,
  onRolledBack,
}: {
  adminEmail: string
  pointer: RowRecord
  onClose: () => void
  onRolledBack: () => void
}) {
  const [targetCandidateId, setTargetCandidateId] = useState(String(pointer.rollback_candidate_id ?? pointer.previous_candidate_id ?? ''))
  const [targetBundleId, setTargetBundleId] = useState(String(pointer.rollback_bundle_id ?? pointer.previous_bundle_id ?? ''))
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [response, setResponse] = useState<unknown>(null)

  async function submitRollback() {
    const strategyFamily = String(pointer.strategy_family ?? '').trim()
    const universe = String(pointer.universe ?? '').trim()
    const environment = String(pointer.environment ?? '').trim()
    if (!strategyFamily || !universe || !environment) {
      setError('Pointer is missing strategy_family, universe, or environment.')
      return
    }

    setSubmitting(true)
    setError(null)
    setResponse(null)
    try {
      const payload = await requestClientJson(`/api/registry/active-pointers/${encodeURIComponent(strategyFamily)}/${encodeURIComponent(universe)}/${encodeURIComponent(environment)}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requested_by: adminEmail,
          reason,
          confirmed,
          current_pointer: pointer,
          target_pointer: {
            candidate_id: targetCandidateId.trim() || null,
            bundle_id: targetBundleId.trim() || null,
          },
        }),
      })
      setResponse(payload)
      onRolledBack()
    } catch (requestError) {
      setError(readApiError(requestError, 'Failed to submit rollback.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="rollbackTitle">
        <div className="split-row">
          <div>
            <h2 id="rollbackTitle">Confirm rollback</h2>
            <p className="small">Review current and target pointer fields before submitting the backend rollback action.</p>
          </div>
          <button className="secondary" type="button" onClick={onClose}>Close</button>
        </div>

        <div className="two-column">
          <div className="card compact-card">
            <h3>Current pointer</h3>
            <JsonBlock value={{
              strategy_family: pointer.strategy_family,
              universe: pointer.universe,
              environment: pointer.environment,
              active_candidate_id: pointer.active_candidate_id,
              active_bundle_id: pointer.active_bundle_id,
            }} />
          </div>
          <div className="card compact-card">
            <h3>Target pointer</h3>
            <label htmlFor="targetCandidate">Target candidate</label>
            <input id="targetCandidate" value={targetCandidateId} onChange={(event) => setTargetCandidateId(event.target.value)} />
            <label htmlFor="targetBundle" style={{ marginTop: 8 }}>Target bundle</label>
            <input id="targetBundle" value={targetBundleId} onChange={(event) => setTargetBundleId(event.target.value)} />
          </div>
        </div>

        <label htmlFor="rollbackReason">Reason</label>
        <textarea id="rollbackReason" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Operational reason for rollback" />
        <label className="check-row" style={{ marginTop: 10 }}>
          <input checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} type="checkbox" />
          <span>confirmed: I reviewed current vs target pointer and want to submit rollback.</span>
        </label>

        <ApiErrorBox error={error} />
        {response ? <div className="success"><JsonBlock value={response} /></div> : null}

        <div className="split-row" style={{ marginTop: 12 }}>
          <button className="secondary" type="button" onClick={onClose}>Cancel</button>
          <button className="danger" type="button" onClick={() => void submitRollback()} disabled={submitting || !confirmed || !reason.trim() || (!targetCandidateId.trim() && !targetBundleId.trim())}>
            {submitting ? 'Submitting...' : 'Submit rollback'}
          </button>
        </div>
      </div>
    </div>
  )
}

function StatusPill({ value }: { value: unknown }) {
  return <span className={`badge ${statusClass(value)}`}>{formatUnknown(value)}</span>
}

function normalizeList(payload: unknown, keys: string[]): RowRecord[] {
  return unwrapList<RowRecord>(payload, keys)
}

function readSurface(snapshot: RowRecord, surface: string): { value: unknown; status: unknown } {
  const surfaces = asRecord(snapshot.surfaces) ?? asRecord(snapshot.latest_readings) ?? asRecord(snapshot.readings)
  const nested = asRecord(surfaces?.[surface]) ?? asRecord(snapshot[surface])
  if (nested) {
    return {
      value: nested.value ?? nested.reading ?? nested.metric_value ?? nested.score,
      status: nested.status ?? nested.state ?? nested.severity,
    }
  }
  return {
    value: snapshot[surface],
    status: snapshot[`${surface}_status`] ?? snapshot[`${surface}_state`],
  }
}

function readOverallStatus(row: RowRecord): unknown {
  return row.status ?? row.overall_status ?? row.state ?? row.severity ?? '—'
}

function hasDegraded(row: RowRecord): boolean {
  const status = String(readOverallStatus(row)).toLowerCase()
  if (status.includes('degraded') || status.includes('critical') || status.includes('failed')) return true
  return SURFACES.some((surface) => {
    const readingStatus = String(readSurface(row, surface).status ?? '').toLowerCase()
    return readingStatus.includes('degraded') || readingStatus.includes('critical') || readingStatus.includes('failed')
  })
}

function statusClass(value: unknown): string {
  const status = String(value ?? '').toLowerCase()
  if (status.includes('degraded') || status.includes('critical') || status.includes('failed')) return 'failed'
  if (status.includes('watch') || status.includes('warn')) return 'running'
  if (status.includes('ok') || status.includes('healthy')) return 'completed'
  return 'queued'
}
