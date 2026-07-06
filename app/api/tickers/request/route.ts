import { NextRequest, NextResponse } from 'next/server'
import { proxyBackendJson, withAdminRoute } from '@/lib/backend-client'

export async function POST(request: NextRequest) {
  return withAdminRoute(async () => {
    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.', message: 'Invalid JSON body.', statusCode: 400 }, { status: 400 })
    }

    const ticker = String(body.ticker ?? '').trim().toUpperCase()
    if (!ticker) {
      return NextResponse.json({ error: 'TICKER_REQUIRED', message: 'ticker is required.', statusCode: 400 }, { status: 400 })
    }

    return proxyBackendJson({
      path: '/tickers/request',
      method: 'POST',
      body: {
        ...body,
        ticker,
        region: String(body.region ?? 'us').trim().toLowerCase() || 'us',
        exchange: body.exchange ? String(body.exchange).trim().toUpperCase() : null,
      },
    })
  })
}
