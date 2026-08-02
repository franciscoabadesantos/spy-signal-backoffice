import { NextRequest } from 'next/server'
import { proxyCanonicalTickerResource, withAdminRoute } from '@/lib/backend-client'

export async function GET(request: NextRequest) {
  return withAdminRoute(async () => proxyCanonicalTickerResource({ resource: 'fund-distributions', searchParams: request.nextUrl.searchParams }))
}
