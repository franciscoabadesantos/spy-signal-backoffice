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
      path: '/analyst/data-ops/series/release-calendar',
      method: 'POST',
      body,
    })
  })
}
