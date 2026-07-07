import { NextRequest, NextResponse } from 'next/server'
import { proxyBackendJson, withAdminRoute } from '@/lib/backend-client'

const MAX_BULK = 500

export async function POST(request: NextRequest) {
  return withAdminRoute(async () => {
    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.', message: 'Invalid JSON body.', statusCode: 400 }, { status: 400 })
    }

    const rawTickers = Array.isArray(body.tickers) ? body.tickers : []
    const tickers = Array.from(
      new Set(
        rawTickers
          .map((value) => String(value ?? '').trim().toUpperCase())
          .filter((value) => value.length > 0),
      ),
    )
    if (tickers.length === 0) {
      return NextResponse.json({ error: 'TICKERS_REQUIRED', message: 'At least one ticker is required.', statusCode: 400 }, { status: 400 })
    }
    if (tickers.length > MAX_BULK) {
      return NextResponse.json(
        { error: 'TOO_MANY_TICKERS', message: `At most ${MAX_BULK} tickers per bulk request.`, statusCode: 400 },
        { status: 400 },
      )
    }

    return proxyBackendJson({
      path: '/tickers/backfill-bulk',
      method: 'POST',
      body: {
        ...body,
        tickers,
        region: String(body.region ?? 'us').trim().toLowerCase() || 'us',
        exchange: body.exchange ? String(body.exchange).trim().toUpperCase() : null,
      },
    })
  })
}
