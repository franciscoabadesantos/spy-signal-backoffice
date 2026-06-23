import Link from 'next/link'
import { requireAdminUser } from '@/lib/admin-auth'
import BatchResultsWorkspace from './ui'

type BatchResultsPageProps = {
  params: Promise<{ batchId: string }>
}

export default async function BatchResultsPage({ params }: BatchResultsPageProps) {
  const admin = await requireAdminUser()
  const { batchId } = await params
  return (
    <div>
      <div className="card">
        <div className="split-row">
          <div>
            <h1>Batch Leque</h1>
            <p className="small">Distribution-level review across backend-returned configs. Region evidence first, member rows second.</p>
          </div>
          <div className="meta">
            <Link href="/research/batches" className="text-link">Back to batches</Link>
            <span className="small">Admin: {admin.email}</span>
          </div>
        </div>
      </div>
      <BatchResultsWorkspace adminEmail={admin.email} batchId={batchId} />
    </div>
  )
}
