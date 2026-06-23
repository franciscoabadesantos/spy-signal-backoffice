'use client'

import { useState } from 'react'
import { readApiError } from '@/lib/api-error'
import { requestClientJson } from '@/lib/client-json'
import { ApiErrorBox, JsonBlock } from '@/app/components/workspace-data'
import type { BundleManifest, CandidateRecord } from '@/lib/registry-backend'
import { buildActivateCandidatePayload, buildPromoteCandidatePayload } from './promotion-payloads'

type RegistryActionMode = 'promote' | 'activate'

export function PromotionAction({
  adminEmail,
  candidate,
  bundles,
}: {
  adminEmail: string
  candidate: CandidateRecord
  bundles: BundleManifest[]
}) {
  const [mode, setMode] = useState<RegistryActionMode | null>(null)
  const primaryBundleId = readBundleId(bundles[0])
  const bundleOptions = bundles.map((bundle) => readBundleId(bundle)).filter((value): value is string => Boolean(value))
  const missingBundle = bundleOptions.length === 0
  const missingLineage = missingActivationFields(candidate)

  return (
    <>
      <div className="card">
        <div className="split-row">
          <div>
            <h3>Registry actions</h3>
            <p className="small">Promotion and active-pointer activation are separate confirmed actions. Neither runs automatically.</p>
            {missingBundle ? <p className="error">No bundle_id is available from candidate lineage. Promotion and activation are blocked until backend returns a bundle.</p> : null}
            {missingLineage.length > 0 ? <p className="warning">Activation needs: {missingLineage.join(', ')}.</p> : null}
          </div>
          <div className="table-actions">
            <button className="primary" type="button" onClick={() => setMode('promote')} disabled={missingBundle}>Promote...</button>
            <button className="secondary" type="button" onClick={() => setMode('activate')} disabled={missingBundle || missingLineage.length > 0}>Activate...</button>
          </div>
        </div>
      </div>

      {mode === 'promote' ? (
        <PromoteDialog
          actor={adminEmail}
          bundleOptions={bundleOptions}
          candidate={candidate}
          defaultBundleId={primaryBundleId ?? ''}
          onClose={() => setMode(null)}
        />
      ) : null}

      {mode === 'activate' ? (
        <ActivateDialog
          actor={adminEmail}
          bundleOptions={bundleOptions}
          candidate={candidate}
          defaultBundleId={primaryBundleId ?? ''}
          onClose={() => setMode(null)}
        />
      ) : null}
    </>
  )
}

