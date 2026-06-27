import Link from 'next/link'
import { requireAdminUser } from '@/lib/admin-auth'
import { listActivePointers, listPromotionEvents } from '@/lib/registry-backend'
import { ActivePointerTable, PromotionEventList, RegistryErrorState } from '@/app/registry/components'
import { EvidenceGap } from '@/app/components/workspace-data'
import CrossSectionalSignalsWorkspace from '@/app/signals/cross-sectional/ui'
import RegistryMonitoringWorkspace from '@/app/registry/monitoring/ui'

export default async function ProductionPage() {
  const admin = await requireAdminUser()
  let activePointers: Awaited<ReturnType<typeof listActivePointers>> = []
  let promotionEvents: Awaited<ReturnType<typeof listPromotionEvents>> = []
  let error: unknown = null

  try {
    const [pointers, events] = await Promise.all([
      listActivePointers(),
      listPromotionEvents(undefined, 50),
    ])
    activePointers = pointers
    promotionEvents = events
  } catch (requestError) {
    error = requestError
  }

  return (
    <div className="page-stack">
      <div className="card">
        <div className="split-row">
          <div>
            <h1>Production</h1>
            <p className="small">Active model pointers, promotion history, daily inference, live ranked panels, and monitoring.</p>
          </div>
          <div className="meta">
            <Link className="text-link" href="#active-models">Active models</Link>
            <Link className="text-link" href="#live-panel">Live panel</Link>
            <Link className="text-link" href="#monitoring">Monitoring</Link>
            <Link className="text-link" href="/production/daily-inference">Daily inference</Link>
            <span className="small">Admin: {admin.email}</span>
          </div>
        </div>
      </div>

      {error ? <RegistryErrorState error={error} /> : null}

      <div className="card" id="active-models">
        <h2>Active models</h2>
        {activePointers.length > 0 ? (
          <ActivePointerTable pointers={activePointers} />
        ) : (
          <EvidenceGap
            reason="No active pointers were returned by the registry contract."
            expected="Rows from /analyst/registry/active-pointers once a model has been activated."
            title="No active model pointer"
          />
        )}
      </div>

      <div className="card" id="promotion-history">
        <h2>Promotion history</h2>
        {promotionEvents.length > 0 ? (
          <PromotionEventList events={promotionEvents} />
        ) : (
          <EvidenceGap
            reason="No promotion events were returned by the registry contract."
            expected="Rows from /analyst/registry/promotion-events after candidate decisions are recorded."
            title="Promotion history unavailable"
          />
        )}
      </div>

      <div className="card" id="live-panel">
        <h2>Live panel</h2>
        <p className="small">Ranked cross-sectional panel for the active production pointer.</p>
        <CrossSectionalSignalsWorkspace />
      </div>

      <div className="card" id="monitoring">
        <h2>Monitoring</h2>
        <RegistryMonitoringWorkspace adminEmail={admin.email} />
      </div>
    </div>
  )
}
