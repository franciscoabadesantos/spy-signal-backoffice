import { DataHealthPanel } from '@/components/data/DataHealthPanel'
import AdvancedRepairConsole from '@/components/data/AdvancedRepairConsole'
import { requireAdminUser } from '@/lib/admin-auth'

type PageProps = {
  searchParams?: Promise<{ source?: string; start_date?: string; end_date?: string }>
}

export default async function DataPage({ searchParams }: PageProps) {
  const admin = await requireAdminUser()
  const resolvedSearchParams = await searchParams
  const today = new Date().toISOString().slice(0, 10)
  const range = resolveDateRange(resolvedSearchParams, today)

  return (
    <div className="page-stack">
      <div className="card">
        <div className="split-row">
          <div>
            <h1>Data</h1>
          </div>
          <div className="small">Admin: {admin.email}</div>
        </div>
      </div>

      <DataHealthPanel
        startDate={range.startDate}
        endDate={range.endDate}
        source={resolvedSearchParams?.source}
        today={today}
      />

      <AdvancedRepairConsole adminEmail={admin.email} initialDomain={resolvedSearchParams?.source} />
    </div>
  )
}

function resolveDateRange(searchParams: Awaited<PageProps['searchParams']>, today: string): { startDate: string; endDate: string } {
  const endDate = validIsoDate(searchParams?.end_date) ?? today
  const startDate = validIsoDate(searchParams?.start_date) ?? shiftIsoDays(endDate, -89)
  if (startDate > endDate) {
    return { startDate: shiftIsoDays(today, -89), endDate: today }
  }
  return { startDate, endDate }
}

function validIsoDate(value?: string): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : value
}

function shiftIsoDays(dateIso: string, days: number): string {
  const date = new Date(`${dateIso}T00:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}
