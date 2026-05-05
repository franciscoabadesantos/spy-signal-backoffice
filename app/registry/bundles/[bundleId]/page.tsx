import Link from 'next/link'
import { requireAdminUser } from '@/lib/admin-auth'
import { createModelRegistryClient } from '@/lib/model-registry-client'
import { BundleOverview, RegistryErrorState, RegistryHeader } from '../../components'

type BundleDetailPageProps = {
  params: Promise<{ bundleId: string }>
}

export default async function BundleDetailPage({ params }: BundleDetailPageProps) {
  const admin = await requireAdminUser()
  const { bundleId } = await params
  const client = createModelRegistryClient()
  let bundle: Awaited<ReturnType<typeof client.getBundle>> | null = null
  let error: unknown = null

  try {
    bundle = await client.getBundle(bundleId)
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
      {!error && bundle ? <BundleOverview bundle={bundle} /> : null}
    </div>
  )
}
