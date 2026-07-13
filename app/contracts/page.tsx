import Link from 'next/link'
import { requireAdminUser } from '@/lib/admin-auth'

const AVAILABLE_CONTRACTS = [
  {
    group: 'Data Ops',
    rows: [
      ['/analyst/data-ops/health', '/data-ops', 'available / proxied', 'Data readiness snapshot.'],
      ['/analyst/data-ops/rebuild-jobs', '/data-ops', 'available / proxied', 'Rebuild job list and creation path.'],
      ['/analyst/data-ops/rebuild-jobs/{job_id}', '/data-ops', 'available / proxied', 'Rebuild job detail.'],
      ['/analyst/data-ops/rebuild-jobs/{job_id}/retry', '/data-ops', 'available / proxied', 'Retry existing rebuild job.'],
      ['/analyst/data-ops/duplicates', '/data-ops', 'available / proxied', 'Duplicate inspection.'],
      ['/analyst/data-ops/freshness', '/data-ops', 'available / proxied', 'Freshness inspection.'],
      ['/analyst/data-ops/source-comparison', '/data-ops', 'available / proxied', 'Source comparison.'],
      ['/analyst/data-ops/macro-release-gaps', '/data-ops', 'available / proxied', 'Macro release gap inspection.'],
    ],
  },
  {
    group: 'Analyst',
    rows: [
      ['/analyst/jobs', '/analyst', 'available / proxied', 'Ticker signal, snapshot, and coverage report jobs.'],
      ['/analyst/jobs/{job_id}', '/analyst', 'available / proxied', 'Analyst job detail.'],
    ],
  },
  {
    group: 'Research',
    rows: [
      ['/analyst/research/experiments', '/research', 'available / proxied', 'Research creation and run library.'],
      ['/analyst/research/experiments/{experiment_id}', '/research', 'available / proxied', 'Run detail.'],
      ['/analyst/research/experiments/{experiment_id}/events', '/research', 'available / proxied', 'Run events.'],
      ['/analyst/research/experiments/{experiment_id}/artifacts', '/research', 'available / proxied', 'Run artifacts.'],
      ['/analyst/research/experiments/{experiment_id}/cancel', '/research', 'available / proxied', 'Admin cancel action.'],
      ['/analyst/research/experiments/{experiment_id}/mark-failed', '/research', 'available / proxied', 'Admin mark-failed action.'],
    ],
  },
  {
    group: 'Registry Read',
    rows: [
      ['/analyst/registry/candidates', '/evaluation', 'available / proxied', 'Read-only candidates.'],
      ['/analyst/registry/bundles', '/evaluation', 'available / proxied', 'Read-only bundles.'],
      ['/analyst/registry/readiness-reports', '/evaluation', 'available / proxied', 'Read-only readiness reports.'],
      ['/analyst/registry/promotion-events', '/production, /diagnostics', 'available / proxied', 'Read-only promotion history.'],
      ['/analyst/registry/active-pointers', '/production', 'available / proxied', 'Read-only active pointers.'],
      ['/analyst/registry/evidence/{evidence_id}', '/evaluation', 'available / proxied', 'Read-only evidence detail.'],
    ],
  },
  {
    group: 'Signals',
    rows: [
      ['/analyst/signal-evaluation/candidates', '/evaluation', 'available / proxied', 'Signal Evaluation V1 candidate comparison list. Normalizes summaries, sources metadata, and gaps.'],
      ['/analyst/signal-evaluation/candidates/{candidate_id}', '/evaluation', 'available / proxied', 'Signal Evaluation V1 selected candidate detail.'],
      ['/analyst/signal-evaluation/candidates/{candidate_id}/report', '/evaluation', 'available / proxied', 'Signal Evaluation V1 selected report with metrics, lineage, artifacts, series containers, and structured gaps.'],
      ['/screener/signals', '/evaluation', 'available / proxied', 'Latest signal rows.'],
      ['/signals/history/{ticker}', '/evaluation', 'available / proxied', 'Ticker signal history.'],
      ['/signals/last-flips', '/evaluation', 'available / proxied', 'Last flip date by ticker.'],
      ['/signals/flips', '/evaluation', 'available / proxied', 'Flip events by date.'],
      ['/signals/composition', '/evaluation', 'available / proxied', 'Signal composition by ticker.'],
    ],
  },
  {
    group: 'Site / Frontoffice',
    rows: [
      ['/site/watchlist/all-tickers', '/frontoffice', 'available / proxied', 'All tickers appearing in user watchlists.'],
      ['/site/watchlist/subscriptions', '/frontoffice', 'available / proxied', 'Ticker subscriptions returned by backend.'],
      ['/site/watchlist', '/frontoffice', 'available / proxied', 'Requires user_id for user watchlist lookup.'],
      ['/site/ai-research/runs', '/frontoffice', 'available / proxied', 'Requires user_id for user research run list.'],
      ['/site/ai-research/runs/{run_id}', '/frontoffice', 'available / proxied', 'Requires user_id for run detail.'],
      ['/site/ai-research/feedback', 'not used by Backoffice', 'available / missing local proxy', 'Mutation path exists for frontoffice feedback; not needed for read-only admin workspace.'],
      ['/site/alerts/reserve', 'not used by Backoffice', 'available / missing local proxy', 'Cron/frontoffice alert dispatch path, not admin dashboard data.'],
      ['/site/alerts/record', 'not used by Backoffice', 'available / missing local proxy', 'Cron/frontoffice alert dispatch path, not admin dashboard data.'],
      ['/site/analytics/events', 'not used by Backoffice', 'available / missing local proxy', 'Event ingestion exists, but no analytics summary endpoint exists.'],
    ],
  },
  {
    group: 'Diagnostics',
    rows: [
      ['/health', '/, /diagnostics', 'available through health snapshot', 'Backend reachability probe.'],
      ['protected route probes', '/, /diagnostics', 'available through health snapshot', 'Backoffice route-level smoke checks.'],
    ],
  },
]

