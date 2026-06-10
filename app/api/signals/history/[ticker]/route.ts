import { NextRequest, NextResponse } from 'next/server'
import { proxyBackendJson, withAdminRoute } from '@/lib/backend-client'

export async function GET(request: NextRequest, context: { params: Promise<{ ticker: string }> }) {
  return withAdminRoute(async () => {
    const params = await context.params
    const ticker = params.ticker?.trim().toUpperCase()
    if (!ticker) {
      return NextResponse.json({ error: 'TICKER_REQUIRED', message: 'ticker is required.', statusCode: 400 }, { status: 400 })
    }

    return proxyBackendJson({
      path: `/signals/history/${encodeURIComponent(ticker)}`,
      method: 'GET',
      searchParams: request.nextUrl.searchParams,
    })
  })
}
