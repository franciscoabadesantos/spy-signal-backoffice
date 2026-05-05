import Link from 'next/link'
import { requireAdminUser } from '@/lib/admin-auth'
import { createModelRegistryClient } from '@/lib/model-registry-client'
import { ReadinessReportDetail, RegistryErrorState, RegistryHeader } from '../../components'

type ReadinessDetailPageProps = {
  params: Promise<{ reportId: string }>
}

export default async function ReadinessDetailPage({ params }: ReadinessDetailPageProps) {
  const admin = await requireAdminUser()
  const { reportId } = await params
  const client = createModelRegistryClient()
  let report: Awaited<ReturnType<typeof client.getReadinessReport>> | null = null
  let error: unknown = null

  try {
    report = await client.getReadinessReport(reportId)
  } catch (requestError) {
    error = requestError
  }

  return (
    <div>
      <RegistryHeader adminEmail={admin.email} />
      <div className="card">
        <Link href="/registry" className="text-link">Back to registry</Link>
      </div>
      {error ? <RegistryErrorState error={error} /> : null}
      {!error && report ? <ReadinessReportDetail report={report} /> : null}
    </div>
  )
}
