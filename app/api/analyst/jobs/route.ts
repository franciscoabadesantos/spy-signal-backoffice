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

    const analysisType = String(body.analysis_type ?? 'ticker_signal_v1').trim()
    if (!['ticker_snapshot', 'coverage_report', 'ticker_signal_v1'].includes(analysisType)) {
      return NextResponse.json(
        {
          error: 'INVALID_ANALYSIS_TYPE',
          message: 'analysis_type must be ticker_snapshot, coverage_report, or ticker_signal_v1.',
          statusCode: 400,
        },
        { status: 400 }
      )
    }

    const ticker = String(body.ticker ?? '').trim().toUpperCase()
    if (!ticker) {
      return NextResponse.json({ error: 'TICKER_REQUIRED', message: 'ticker is required.', statusCode: 400 }, { status: 400 })
    }

    return proxyBackendJson({
      path: '/analyst/jobs',
      method: 'POST',
      body: {
        ticker,
        region: body.region ?? null,
        exchange: body.exchange ?? null,
        analysis_type: analysisType,
      },
    })
  })
}

export async function GET(request: NextRequest) {
  return withAdminRoute(async () => {
    return proxyBackendJson({
      path: '/analyst/jobs',
      method: 'GET',
      searchParams: request.nextUrl.searchParams,
    })
  })
}
