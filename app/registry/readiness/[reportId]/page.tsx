import Link from 'next/link'
import { requireAdminUser } from '@/lib/admin-auth'
import { getReadinessReport } from '@/lib/registry-backend'
import { JsonSection, ReadinessReportDetail, RegistryErrorState, RegistryHeader } from '../../components'

type ReadinessDetailPageProps = {
  params: Promise<{ reportId: string }>
}

export default async function ReadinessDetailPage({ params }: ReadinessDetailPageProps) {
  const admin = await requireAdminUser()
  const { reportId } = await params
  let report: Awaited<ReturnType<typeof getReadinessReport>> | null = null
  let error: unknown = null

  try {
    report = await getReadinessReport(reportId)
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
      {!error && report ? (
        <>
          <ReadinessReportDetail report={report.readiness_report} />
          <JsonSection title="Current Contract Evidence" value={report.current_contract_evidence} />
        </>
      ) : null}
    </div>
  )
}
