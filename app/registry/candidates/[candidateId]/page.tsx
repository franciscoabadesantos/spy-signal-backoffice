import Link from 'next/link'
import { requireAdminUser } from '@/lib/admin-auth'
import { createModelRegistryClient, ModelRegistryClientError, ReadinessReport } from '@/lib/model-registry-client'
import {
  CandidateOverview,
  LineageView,
  ReadinessReportDetail,
  RegistryErrorState,
  RegistryHeader,
} from '../../components'

type CandidateDetailPageProps = {
  params: Promise<{ candidateId: string }>
}

export default async function CandidateDetailPage({ params }: CandidateDetailPageProps) {
  const admin = await requireAdminUser()
  const { candidateId } = await params
  const client = createModelRegistryClient()

  let lineage: Awaited<ReturnType<typeof client.getCandidateLineage>> | null = null
  let latestReadiness: ReadinessReport | null = null
  let error: unknown = null
  let latestReadinessError: unknown = null

  try {
    lineage = await client.getCandidateLineage(candidateId)
    try {
      latestReadiness = await client.getLatestReadinessReport(candidateId)
    } catch (requestError) {
      if (requestError instanceof ModelRegistryClientError && requestError.status === 404) {
        latestReadinessError = requestError
      } else {
        throw requestError
      }
    }
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
      {!error && lineage ? (
        <>
          <CandidateOverview candidate={lineage.candidate} />
          {latestReadiness ? (
            <ReadinessReportDetail report={latestReadiness} />
          ) : (
            <div className="card">
              <h3>Latest Readiness</h3>
              <p className="small">
                {latestReadinessError instanceof Error ? latestReadinessError.message : 'No readiness report found for this candidate.'}
              </p>
            </div>
          )}
          <LineageView lineage={lineage} />
        </>
      ) : null}
    </div>
  )
}
