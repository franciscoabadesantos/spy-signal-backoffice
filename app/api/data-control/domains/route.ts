import { proxyBackendJson, withAdminRoute } from '@/lib/backend-client'

export async function GET() {
  return withAdminRoute(async () => proxyBackendJson({
    path: '/admin/data-control/domains',
    method: 'GET',
  }))
}
