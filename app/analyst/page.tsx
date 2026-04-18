import { requireAdminUser } from '@/lib/admin-auth'
import AnalystConsole from './ui'

export default async function AnalystPage() {
  const admin = await requireAdminUser()
  return <AnalystConsole adminEmail={admin.email} />
}