const MISSING_CONTRACTS = [
  'official signal active model/candidate lineage',
  'official signal forward evaluation',
  'paper/shadow signal candidates',
  'candidate-vs-official comparison',
  'decay/replacement proposals',
  'admin all-user AI research runs',
  'user research activity summary',
  'queue depth',
  'worker heartbeat',
  'campaign preview/create/detail',
  'registry pending authorization actions',
  'registry mutation approval workflow',
  'data-ops issue drilldown/repair preview',
]

const SIGNAL_EVALUATION_REQUIRED_CONTRACTS = [
  ['candidate/model universe list', 'available', 'backend', '/evaluation', 'Signal Evaluation V1 exposes /analyst/signal-evaluation/candidates with source, ticker, strategy, universe, status, limit, offset, and include_official filters.'],
  ['normalized comparison summary', 'available', 'backend', '/evaluation', 'Signal Evaluation V1 normalizes candidate summaries, metrics, sources metadata, links, and structured gaps.'],
  ['selected candidate report', 'available', 'backend', '/evaluation', 'Signal Evaluation V1 report endpoint returns metrics, robustness, lineage, readiness, artifacts, raw evidence, series containers, and gaps.'],
  ['IC series', 'V1 gap-backed', 'backend / research orchestrator', '/evaluation', 'V1 returns series containers and backend gaps; it does not compute/populate IC points.'],
  ['rolling IC series', 'V1 gap-backed', 'backend / research orchestrator', '/evaluation', 'V1 returns structured gaps for rolling IC series.'],
  ['forward returns by signal date/horizon', 'V1 gap-backed', 'backend', '/evaluation', 'V1 does not compute candidate/model forward-return time series.'],
  ['cumulative return/equity curve', 'backend-supported when configured', 'research orchestrator / backend', '/evaluation', 'Signal Evaluation Series V1 can populate report.series.equity_curve.points when artifact roots/readers are configured; otherwise it returns artifact_reader_disabled or related gaps.'],
  ['drawdown series', 'backend-supported when configured', 'research orchestrator / backend', '/evaluation', 'Signal Evaluation Series V1 can populate report.series.drawdown.points when artifact roots/readers are configured; otherwise it returns artifact_reader_disabled or related gaps.'],
  ['turnover series', 'backend-supported when configured', 'backend / strategy lab', '/evaluation', 'Signal Evaluation Series V1 can populate report.series.turnover.points when artifact roots/readers are configured; otherwise it returns artifact_reader_disabled or related gaps.'],
  ['confidence calibration', 'V1 gap-backed', 'backend / ML lab', '/evaluation', 'V1 returns structured gaps for confidence calibration.'],
  ['regime breakdown', 'V1 gap-backed', 'backend / research orchestrator', '/evaluation', 'V1 returns structured gaps for regime breakdown.'],
  ['decay/live-vs-backtest divergence', 'V1 gap-backed', 'backend / future', '/evaluation', 'V1 returns structured gaps for decay/live-vs-backtest divergence.'],
  ['official active model/candidate lineage', 'partial', 'registry / backend', '/evaluation', 'V1 can include active-pointer evidence when available, but live signal history is not fully linked to official lineage.'],
  ['paper/shadow candidate signal stream', 'missing', 'backend / future', '/evaluation', 'No paper/shadow signal stream exists.'],
  ['candidate-vs-official disagreement performance', 'V1 gap-backed', 'backend / future', '/evaluation', 'V1 returns structured gaps; no disagreement-performance series is computed.'],
  ['launch signal test/model experiment', 'partial', 'backend / research orchestrator', '/evaluation, /research', 'Single research experiment creation exists; dynamic signal-test launch is not standardized.'],
  ['campaign/model-template catalog', 'missing', 'backend / future', '/evaluation, /research', 'No template catalog or campaign expansion contract exists.'],
]

