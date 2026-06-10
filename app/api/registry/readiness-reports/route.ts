import { NextRequest } from 'next/server'
import { proxyResearchBackendJson, withAdminRoute } from '@/lib/backend-client'

export async function GET(request: NextRequest) {
  return withAdminRoute(async () => {
    return proxyResearchBackendJson({
      path: '/analyst/registry/readiness-reports',
      method: 'GET',
      searchParams: request.nextUrl.searchParams,
    })
  })
}
