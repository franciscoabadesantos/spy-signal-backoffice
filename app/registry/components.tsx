import Link from 'next/link'
import {
  ActivePointer,
  BundleManifest,
  CandidateLineage,
  CandidateRecord,
  DashboardSummary,
  PromotionEvent,
  ReadinessReport,
  RegistryBackendError,
  buildCandidateEvidenceId,
  buildReadinessEvidenceId,
  isRegistryUnavailableError,
} from '@/lib/registry-backend'

export function RegistryErrorState({ error }: { error: unknown }) {
  const registryError = error instanceof RegistryBackendError ? error : null
  const title = registryError ? registryError.errorCode : 'registry_error'
  const message = error instanceof Error ? error.message : 'Unable to load registry data.'
  const status = registryError ? registryError.status : null
  const isUnavailable = isRegistryUnavailableError(error)
  return (
    <div className="error">
      <strong>{title}</strong>
      <div>{message}</div>
      {isUnavailable ? (
        <div className="small" style={{ marginTop: 8 }}>
          Registry evidence is not available through finance-backend yet.
        </div>
      ) : null}
      {status ? <div className="small">HTTP status: {status}</div> : null}
      {registryError && !isUnavailable && Object.keys(registryError.details).length > 0 ? (
        <pre>{JSON.stringify(registryError.details, null, 2)}</pre>
      ) : null}
    </div>
  )
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="small empty-state">{children}</p>
}

export function RegistryHeader({ adminEmail }: { adminEmail: string }) {
  return (
    <div className="card">
      <div className="split-row">
        <div>
          <h2>Registry / Evidence</h2>
          <p className="small">Read-only inspection through finance-backend registry proxy routes. This is the candidate, bundle, readiness, promotion, and active-pointer ledger for research outputs.</p>
        </div>
        <div className="small">Admin: {adminEmail}</div>
      </div>
    </div>
  )
}

export function RegistryConceptGrid() {
  const items = [
    ['Candidates', 'Outputs produced by research runs.'],
    ['Bundles', 'Packaged candidates plus lineage and reproducibility evidence.'],
    ['Readiness reports', 'Checks that decide whether a candidate is reviewable.'],
    ['Promotion history', 'Who promoted what, when, and why.'],
    ['Active pointers', 'What the system currently treats as active.'],
  ]

  return (
    <div className="feature-grid">
      {items.map(([title, body]) => (
        <div className="card compact-card" key={title}>
          <h3>{title}</h3>
          <p className="small">{body}</p>
        </div>
      ))}
    </div>
  )
}

