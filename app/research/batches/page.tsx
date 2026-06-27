import Link from 'next/link'
import { requireAdminUser } from '@/lib/admin-auth'
import BatchResultsWorkspace from './ui'

export default async function ResearchBatchesPage() {
  const admin = await requireAdminUser()
  return (
    <div>
      <div className="card">
        <div className="split-row">
          <div>
            <h1>Research Batches</h1>
            <p className="small">Inspect cross-sectional batch results. Launch new grids from Research.</p>
          </div>
          <div className="meta">
            <Link href="/research" className="text-link">Experiments</Link>
            <span className="small">Admin: {admin.email}</span>
          </div>
        </div>
      </div>
      <BatchResultsWorkspace />
    </div>
  )
}
