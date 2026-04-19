import { requireAdminUser } from '@/lib/admin-auth'
import DataOpsConsole from './ui'

export default async function DataOpsPage() {
  const admin = await requireAdminUser()
  return <DataOpsConsole adminEmail={admin.email} />
}
