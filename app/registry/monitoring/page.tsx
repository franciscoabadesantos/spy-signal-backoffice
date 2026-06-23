import Link from 'next/link'
import { requireAdminUser } from '@/lib/admin-auth'
import RegistryMonitoringWorkspace from './ui'

export default async function RegistryMonitoringPage() {
  const admin = await requireAdminUser()
  return (
    <div>
      <div className="card">
        <div className="split-row">
          <div>
            <h1>Registry Monitoring</h1>
            <p className="small">Active-pointer health snapshots, alerts, and human-confirmed rollback.</p>
          </div>
          <div className="meta">
            <Link href="/registry" className="text-link">Registry</Link>
            <span className="small">Admin: {admin.email}</span>
          </div>
        </div>
      </div>
      <RegistryMonitoringWorkspace adminEmail={admin.email} />
    </div>
  )
}
