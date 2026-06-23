import Link from 'next/link'
import { requireAdminUser } from '@/lib/admin-auth'
import { loadRegistryDashboard } from '@/lib/registry-backend'
import {
  ActivePointerTable,
  BundleList,
  CandidateFilters,
  CandidateTable,
  PromotionEventList,
  RegistryConceptGrid,
  ReadinessReportList,
  RegistryErrorState,
  RegistryHeader,
  SummaryCards,
} from './components'

type RegistryPageProps = {
  searchParams: Promise<{
    status?: string
    strategy_family?: string
    universe?: string
    environment?: string
  }>
}

export default async function RegistryPage({ searchParams }: RegistryPageProps) {
  const admin = await requireAdminUser()
  const params = await searchParams
  const status = trimParam(params.status)
  const strategyFamily = trimParam(params.strategy_family)
  const universe = trimParam(params.universe)
  const environment = trimParam(params.environment)

  let payload:
    | Awaited<ReturnType<typeof loadRegistryDashboard>>
    | null = null
  let error: unknown = null

  try {
    payload = await loadRegistryDashboard({ status, strategyFamily, universe, environment })
  } catch (requestError) {
    error = requestError
  }

  return (
    <div>
      <RegistryHeader adminEmail={admin.email} />
      <RegistryConceptGrid />
      {error ? <RegistryErrorState error={error} /> : null}
      {!error && payload ? (
        <>
          <div className="card">
            <div className="split-row">
              <div>
                <h3>Evidence Dashboard</h3>
                <p className="small">Generated: {payload.summary.generated_at ?? '—'}</p>
              </div>
              <div className="meta">
                <Link href="/registry/promotions" className="text-link">Promotion history</Link>
                <Link href="/registry/monitoring" className="text-link">Monitoring</Link>
              </div>
            </div>
          </div>

          <SummaryCards summary={payload.summary} />
          <CandidateFilters status={status} strategyFamily={strategyFamily} universe={universe} />

          <div className="card">
            <h3>Candidate List</h3>
            <CandidateTable candidates={payload.candidates} />
          </div>

          <div className="card">
            <h3>Bundle List</h3>
            <BundleList bundles={payload.bundles} />
          </div>

          <div className="card">
            <h3>Active Pointer Dashboard</h3>
            <form action="/registry" className="inline-filter">
              <input type="hidden" name="status" value={status ?? ''} />
              <input type="hidden" name="strategy_family" value={strategyFamily ?? ''} />
              <input type="hidden" name="universe" value={universe ?? ''} />
              <label htmlFor="environment">Environment</label>
              <input id="environment" name="environment" defaultValue={environment ?? ''} placeholder="paper" />
              <button className="secondary" type="submit">Filter</button>
            </form>
            <ActivePointerTable pointers={payload.activePointers} />
          </div>

          <div className="card">
            <h3>Promotion History</h3>
            <PromotionEventList events={payload.promotionEvents} />
          </div>

          <div className="card">
            <h3>Readiness Reports</h3>
            <ReadinessReportList reports={payload.readinessReports} />
          </div>
        </>
      ) : null}
    </div>
  )
}

function trimParam(value?: string): string | undefined {
  const trimmed = value?.trim()
  return trimmed || undefined
}
