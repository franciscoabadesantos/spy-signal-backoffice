import { NextRequest, NextResponse } from 'next/server'
import { proxyResearchBackendJson, withAdminRoute } from '@/lib/backend-client'

export async function GET(request: NextRequest) {
  return withAdminRoute(async () => {
    return proxyResearchBackendJson({
      path: '/analyst/research/batches',
      method: 'GET',
      searchParams: request.nextUrl.searchParams,
    })
  })
}

export async function POST(request: NextRequest) {
  return withAdminRoute(async () => {
    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.', message: 'Invalid JSON body.', statusCode: 400 }, { status: 400 })
    }

    return proxyResearchBackendJson({
      path: '/analyst/research/batches',
      method: 'POST',
      body,
    })
  })
}