function PromoteDialog({
  actor,
  bundleOptions,
  candidate,
  defaultBundleId,
  onClose,
}: {
  actor: string
  bundleOptions: string[]
  candidate: CandidateRecord
  defaultBundleId: string
  onClose: () => void
}) {
  const [toStatus, setToStatus] = useState('promotion_ready')
  const [bundleId, setBundleId] = useState(defaultBundleId)
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [response, setResponse] = useState<unknown>(null)

  async function submitPromotion() {
    const result = buildPromoteCandidatePayload({
      toStatus,
      bundleId,
      actor,
      reason,
      confirmed,
    })
    if (!result.ok) {
      setError(result.errors.join(' '))
      return
    }

    setSubmitting(true)
    setError(null)
    setResponse(null)
    try {
      const payload = await requestClientJson(`/api/registry/candidates/${encodeURIComponent(candidate.candidate_id)}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.payload),
      })
      setResponse(payload)
    } catch (requestError) {
      setError(readApiError(requestError, 'Failed to submit promotion.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="promotionTitle">
        <DialogHeader id="promotionTitle" title="Confirm promotion" description="Promotion changes candidate status only. It does not activate the candidate." onClose={onClose} />
        <EvidenceGrid candidate={candidate} bundleId={bundleId} />
        <BundleSelect bundleId={bundleId} bundleOptions={bundleOptions} id="promotionBundle" onChange={setBundleId} />
        <label htmlFor="promotionTarget">Target status</label>
        <input id="promotionTarget" value={toStatus} onChange={(event) => setToStatus(event.target.value)} />
        <ReasonConfirmFields
          confirmed={confirmed}
          confirmText="confirmed: I reviewed the promotion evidence and want to submit promotion only."
          reason={reason}
          reasonId="promotionReason"
          setConfirmed={setConfirmed}
          setReason={setReason}
        />
        <ApiErrorBox error={error} />
        {response ? <div className="success"><JsonBlock value={response} /></div> : null}
        <DialogActions
          disabled={submitting || !confirmed || !reason.trim() || !toStatus.trim() || !bundleId.trim()}
          label={submitting ? 'Submitting...' : 'Submit promotion'}
          onCancel={onClose}
          onSubmit={() => void submitPromotion()}
          primaryClass="primary"
        />
      </div>
    </div>
  )
}

function ActivateDialog({
  actor,
  bundleOptions,
  candidate,
  defaultBundleId,
  onClose,
}: {
  actor: string
  bundleOptions: string[]
  candidate: CandidateRecord
  defaultBundleId: string
  onClose: () => void
}) {
  const [environment, setEnvironment] = useState('paper')
  const [bundleId, setBundleId] = useState(defaultBundleId)
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [response, setResponse] = useState<unknown>(null)

  async function submitActivation() {
    const result = buildActivateCandidatePayload({
      strategyFamily: candidate.strategy_family,
      universe: candidate.universe,
      environment,
      candidateId: candidate.candidate_id,
      bundleId,
      actor,
      reason,
      confirmed,
    })
    if (!result.ok) {
      setError(result.errors.join(' '))
      return
    }

    setSubmitting(true)
    setError(null)
    setResponse(null)
    try {
      const payload = await requestClientJson('/api/registry/active-pointers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.payload),
      })
      setResponse(payload)
    } catch (requestError) {
      setError(readApiError(requestError, 'Failed to activate candidate.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="activationTitle">
        <DialogHeader id="activationTitle" title="Confirm activation" description="Activation sets the active pointer for the selected environment. It is separate from promotion." onClose={onClose} />
        <EvidenceGrid candidate={candidate} bundleId={bundleId} />
        <div className="two-column">
          <div>
            <label htmlFor="activationEnvironment">Environment</label>
            <select id="activationEnvironment" value={environment} onChange={(event) => setEnvironment(event.target.value)}>
              <option value="paper">paper</option>
              <option value="shadow">shadow</option>
              <option value="production">production</option>
            </select>
          </div>
          <div>
            <BundleSelect bundleId={bundleId} bundleOptions={bundleOptions} id="activationBundle" onChange={setBundleId} />
          </div>
        </div>
        <ReasonConfirmFields
          confirmed={confirmed}
          confirmText="confirmed: I reviewed the active pointer target and want to submit activation."
          reason={reason}
          reasonId="activationReason"
          setConfirmed={setConfirmed}
          setReason={setReason}
        />
        <ApiErrorBox error={error} />
        {response ? <div className="success"><JsonBlock value={response} /></div> : null}
        <DialogActions
          disabled={submitting || !confirmed || !reason.trim() || !environment.trim() || !bundleId.trim()}
          label={submitting ? 'Submitting...' : 'Submit activation'}
          onCancel={onClose}
          onSubmit={() => void submitActivation()}
          primaryClass="danger"
        />
      </div>
    </div>
  )
}

function DialogHeader({ id, title, description, onClose }: { id: string; title: string; description: string; onClose: () => void }) {
  return (
    <div className="split-row">
      <div>
        <h2 id={id}>{title}</h2>
        <p className="small">{description}</p>
      </div>
      <button className="secondary" type="button" onClick={onClose}>Close</button>
    </div>
  )
}

function EvidenceGrid({ candidate, bundleId }: { candidate: CandidateRecord; bundleId: string }) {
  return (
    <div className="two-column">
      <div className="card compact-card">
        <h3>Candidate</h3>
        <JsonBlock value={{
          candidate_id: candidate.candidate_id,
          current_status: candidate.status,
          strategy_family: candidate.strategy_family,
          universe: candidate.universe,
          selected_bundle_id: bundleId || null,
          batch_id: candidate.batch_id,
        }} />
      </div>
      <div className="card compact-card">
        <h3>Evidence</h3>
        <JsonBlock value={{
          rank_ic: candidate.rank_ic,
          rank_ic_ir: candidate.rank_ic_ir,
          top_bottom_spread: candidate.top_bottom_spread,
          mcpt_p_value: candidate.mcpt_p_value,
          selection_summary_json: candidate.selection_summary_json,
        }} />
      </div>
    </div>
  )
}

function BundleSelect({
  bundleId,
  bundleOptions,
  id,
  onChange,
}: {
  bundleId: string
  bundleOptions: string[]
  id: string
  onChange: (value: string) => void
}) {
  return (
    <>
      <label htmlFor={id}>Bundle ID</label>
      {bundleOptions.length > 0 ? (
        <select id={id} value={bundleId} onChange={(event) => onChange(event.target.value)}>
          {bundleOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : (
        <input id={id} value={bundleId} onChange={(event) => onChange(event.target.value)} placeholder="bundle_id required" />
      )}
    </>
  )
}

function ReasonConfirmFields({
  confirmed,
  confirmText,
  reason,
  reasonId,
  setConfirmed,
  setReason,
}: {
  confirmed: boolean
  confirmText: string
  reason: string
  reasonId: string
  setConfirmed: (value: boolean) => void
  setReason: (value: string) => void
}) {
  return (
    <>
      <label htmlFor={reasonId} style={{ marginTop: 10 }}>Reason</label>
      <textarea id={reasonId} value={reason} onChange={(event) => setReason(event.target.value)} rows={3} />
      <label className="check-row" style={{ marginTop: 10 }}>
        <input checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} type="checkbox" />
        <span>{confirmText}</span>
      </label>
    </>
  )
}

function DialogActions({
  disabled,
  label,
  onCancel,
  onSubmit,
  primaryClass,
}: {
  disabled: boolean
  label: string
  onCancel: () => void
  onSubmit: () => void
  primaryClass: 'primary' | 'danger'
}) {
  return (
    <div className="split-row" style={{ marginTop: 12 }}>
      <button className="secondary" type="button" onClick={onCancel}>Cancel</button>
      <button className={primaryClass} type="button" onClick={onSubmit} disabled={disabled}>{label}</button>
    </div>
  )
}

function missingActivationFields(candidate: CandidateRecord): string[] {
  const missing: string[] = []
  if (!readString(candidate.strategy_family)) missing.push('strategy_family')
  if (!readString(candidate.universe)) missing.push('universe')
  if (!readString(candidate.candidate_id)) missing.push('candidate_id')
  return missing
}

function readBundleId(bundle?: BundleManifest): string | null {
  return readString(bundle?.bundle_id)
}

function readString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return null
}
