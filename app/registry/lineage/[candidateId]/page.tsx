import Link from 'next/link'
import { requireAdminUser } from '@/lib/admin-auth'
import { getCandidateLineage } from '@/lib/registry-backend'
import { LineageView, RegistryErrorState, RegistryHeader } from '../../components'

type LineagePageProps = {
  params: Promise<{ candidateId: string }>
}

export default async function LineagePage({ params }: LineagePageProps) {
  const admin = await requireAdminUser()
  const { candidateId } = await params
  let lineage: Awaited<ReturnType<typeof getCandidateLineage>> | null = null
  let error: unknown = null

  try {
    lineage = await getCandidateLineage(candidateId)
  } catch (requestError) {
    error = requestError
  }

  return (
    <div>
      <RegistryHeader adminEmail={admin.email} />
      <div className="card">
        <Link href={`/registry/candidates/${encodeURIComponent(candidateId)}`} className="text-link">Back to candidate</Link>
      </div>
      {error ? <RegistryErrorState error={error} /> : null}
      {!error && lineage ? <LineageView lineage={lineage} /> : null}
    </div>
  )
}
