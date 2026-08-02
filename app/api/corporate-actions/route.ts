import { NextRequest } from 'next/server'
import { proxyCanonicalTickerResource, withAdminRoute } from '@/lib/backend-client'

export async function GET(request: NextRequest) {
  return withAdminRoute(async () => {
    return proxyCanonicalTickerResource({ resource: 'corporate-actions', searchParams: request.nextUrl.searchParams })
  })
}
