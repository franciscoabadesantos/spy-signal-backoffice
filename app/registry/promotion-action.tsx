'use client'

import { useState } from 'react'
import { readApiError } from '@/lib/api-error'
import { requestClientJson } from '@/lib/client-json'
import { ApiErrorBox, JsonBlock } from '@/app/components/workspace-data'
import type { CandidateRecord } from '@/lib/registry-backend'

export function PromotionAction({ adminEmail, candidate }: { adminEmail: string; candidate: CandidateRecord }) {
  const [open, setOpen] = useState(false)
  const [targetStatus, setTargetStatus] = useState('production')
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [response, setResponse] = useState<unknown>(null)

  async function submitPromotion() {
    setSubmitting(true)
    setError(null)
    setResponse(null)
    try {
      const payload = await requestClientJson(`/api/registry/candidates/${encodeURIComponent(candidate.candidate_id)}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requested_by: adminEmail,
          candidate_id: candidate.candidate_id,
          target_status: targetStatus.trim(),
          reason,
          confirmed,
          evidence: {
            rank_ic: candidate.rank_ic,
            rank_ic_ir: candidate.rank_ic_ir,
            top_bottom_spread: candidate.top_bottom_spread,
            mcpt_p_value: candidate.mcpt_p_value,
            selection_summary_json: candidate.selection_summary_json,
            batch_id: candidate.batch_id,
          },
        }),
      })
      setResponse(payload)
    } catch (requestError) {
      setError(readApiError(requestError, 'Failed to submit promotion.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="card">
        <div className="split-row">
          <div>
            <h3>Promotion action</h3>
            <p className="small">Promotion requires explicit confirmation and keeps cross-sectional evidence visible in the dialog.</p>
          </div>
          <button className="primary" type="button" onClick={() => setOpen(true)}>Promote...</button>
        </div>
      </div>

      {open ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="promotionTitle">
            <div className="split-row">
              <div>
                <h2 id="promotionTitle">Confirm promotion</h2>
                <p className="small">Review evidence, choose the target status, provide a reason, and confirm.</p>
              </div>
              <button className="secondary" type="button" onClick={() => setOpen(false)}>Close</button>
            </div>
            <div className="two-column">
              <div className="card compact-card">
                <h3>Candidate</h3>
                <JsonBlock value={{
                  candidate_id: candidate.candidate_id,
                  current_status: candidate.status,
                  strategy_family: candidate.strategy_family,
                  universe: candidate.universe,
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
            <label htmlFor="promotionTarget">Target status</label>
            <input id="promotionTarget" value={targetStatus} onChange={(event) => setTargetStatus(event.target.value)} />
            <label htmlFor="promotionReason" style={{ marginTop: 10 }}>Reason</label>
            <textarea id="promotionReason" value={reason} onChange={(event) => setReason(event.target.value)} rows={3} />
            <label className="check-row" style={{ marginTop: 10 }}>
              <input checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} type="checkbox" />
              <span>confirmed: I reviewed the promotion evidence and want to submit.</span>
            </label>
            <ApiErrorBox error={error} />
            {response ? <div className="success"><JsonBlock value={response} /></div> : null}
            <div className="split-row" style={{ marginTop: 12 }}>
              <button className="secondary" type="button" onClick={() => setOpen(false)}>Cancel</button>
              <button className="primary" type="button" onClick={() => void submitPromotion()} disabled={submitting || !confirmed || !reason.trim() || !targetStatus.trim()}>
                {submitting ? 'Submitting...' : 'Submit promotion'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