export default async function ContractsPage() {
  const admin = await requireAdminUser()

  return (
    <div className="page-stack">
      <div className="hero-panel">
        <div>
          <p className="eyebrow">Backend Contract Inventory</p>
          <h1>See what Backoffice can really operate, what is proxied, and what still needs backend support.</h1>
          <p className="hero-copy">
            This inventory is Backoffice-owned until finance-backend exposes contract metadata. It helps operators and developers distinguish real backend data from UI-only gaps.
          </p>
        </div>
        <div className="hero-actions">
          <div className="small">Admin: {admin.email}</div>
          <Link className="hero-link" href="/diagnostics">Open Diagnostics</Link>
        </div>
      </div>

      <div className="card">
        <h2>Why This Exists</h2>
        <p className="small">
          Operators and developers need one place to see what is real, what is only UI, and which backend contract is missing. This page does not create backend capabilities; it documents the current Backoffice contract surface.
        </p>
      </div>

      <div className="card">
        <h2>Signal Evaluation Required Contracts</h2>
        <p className="small">These contracts define what the Signal Evaluation Lab needs to compare many candidates/models and render model-quality evidence without fake metrics.</p>
        <div className="table-wrap">
          <table className="registry-table">
            <thead>
              <tr>
                <th>Contract</th>
                <th>Current status</th>
                <th>Expected owner</th>
                <th>Needed by</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {SIGNAL_EVALUATION_REQUIRED_CONTRACTS.map(([contract, status, owner, page, notes]) => (
                <tr key={contract}>
                  <td>{contract}</td>
                  <td><span className={contractStatusClass(status)}>{status}</span></td>
                  <td>{owner}</td>
                  <td>{page}</td>
                  <td>{notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {AVAILABLE_CONTRACTS.map((group) => (
        <div className="card" key={group.group}>
          <h2>{group.group}</h2>
          <div className="table-wrap">
            <table className="registry-table">
              <thead>
                <tr>
                  <th>Route</th>
                  <th>Backoffice page</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map(([route, page, status, notes]) => (
                  <tr key={`${group.group}-${route}`}>
                    <td>{route}</td>
                    <td>{page}</td>
                    <td><span className={status.includes('missing') || status.includes('gap') ? 'badge backend-gap' : 'badge completed'}>{status}</span></td>
                    <td>{notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="card">
        <h2>Missing Contracts</h2>
        <p className="small">These are product requirements that still need finance-backend support before Backoffice can operate them as real control surfaces.</p>
        <ul className="plain-list">
          {MISSING_CONTRACTS.map((contract) => (
            <li key={contract}>{contract}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function contractStatusClass(status: string): string {
  if (status === 'available') return 'badge completed'
  if (status === 'partial' || status === 'artifact-only' || status === 'V1 gap-backed' || status === 'backend-supported when configured') return 'badge running'
  return 'badge backend-gap'
}
