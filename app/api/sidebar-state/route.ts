import { NextResponse } from 'next/server'
import { withAdminRoute } from '@/lib/backend-client'
import { loadSidebarState } from '@/lib/sidebar-state'

export async function GET() {
  return withAdminRoute(async () => {
    return NextResponse.json(await loadSidebarState())
  })
}
