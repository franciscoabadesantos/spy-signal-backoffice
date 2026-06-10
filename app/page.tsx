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
          <h1>Start with data readiness, then inspect research, analyst validation, registry evidence, and diagnostics.</h1>
          <p className="hero-copy">
            Backoffice is the internal control plane for the finance product. Check whether the data is good enough to trust, inspect active research and frontoffice-style validation, review registry evidence, and use diagnostics where backend or worker visibility is missing.
          </p>
        </div>
        <div className="hero-actions">
          <Link className="hero-link" href="/data-ops">Open Data Ops</Link>
          <Link className="hero-link secondary-link" href="/research">Open Research Lab</Link>
          <Link className="hero-link secondary-link" href="/diagnostics">Open Diagnostics</Link>
        </div>
      </div>

      <BackofficeHealthPanel snapshot={health} />

      <div className="card">
        <div className="split-row">
          <div>
            <h2>Control Room Operations Overview</h2>
            <p className="small">
              Data quality comes before research confidence. Research results are evidence, not automatic product decisions. Analyst validation is a first-class control surface. Registry is review-only today, and Backoffice exposes missing backend contracts instead of hiding them.
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
              <strong>5. Backend route, registry proxy, or worker visibility is broken</strong>
              <div className="small">Open Diagnostics. Use protected route probes and raw debug entry points, and treat missing queue or worker visibility as an explicit backend gap.</div>
            </div>
            <Link className="text-link" href="/diagnostics">Open Diagnostics</Link>
          </div>
          <div className="list-row">
            <div>
              <strong>6. Need official signal, campaign, user research, or registry mutation controls</strong>
              <div className="small">Use the planned-surface inventory below. These are not implemented as fake functionality; they identify backend contracts needed for the next product layers.</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Missing / Planned Control Surfaces</h2>
        <p className="small">
          These surfaces are required for the full control plane, but they are not implemented as working features on this page. The current state is shown honestly as backend gaps or planned Backoffice capabilities.
        </p>
        <div className="planned-grid">
          <PlannedSurface
            title="Official Signals"
            why="We cannot know whether a model is truly good only from backtests. Operators need official, paper, and live signal evaluation, forward performance, decay detection, and comparison against active models."
            status="Not implemented in Backoffice."
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
            why="Backoffice must see and control what people are researching through the frontoffice or product experience."
            status="Not implemented as a dedicated Backoffice surface."
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
            why="Data Ops, Analyst jobs, and Research jobs all rely on queues and workers, but Backoffice currently sees only per-job polling and stuck heuristics."
            status="Not implemented as a unified queue or worker dashboard."
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
            why="Operators need one place to see which backend contracts exist, which are missing, and which control-plane capabilities are blocked."
            status="Not implemented."
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
  why,
  status,
  gaps,
}: {
  title: string
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
