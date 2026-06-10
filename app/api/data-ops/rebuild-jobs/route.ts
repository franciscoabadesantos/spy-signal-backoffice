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

    return proxyBackendJson({
      path: '/analyst/data-ops/rebuild-jobs',
      method: 'POST',
      body,
    })
  })
}

export async function GET(request: NextRequest) {
  return withAdminRoute(async () => {
    return proxyBackendJson({
      path: '/analyst/data-ops/rebuild-jobs',
      method: 'GET',
      searchParams: request.nextUrl.searchParams,
    })
  })
}
