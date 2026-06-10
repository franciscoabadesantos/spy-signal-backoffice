import Link from 'next/link'
import { BackofficeHealthPanel } from '@/app/components/backoffice-health-panel'
import { requireAdminUser } from '@/lib/admin-auth'
import type { BackofficeHealthSnapshot, HealthState, RouteProbe } from '@/lib/backoffice-health'
import { loadBackofficeHealth } from '@/lib/backoffice-health'

export default async function HomePage() {
  const admin = await requireAdminUser()
  const health = await loadBackofficeHealth(admin.email)
  const backendProbe = findProbe(health, 'Backend /health')
  const researchProbe = findProbe(health, 'Research experiment list')
  const dataProbe = findProbe(health, 'Data quality health')
  const registryProbe = findProbe(health, 'Registry proxy')

  return (
    <div className="page-stack">
      <div className="hero-panel">
        <div>
          <p className="eyebrow">Backoffice Operations Control Plane</p>
          <h1>Start with data readiness, then inspect research, analyst validation, official signals, frontoffice activity, registry evidence, operations, and diagnostics.</h1>
          <p className="hero-copy">
            Backoffice is the internal control plane for the finance product. Check whether the data is good enough to trust, inspect active research and frontoffice-style validation, review official signal behavior and registry evidence, and use operations or diagnostics where backend or worker visibility is missing.
          </p>
        </div>
        <div className="hero-actions">
          <Link className="hero-link" href="/data-ops">Open Data Ops</Link>
          <Link className="hero-link secondary-link" href="/research">Open Research Lab</Link>
          <Link className="hero-link secondary-link" href="/signals">Open Signals</Link>
          <Link className="hero-link secondary-link" href="/diagnostics">Open Diagnostics</Link>
        </div>
      </div>

      <BackofficeHealthPanel snapshot={health} />

      <div className="card">
        <div className="split-row">
          <div>
            <h2>Control Room Operations Overview</h2>
            <p className="small">
              Data quality comes before research confidence. Research results are evidence, not automatic product decisions. Analyst validation, official signal inspection, frontoffice activity, registry review, and operations visibility are first-class control surfaces. Backoffice exposes missing backend contracts instead of hiding them.
            </p>
          </div>
        </div>
      </div>

      <div className="operations-grid">
        <OperationCard
          href="/data-ops"
          title="Data Ops / Data Readiness"
          controls="Coverage, missing days, freshness, duplicates, source comparison, macro release gaps, and repair or rebuild jobs."
          matters="This is the first place to check before trusting research runs, analyst output, or future official signals."
          availabilityLabel="Data quality health"
          availabilityStatus={dataProbe?.status}
          availabilityDetail={dataProbe?.message ?? 'Not available in the current health snapshot.'}
          gap="No additional summary metrics are shown here because the Control Room should not invent data-readiness scores."
        />
        <OperationCard
          href="/research"
          title="Research Operations"
          controls="Experiment creation, run library, run detail, events, artifacts, stages, evidence, lineage, compare, duplicate, cancel, and mark-failed flows."
          matters="Research quality depends on Data Ops readiness, and research outputs remain evidence until reviewed through the registry and future official-signal controls."
          availabilityLabel="Research experiment list"
          availabilityStatus={researchProbe?.status}
          availabilityDetail={researchProbe?.message ?? 'Not available in the current health snapshot.'}
        />
        <OperationCard
          href="/analyst"
          title="Analyst / Frontoffice Validation"
          controls="Ticker analysis validation, ticker_signal_v1, ticker_snapshot, coverage_report, and structured market or earnings rendering."
          matters="This checks what frontoffice-style research and analysis produces, even while the surface still uses internal smoke-test framing."
          availabilityLabel="Backend API"
          availabilityStatus={health.backendApi.status}
          availabilityDetail="Dedicated Analyst route status is not summarized in the Control Room snapshot yet."
          gap="Backend gap: add dedicated analyst/frontoffice validation contract health to the operations snapshot."
        />
        <OperationCard
          href="/signals"
          title="Official Signals"
          controls="Latest screener signals, ticker signal history, last flips, flip events by date, and composition from existing finance-backend contracts."
          matters="Official signal behavior needs a real workspace now, even though active model lineage, paper candidates, and forward evaluation are still missing."
          availabilityLabel="Signal contracts"
          availabilityDetail="Not included in the existing health snapshot. The /signals workspace uses thin admin proxies to existing finance-backend signal endpoints."
          gap="Backend gaps remain for official model lineage, forward return evaluation, paper/shadow candidates, comparisons, and decay proposals."
        />
        <OperationCard
          href="/frontoffice"
          title="Frontoffice / User Research"
          controls="All watched tickers, watchlist subscriptions, user-id based watchlist lookup, user AI research runs, and run detail lookup."
          matters="Backoffice needs visibility into what users and frontoffice-style flows are researching, even while all-user admin views are missing."
          availabilityLabel="Site contracts"
          availabilityDetail="Not included in the existing health snapshot. The /frontoffice workspace uses thin admin proxies to existing site/watchlist and site/ai-research endpoints."
          gap="Backend gaps remain for all-user research lists, user search, usage summaries, moderation controls, alert dashboards, and analytics summaries."
        />
        <OperationCard
          href="/operations"
          title="Queue & Worker Operations"
          controls="Analyst jobs, Data Ops rebuild jobs, Research experiments, and a clearly labeled UI-only old queued/running heuristic."
          matters="Operators need one place to inspect visible job surfaces while true queue depth and worker heartbeat are still missing."
          availabilityLabel="Existing job list APIs"
          availabilityDetail="Uses existing local Backoffice APIs for analyst jobs, data-ops rebuild jobs, and research experiments."
          gap="Not worker health: queue depth, worker heartbeat, dispatch lag, dead-letter tasks, and unified retry/cancel need backend contracts."
        />
        <OperationCard
          href="/registry"
          title="Registry / Evidence"
          controls="Candidates, bundles, readiness, promotion history, active pointers, evidence drilldowns, and lineage visibility."
          matters="Registry is evidence and review now. Future registry mutations must be authorized through Backoffice and finance-backend."
          availabilityLabel="Registry proxy"
          availabilityStatus={registryProbe?.status}
          availabilityDetail={registryProbe?.message ?? 'Not available in the current health snapshot.'}
          gap="Read-only today: no add, delete, promote, activate, or replacement actions are implemented here."
        />
        <OperationCard
          href="/diagnostics"
          title="Diagnostics / System Health"
          controls="Backend and registry reachability, protected route probes, raw debug entry points, and current visibility gaps."
          matters="Use this when a route, proxy, service credential, or backend contract path is broken or unclear."
          availabilityLabel="Backend / Registry probes"
          availabilityStatus={worstStatus([backendProbe?.status, registryProbe?.status])}
          availabilityDetail="Health snapshot covers backend reachability, registry proxy reachability, and selected protected route probes."
          gap="Backend gap: unified queue and worker health is not exposed yet."
        />
        <OperationCard
          href="/contracts"
          title="Backend Contract Inventory"
          controls="Backoffice-owned inventory of available, proxied, not-yet-wired, and missing backend contracts."
          matters="Operators and developers need one place to see what is real backend data, what is UI-only, and what blocks the next control-plane capabilities."
          availabilityLabel="Inventory source"
          availabilityDetail="Static Backoffice-owned inventory until finance-backend exposes contract metadata."
          gap="Backend gap: no contract metadata endpoint exists yet."
        />
      </div>

      <div className="card">
        <h2>What Should I Do?</h2>
        <div className="list-stack">
          <div className="list-row">
            <div>
              <strong>1. Data looks wrong or research seems unreliable</strong>
              <div className="small">Open Data Ops. Check coverage, missing days, freshness, duplicates, source comparison, macro release gaps, and repair or rebuild jobs before trusting downstream conclusions.</div>
            </div>
            <Link className="text-link" href="/data-ops">Open Data Ops</Link>
          </div>
          <div className="list-row">
            <div>
              <strong>2. Need to validate a ticker or signal-style answer</strong>
              <div className="small">Open Analyst. Review ticker_signal_v1, ticker_snapshot, coverage_report, and structured market or earnings output as frontoffice-adjacent validation.</div>
            </div>
            <Link className="text-link" href="/analyst">Open Analyst</Link>
          </div>
          <div className="list-row">
            <div>
              <strong>3. Need to inspect experiment evidence</strong>
              <div className="small">Open Research Lab. Inspect runs, stages, events, artifacts, evidence, lineage, compare views, and operational controls for research jobs.</div>
            </div>
            <Link className="text-link" href="/research">Open Research Lab</Link>
          </div>
          <div className="list-row">
            <div>
              <strong>4. Need to review candidates, readiness, or evidence</strong>
              <div className="small">Open Registry / Evidence. Review candidates, bundles, promotion history, active pointers, evidence, and lineage without mutating registry state.</div>
            </div>
            <Link className="text-link" href="/registry">Open Registry</Link>
          </div>
          <div className="list-row">
            <div>
              <strong>5. Need to inspect official signal behavior</strong>
              <div className="small">Open Signals. Inspect current screener signals, ticker history, flips, and composition while treating official evaluation gaps as missing backend contracts.</div>
            </div>
            <Link className="text-link" href="/signals">Open Signals</Link>
          </div>
          <div className="list-row">
            <div>
              <strong>6. Need user/frontoffice research visibility</strong>
              <div className="small">Open Frontoffice. Inspect all watched tickers, subscriptions, and user-id based AI research runs as far as current backend contracts allow.</div>
            </div>
            <Link className="text-link" href="/frontoffice">Open Frontoffice</Link>
          </div>
          <div className="list-row">
            <div>
              <strong>7. Need job or queue/worker visibility</strong>
              <div className="small">Open Operations for current job surfaces. Open Diagnostics when protected routes or backend reachability are broken.</div>
            </div>
            <div className="meta">
              <Link className="text-link" href="/operations">Open Operations</Link>
              <Link className="text-link" href="/diagnostics">Open Diagnostics</Link>
            </div>
          </div>
          <div className="list-row">
            <div>
              <strong>8. Need to know whether a backend contract exists</strong>
              <div className="small">Open Contracts. It separates available/proxied contracts from missing backend capabilities.</div>
            </div>
            <Link className="text-link" href="/contracts">Open Contracts</Link>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Partial Workspaces / Remaining Gaps</h2>
        <p className="small">
          These are now Backoffice workspaces where possible. Each workspace uses existing finance-backend data and shows missing backend contracts inside the relevant page.
        </p>
        <div className="planned-grid">
          <PlannedSurface
            title="Official Signals"
            href="/signals"
            why="We cannot know whether a model is truly good only from backtests. Operators need official, paper, and live signal evaluation, forward performance, decay detection, and comparison against active models."
            status="Workspace exists at /signals with current signal inspection. Full official evaluation is not implemented."
            gaps={[
              'official signal overview',
              'active official model or candidate lineage',
              'signal history linked to candidate or model',
              'forward signal evaluation',
              'paper or shadow candidates',
              'candidate vs current official comparison',
              'decay and replacement proposals',
            ]}
          />
          <PlannedSurface
            title="Frontoffice / User Research Control"
            href="/frontoffice"
            why="Backoffice must see and control what people are researching through the frontoffice or product experience."
            status="Workspace exists at /frontoffice with watchlist and user-id based AI research visibility. All-user admin views are not implemented."
            gaps={[
              'user research runs and lists',
              'user intent and query visibility',
              'watchlist or user activity summary',
              'rate and usage visibility',
              'alert and research status',
              'admin moderation or control if needed',
            ]}
          />
          <PlannedSurface
            title="Queue & Worker Operations"
            href="/operations"
            why="Data Ops, Analyst jobs, and Research jobs all rely on queues and workers, but Backoffice currently sees only per-job polling and stuck heuristics."
            status="Workspace exists at /operations with current visible job lists. True queue and worker health are not implemented."
            gaps={[
              'queue depth',
              'worker heartbeat',
              'failed and stuck job counts',
              'retry or cancel visibility across job types',
              'task age and dispatch lag',
            ]}
          />
          <PlannedSurface
            title="Campaign / Batch Research"
            why="Operators need to run many research configurations safely, likely up to 250 queued runs per campaign, without hardcoded Q40/Q41-style assumptions."
            status="Not implemented."
            gaps={[
              'template and catalog contracts',
              'campaign preview',
              'campaign creation',
              'campaign run expansion',
              'campaign progress and comparison',
            ]}
          />
          <PlannedSurface
            title="Registry Authorization"
            why="Adding, deleting, promoting, activating, or replacing registry models and candidates must always be authorized through Backoffice, even if automation proposes the change."
            status="Registry is read-only today."
            gaps={[
              'pending registry actions',
              'approval and rejection workflow',
              'audit log',
              'authorized backend proxy mutations',
              'automation proposals requiring admin approval',
            ]}
          />
          <PlannedSurface
            title="Backend Contract Inventory"
            href="/contracts"
            why="Operators need one place to see which backend contracts exist, which are missing, and which control-plane capabilities are blocked."
            status="Workspace exists at /contracts as a Backoffice-owned inventory until backend metadata exists."
            gaps={[
              'backend contract metadata endpoint',
              'Backoffice-maintained static gap inventory until backend supports metadata',
            ]}
          />
        </div>
      </div>
    </div>
  )
}

