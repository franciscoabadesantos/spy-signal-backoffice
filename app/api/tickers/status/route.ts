import { NextRequest, NextResponse } from 'next/server'
import { proxyBackendJson, withAdminRoute } from '@/lib/backend-client'

export async function GET(request: NextRequest) {
  return withAdminRoute(async () => {
    const searchParams = new URLSearchParams(request.nextUrl.searchParams)
    const ticker = String(searchParams.get('ticker') ?? '').trim().toUpperCase()
    if (!ticker) {
      return NextResponse.json({ error: 'TICKER_REQUIRED', message: 'ticker is required.', statusCode: 400 }, { status: 400 })
    }

    searchParams.set('ticker', ticker)
    searchParams.set('region', String(searchParams.get('region') ?? 'us').trim().toLowerCase() || 'us')
    const exchange = String(searchParams.get('exchange') ?? '').trim().toUpperCase()
    if (exchange) searchParams.set('exchange', exchange)
    else searchParams.delete('exchange')

    return proxyBackendJson({
      path: '/tickers/status',
      method: 'GET',
      searchParams,
    })
  })
}
