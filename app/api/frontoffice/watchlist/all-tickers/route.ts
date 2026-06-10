import { proxyBackendJson, withAdminRoute } from '@/lib/backend-client'

export async function GET() {
  return withAdminRoute(async () => {
    return proxyBackendJson({
      path: '/site/watchlist/all-tickers',
      method: 'GET',
    })
  })
}