function OperationCard({
  href,
  title,
  controls,
  matters,
  availabilityLabel,
  availabilityStatus,
  availabilityDetail,
  gap,
}: {
  href: string
  title: string
  controls: string
  matters: string
  availabilityLabel: string
  availabilityStatus?: HealthState
  availabilityDetail: string
  gap?: string
}) {
  return (
    <div className="operation-card">
      <div>
        <div className="section-link-eyebrow">{title}</div>
        <h3>{title}</h3>
      </div>
      <div className="operation-copy">
        <strong>Controls:</strong> {controls}
      </div>
      <div className="operation-copy">
        <strong>Why it matters:</strong> {matters}
      </div>
      <div className="availability-box">
        <div className="split-row">
          <strong>{availabilityLabel}</strong>
          <span className={statusTone(availabilityStatus)}>{availabilityStatus ?? 'not available yet'}</span>
        </div>
        <div className="small">{availabilityDetail}</div>
      </div>
      {gap ? <div className="gap-note"><strong>Gap:</strong> {gap}</div> : null}
      <Link className="hero-link card-link" href={href}>Open {title}</Link>
    </div>
  )
}

function PlannedSurface({
  title,
  href,
  why,
  status,
  gaps,
}: {
  title: string
  href?: string
  why: string
  status: string
  gaps: string[]
}) {
  return (
    <div className="planned-surface">
      <div className="split-row">
        <h3>{title}</h3>
        <span className="badge backend-gap">Backend gap</span>
      </div>
      <p className="small"><strong>Why needed:</strong> {why}</p>
      <p className="small"><strong>Current status:</strong> {status}</p>
      {href ? <Link className="text-link" href={href}>Open workspace</Link> : null}
      <div className="small"><strong>Backend gaps likely needed later:</strong></div>
      <ul className="plain-list small">
        {gaps.map((gap) => (
          <li key={gap}>{gap}</li>
        ))}
      </ul>
    </div>
  )
}

function findProbe(snapshot: BackofficeHealthSnapshot, label: string): RouteProbe | undefined {
  return snapshot.routeChecks.find((probe) => probe.label === label)
}

function worstStatus(statuses: Array<HealthState | undefined>): HealthState | undefined {
  if (statuses.includes('unreachable')) return 'unreachable'
  if (statuses.includes('missing')) return 'missing'
  if (statuses.includes('reachable')) return 'reachable'
  if (statuses.includes('configured')) return 'configured'
  return undefined
}

function statusTone(status?: HealthState): string {
  if (status === 'reachable') return 'badge completed'
  if (status === 'configured') return 'badge queued'
  if (status === 'missing') return 'badge cancelled'
  if (status === 'unreachable') return 'badge failed'
  return 'badge backend-gap'
}