export function SummaryCards({ summary }: { summary: DashboardSummary }) {
  const statusCounts = summary.candidate_counts_by_status ?? {}
  return (
    <div className="metric-grid">
      <MetricCard label="Candidates" value={summary.candidate_count} />
      <MetricCard label="Bundles" value={summary.bundle_count} />
      <MetricCard label="Active Pointers" value={summary.active_pointer_count} />
      <MetricCard label="Promotion Events" value={summary.promotion_event_count} />
      <MetricCard label="Readiness Reports" value={summary.readiness_report_count} />
      <div className="card compact-card">
        <label>Candidate Statuses</label>
        {Object.keys(statusCounts).length === 0 ? (
          <EmptyState>No candidates.</EmptyState>
        ) : (
          <div className="meta">
            {Object.entries(statusCounts).map(([status, count]) => (
              <span className={`badge status-${status}`} key={status}>
                {status}: {count}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card compact-card">
      <label>{label}</label>
      <div className="metric-value">{value}</div>
    </div>
  )
}

export function CandidateFilters({
  status,
  strategyFamily,
  universe,
}: {
  status?: string
  strategyFamily?: string
  universe?: string
}) {
  return (
    <form action="/registry" className="card">
      <h3>Candidate Filters</h3>
      <div className="row">
        <div>
          <label htmlFor="status">Status</label>
          <input id="status" name="status" defaultValue={status ?? ''} placeholder="paper_candidate" />
        </div>
        <div>
          <label htmlFor="strategyFamily">Strategy Family</label>
          <input id="strategyFamily" name="strategy_family" defaultValue={strategyFamily ?? ''} placeholder="spy_signal" />
        </div>
        <div>
          <label htmlFor="universe">Universe</label>
          <input id="universe" name="universe" defaultValue={universe ?? ''} placeholder="spy" />
        </div>
        <div style={{ display: 'flex', alignItems: 'end' }}>
          <button className="secondary" type="submit">Apply Filters</button>
        </div>
      </div>
    </form>
  )
}

export function CandidateTable({ candidates }: { candidates: CandidateRecord[] }) {
  if (candidates.length === 0) {
    return <EmptyState>No candidates found.</EmptyState>
  }
  return (
    <div className="table-wrap">
      <table className="registry-table">
        <thead>
          <tr>
            <th>Candidate</th>
            <th>Status</th>
            <th>Family / Universe</th>
            <th>Horizon</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((candidate) => (
            <tr key={candidate.candidate_id}>
              <td>
                <Link href={`/registry/candidates/${encodeURIComponent(candidate.candidate_id)}`}>{candidate.candidate_id}</Link>
                <div className="small">{candidate.candidate_name ?? '—'} · {candidate.candidate_version ?? '—'}</div>
              </td>
              <td><StatusBadge value={candidate.status} /></td>
              <td>{renderText(candidate.strategy_family)} / {renderText(candidate.universe)}</td>
              <td>{renderText(candidate.horizon)}</td>
              <td>{renderText(candidate.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function CandidateOverview({ candidate }: { candidate: CandidateRecord }) {
  const evidenceId = buildCandidateEvidenceId(candidate.candidate_id)
  return (
    <div className="card">
      <h3>Candidate Detail</h3>
      <FieldGrid
        fields={[
          ['candidate_id', candidate.candidate_id],
          ['candidate_name', candidate.candidate_name],
          ['candidate_version', candidate.candidate_version],
          ['status', candidate.status],
          ['strategy_family', candidate.strategy_family],
          ['universe', candidate.universe],
          ['symbols', Array.isArray(candidate.symbols) ? candidate.symbols.join(', ') : null],
          ['horizon', candidate.horizon],
          ['created_at', candidate.created_at],
          ['created_by', candidate.created_by],
          ['source_ml_run_id', candidate.source_ml_run_id],
          ['source_strategy_run_id', candidate.source_strategy_run_id],
          ['source_backtest_run_id', candidate.source_backtest_run_id],
          ['source_robustness_report_id', candidate.source_robustness_report_id],
          ['source_feature_snapshot_name', candidate.source_feature_snapshot_name],
          ['source_feature_snapshot_version', candidate.source_feature_snapshot_version],
          ['source_prediction_panel_id', candidate.source_prediction_panel_id],
          ['batch_id', candidate.batch_id],
          ['rank_ic', candidate.rank_ic],
          ['rank_ic_ir', candidate.rank_ic_ir],
          ['top_bottom_spread', candidate.top_bottom_spread],
          ['mcpt_p_value', candidate.mcpt_p_value],
          ['notes', candidate.notes],
        ]}
      />
      <CrossSectionalEvidenceCard
        title="Cross-Sectional Promotion Evidence"
        rankIc={candidate.rank_ic}
        rankIcIr={candidate.rank_ic_ir}
        topBottomSpread={candidate.top_bottom_spread}
        mcptPValue={candidate.mcpt_p_value}
        batchId={candidate.batch_id}
        selectionSummary={candidate.selection_summary_json}
      />
      <JsonSection title="Metrics Summary" value={candidate.metrics_summary_json} />
      <JsonSection title="Robustness Summary" value={candidate.robustness_summary_json} />
      <JsonSection title="Approval Summary" value={candidate.approval_summary_json} />
      <p className="small" style={{ marginTop: 16 }}>
        <Link href={`/registry/evidence/${encodeURIComponent(evidenceId)}`} className="text-link">
          Open research artifact evidence
        </Link>
      </p>
    </div>
  )
}

export function BundleOverview({ bundle }: { bundle: BundleManifest }) {
  return (
    <div className="card">
      <h3>Bundle Detail</h3>
      <FieldGrid
        fields={[
          ['bundle_id', bundle.bundle_id],
          ['candidate_id', bundle.candidate_id],
          ['bundle_version', bundle.bundle_version],
          ['created_at', bundle.created_at],
          ['feature_snapshot_ref', bundle.feature_snapshot_ref],
          ['ml_artifact_ref', bundle.ml_artifact_ref],
          ['prediction_panel_ref', bundle.prediction_panel_ref],
          ['strategy_config_ref', bundle.strategy_config_ref],
          ['strategy_signal_schema_version', bundle.strategy_signal_schema_version],
          ['backtest_run_ref', bundle.backtest_run_ref],
          ['robustness_report_ref', bundle.robustness_report_ref],
          ['runtime_contract_version', bundle.runtime_contract_version],
        ]}
      />
      <JsonSection title="Artifact Hashes" value={bundle.artifact_hashes_json} />
      <JsonSection title="Repro Command" value={bundle.repro_command_json} />
    </div>
  )
}

export function BundleList({ bundles }: { bundles: BundleManifest[] }) {
  if (bundles.length === 0) return <EmptyState>No bundles found.</EmptyState>
  return (
    <div className="list-stack">
      {bundles.map((bundle) => (
        <div className="list-row" key={bundle.bundle_id}>
          <div>
            <Link href={`/registry/bundles/${encodeURIComponent(bundle.bundle_id)}`}>{bundle.bundle_id}</Link>
            <div className="small">version {renderText(bundle.bundle_version)} · candidate {renderText(bundle.candidate_id)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function PromotionEventList({ events }: { events: PromotionEvent[] }) {
  if (events.length === 0) return <EmptyState>No promotion history.</EmptyState>
  return (
    <div className="list-stack">
      {events.map((event) => (
        <div className="list-row" key={event.promotion_event_id}>
          <div>
            <Link href={`/registry/promotions?candidate_id=${encodeURIComponent(String(event.candidate_id ?? ''))}`}>
              {event.promotion_event_id}
            </Link>
            <div className="small">
              {renderText(event.from_status)} → {renderText(event.to_status)} · {renderText(event.actor)} · {renderText(event.created_at)}
            </div>
            <div>{renderText(event.reason)}</div>
          </div>
          <details>
            <summary>Evidence</summary>
            <JsonBlock value={{ evidence_json: event.evidence_json ?? {}, checks_json: event.checks_json ?? {} }} />
          </details>
        </div>
      ))}
    </div>
  )
}

export function ActivePointerTable({ pointers }: { pointers: ActivePointer[] }) {
  if (pointers.length === 0) return <EmptyState>No active pointers.</EmptyState>
  return (
    <div className="table-wrap">
      <table className="registry-table">
        <thead>
          <tr>
            <th>Environment</th>
            <th>Family / Universe</th>
            <th>Candidate</th>
            <th>Bundle</th>
            <th>Activated</th>
          </tr>
        </thead>
        <tbody>
          {pointers.map((pointer) => (
            <tr key={pointer.active_pointer_id}>
              <td><StatusBadge value={pointer.environment} /></td>
              <td>{renderText(pointer.strategy_family)} / {renderText(pointer.universe)}</td>
              <td>
                {pointer.active_candidate_id ? (
                  <Link href={`/registry/candidates/${encodeURIComponent(pointer.active_candidate_id)}`}>{pointer.active_candidate_id}</Link>
                ) : '—'}
              </td>
              <td>
                {pointer.active_bundle_id ? (
                  <Link href={`/registry/bundles/${encodeURIComponent(pointer.active_bundle_id)}`}>{pointer.active_bundle_id}</Link>
                ) : '—'}
              </td>
              <td>{renderText(pointer.activated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ReadinessReportList({ reports }: { reports: ReadinessReport[] }) {
  if (reports.length === 0) return <EmptyState>No readiness reports.</EmptyState>
  return (
    <div className="list-stack">
      {reports.map((report) => (
        <div className="list-row" key={report.report_id}>
          <div>
            <Link href={`/registry/readiness/${encodeURIComponent(report.report_id)}`}>{report.report_id}</Link>
            <div className="small">
              candidate {renderText(report.candidate_id)} · target {renderText(report.target_status)} · {renderText(report.created_at)}
            </div>
          </div>
          <StatusBadge value={report.overall_status} />
        </div>
      ))}
    </div>
  )
}

export function ReadinessReportDetail({ report }: { report: ReadinessReport }) {
  const evidenceId = buildReadinessEvidenceId(report.report_id)
  return (
    <div className="card">
      <h3>Readiness Report</h3>
      <FieldGrid
        fields={[
          ['report_id', report.report_id],
          ['candidate_id', report.candidate_id],
          ['target_status', report.target_status],
          ['policy_id', report.policy_id],
          ['policy_version', report.policy_version],
          ['overall_status', report.overall_status],
          ['batch_id', report.batch_id],
          ['rank_ic', report.rank_ic],
          ['rank_ic_ir', report.rank_ic_ir],
          ['top_bottom_spread', report.top_bottom_spread],
          ['mcpt_p_value', report.mcpt_p_value],
          ['created_at', report.created_at],
        ]}
      />
      <CrossSectionalEvidenceCard
        title="Cross-Sectional Readiness Evidence"
        rankIc={report.rank_ic}
        rankIcIr={report.rank_ic_ir}
        topBottomSpread={report.top_bottom_spread}
        mcptPValue={report.mcpt_p_value}
        batchId={report.batch_id}
        selectionSummary={report.selection_summary_json}
      />
      <JsonSection title="Checks Passed" value={report.checks_passed} />
      <JsonSection title="Checks Warned" value={report.checks_warned} />
      <JsonSection title="Checks Failed" value={report.checks_failed} />
      <JsonSection title="Missing Evidence" value={report.missing_evidence} />
      <JsonSection title="Metric Evidence" value={report.metric_evidence} />
      <JsonSection title="Artifact Evidence" value={report.artifact_evidence} />
      <p className="small" style={{ marginTop: 16 }}>
        <Link href={`/registry/evidence/${encodeURIComponent(evidenceId)}`} className="text-link">
          Open current contract evidence
        </Link>
      </p>
    </div>
  )
}

export function LineageView({ lineage }: { lineage: CandidateLineage }) {
  return (
    <div className="card">
      <h3>Lineage</h3>
      <FieldGrid
        fields={[
          ['source_ml_run_id', lineage.source_refs?.source_ml_run_id],
          ['source_strategy_run_id', lineage.source_refs?.source_strategy_run_id],
          ['source_backtest_run_id', lineage.source_refs?.source_backtest_run_id],
          ['source_robustness_report_id', lineage.source_refs?.source_robustness_report_id],
          ['source_feature_snapshot_name', lineage.source_refs?.source_feature_snapshot_name],
          ['source_feature_snapshot_version', lineage.source_refs?.source_feature_snapshot_version],
          ['source_prediction_panel_id', lineage.source_refs?.source_prediction_panel_id],
        ]}
      />
      <div className="section-grid">
        <section>
          <h4>Bundles</h4>
          <BundleList bundles={lineage.bundles ?? []} />
        </section>
        <section>
          <h4>Promotion History</h4>
          <PromotionEventList events={lineage.promotion_events ?? []} />
        </section>
        <section>
          <h4>Readiness Reports</h4>
          <ReadinessReportList reports={lineage.readiness_reports ?? []} />
        </section>
        <section>
          <h4>Active References</h4>
          <ActivePointerTable pointers={lineage.active_pointers ?? []} />
        </section>
      </div>
      <details>
        <summary>Raw Lineage Payload</summary>
        <JsonBlock value={lineage} />
      </details>
    </div>
  )
}

export function JsonSection({ title, value }: { title: string; value: unknown }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div style={{ marginTop: 16 }}>
      <h4>{title}</h4>
      <JsonBlock value={value} />
    </div>
  )
}

function CrossSectionalEvidenceCard({
  title,
  rankIc,
  rankIcIr,
  topBottomSpread,
  mcptPValue,
  batchId,
  selectionSummary,
}: {
  title: string
  rankIc: unknown
  rankIcIr: unknown
  topBottomSpread: unknown
  mcptPValue: unknown
  batchId: unknown
  selectionSummary: unknown
}) {
  const hasEvidence = [rankIc, rankIcIr, topBottomSpread, mcptPValue, batchId, selectionSummary].some(
    (value) => value !== null && value !== undefined && value !== ''
  )
  if (!hasEvidence) return null
  return (
    <div className="card compact-card" style={{ marginTop: 16 }}>
      <h4>{title}</h4>
      <FieldGrid
        fields={[
          ['batch_id', batchId],
          ['rank_ic', rankIc],
          ['rank_ic_ir', rankIcIr],
          ['top_bottom_spread', topBottomSpread],
          ['mcpt_p_value', mcptPValue],
        ]}
      />
      <JsonSection title="Selection Summary" value={selectionSummary} />
    </div>
  )
}

export function JsonBlock({ value }: { value: unknown }) {
  return <pre>{JSON.stringify(value ?? {}, null, 2)}</pre>
}

export function StatusBadge({ value }: { value: unknown }) {
  const text = renderText(value)
  return <span className={`badge status-${String(text).replace(/[^a-zA-Z0-9_-]/g, '_')}`}>{text}</span>
}

export function FieldGrid({ fields }: { fields: Array<[string, unknown]> }) {
  return (
    <div className="field-grid">
      {fields.map(([label, value]) => (
        <div key={label}>
          <label>{label}</label>
          <div className="field-value">{renderText(value)}</div>
        </div>
      ))}
    </div>
  )
}

export function renderText(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}
