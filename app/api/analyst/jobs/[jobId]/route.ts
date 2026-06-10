import { NextRequest, NextResponse } from 'next/server'
import { proxyBackendJson, withAdminRoute } from '@/lib/backend-client'

export async function GET(_: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  return withAdminRoute(async () => {
    const params = await context.params
    const jobId = params.jobId?.trim()
    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required.', message: 'jobId is required.', statusCode: 400 }, { status: 400 })
    }

    return proxyBackendJson({
      path: `/analyst/jobs/${encodeURIComponent(jobId)}`,
      method: 'GET',
    })
  })
}
