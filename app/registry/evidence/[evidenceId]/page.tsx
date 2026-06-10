import Link from 'next/link'
import { requireAdminUser } from '@/lib/admin-auth'
import { getEvidence } from '@/lib/registry-backend'
import { JsonSection, RegistryErrorState, RegistryHeader } from '../../components'

type EvidenceDetailPageProps = {
  params: Promise<{ evidenceId: string }>
}

export default async function EvidenceDetailPage({ params }: EvidenceDetailPageProps) {
  const admin = await requireAdminUser()
  const { evidenceId } = await params
  let evidence: Awaited<ReturnType<typeof getEvidence>> | null = null
  let error: unknown = null

  try {
    evidence = await getEvidence(evidenceId)
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
      {!error && evidence ? (
        <div className="card">
          <h3>Evidence Detail</h3>
          <div className="field-grid">
            <div>
              <label>evidence_id</label>
              <div className="field-value">{evidence.evidence_id}</div>
            </div>
            <div>
              <label>source_type</label>
              <div className="field-value">{evidence.source_type}</div>
            </div>
            <div>
              <label>source_id</label>
              <div className="field-value">{evidence.source_id}</div>
            </div>
            <div>
              <label>field</label>
              <div className="field-value">{evidence.field}</div>
            </div>
          </div>
          <JsonSection title="Payload" value={evidence.payload_json} />
        </div>
      ) : null}
    </div>
  )
}
