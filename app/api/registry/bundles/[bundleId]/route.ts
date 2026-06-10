import { NextRequest, NextResponse } from 'next/server'
import { proxyResearchBackendJson, withAdminRoute } from '@/lib/backend-client'

export async function GET(_: NextRequest, context: { params: Promise<{ bundleId: string }> }) {
  return withAdminRoute(async () => {
    const params = await context.params
    const bundleId = params.bundleId?.trim()
    if (!bundleId) {
      return NextResponse.json({ error: 'bundleId is required.', message: 'bundleId is required.', statusCode: 400 }, { status: 400 })
    }

    return proxyResearchBackendJson({
      path: `/analyst/registry/bundles/${encodeURIComponent(bundleId)}`,
      method: 'GET',
    })
  })
}
