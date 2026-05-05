import Link from 'next/link'
import { requireAdminUser } from '@/lib/admin-auth'
import { createModelRegistryClient } from '@/lib/model-registry-client'
import { LineageView, RegistryErrorState, RegistryHeader } from '../../components'

type LineagePageProps = {
  params: Promise<{ candidateId: string }>
}

export default async function LineagePage({ params }: LineagePageProps) {
  const admin = await requireAdminUser()
  const { candidateId } = await params
  const client = createModelRegistryClient()
  let lineage: Awaited<ReturnType<typeof client.getCandidateLineage>> | null = null
  let error: unknown = null

  try {
    lineage = await client.getCandidateLineage(candidateId)
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
