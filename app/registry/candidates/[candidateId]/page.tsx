import Link from 'next/link'
import { requireAdminUser } from '@/lib/admin-auth'
import { getCandidateDetail, getCandidateLineage, listReadinessReports } from '@/lib/registry-backend'
import {
  CandidateOverview,
  LineageView,
  JsonSection,
  RegistryErrorState,
  RegistryHeader,
} from '../../components'

type CandidateDetailPageProps = {
  params: Promise<{ candidateId: string }>
}

export default async function CandidateDetailPage({ params }: CandidateDetailPageProps) {
  const admin = await requireAdminUser()
  const { candidateId } = await params
  let candidateDetail: Awaited<ReturnType<typeof getCandidateDetail>> | null = null
  let lineage: Awaited<ReturnType<typeof getCandidateLineage>> | null = null
  let readinessPayload: Awaited<ReturnType<typeof listReadinessReports>> | null = null
  let error: unknown = null

  try {
    ;[candidateDetail, lineage, readinessPayload] = await Promise.all([
      getCandidateDetail(candidateId),
      getCandidateLineage(candidateId),
      listReadinessReports(candidateId, 25),
    ])
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
      {!error && candidateDetail && lineage ? (
        <>
          <CandidateOverview candidate={candidateDetail.candidate} />
          <JsonSection title="Research Artifact Evidence" value={candidateDetail.research_artifact_evidence} />
          <JsonSection title="Current Contract Evidence" value={readinessPayload?.current_contract_evidence} />
          <LineageView lineage={lineage} />
        </>
      ) : null}
    </div>
  )
}
