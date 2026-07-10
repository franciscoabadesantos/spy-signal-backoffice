import { NextRequest, NextResponse } from 'next/server'
import { proxyBackendJson, withAdminRoute } from '@/lib/backend-client'

export async function GET(request: NextRequest) {
  return withAdminRoute(async () => {
    const searchParams = new URLSearchParams(request.nextUrl.searchParams)
    const query = String(searchParams.get('q') ?? '').trim()
    if (!query) {
      return NextResponse.json({ error: 'QUERY_REQUIRED', message: 'q is required.', statusCode: 400 }, { status: 400 })
    }

    searchParams.set('q', query)
    return proxyBackendJson({
      path: '/tickers/onboarding-preview',
      method: 'GET',
      searchParams,
    })
  })
}
