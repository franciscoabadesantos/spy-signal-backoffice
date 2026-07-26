import { proxyBackendJson, withAdminRoute } from '@/lib/backend-client'

export async function GET() {
  return withAdminRoute(async () => proxyBackendJson({
    path: '/analyst/data-control/domains',
    method: 'GET',
  }))
}
