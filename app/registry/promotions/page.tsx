import Link from 'next/link'
import { requireAdminUser } from '@/lib/admin-auth'
import { createModelRegistryClient } from '@/lib/model-registry-client'
import { PromotionEventList, RegistryErrorState, RegistryHeader } from '../components'

type PromotionHistoryPageProps = {
  searchParams: Promise<{
    candidate_id?: string
    limit?: string
  }>
}

export default async function PromotionHistoryPage({ searchParams }: PromotionHistoryPageProps) {
  const admin = await requireAdminUser()
  const params = await searchParams
  const candidateId = trimParam(params.candidate_id)
  const limit = parseLimit(params.limit)
  const client = createModelRegistryClient()
  let events: Awaited<ReturnType<typeof client.listPromotionEvents>> = []
  let error: unknown = null

  try {
    events = await client.listPromotionEvents(candidateId, limit)
  } catch (requestError) {
    error = requestError
  }

  return (
    <div>
      <RegistryHeader adminEmail={admin.email} />
      <div className="card">
        <Link href="/registry" className="text-link">Back to registry</Link>
      </div>
      <form action="/registry/promotions" className="card">
        <h3>Promotion History</h3>
        <div className="row">
          <div>
            <label htmlFor="candidateId">Candidate ID</label>
            <input id="candidateId" name="candidate_id" defaultValue={candidateId ?? ''} placeholder="cand_spy_meta_v1" />
          </div>
          <div>
            <label htmlFor="limit">Limit</label>
            <input id="limit" name="limit" defaultValue={String(limit)} inputMode="numeric" />
          </div>
          <div style={{ display: 'flex', alignItems: 'end' }}>
            <button className="secondary" type="submit">Apply</button>
          </div>
        </div>
      </form>
      {error ? <RegistryErrorState error={error} /> : <div className="card"><PromotionEventList events={events} /></div>}
    </div>
  )
}

function trimParam(value?: string): string | undefined {
  const trimmed = value?.trim()
  return trimmed || undefined
}

function parseLimit(value?: string): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return 50
  return Math.min(Math.floor(parsed), 200)
}
