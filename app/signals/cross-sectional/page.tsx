import Link from 'next/link'
import { requireAdminUser } from '@/lib/admin-auth'
import CrossSectionalSignalsWorkspace from './ui'

export default async function CrossSectionalSignalsPage() {
  const admin = await requireAdminUser()
  return (
    <div>
      <div className="card">
        <div className="split-row">
          <div>
            <h1>Cross-Sectional Signals</h1>
            <p className="small">Daily ranked panel for the active production model, rendered from the backend contract.</p>
          </div>
          <div className="meta">
            <Link href="/signals" className="text-link">Directional signals</Link>
            <span className="small">Admin: {admin.email}</span>
          </div>
        </div>
      </div>
      <CrossSectionalSignalsWorkspace />
    </div>
  )
}
