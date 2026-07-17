import { proxyBackendJson, withAdminRoute } from '@/lib/backend-client'

export async function GET() {
  return withAdminRoute(async () => {
    return proxyBackendJson({
      path: '/analyst/entity-layer/summary',
      method: 'GET',
    })
  })
}
